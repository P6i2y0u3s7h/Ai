import type { IncomingMessage, ServerResponse } from 'http';
import { verifyAuthToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { buildSystemPrompt } from './_lib/prompts';
import {
  extractRateLimitHeaders,
  parseResetStringToSeconds,
  categorizeGroqError,
  maskApiKey,
  isDuplicateInFlight,
  registerInFlight,
  clearInFlight
} from './_lib/groq';



interface RequestWithBody extends IncomingMessage {
  body?: any;
}

export default async function handler(req: RequestWithBody, res: ServerResponse) {
  console.log('[CHAT] Request received');
  // 1. CORS Headers
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST.' }));
    return;
  }

  let inFlightKey: string | null = null;
  let connectionTimeoutId: NodeJS.Timeout | null = null;

  try {
    // 2. Client IP Rate Limiting (30 requests / 10 min window)
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || (req as any).connection?.remoteAddress || 'unknown';
    const rateLimitResult = checkRateLimit(clientIp, 30, 10 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Retry-After', String(Math.ceil(rateLimitResult.resetInMs / 1000)));
      res.end(JSON.stringify({
        error: 'Rate Limit Exceeded: Too many requests sent recently. Please wait a moment before asking another question.',
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        retryAfter: Math.ceil(rateLimitResult.resetInMs / 1000)
      }));
      return;
    }

    // 3. Authenticate User with Firebase Bearer Token
    const authHeader = req.headers.authorization;
    const user = await verifyAuthToken(authHeader);
    if (!user) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Unauthorized: Missing or invalid Firebase Authorization Bearer header.',
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401
      }));
      return;
    }
    console.log('[CHAT] Authentication checked');

    // 4. Parse JSON body (handles pre-parsed object or incoming raw stream)
    let body = req.body;
    if (!body && typeof (req as any)[Symbol.asyncIterator] === 'function' && !req.readableEnded) {
      try {
        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const rawText = Buffer.concat(buffers).toString('utf8');
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        body = {};
      }
    } else if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Malformed JSON string payload.', code: 'VALIDATION_ERROR', statusCode: 400 }));
        return;
      }
    }
    body = body || {};

    const { messages, studyMode = 'general', options = {} } = body;

    // Validate request structure
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Validation Error: "messages" must be a non-empty array.', code: 'VALIDATION_ERROR', statusCode: 400 }));
      return;
    }

    // Free-tier optimization: Cap history context to last 6 messages (3 turns) to avoid exceeding TPM limits
    const cappedMessages = messages.slice(-6);
    const sanitizedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const m of cappedMessages) {
      if (!m.role || !['user', 'assistant', 'system'].includes(m.role)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Validation Error: Invalid role "${m.role}".`, code: 'VALIDATION_ERROR', statusCode: 400 }));
        return;
      }
      if (typeof m.content !== 'string' || !m.content.trim()) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Validation Error: Message content must be a non-empty string.', code: 'VALIDATION_ERROR', statusCode: 400 }));
        return;
      }
      // Enforce 8,000 character limit per message for free-tier token protection
      if (m.content.length > 8000) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Validation Error: Message content exceeds 8,000 character limit for the free tier.', code: 'VALIDATION_ERROR', statusCode: 400 }));
        return;
      }

      // Downgrade client-supplied 'system' role to 'user' to protect tutor persona
      const safeRole = m.role === 'system' ? 'user' : m.role;

      // Optimize prior assistant responses to protect TPM quota
      const optimizedContent = (safeRole === 'assistant' && m.content.length > 1500)
        ? m.content.slice(0, 1500) + '... [earlier response shortened for token limits]'
        : m.content;

      sanitizedMessages.push({ role: safeRole, content: optimizedContent });
    }

    console.log('[CHAT] Request body validated');

    // 5. In-flight duplicate request detection
    const latestPrompt = sanitizedMessages[sanitizedMessages.length - 1]?.content.trim().slice(0, 100) || '';
    inFlightKey = `${user.uid}:${latestPrompt.toLowerCase()}`;
    if (isDuplicateInFlight(inFlightKey)) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'A request with this prompt is currently processing. Please wait for it to complete.',
        code: 'DUPLICATE_REQUEST',
        statusCode: 429
      }));
      return;
    }

    // 6. Verify and Load Groq API Key on Backend
    const apiKey = (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('your_'))
      ? process.env.GROQ_API_KEY.trim()
      : '';
    const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Groq API Key is missing on the server. Please configure GROQ_API_KEY in your Vercel project environment variables.',
        code: 'CONFIGURATION_ERROR',
        statusCode: 500
      }));
      return;
    }

    console.log(`[Groq Backend] Model: ${model}, Key: ${maskApiKey(apiKey)}, Prompt: "${latestPrompt.slice(0, 40)}..."`);

    // 7. Build trusted server-side system prompt
    const systemPrompt = buildSystemPrompt(studyMode, options);
    const formattedInput = [
      { role: 'system', content: systemPrompt },
      ...sanitizedMessages
    ];

    const abortController = new AbortController();
    registerInFlight(inFlightKey, abortController);

    // Cancel upstream generation if student disconnects
    res.on('close', () => {
      if (!res.writableEnded && !res.writableFinished) {
        abortController.abort();
      }
    });

    // 30-Second connection timeout to Groq upstream
    connectionTimeoutId = setTimeout(() => {
      abortController.abort(new Error('Groq connection timeout after 30 seconds'));
    }, 30000);

    const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    const requestPayload = {
      model,
      messages: formattedInput,
      stream: true,
      temperature: 0.6,
      max_tokens: 1024
    };

    // 8. Dispatch request to Groq API
    let upstreamResp: Response;
    try {
      console.log('[CHAT] Groq API request started');
      upstreamResp = await fetch(groqEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestPayload),
        signal: abortController.signal
      });
      console.log('[CHAT] Groq response received');
    } catch (fetchErr: any) {
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
      if (fetchErr.name === 'AbortError') {
        res.statusCode = 408;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Groq API request timed out after 30 seconds. Please retry.',
          code: 'REQUEST_TIMEOUT',
          statusCode: 408
        }));
        return;
      }
      throw fetchErr;
    }

    if (connectionTimeoutId) {
      clearTimeout(connectionTimeoutId);
      connectionTimeoutId = null;
    }

    // 9. Read and Monitor Rate Limit Response Headers
    const rlMetrics = extractRateLimitHeaders(upstreamResp.headers);
    console.log(`[Groq Rate Limits] HTTP ${upstreamResp.status} | TPM Remaining: ${rlMetrics.remainingTokens}/${rlMetrics.limitTokens} | RPM Remaining: ${rlMetrics.remainingRequests}/${rlMetrics.limitRequests} | Reset Tokens: ${rlMetrics.resetTokens}`);

    // Forward rate limit headers to client
    if (rlMetrics.limitRequests) res.setHeader('x-ratelimit-limit-requests', rlMetrics.limitRequests);
    if (rlMetrics.remainingRequests) res.setHeader('x-ratelimit-remaining-requests', rlMetrics.remainingRequests);
    if (rlMetrics.limitTokens) res.setHeader('x-ratelimit-limit-tokens', rlMetrics.limitTokens);
    if (rlMetrics.remainingTokens) res.setHeader('x-ratelimit-remaining-tokens', rlMetrics.remainingTokens);
    if (rlMetrics.resetRequests) res.setHeader('x-ratelimit-reset-requests', rlMetrics.resetRequests);
    if (rlMetrics.resetTokens) res.setHeader('x-ratelimit-reset-tokens', rlMetrics.resetTokens);

    // 10. Handle HTTP 429 and Upstream Errors without converting to generic 500
    if (!upstreamResp.ok) {
      const errorText = await upstreamResp.text();
      let upstreamErrMsg = '';
      try {
        const errorJson = JSON.parse(errorText);
        upstreamErrMsg = (typeof errorJson.error === 'string' ? errorJson.error : errorJson.error?.message) || errorJson.message || errorText;
      } catch {
        upstreamErrMsg = errorText;
      }

      const retryAfterSecs = rlMetrics.retryAfter
        ? parseInt(rlMetrics.retryAfter, 10)
        : parseResetStringToSeconds(rlMetrics.resetTokens);

      const categorized = categorizeGroqError(upstreamResp.status, upstreamErrMsg, model, retryAfterSecs);

      // Return proper HTTP status code (429, 401, 400, 502) - NEVER generic 500
      res.statusCode = categorized.statusCode;
      res.setHeader('Content-Type', 'application/json');
      if (categorized.statusCode === 429) {
        res.setHeader('Retry-After', String(retryAfterSecs));
      }

      res.end(JSON.stringify({
        error: categorized.message,
        code: categorized.code,
        statusCode: categorized.statusCode,
        retryAfter: categorized.retryAfterSeconds,
        rateLimits: rlMetrics
      }));
      return;
    }

    // 11. Upstream is 200 OK -> Initialize SSE streaming headers
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    (res as any).flushHeaders?.();

    const reader = upstreamResp.body?.getReader();
    if (!reader) {
      throw new Error('Failed to obtain stream reader from Groq response.');
    }

    const decoder = new TextDecoder();
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        if (trimmed === 'data: [DONE]') continue;

        try {
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          const data = JSON.parse(jsonStr);
          const delta = data.choices?.[0]?.delta?.content || '';

          if (delta) {
            accumulatedText += delta;
            res.write(`data: ${JSON.stringify({ delta, fullText: accumulatedText })}\n\n`);
          }
        } catch {
          // Skip non-json lines
        }
      }
    }

    console.log('[CHAT] Response returned to frontend');
    res.write(`data: ${JSON.stringify({ done: true, fullText: accumulatedText })}\n\n`);
    res.end();
  } catch (err: any) {
    if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
    if (err.name === 'AbortError') {
      res.end();
    } else {
      console.error('[API /api/chat error]:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: `Server error: ${err.message || 'Failed to process AI chat request.'}`,
          code: 'SERVER_ERROR',
          statusCode: 500
        }));
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message || 'Stream connection error.', code: 'STREAM_ERROR' })}\n\n`);
        res.end();
      }
    }
  } finally {
    if (connectionTimeoutId) {
      clearTimeout(connectionTimeoutId);
    }
    if (inFlightKey) {
      clearInFlight(inFlightKey);
    }
  }
}
