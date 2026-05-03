/**
 * Phase 3C — Admin session action (approve / reject).
 * POST /api/admin/sessions/[id]/approve
 * POST /api/admin/sessions/[id]/reject
 *
 * Updates the session status in the DB and fires the appropriate webhook.
 * Protected by admin cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { fireWebhook } from '@/lib/webhook';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  // Check admin cookie
  const adminToken = req.cookies.get('admin_token')?.value;
  if (!adminToken) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Admin authentication required' },
      { status: 401 }
    );
  }

  const { id: sessionId, action } = params;

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Action must be "approve" or "reject"' },
      { status: 400 }
    );
  }

  // Fetch session
  const sessionResult = await pool.query(
    'SELECT * FROM verification_sessions WHERE id = $1',
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    return NextResponse.json(
      { error: 'SESSION_NOT_FOUND', message: 'Session not found' },
      { status: 404 }
    );
  }

  const session = sessionResult.rows[0];

  if (session.status !== 'pending') {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: `Session is "${session.status}", not "pending"` },
      { status: 400 }
    );
  }

  // Determine new status
  const newStatus = action === 'approve' ? 'verified' : 'rejected';
  const completedAt = new Date().toISOString();

  // Update DB
  await pool.query(
    `UPDATE verification_sessions
     SET status = $1, completed_at = $2
     WHERE id = $3`,
    [newStatus, completedAt, sessionId]
  );

  // Fire webhook to partner
  const partner = await pool.query(
    'SELECT webhook_secret FROM partners WHERE id = $1',
    [session.partner_id]
  );

  if (session.callback_url && partner.rows[0]) {
    fireWebhook(
      session.callback_url,
      {
        event: 'verification.completed',
        session_id: sessionId,
        partner_doctor_id: session.partner_ref,
        status: newStatus,
        trust_score: session.trust_score,
        doctor: newStatus === 'verified'
          ? {
              full_name: session.full_name,
              cnom_number: session.cnom_number,
              specialty: session.specialty,
              wilaya: session.wilaya_name,
              cnom_status: 'ACTIVE',
            }
          : null as any,
        verified_at: completedAt,
      },
      partner.rows[0].webhook_secret
    ).catch(err => console.error('[Admin] Webhook failed:', err));
  }

  return NextResponse.json({
    success: true,
    session_id: sessionId,
    action,
    new_status: newStatus,
  });
}
