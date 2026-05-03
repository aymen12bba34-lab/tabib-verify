import crypto from 'crypto';
import nodemailer from 'nodemailer';
import redis from './redis';

const OTP_EXPIRY = 300; // 5 minutes
const MAX_ATTEMPTS = 3;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE !== 'false', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

export async function sendOTPEmail(
  sessionId: string,
  email: string
): Promise<{ sent: boolean; error?: string }> {
  const otp = generateOTP();
  await storeOTP(sessionId, email, otp);

  // Dev mode fallback
  if (!process.env.SMTP_USER || process.env.SMTP_USER === '') {
    console.log(`\n┌─ [DEV OTP - NODEMAILER] ────┐`);
    console.log(`│  Session : ${sessionId}  │`);
    console.log(`│  Email   : ${email.padEnd(20)} │`);
    console.log(`│  Code    : ${otp}                │`);
    console.log(`└─────────────────────────────┘\n`);
    return { sent: true };
  }

  try {
    await transporter.sendMail({
      from: `"TabibVerify DZ" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `${otp} — Votre code de vérification TabibVerify`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:#1B6CA8;padding:24px 32px">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">TabibVerify DZ</h1>
            <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">Vérification des médecins algériens</p>
          </td>
        </tr>
        <!-- Body -->
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
        <!-- Footer -->
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
</html>`,
    });

    return { sent: true };
  } catch (err) {
    console.error('[Nodemailer] Exception:', err);
    return { sent: false, error: 'EMAIL_SEND_FAILED' };
  }
}
