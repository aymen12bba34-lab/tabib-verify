import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendOTPEmail, hashEmail } from '@/lib/otp';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  // Rate limit: 3 OTP sends per minute per session
  if (!rateLimit(`otp-send:${sessionId}`, 3, 60_000)) {
    log.warn('rate_limited', { route: 'otp/send', sessionId });
    return rateLimitResponse();
  }

  const session = await pool.query('SELECT * FROM verification_sessions WHERE id = $1', [sessionId]);
  if (session.rows.length === 0) {
    return NextResponse.json({ error: 'not_found', message: 'Session introuvable' }, { status: 404 });
  }

  if (new Date(session.rows[0].expires_at) < new Date()) {
    return NextResponse.json({ error: 'expired', message: 'Session expirée' }, { status: 410 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'JSON invalide' }, { status: 400 });
  }

  const { email } = body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return NextResponse.json(
      { error: 'bad_request', message: 'Adresse email valide requise' },
      { status: 400 }
    );
  }

  const result = await sendOTPEmail(sessionId, email.toLowerCase().trim());

  if (!result.sent) {
    return NextResponse.json(
      { error: 'email_failed', message: "Échec de l'envoi de l'email. Réessayez." },
      { status: 500 }
    );
  }

  // Store hashed email on session
  await pool.query(
    'UPDATE verification_sessions SET phone_hash = $1 WHERE id = $2',
    [hashEmail(email), sessionId]
  );

  // Mask email for response: dr.m***@gmail.com
  const [local, domain] = email.split('@');
  const masked = `${local.slice(0, 3)}***@${domain}`;

  log.info('otp_sent', { sessionId, email: masked });

  return NextResponse.json({ success: true, message: `Code envoyé à ${masked}` });
}
