import { auth } from '../lib/firebase';
import { apiUrl } from '../utils/apiConfig';
import { StudyMode, StudyOptions } from '../types/chat';

export interface StreamChatOptions {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  studyMode?: StudyMode;
  options?: StudyOptions;
  signal?: AbortSignal;
  onChunk: (delta: string, fullText: string) => void;
  onRetry?: (attempt: number, delayMs: number, reason: string) => void;
}

export class AiApiError extends Error {
  statusCode?: number;
  isRetryable: boolean;
  retryAfter?: number;
  rateLimits?: Record<string, string | null>;

  constructor(
    message: string,
    statusCode?: number,
    isRetryable: boolean = true,
    retryAfter?: number,
    rateLimits?: Record<string, string | null>
  ) {
    super(message);
    this.name = 'AiApiError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
    this.retryAfter = retryAfter;
    this.rateLimits = rateLimits;
  }
}

// Backward-compatibility alias
export const XaiApiError = AiApiError;

/**
 * Safely obtain current Firebase ID token or guest fallback
 */
export async function getAuthToken(): Promise<string> {
  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken(true);
    }
  } catch (err) {
    console.warn('Could not refresh Firebase ID token, using guest session token:', err);
  }
  return 'guest-student-session';
}

export interface BackoffOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, delayMs: number, reason: string) => void;
}

/**
 * Helper to fetch with controlled exponential backoff.
 * Supports up to 3 retries for HTTP 429 rate limits and 502/503/504 server errors.
 * Never retries immediately on 429 — respects Retry-After headers and includes jitter.
 */
async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  options: BackoffOptions = {}
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 3;
  let attempt = 0;

  while (true) {
    try {
      const resp = await fetch(url, init);

      // Handle HTTP 429 Rate Limit with Controlled Backoff (max 3 retries, NEVER immediate)
      if (resp.status === 429 && attempt < maxRetries) {
        attempt++;

        // Determine cooldown delay from Retry-After header or exponential backoff
        const retryAfterHeader = resp.headers.get('Retry-After');
        let delayMs = 0;
        if (retryAfterHeader) {
          const parsedSecs = parseFloat(retryAfterHeader);
          if (!isNaN(parsedSecs) && parsedSecs > 0) {
            delayMs = Math.ceil(parsedSecs * 1000);
          }
        }

        // If no explicit header, use exponential backoff: 2s -> 4s -> 8s (+ jitter)
        if (!delayMs) {
          delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
        }

        // Add small jitter (100–350ms) to avoid simultaneous synchronized retries
        delayMs += Math.floor(Math.random() * 250);

        if (options.onRetry) {
          options.onRetry(attempt, delayMs, 'Rate limit reached on Groq free tier');
        }

        // Wait before retrying (respect user abort signal)
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          if (init.signal) {
            if (init.signal.aborted) {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
              return;
            }
            init.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true }
            );
          }
        });

        continue;
      }

      // Transient server errors (502, 503, 504)
      if ((resp.status === 502 || resp.status === 503 || resp.status === 504) && attempt < maxRetries) {
        attempt++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 4000);
        if (options.onRetry) {
          options.onRetry(attempt, backoffMs, 'Temporary server unavailability');
        }
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      return resp;
    } catch (err: any) {
      if (err.name === 'AbortError' || attempt >= maxRetries) {
        throw err;
      }
      attempt++;
      const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 4000);
      if (options.onRetry) {
        options.onRetry(attempt, backoffMs, 'Network connection retry');
      }
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
}

/**
 * Client service to stream chat responses securely from the backend AI endpoint (Groq / Free Tier)
 */
export async function streamAiResponse({
  messages,
  studyMode = 'general',
  options,
  signal,
  onChunk,
  onRetry
}: StreamChatOptions): Promise<string> {
  // 1. Obtain Firebase ID token (or guest token)
  const idToken = await getAuthToken();

  // 2. Dispatch request to secure server endpoint (/api/chat) with controlled backoff
  let response: Response;
  try {
    response = await fetchWithBackoff(
      apiUrl('/api/chat'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          messages,
          studyMode,
          options
        }),
        signal
      },
      { maxRetries: 3, onRetry }
    );
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    throw new AiApiError(
      'Network connection failed. Unable to reach StudyAI server. Please check your connection or restart the dev server.',
      0,
      true
    );
  }

  // 3. Handle non-SSE error responses safely consuming response body only once
  if (!response.ok) {
    const responseText = await response.text();
    let data: any;

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: responseText || 'Invalid server response' };
    }

    const errorDetail = data.error || data.message || responseText || '';

    if (response.status === 401) {
      throw new AiApiError(
        errorDetail || 'Authentication failed: Please sign in again to continue your study session.',
        401,
        false
      );
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      let retrySecs = data.retryAfter || (retryAfterHeader ? parseInt(retryAfterHeader, 10) : 15);
      if (isNaN(retrySecs) || retrySecs <= 0) retrySecs = 15;

      throw new AiApiError(
        data.error || `Groq Free Tier Rate Limit reached for model "qwen/qwen3.8-27b". Free tier tokens refresh every minute. Please wait ${retrySecs}s before sending another message.`,
        429,
        true,
        retrySecs,
        data.rateLimits
      );
    }

    if (response.status === 408) {
      throw new AiApiError(
        data.error || 'Groq API request timed out after 30 seconds. Please retry.',
        408,
        true
      );
    }

    if (response.status === 500) {
      if (errorDetail.includes('ECONNREFUSED') || errorDetail.includes('<html') || errorDetail.includes('<pre>')) {
        throw new AiApiError(
          'Backend server is currently offline or unreachable on port 5000. Please start it using "npm run dev" or "npm run dev:server".',
          500,
          true
        );
      }
      if (errorDetail.includes('API Key is missing')) {
        throw new AiApiError(
          'Server configuration notice: The AI API Key (GROQ_API_KEY) has not been set in server/.env.',
          500,
          false
        );
      }
      throw new AiApiError(
        data.error || 'The AI backend encountered an error. Please wait a moment and retry.',
        500,
        true
      );
    }

    throw new AiApiError(
      errorDetail || `Server error (${response.status}): Failed to generate AI response.`,
      response.status,
      true
    );
  }

  // 4. Parse incoming Server-Sent Events (SSE) stream
  const reader = response.body?.getReader();
  if (!reader) {
    throw new AiApiError('Response stream reader is unavailable in this browser.', 0, false);
  }

  const decoder = new TextDecoder();
  let accumulatedText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.replace(/^data:\s*/, '');
        if (jsonStr === '[DONE]') continue;

        try {
          const eventData = JSON.parse(jsonStr);

          // Server forwarded upstream AI error
          if (eventData.error) {
            throw new AiApiError(eventData.error, 502, true);
          }

          if (eventData.delta) {
            accumulatedText += eventData.delta;
            onChunk(eventData.delta, accumulatedText);
          } else if (eventData.fullText && !accumulatedText) {
            accumulatedText = eventData.fullText;
            onChunk('', accumulatedText);
          }
        } catch (e: any) {
          if (e instanceof AiApiError) throw e;
          // Ignore JSON parse error on non-payload data lines
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return accumulatedText;
    }
    throw err;
  }

  return accumulatedText;
}

// Backward compatibility alias
export const streamGrokResponse = streamAiResponse;

