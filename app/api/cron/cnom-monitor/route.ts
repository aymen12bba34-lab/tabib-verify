/**
 * Phase 3A — Vercel Cron route for CNOM monitoring.
 * Runs daily at 2 AM (configured in vercel.json).
 * Protected by CRON_SECRET to prevent external invocation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runCNOMMonitor } from '@/scripts/monitor/cnom-monitor';

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Invalid cron secret' },
      { status: 401 }
    );
  }

  try {
    const stats = await runCNOMMonitor();

    return NextResponse.json({
      success: true,
      message: 'CNOM monitor completed',
      stats,
      ran_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron/CNOM Monitor] Error:', err);
    return NextResponse.json(
      { error: 'MONITOR_FAILED', message: 'CNOM monitor encountered an error' },
      { status: 500 }
    );
  }
}
