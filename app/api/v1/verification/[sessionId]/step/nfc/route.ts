import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calculateTrustScore, checkOSMPresence, getDecision } from '@/lib/trust-score';
import { fireWebhook } from '@/lib/webhook';
import { lookupCNOM } from '@/lib/cnom';

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  const session = await pool.query('SELECT * FROM verification_sessions WHERE id = $1', [sessionId]);
  if (session.rows.length === 0) {
    return NextResponse.json({ error: 'not_found', message: 'Session not found' }, { status: 404 });
  }

  const s = session.rows[0];
  if (!s.face_verified) {
    return NextResponse.json({ error: 'step_required', message: 'Face verification required first' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 });
  }

  const { nfc_read, nin_match, skipped } = body;
  const nfcVerified = nfc_read && nin_match && !skipped;

  await pool.query('UPDATE verification_sessions SET nfc_verified = $1 WHERE id = $2', [nfcVerified, sessionId]);

  // Phase 1A: Check OpenStreetMap presence
  let osmClinicFound = false;
  if (s.full_name && s.wilaya_name) {
    const cnomRecord = s.cnom_number ? await lookupCNOM(s.cnom_number) : null;
    const wilayaCode = cnomRecord?.wilaya_code ?? null;
    if (wilayaCode) {
      osmClinicFound = await checkOSMPresence(s.full_name, wilayaCode);
    }
  }

  // Calculate final score with all signals
  const score = calculateTrustScore({
    otpVerified: s.otp_verified,
    cnomFound: s.cnom_verified,
    cnomNameMatch: 0.9, // Passed identity step so name matched
    ninValid: true,
    ninWilayaMatch: true,
    faceDetected: s.face_verified,
    faceMethod:   s.face_method ?? 'faceapi_blink', // Phase 2C: +15 if mediapipe_headnod
    nfcMatch: nfcVerified,
    osmClinicFound,
    documentVerified:  s.document_verified  ?? false,
    documentNinMatch:  s.document_nin_match  ?? false,
    documentNameMatch: s.document_name_match ?? false,
  });

  const decision = getDecision(score);
  const completedAt = new Date().toISOString();

  await pool.query(
    `UPDATE verification_sessions SET status = $1, trust_score = $2, completed_at = $3 WHERE id = $4`,
    [decision, score, completedAt, sessionId]
  );

  // Fire webhook async (non-blocking)
  const partner = await pool.query('SELECT webhook_secret FROM partners WHERE id = $1', [s.partner_id]);
  if (s.callback_url && partner.rows[0]) {
    fireWebhook(s.callback_url, {
      event: 'verification.completed',
      session_id: sessionId,
      partner_doctor_id: s.partner_ref,
      status: decision,
      trust_score: score,
      doctor: {
        full_name: s.full_name,
        cnom_number: s.cnom_number,
        specialty: s.specialty,
        wilaya: s.wilaya_name,
        cnom_status: 'ACTIVE',
      },
      verified_at: completedAt,
    }, partner.rows[0].webhook_secret);
  }

  return NextResponse.json({
    success: true,
    status: decision,
    trust_score: score,
    redirect_url: s.redirect_url,
    signals: { osm_clinic_found: osmClinicFound, nfc_verified: nfcVerified },
  });
}
