let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch {}

async function sendVerificationEmail(toEmail, token) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const link = `${clientUrl}/verify-email?token=${token}`;

  if (!nodemailer) {
    console.warn(`[email] nodemailer not installed — verification link: ${link}`);
    return false;
  }

  let transporter;
  const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_USER;

  if (hasSmtp) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: /^true$/i.test(process.env.SMTP_SECURE || ''),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    // Dev: Ethereal captures the email — check the preview URL in server logs
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.info(`[email] SMTP not configured — using Ethereal test account (${testAccount.user})`);
    console.info(`[email] Verification link for ${toEmail}: ${link}`);
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"TriVanta" <noreply@trivanta.com>',
    to: toEmail,
    subject: 'Verify your TriVanta account',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr>
          <td style="background:#0f2057;padding:32px 40px;text-align:center">
            <div style="color:#d4a017;font-size:22px;font-weight:800;letter-spacing:1px">TRIVANTA</div>
            <div style="color:#93aadc;font-size:11px;margin-top:4px;letter-spacing:2px">LEGAL PLATFORM</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px">
            <h2 style="color:#0f2057;margin:0 0 12px;font-size:22px">Confirm your email address</h2>
            <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 28px">
              Thank you for creating a TriVanta account. Click the button below to verify your email and activate your account.
            </p>
            <div style="text-align:center;margin:0 0 28px">
              <a href="${link}" style="display:inline-block;background:#0f2057;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px">
                Verify My Email
              </a>
            </div>
            <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0 0 8px">
              This link expires in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.
            </p>
            <p style="color:#9ca3af;font-size:12px;margin:0">
              Or copy this URL into your browser:<br>
              <span style="color:#3b82f6;word-break:break-all">${link}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
            <p style="color:#9ca3af;font-size:12px;margin:0">© ${new Date().getFullYear()} TriVanta · All rights reserved</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  if (!hasSmtp) {
    const preview = nodemailer.getTestMessageUrl(info);
    console.info(`[email] Preview at: ${preview}`);
  }

  return true;
}

module.exports = { sendVerificationEmail };
