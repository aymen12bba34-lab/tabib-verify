import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { fuzzyNameMatch } from '@/lib/cnom';

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  const session = await pool.query('SELECT * FROM verification_sessions WHERE id = $1', [sessionId]);
  if (session.rows.length === 0) {
    return NextResponse.json({ error: 'not_found', message: 'Session introuvable' }, { status: 404 });
  }

  const s = session.rows[0];
  if (!s.cnom_verified) {
    return NextResponse.json(
      { error: 'step_required', message: 'Vérification CNOM requise avant le scan' },
      { status: 400 }
    );
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'bad_request', message: 'JSON invalide' }, { status: 400 }); }

  const { extracted_nin, extracted_name, ocr_confidence, skipped } = body;

  // Skipped — record it and move on (no points)
  if (skipped) {
    await pool.query(
      'UPDATE verification_sessions SET document_verified = false WHERE id = $1',
      [sessionId]
    );
    return NextResponse.json({ success: true, skipped: true });
  }

  // Cross-check extracted NIN with NIN scraped from web registry (Step 1)
  const extractedNinClean = extracted_nin ? extracted_nin.trim() : '';
  const storedNinClean = s.input_nin ? s.input_nin.trim() : '';
  
  if (!extractedNinClean || !storedNinClean || extractedNinClean !== storedNinClean) {
    return NextResponse.json({
      error: 'nin_mismatch',
      message: 'Identity Verification Failed: NIN Mismatch.'
    }, { status: 400 });
  }

  // Cross-check extracted name with CNOM name (fuzzy)
  const nameMatchScore = (extracted_name && s.full_name)
    ? fuzzyNameMatch(extracted_name, s.full_name)
    : 0;
  const nameMatch = nameMatchScore >= 0.65;

  // NIN matched exactly, identity verified
  await pool.query(
    `UPDATE verification_sessions SET
       status = 'VERIFIED',
       document_verified   = true,
       document_nin_match  = true,
       document_name_match = $2,
       document_confidence = $3
     WHERE id = $1`,
    [sessionId, nameMatch, ocr_confidence ?? 0]
  );

  return NextResponse.json({
    success: true,
    message: 'Identity successfully verified.',
    nin_match: true,
    name_match: nameMatch,
    name_score: Math.round(nameMatchScore * 100),
    confidence: ocr_confidence,
  });
}
