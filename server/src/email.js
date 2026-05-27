const nodemailer = require('nodemailer');

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendVerificationEmail(toEmail, token) {
  const transporter = createTransporter();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const link = `${clientUrl}/verify-email?token=${token}`;

  if (!transporter) {
    console.warn(`[email] SMTP not configured — skipping verification email for ${toEmail}`);
    console.warn(`[email] Verification link: ${link}`);
    return false;
  }

  const from = process.env.SMTP_FROM || '"TriVanta" <noreply@trivanta.com>';

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Verify your TriVanta account',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="text-align:center;margin-bottom:24px;">
          <span style="font-size:24px;font-weight:bold;color:#16a34a;">Tri<span style="color:#166534;">V</span>anta</span>
        </div>
        <h2 style="color:#111827;margin-bottom:8px;">Verify your email address</h2>
        <p style="color:#4b5563;margin-bottom:24px;">
          Thanks for signing up! Click the button below to verify your email address and activate your account.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${link}"
             style="background:#16a34a;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;display:inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">
          Or copy and paste this link into your browser:<br>
          <a href="${link}" style="color:#16a34a;word-break:break-all;">${link}</a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#9ca3af;font-size:12px;">
          This link expires in 24 hours. If you didn't create a TriVanta account, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  return true;
}

module.exports = { sendVerificationEmail };
