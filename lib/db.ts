import { Pool } from 'pg';

// Prevent multiple Pool instances during Next.js hot-reload in dev
const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // Render and Supabase both require SSL in production
  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    process.env.NODE_ENV === 'development';

  return new Pool({
    connectionString,
    // Serverless-friendly: keep the pool small so we don't exhaust
    // Render's connection limit on free tier (97 max connections)
    max: process.env.NODE_ENV === 'production' ? 3 : 10,
    idleTimeoutMillis:    30_000,
    connectionTimeoutMillis: 5_000,
    // SSL required for Render / Supabase; skip for local Docker
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
}

const pool = globalForDb.__pgPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__pgPool = pool;
}

export default pool;
