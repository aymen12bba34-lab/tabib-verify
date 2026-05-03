import crypto from 'crypto';

export interface WebhookPayload {
  event: string;
  session_id: string;
  partner_doctor_id: string;
  status: string;
  trust_score: number;
  doctor: {
    full_name: string;
    cnom_number: string;
    specialty: string;
    wilaya: string;
    cnom_status: string;
  } | null;
  verified_at: string;
}

export interface RevocationPayload {
  event: 'verification.revoked';
  session_id: string;
  partner_doctor_id: string;
  reason: string;
  revoked_at: string;
}

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Fire the verification.completed webhook to the partner.
 * Retries up to 3 times with 5s delay between attempts.
 */
export async function fireWebhook(
  callbackUrl: string,
  payload: WebhookPayload,
  secret: string
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TabibVerify-Signature': `sha256=${signature}`,
          'X-TabibVerify-Event': 'verification.completed',
        },
        body,
      });
      if (res.ok) return;
    } catch (err) {
      console.error(`[Webhook] Attempt ${attempt + 1} failed:`, err);
      if (attempt < 2) await sleep(5000);
    }
  }
  console.error('[Webhook] All 3 delivery attempts failed for', callbackUrl);
}

/**
 * Phase 3B — Fire a verification.revoked webhook when a doctor's
 * CNOM status changes (SUSPENDED / RADIÉ) after they were verified.
 * Retries up to 3 times with 5s delay between attempts.
 */
export async function fireRevocationWebhook(
  callbackUrl: string,
  webhookSecret: string,
  sessionId: string,
  partnerRef: string,
  reason: string
): Promise<void> {
  const payload: RevocationPayload = {
    event: 'verification.revoked',
    session_id: sessionId,
    partner_doctor_id: partnerRef,
    reason,
    revoked_at: new Date().toISOString(),
  };

  const body = JSON.stringify(payload);
  const sig = `sha256=${crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TabibVerify-Signature': sig,
          'X-TabibVerify-Event': 'verification.revoked',
        },
        body,
      });
      if (res.ok) return;
    } catch (err) {
      console.error(`[RevocationWebhook] Attempt ${attempt + 1} failed:`, err);
      if (attempt < 2) await sleep(5000);
    }
  }
  console.error('[RevocationWebhook] All 3 delivery attempts failed for', callbackUrl);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
