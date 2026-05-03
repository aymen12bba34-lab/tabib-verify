import { Pool } from 'pg';

// Lazy-initialized pool — only created on first query, not at module import.
// This avoids throwing during Vercel's build phase when DATABASE_URL isn't
// available as a build-time env var (it's a runtime secret).
const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not configured.');
  }

  // Render and Supabase both require SSL; skip SSL for local Docker.
  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');

  return new Pool({
    connectionString,
    // Keep pool small for Vercel serverless (free DB tiers: ~97 max conns)
    max: process.env.NODE_ENV === 'production' ? 3 : 10,
    idleTimeoutMillis:       30_000,
    connectionTimeoutMillis: 5_000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
}

// Export a Proxy so callers write `pool.query(...)` exactly as before,
// but the actual Pool is only created on the first method call.
const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    if (!globalForDb.__pgPool) {
      globalForDb.__pgPool = createPool();
    }
    const value = (globalForDb.__pgPool as any)[prop];
    return typeof value === 'function'
      ? value.bind(globalForDb.__pgPool)
      : value;
  },
});

export default pool;
