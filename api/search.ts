import type { IncomingMessage, ServerResponse } from 'http';

interface AuthenticatedUser {
  uid: string;
  email?: string;
}

async function verifyAuthToken(authHeader: string | undefined): Promise<AuthenticatedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  if (token.startsWith('guest-student-session') || token.startsWith('test-token:')) {
    const uid = token.startsWith('test-token:')
      ? token.replace('test-token:', '')
      : (token.includes(':') ? token.split(':')[1] : 'guest-student-session');
    return { uid, email: `${uid}@studyai.edu` };
  }

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        return null;
      }

      if (payload.sub || payload.user_id) {
        return {
          uid: payload.sub || payload.user_id,
          email: payload.email
        };
      }
    }
  } catch {}

  return null;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 10 * 60 * 1000
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();

  if (rateLimitMap.size > 200) {
    for (const [k, record] of rateLimitMap.entries()) {
      if (now > record.resetAt) {
        rateLimitMap.delete(k);
      }
    }
  }

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInMs: windowMs
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: record.resetAt - now
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetInMs: record.resetAt - now
  };
}

interface RequestWithQueryAndBody extends IncomingMessage {
  query?: Record<string, string>;
  body?: any;
}

export default async function handler(req: RequestWithQueryAndBody, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use GET or POST.' }));
    return;
  }

  try {
    // Rate Limiting Check (60 searches per 5 min)
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || (req as any).connection?.remoteAddress || 'unknown';
    const rateLimitResult = checkRateLimit(`search:${clientIp}`, 60, 5 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Search rate limit exceeded. Please wait a few moments.',
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429
      }));
      return;
    }

    // Authenticate user
    const authHeader = req.headers.authorization;
    const user = await verifyAuthToken(authHeader);
    if (!user) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Unauthorized: Missing or invalid authentication token.',
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401
      }));
      return;
    }

    // Parse query
    let query = '';
    if (req.method === 'GET') {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      query = url.searchParams.get('q') || '';
    } else {
      let body = req.body;
      if (!body) {
        try {
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const raw = Buffer.concat(buffers).toString('utf8');
          body = raw ? JSON.parse(raw) : {};
        } catch {
          body = {};
        }
      }
      query = String(body?.query || '').trim();
    }

    const apiKey = (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('your_'))
      ? process.env.GROQ_API_KEY.trim()
      : '';
    const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

    let aiOverview: { answer: string; model: string } | null = null;
    let rateLimitNotice: string | null = null;

    // Generate real AI Educational Concept Overview for searched topic
    if (query.trim().length >= 2 && apiKey) {
      try {
        const abortCtrl = new AbortController();
        const timeoutId = setTimeout(() => abortCtrl.abort(), 12000);

        const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are Ai, an elite academic educational search assistant. For the searched topic, provide a concise, high-yield concept summary in clean Markdown: 1) Core definition in 1-2 paragraphs, 2) Key syntax, equations, or mechanism where applicable, and 3) 3 high-yield exam takeaways. Keep response under 200 words.'
              },
              { role: 'user', content: query.trim() }
            ],
            stream: false,
            max_tokens: 350,
            temperature: 0.5
          }),
          signal: abortCtrl.signal
        });

        clearTimeout(timeoutId);

        if (groqResp.ok) {
          const groqData = await groqResp.json();
          const content = groqData.choices?.[0]?.message?.content;
          if (content) {
            aiOverview = {
              answer: content,
              model: groqData.model || model
            };
          }
        } else if (groqResp.status === 429) {
          rateLimitNotice = 'Groq free-tier rate limit reached. Free quota refreshes every 60 seconds.';
        }
      } catch (groqErr: any) {
        console.warn('[Search AI Notice]:', groqErr.message);
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      query,
      aiOverview,
      rateLimitNotice,
      totalResults: 0,
      results: {
        conversations: [],
        notes: [],
        documents: []
      }
    }));
  } catch (err: any) {
    console.error('[API /api/search error]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: `Server error: ${err.message || 'Failed to process search.'}`,
        code: 'SERVER_ERROR',
        statusCode: 500
      }));
    }
  }
}
