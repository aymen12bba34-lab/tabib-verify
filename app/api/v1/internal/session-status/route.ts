import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'bad_request', message: 'id required' }, { status: 400 });
  }

  const result = await pool.query('SELECT * FROM verification_sessions WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'not_found', message: 'Session not found' }, { status: 404 });
  }

  const session = result.rows[0];
  const expired = new Date(session.expires_at) < new Date();

  return NextResponse.json({
    status: session.status,
    trust_score: session.trust_score,
    full_name: session.full_name,
    redirect_url: session.redirect_url,
    expired,
  });
}
