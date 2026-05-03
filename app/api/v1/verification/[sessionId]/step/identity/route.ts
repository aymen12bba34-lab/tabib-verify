import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { lookupCNOM, fuzzyNameMatch } from '@/lib/cnom';
import { validateNIN, getNINPartial } from '@/lib/nin';
import { calculateTrustScore, getDecision } from '@/lib/trust-score';

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  const session = await pool.query('SELECT * FROM verification_sessions WHERE id = $1', [sessionId]);
  if (session.rows.length === 0) {
    return NextResponse.json({ error: 'not_found', message: 'Session not found' }, { status: 404 });
  }

  if (!session.rows[0].otp_verified) {
    return NextResponse.json({ error: 'step_required', message: 'OTP verification required first' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 });
  }

  const { cnom_number, nin, full_name, specialty, wilaya } = body;
  if (!cnom_number || !nin || !full_name) {
    return NextResponse.json(
      { error: 'bad_request', message: 'cnom_number, nin, and full_name are required' },
      { status: 400 }
    );
  }

  const cnomRecord = await lookupCNOM(cnom_number);
  const ninResult = validateNIN(nin);
  const nameMatchScore = cnomRecord ? fuzzyNameMatch(full_name, cnomRecord.full_name_fr) : 0;

  const ninWilayaMatch = cnomRecord && ninResult.valid
    ? ninResult.wilayaCode === cnomRecord.wilaya_code
    : false;

  const cnomFound = cnomRecord !== null;
  const cnomActive = cnomRecord?.status === 'ACTIVE';

  if (cnomRecord && !cnomActive) {
    return NextResponse.json({
      error: 'cnom_inactive',
      message: `CNOM status: ${cnomRecord.status}. Verification cannot proceed.`,
      cnom_status: cnomRecord.status,
    }, { status: 400 });
  }

  // Store the full scraped NIN for exact cross-verification in Step 4
  const scrapedNin = nin ? nin.trim() : null;

  await pool.query(
    `UPDATE verification_sessions SET
      cnom_verified = $1, cnom_number = $2, full_name = $3,
      specialty = $4, wilaya_name = $5, input_nin = $6
     WHERE id = $7`,
    [cnomFound && cnomActive, cnom_number, full_name, specialty || cnomRecord?.specialty, wilaya || cnomRecord?.wilaya_name, scrapedNin, sessionId]
  );

  return NextResponse.json({
    success: true,
    cnom_found: cnomFound,
    name_match_score: Math.round(nameMatchScore * 100),
    nin_valid: ninResult.valid,
    nin_wilaya_match: ninWilayaMatch,
  });
}
