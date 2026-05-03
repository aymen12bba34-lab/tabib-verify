import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  const session = await pool.query('SELECT * FROM verification_sessions WHERE id = $1', [sessionId]);
  if (session.rows.length === 0) {
    return NextResponse.json({ error: 'not_found', message: 'Session not found' }, { status: 404 });
  }

  if (!session.rows[0].cnom_verified) {
    return NextResponse.json({ error: 'step_required', message: 'Identity verification required first' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 });
  }

  const { face_detected, liveness_passed, face_method } = body;
  if (!face_detected || !liveness_passed) {
    return NextResponse.json({ error: 'face_failed', message: 'Face detection or liveness check failed' }, { status: 400 });
  }

  // face_method: 'mediapipe_headnod' (+15 pts) | 'faceapi_blink' (+10 pts)
  const method = face_method || 'faceapi_blink';

  await pool.query(
    'UPDATE verification_sessions SET face_verified = true, face_method = $2 WHERE id = $1',
    [sessionId, method]
  );

  return NextResponse.json({
    success: true,
    message: 'Face verification recorded',
    method,
    bonus: method === 'mediapipe_headnod' ? 15 : 10,
  });
}
