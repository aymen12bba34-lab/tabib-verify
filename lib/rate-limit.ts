/**
 * Phase 3D — Simple in-memory rate limiter.
 * No Redis dependency — works in serverless (per-instance).
 * For Vercel, each cold start gets a fresh store, which is fine for MVP.
 *
 * Usage:
 *   import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
 *
 *   if (!rateLimit(`otp:${sessionId}`, 5, 60_000)) {
 *     return rateLimitResponse();
 *   }
 */

const store = new Map<string, { count: number; reset: number }>();

// Periodic cleanup to prevent memory leaks (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (now > entry.reset) store.delete(key);
  });
}, 5 * 60 * 1000);

/**
 * Check if a request is within rate limits.
 * @param key   Unique key (e.g. "otp:sess_abc123" or "login:192.168.1.1")
 * @param max   Maximum requests allowed in the window
 * @param windowMs  Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count++;
  return true;
}

/**
 * Get remaining requests for a key.
 */
export function getRateLimitInfo(key: string, max: number): {
  remaining: number;
  resetAt: number;
} {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.reset) {
    return { remaining: max, resetAt: 0 };
  }
  return {
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.reset,
  };
}

/**
 * Standard 429 JSON response for rate-limited requests.
 */
export function rateLimitResponse() {
  const { NextResponse } = require('next/server');
  return NextResponse.json(
    {
      error: 'RATE_LIMITED',
      message: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
    },
    {
      status: 429,
      headers: { 'Retry-After': '60' },
    }
  );
}
