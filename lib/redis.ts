/**
 * Phase 4B — Redis client with Upstash (production) + in-memory fallback (local dev).
 *
 * In production (Vercel): uses Upstash REST API — serverless-native, no connection pool.
 * In local dev: if UPSTASH env vars are missing, falls back to an in-memory Map
 * so you can test the full flow without any external Redis instance.
 *
 * NOTE: The globalThis trick prevents Next.js hot-reload from wiping the store.
 */

import { Redis } from '@upstash/redis';

// ─── In-memory fallback for local dev ──────────────────────────────────
class MemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async set(key: string, value: string, opts?: { ex?: number }): Promise<string> {
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

// ─── Survive Next.js hot-reloads in dev ────────────────────────────────
const globalForRedis = globalThis as unknown as {
  __redisClient?: Redis | MemoryRedis;
};

function createClient(): Redis | MemoryRedis {
  const hasUpstash =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasUpstash) {
    return new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  console.warn('[Redis] ⚠ UPSTASH env vars missing — using in-memory fallback (dev only)');
  return new MemoryRedis();
}

const redis = globalForRedis.__redisClient ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__redisClient = redis;
}

export default redis;
