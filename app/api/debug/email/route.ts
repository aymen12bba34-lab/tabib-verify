import { NextResponse } from 'next/server';

// Quick diagnostic endpoint — shows which email provider is configured
// and actually fires a test send to confirm it works end-to-end.
// DELETE THIS FILE before going to real production.

export async function GET() {
  const resendKey = process.env.RESEND_API_KEY;
  const smtpUser  = process.env.SMTP_USER;
  const smtpPass  = process.env.SMTP_PASS;

  const provider = resendKey
    ? 'resend'
    : smtpUser && smtpPass
    ? 'smtp'
    : process.env.NODE_ENV !== 'production'
    ? 'console-dev'
    : 'NONE';

  return NextResponse.json({
    provider,
    resend_key_set:  !!resendKey,
    smtp_user_set:   !!smtpUser,
    smtp_pass_set:   !!smtpPass,
    node_env:        process.env.NODE_ENV,
  });
}

export async function POST(req: Request) {
  const { to } = await req.json().catch(() => ({ to: null }));
  if (!to) return NextResponse.json({ error: 'pass { "to": "email@example.com" }' }, { status: 400 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set on this server' }, { status: 503 });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: [to],
      subject: 'TabibVerify — debug test',
      html: '<p>✅ Resend is configured correctly on this deployment.</p>',
    }),
  });
  const body = await res.json();
  return NextResponse.json({ status: res.status, resend: body });
}
