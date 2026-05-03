import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticatePartner } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await authenticatePartner(req);
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = params;
  const result = await pool.query(
    'SELECT * FROM verification_sessions WHERE id = $1 AND partner_id = $2',
    [sessionId, auth.partnerId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: 'not_found', message: 'Session not found' },
      { status: 404 }
    );
  }

  const session = result.rows[0];

  return NextResponse.json({
    session_id: session.id,
    status: session.status,
    trust_score: session.trust_score,
    doctor: session.status !== 'in_progress' ? {
      full_name: session.full_name,
      cnom_number: session.cnom_number,
      specialty: session.specialty,
      wilaya: session.wilaya_name,
    } : undefined,
  });
}
