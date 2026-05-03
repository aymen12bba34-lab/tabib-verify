import crypto from 'crypto';
import redis from './redis';

const OTP_EXPIRY = 300; // 5 minutes
const MAX_ATTEMPTS = 3;

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// Legacy phone hash — kept for backward compatibility
export function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

export async function storeOTP(sessionId: string, email: string, otp: string): Promise<void> {
  const key = `otp:${sessionId}`;
  await redis.set(
    key,
    JSON.stringify({ otp, emailHash: hashEmail(email), attempts: 0 }),
    { ex: OTP_EXPIRY }
  );
}

export async function verifyOTP(
  sessionId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const key = `otp:${sessionId}`;
  const data = await redis.get<string | Record<string, unknown>>(key);

  if (!data) {
    return { valid: false, error: 'Code expiré. Veuillez demander un nouveau code.' };
  }

  // Upstash auto-deserializes JSON; ioredis returns a string
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;

  if (parsed.attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    return { valid: false, error: 'Trop de tentatives. Veuillez demander un nouveau code.' };
  }

  if (parsed.otp !== code) {
    parsed.attempts++;
    await redis.set(key, JSON.stringify(parsed), { ex: OTP_EXPIRY });
    const remaining = MAX_ATTEMPTS - parsed.attempts;
    return {
      valid: false,
      error: `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`,
    };
  }

  await redis.del(key);
  return { valid: true };
}

// ─── HTML email template ──────────────────────────────────────────────────────
function buildEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#1B6CA8;padding:24px 32px">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">TabibVerify DZ</h1>
            <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">Vérification des médecins algériens</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 16px;color:#374151;font-size:15px">Votre code de vérification :</p>
            <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px">
               <span style="font-size:42px;font-weight:700;letter-spacing:12px;color:#1B6CA8">${otp}</span>
            </div>
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">
              ⏱ Ce code expire dans <strong>5 minutes</strong>.
            </p>
            <p style="margin:0;color:#6b7280;font-size:13px">
              🔒 Ne partagez ce code avec personne.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
            <p style="margin:0;color:#9ca3af;font-size:11px">
              Si vous n'avez pas demandé ce code, ignorez cet email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Resend sender ────────────────────────────────────────────────────────────
async function sendViaResend(email: string, otp: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TabibVerify DZ <onboarding@resend.dev>',
      to: [email],
      subject: `${otp} — Votre code de vérification TabibVerify`,
      html: buildEmailHtml(otp),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

// ─── Nodemailer SMTP sender ───────────────────────────────────────────────────
async function sendViaSmtp(email: string, otp: string): Promise<void> {
  // Lazy import so the module doesn't fail to load when nodemailer isn't installed
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"TabibVerify DZ" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `${otp} — Votre code de vérification TabibVerify`,
    html: buildEmailHtml(otp),
  });
}

// ─── Public entry point ───────────────────────────────────────────────────────
export async function sendOTPEmail(
  sessionId: string,
  email: string
): Promise<{ sent: boolean; error?: string }> {
  const otp = generateOTP();
  await storeOTP(sessionId, email, otp);

  // 1️⃣  Resend (primary — free 3 000 emails/month, no SMTP config needed)
  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(email, otp);
      console.log(`[OTP] Sent via Resend to ${email} (session ${sessionId})`);
      return { sent: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[OTP] Resend failed:', msg);
      // If no SMTP fallback configured, surface the Resend error directly
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { sent: false, error: `RESEND_ERROR: ${msg}` };
      }
    }
  }

  // 2️⃣  Nodemailer SMTP (fallback — requires SMTP_USER + SMTP_PASS)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await sendViaSmtp(email, otp);
      console.log(`[OTP] Sent via SMTP to ${email} (session ${sessionId})`);
      return { sent: true };
    } catch (err) {
      console.error('[OTP] SMTP failed:', err);
      return { sent: false, error: 'EMAIL_SEND_FAILED' };
    }
  }

  // 3️⃣  Dev console fallback — logs OTP locally, never use in production
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n┌─ [DEV OTP] ──────────────────────────┐`);
    console.log(`│  Session : ${sessionId.padEnd(26)} │`);
    console.log(`│  Email   : ${email.padEnd(26)} │`);
    console.log(`│  Code    : ${otp.padEnd(26)} │`);
    console.log(`└──────────────────────────────────────┘\n`);
    return { sent: true };
  }

  // Production with no email config at all → hard error
  console.error('[OTP] No email provider configured (RESEND_API_KEY, SMTP_USER/SMTP_PASS missing)');
  return { sent: false, error: 'NO_EMAIL_PROVIDER' };
}
