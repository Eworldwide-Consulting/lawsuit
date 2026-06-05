let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch {}

function createTransporter() {
  if (!nodemailer || !process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: /^true$/i.test(process.env.SMTP_SECURE || ''),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendVerificationEmail(toEmail, token) {
  const transporter = createTransporter();
  const clientUrl   = process.env.CLIENT_URL || 'http://localhost:5173';
  const link        = `${clientUrl}/verify-email?token=${token}`;

  if (!transporter) {
    console.warn(`[email] SMTP not configured — verification link: ${link}`);
    return false;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"TriVanta" <noreply@trivanta.com>',
    to: toEmail,
    subject: 'Verify your TriVanta account',
    html: `<p>Click <a href="${link}">here</a> to verify your email. Link expires in 24 hours.</p>`,
  });
  return true;
}

module.exports = { sendVerificationEmail };
