import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import pool from '@/lib/db';
import { authenticatePartner } from '@/lib/auth';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const auth = await authenticatePartner(req);
  if (auth instanceof NextResponse) return auth;

  // Rate limit: 10 sessions per minute per partner
  if (!rateLimit(`start:${auth.partnerId}`, 10, 60_000)) {
    log.warn('rate_limited', { route: 'start', partnerId: auth.partnerId });
    return rateLimitResponse();
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'bad_request', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { partner_doctor_id, callback_url, redirect_url } = body;
  if (!partner_doctor_id || !callback_url) {
    return NextResponse.json(
      { error: 'bad_request', message: 'partner_doctor_id and callback_url are required' },
      { status: 400 }
    );
  }

  const sessionId = `sess_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await pool.query(
    `INSERT INTO verification_sessions (id, partner_id, partner_ref, callback_url, redirect_url, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, auth.partnerId, partner_doctor_id, callback_url, redirect_url || null, expiresAt]
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  log.info('session_created', { sessionId, partnerId: auth.partnerId, partnerRef: partner_doctor_id });

  return NextResponse.json({
    session_id: sessionId,
    verification_url: `${appUrl}/verify/${sessionId}`,
    expires_at: expiresAt.toISOString(),
  }, { status: 201 });
}
