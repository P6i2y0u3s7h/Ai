/**
 * Shared Groq API Rate Limiting, Metrics, Error Categorization, and Request Guards
 */

export interface GroqRateLimitMetrics {
  limitRequests: string | null;
  remainingRequests: string | null;
  limitTokens: string | null;
  remainingTokens: string | null;
  resetRequests: string | null;
  resetTokens: string | null;
  retryAfter: string | null;
}

export interface CategorizedError {
  code:
    | 'RATE_LIMIT_EXCEEDED'
    | 'AUTHENTICATION_ERROR'
    | 'MODEL_UNAVAILABLE'
    | 'CONTEXT_LENGTH_EXCEEDED'
    | 'PROVIDER_UNAVAILABLE'
    | 'REQUEST_TIMEOUT'
    | 'DUPLICATE_REQUEST'
    | 'UNKNOWN_ERROR';
  message: string;
  statusCode: number;
  retryAfterSeconds?: number;
  isRetryable: boolean;
}

/**
 * Parses Groq reset duration strings such as "1m26.4s", "15s", "285ms" into whole seconds.
 */
export function parseResetStringToSeconds(resetStr?: string | null): number {
  if (!resetStr) return 15;
  let totalSeconds = 0;

  // 1. Milliseconds (e.g. "285ms")
  const msMatch = resetStr.match(/(\d+(?:\.\d+)?)ms/);
  if (msMatch) {
    totalSeconds += Math.ceil(parseFloat(msMatch[1]) / 1000);
  }

  // 2. Minutes (e.g. "1m", not followed by "s")
  const mMatch = resetStr.match(/(\d+(?:\.\d+)?)m(?!s)/);
  if (mMatch) {
    totalSeconds += parseFloat(mMatch[1]) * 60;
  }

  // 3. Seconds (e.g. "26.4s", excluding "ms")
  const withoutMs = resetStr.replace(/\d+(?:\.\d+)?ms/, '');
  const sMatch = withoutMs.match(/(\d+(?:\.\d+)?)s/);
  if (sMatch) {
    totalSeconds += parseFloat(sMatch[1]);
  }

  return totalSeconds > 0 ? Math.ceil(totalSeconds) : 15;
}

/**
 * Extracts standard Groq rate limit headers from a Fetch Response.
 */
export function extractRateLimitHeaders(headers: Headers): GroqRateLimitMetrics {
  return {
    limitRequests: headers.get('x-ratelimit-limit-requests'),
    remainingRequests: headers.get('x-ratelimit-remaining-requests'),
    limitTokens: headers.get('x-ratelimit-limit-tokens'),
    remainingTokens: headers.get('x-ratelimit-remaining-tokens'),
    resetRequests: headers.get('x-ratelimit-reset-requests'),
    resetTokens: headers.get('x-ratelimit-reset-tokens'),
    retryAfter: headers.get('retry-after')
  };
}

/**
 * Masks sensitive API keys for safe observability without exposing credentials.
 */
export function maskApiKey(key?: string): string {
  if (!key || key.length < 8) return 'gsk_...[invalid/missing]';
  return `gsk_...${key.slice(-4)}`;
}

/**
 * In-flight duplicate request registry to prevent double-click / rapid resubmission token burn.
 */
const inFlightRequests = new Map<string, { timestamp: number; controller: AbortController }>();

export function isDuplicateInFlight(key: string, maxAgeMs: number = 30000): boolean {
  const existing = inFlightRequests.get(key);
  if (existing) {
    if (Date.now() - existing.timestamp < maxAgeMs) {
      return true;
    }
    inFlightRequests.delete(key);
  }
  return false;
}

export function registerInFlight(key: string, controller: AbortController): void {
  inFlightRequests.set(key, { timestamp: Date.now(), controller });
}

export function clearInFlight(key: string): void {
  inFlightRequests.delete(key);
}

/**
 * Categorizes upstream Groq status and error message into user-safe educational explanations.
 */
export function categorizeGroqError(
  status: number,
  errorMessage: string,
  model: string,
  retryAfterSecs: number = 15
): CategorizedError {
  const lowerMsg = (errorMessage || '').toLowerCase();

  if (status === 429 || lowerMsg.includes('rate limit') || lowerMsg.includes('tpm') || lowerMsg.includes('rpm') || lowerMsg.includes('otpm')) {
    // Extract exact retry seconds if reported in error message (e.g. "Please try again in 9.9s")
    let computedRetrySecs = retryAfterSecs;
    const tryAgainMatch = errorMessage.match(/(?:try again in|retry after)\s*(\d+(?:\.\d+)?)\s*s/i);
    if (tryAgainMatch) {
      computedRetrySecs = Math.max(1, Math.ceil(parseFloat(tryAgainMatch[1])));
    }

    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Groq Free Tier Rate Limit reached for model "${model}". Free tier tokens refresh every minute. Please wait ${computedRetrySecs}s before sending another message.`,
      statusCode: 429,
      retryAfterSeconds: computedRetrySecs,
      isRetryable: true
    };
  }

  if (status === 401 || lowerMsg.includes('api key') || lowerMsg.includes('authentication')) {
    return {
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid Groq API Key. Please verify your GROQ_API_KEY in your server configuration.',
      statusCode: 401,
      isRetryable: false
    };
  }

  if (
    (status === 400 || status === 404) &&
    (lowerMsg.includes('model') || lowerMsg.includes('not found') || lowerMsg.includes('decommissioned'))
  ) {
    return {
      code: 'MODEL_UNAVAILABLE',
      message: `Model "${model}" is unavailable or deprecated. Recommended model: qwen/qwen3.8-27b.`,
      statusCode: status,
      isRetryable: true
    };
  }

  if (status === 413 || (status === 400 && lowerMsg.includes('context'))) {
    return {
      code: 'CONTEXT_LENGTH_EXCEEDED',
      message: 'Conversation context exceeded the token limit. Please start a new chat.',
      statusCode: 400,
      isRetryable: false
    };
  }

  if (status === 502 || status === 503 || status === 504) {
    return {
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Groq API is temporarily unavailable or experiencing high load. Please try again shortly.',
      statusCode: status,
      isRetryable: true
    };
  }

  if (status === 408) {
    return {
      code: 'REQUEST_TIMEOUT',
      message: 'Groq API request timed out after 30 seconds. Please retry your question.',
      statusCode: 408,
      isRetryable: true
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: errorMessage || 'An unexpected error occurred while communicating with the AI service.',
    statusCode: status || 500,
    isRetryable: true
  };
}
