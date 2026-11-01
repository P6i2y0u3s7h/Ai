interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Checks and increments rate limit for an identifier (e.g. client IP or userId)
 * Defaults to 30 requests per 10 minutes (tailored for Groq free-tier 30 RPM limit)
 * Uses lazy cleanup without top-level timers to ensure compatibility with serverless environments.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 10 * 60 * 1000
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();

  // Lazy cleanup of expired entries (prevents event loop hanging in serverless functions)
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
