/**
 * Phase 3D — Structured JSON logger.
 * No external service — outputs to stdout for Vercel / Docker log capture.
 *
 * Usage:
 *   import { log } from '@/lib/logger';
 *
 *   log.info('session_created', { sessionId, partnerId });
 *   log.warn('otp_attempt_failed', { sessionId, attempt: 2 });
 *   log.error('webhook_delivery_failed', { url, status: 500 });
 */

function formatLog(level: string, event: string, data?: object): string {
  return JSON.stringify({
    level,
    ts: new Date().toISOString(),
    event,
    ...data,
  });
}

export const log = {
  info(event: string, data?: object) {
    console.log(formatLog('info', event, data));
  },

  warn(event: string, data?: object) {
    console.warn(formatLog('warn', event, data));
  },

  error(event: string, data?: object) {
    console.error(formatLog('error', event, data));
  },
};
