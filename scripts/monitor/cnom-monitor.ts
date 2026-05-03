/**
 * Phase 3A — CNOM Continuous Monitor
 *
 * Runs daily (via Vercel Cron or Docker cron).
 * Re-checks the CNOM status of all verified doctors.
 * If a doctor's CNOM status has changed to SUSPENDED or RADIÉ,
 * the session is revoked and a webhook is fired to the partner.
 *
 * Usage (standalone):
 *   npx tsx scripts/monitor/cnom-monitor.ts
 *
 * Usage (Vercel Cron):
 *   Handled by /api/cron/cnom-monitor
 */

import pool from '../../lib/db';
import { fireRevocationWebhook } from '../../lib/webhook';

export async function runCNOMMonitor(): Promise<{
  checked: number;
  revoked: number;
  errors: number;
}> {
  const stats = { checked: 0, revoked: 0, errors: 0 };

  try {
    // Find verified sessions whose CNOM status hasn't been checked
    // in the last 24 hours (or has never been checked)
    const sessions = await pool.query(`
      SELECT
        vs.id,
        vs.cnom_number,
        vs.partner_ref,
        vs.callback_url,
        vs.full_name,
        p.webhook_secret
      FROM verification_sessions vs
      JOIN partners p ON vs.partner_id = p.id
      WHERE vs.status = 'verified'
        AND vs.cnom_number IS NOT NULL
        AND vs.callback_url IS NOT NULL
        AND (
          vs.last_cnom_check IS NULL
          OR vs.last_cnom_check < NOW() - INTERVAL '24 hours'
        )
      ORDER BY vs.last_cnom_check ASC NULLS FIRST
      LIMIT 100
    `);

    console.log(`[CNOM Monitor] Found ${sessions.rows.length} sessions to check`);

    for (const session of sessions.rows) {
      try {
        // Look up the current CNOM status
        const cnom = await pool.query(
          'SELECT status FROM cnom_registry WHERE cnom_number = $1',
          [session.cnom_number]
        );

        const currentStatus = cnom.rows[0]?.status;

        if (currentStatus && currentStatus !== 'ACTIVE') {
          // Doctor is no longer active — revoke the session
          console.log(
            `[CNOM Monitor] Revoking session ${session.id}: ` +
            `doctor ${session.full_name} CNOM status = ${currentStatus}`
          );

          await revokeSession(session, `CNOM_${currentStatus}`);
          stats.revoked++;
        }

        // Update the check timestamp regardless of result
        await pool.query(
          'UPDATE verification_sessions SET last_cnom_check = NOW() WHERE id = $1',
          [session.id]
        );

        stats.checked++;
      } catch (err) {
        console.error(`[CNOM Monitor] Error checking session ${session.id}:`, err);
        stats.errors++;
      }
    }

    console.log(
      `[CNOM Monitor] Done. Checked: ${stats.checked}, ` +
      `Revoked: ${stats.revoked}, Errors: ${stats.errors}`
    );
  } catch (err) {
    console.error('[CNOM Monitor] Fatal error:', err);
    stats.errors++;
  }

  return stats;
}

/**
 * Revoke a previously-verified session.
 * Updates the DB status and fires a revocation webhook to the partner.
 */
async function revokeSession(
  session: {
    id: string;
    partner_ref: string;
    callback_url: string;
    webhook_secret: string;
  },
  reason: string
) {
  // 1. Update session status in DB
  await pool.query(
    `UPDATE verification_sessions
     SET status = 'revoked',
         revoked_at = NOW(),
         revocation_reason = $2
     WHERE id = $1`,
    [session.id, reason]
  );

  // 2. Fire revocation webhook to partner (async, non-blocking)
  fireRevocationWebhook(
    session.callback_url,
    session.webhook_secret,
    session.id,
    session.partner_ref,
    reason
  ).catch(err => {
    console.error(`[CNOM Monitor] Revocation webhook failed for ${session.id}:`, err);
  });
}

// ─── Direct execution ───────────────────────────────────────────────────────

if (require.main === module) {
  runCNOMMonitor()
    .then(stats => {
      console.log('[CNOM Monitor] Final stats:', JSON.stringify(stats));
      process.exit(0);
    })
    .catch(err => {
      console.error('[CNOM Monitor] Unhandled error:', err);
      process.exit(1);
    });
}
