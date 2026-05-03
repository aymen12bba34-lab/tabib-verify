/**
 * Phase 3C — Admin sessions list endpoint.
 * GET /api/admin/sessions?tab=pending|verified|rejected|all
 *
 * Returns sessions filtered by status, plus aggregate stats.
 * Protected by admin cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  // Check admin cookie
  const adminToken = req.cookies.get('admin_token')?.value;
  if (!adminToken) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Admin authentication required' },
      { status: 401 }
    );
  }

  const tab = req.nextUrl.searchParams.get('tab') || 'pending';

  // Build WHERE clause based on tab
  let whereClause = '';
  switch (tab) {
    case 'pending':
      whereClause = "WHERE vs.status = 'pending'";
      break;
    case 'verified':
      whereClause = "WHERE vs.status = 'verified'";
      break;
    case 'rejected':
      whereClause = "WHERE vs.status = 'rejected'";
      break;
    default:
      whereClause = ''; // all sessions
  }

  // Fetch sessions
  const sessionsResult = await pool.query(`
    SELECT
      vs.id, vs.partner_ref, vs.status, vs.trust_score,
      vs.full_name, vs.cnom_number, vs.specialty, vs.wilaya_name,
      vs.otp_verified, vs.cnom_verified, vs.face_verified, vs.face_method,
      vs.nfc_verified, vs.document_verified, vs.document_nin_match,
      vs.created_at, vs.completed_at
    FROM verification_sessions vs
    ${whereClause}
    ORDER BY
      CASE vs.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
      vs.created_at DESC
    LIMIT 100
  `);

  // Fetch aggregate stats
  const statsResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
      COUNT(*) FILTER (WHERE status = 'verified') AS verified,
      COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
      COUNT(*)                                      AS total
    FROM verification_sessions
  `);

  const stats = statsResult.rows[0] || { pending: 0, verified: 0, rejected: 0, total: 0 };

  return NextResponse.json({
    sessions: sessionsResult.rows,
    stats: {
      pending:  Number(stats.pending),
      verified: Number(stats.verified),
      rejected: Number(stats.rejected),
      total:    Number(stats.total),
    },
  });
}
