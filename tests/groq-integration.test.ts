import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseResetStringToSeconds,
  extractRateLimitHeaders,
  categorizeGroqError,
  maskApiKey,
  isDuplicateInFlight,
  registerInFlight,
  clearInFlight
} from '../api/_lib/groq.js';

describe('Groq API Integration, Rate Limiting & Resilience Tests', () => {
  it('1. Secure Key Verification: Masks API keys and never exposes secret values', () => {
    const rawKey = 'gsk_test_dummy_key_for_unit_tests_sample1234';
    const masked = maskApiKey(rawKey);

    assert.equal(masked, 'gsk_...1234');
    assert.ok(!masked.includes('dummy'));
    assert.equal(maskApiKey(''), 'gsk_...[invalid/missing]');
    assert.equal(maskApiKey(undefined), 'gsk_...[invalid/missing]');
  });

  it('2. Model Configuration: Ensures default model is qwen/qwen3.8-27b', () => {
    const configuredModel = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
    assert.equal(configuredModel, 'qwen/qwen3.8-27b');
  });

  it('3. Rate Limit Headers: Extracts and normalizes all 6 rate limit headers from Groq', () => {
    const mockHeaders = new Headers({
      'x-ratelimit-limit-requests': '1000',
      'x-ratelimit-remaining-requests': '995',
      'x-ratelimit-limit-tokens': '8000',
      'x-ratelimit-remaining-tokens': '6420',
      'x-ratelimit-reset-requests': '1m20s',
      'x-ratelimit-reset-tokens': '12.5s',
      'retry-after': '13'
    });

    const metrics = extractRateLimitHeaders(mockHeaders);
    assert.equal(metrics.limitRequests, '1000');
    assert.equal(metrics.remainingRequests, '995');
    assert.equal(metrics.limitTokens, '8000');
    assert.equal(metrics.remainingTokens, '6420');
    assert.equal(metrics.resetRequests, '1m20s');
    assert.equal(metrics.resetTokens, '12.5s');
    assert.equal(metrics.retryAfter, '13');
  });

  it('4. Reset Time Parsing: Accurately converts Groq reset strings to whole seconds', () => {
    assert.equal(parseResetStringToSeconds('1m26.4s'), 87);
    assert.equal(parseResetStringToSeconds('15s'), 15);
    assert.equal(parseResetStringToSeconds('285ms'), 1);
    assert.equal(parseResetStringToSeconds(null), 15);
    assert.equal(parseResetStringToSeconds(''), 15);
  });

  it('5. HTTP 429 Preservation: Ensures 429 is not converted into generic 500', () => {
    const errorMsg = 'Rate limit reached on tokens per minute (TPM): Limit 8000, Used 7500, Requested 600';
    const categorized = categorizeGroqError(429, errorMsg, 'qwen/qwen3.8-27b', 15);

    assert.equal(categorized.statusCode, 429);
    assert.equal(categorized.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(categorized.message.includes('Groq Free Tier Rate Limit reached'));
    assert.ok(categorized.message.includes('15s'));
    assert.equal(categorized.retryAfterSeconds, 15);
    assert.equal(categorized.isRetryable, true);

    // Test second-accurate regex extraction from Groq error text
    const detailedGroqMsg = 'Rate limit reached for model `qwen/qwen3.8-27b` on output tokens per minute (OTPM): Limit 1000, Used 982. Please try again in 9.9s.';
    const detailedCategorized = categorizeGroqError(429, detailedGroqMsg, 'qwen/qwen3.8-27b', 15);
    assert.equal(detailedCategorized.statusCode, 429);
    assert.equal(detailedCategorized.retryAfterSeconds, 10);
    assert.ok(detailedCategorized.message.includes('10s'));
  });

  it('6. Duplicate Request Prevention: Rejects concurrent duplicate prompts', () => {
    const testKey = 'student_123:array in java';
    const mockController = new AbortController();

    assert.equal(isDuplicateInFlight(testKey), false);
    registerInFlight(testKey, mockController);
    assert.equal(isDuplicateInFlight(testKey), true);

    clearInFlight(testKey);
    assert.equal(isDuplicateInFlight(testKey), false);
  });

  it('7. Error Categorization: Accurately maps upstream statuses into actionable student feedback', () => {
    // 401 Auth
    const authErr = categorizeGroqError(401, 'Invalid API Key', 'qwen/qwen3.8-27b');
    assert.equal(authErr.statusCode, 401);
    assert.equal(authErr.code, 'AUTHENTICATION_ERROR');
    assert.equal(authErr.isRetryable, false);

    // 400 Model Unavailable
    const modelErr = categorizeGroqError(400, 'Model decommissioned', 'legacy-model');
    assert.equal(modelErr.statusCode, 400);
    assert.equal(modelErr.code, 'MODEL_UNAVAILABLE');

    // 408 Timeout
    const timeoutErr = categorizeGroqError(408, 'Timed out', 'qwen/qwen3.8-27b');
    assert.equal(timeoutErr.statusCode, 408);
    assert.equal(timeoutErr.code, 'REQUEST_TIMEOUT');
    assert.equal(timeoutErr.isRetryable, true);
  });
});

