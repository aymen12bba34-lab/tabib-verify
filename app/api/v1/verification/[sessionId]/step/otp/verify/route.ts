import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyOTP } from '@/lib/otp';

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  const session = await pool.query('SELECT * FROM verification_sessions WHERE id = $1', [sessionId]);
  if (session.rows.length === 0) {
    return NextResponse.json({ error: 'not_found', message: 'Session not found' }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 });
  }

  const { code } = body;
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'bad_request', message: '6-digit code required' }, { status: 400 });
  }

  const result = await verifyOTP(sessionId, code);

  if (!result.valid) {
    return NextResponse.json({ error: 'invalid_otp', message: result.error }, { status: 400 });
  }

  await pool.query('UPDATE verification_sessions SET otp_verified = true WHERE id = $1', [sessionId]);

  return NextResponse.json({ success: true, message: 'OTP verified' });
}
