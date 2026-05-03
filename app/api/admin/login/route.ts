/**
 * Phase 3C — Admin login endpoint.
 * Validates ADMIN_SECRET and sets an HttpOnly session cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  // Rate limit: 5 login attempts per 5 minutes per IP
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!rateLimit(`admin-login:${ip}`, 5, 5 * 60_000)) {
    log.warn('admin_login_rate_limited', { ip });
    return rateLimitResponse();
  }

  const { password } = await req.json();
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return NextResponse.json(
      { error: 'CONFIG_ERROR', message: 'ADMIN_SECRET not configured' },
      { status: 500 }
    );
  }

  // Constant-time comparison to prevent timing attacks
  const inputBuf = Buffer.from(password || '');
  const secretBuf = Buffer.from(adminSecret);

  if (inputBuf.length !== secretBuf.length || !crypto.timingSafeEqual(inputBuf, secretBuf)) {
    log.warn('admin_login_failed', { ip });
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Mot de passe incorrect' },
      { status: 401 }
    );
  }

  log.info('admin_login_success', { ip });

  // Generate a session token (HMAC of the secret + timestamp)
  const token = crypto
    .createHmac('sha256', adminSecret)
    .update(`admin-session-${Date.now()}`)
    .digest('hex');

  const response = NextResponse.json({ success: true });

  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  });

  // Also store the token server-side so we can validate it
  // For MVP, we store in a simple env-derived check: the cookie exists + is a valid HMAC
  // In production you'd use Redis, but for MVP the cookie itself is proof of auth

  return response;
}
