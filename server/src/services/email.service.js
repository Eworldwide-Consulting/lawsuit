// Email service — all outbound email flows through here.
// `queue()` is fire-and-forget (never blocks a request).
// `send()` is synchronous for cases that need delivery confirmation.

let nodemailer;
try { nodemailer = require('nodemailer'); } catch {}

const config  = require('../config');
const logger  = require('../logger');
const { breakers }    = require('../lib/circuit-breaker');
const { getQueue, QUEUE_NAMES } = require('../queue');

const JOB = {
  VERIFY_EMAIL:          'verify_email',
  PASSWORD_CHANGED:      'password_changed',
  PASSWORD_RESET:        'password_reset',
  NEW_MESSAGE:           'new_message',
  APPOINTMENT_REMINDER:  'appointment_reminder',
  INVOICE_CREATED:       'invoice_created',
  MATTER_STATUS_CHANGED: 'matter_status_changed',
  ATTORNEY_PENDING:      'attorney_pending',
  ATTORNEY_DECISION:     'attorney_decision',
};

// ── Transport ─────────────────────────────────────────────────────────────────

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  if (!nodemailer) return null;
  if (!config.smtp.host || !config.smtp.user) return null;
  _transport = nodemailer.createTransport({
    host:   config.smtp.host,
    port:   config.smtp.port,
    secure: config.smtp.secure,
    auth:   { user: config.smtp.user, pass: config.smtp.pass },
    pool:   true,     // reuse SMTP connections
    maxConnections: 5,
  });
  return _transport;
}

// ── Core send (wrapped in circuit breaker) ────────────────────────────────────

async function send({ to, subject, html, text, replyTo }) {
  const transport = getTransport();
  if (!transport) {
    logger.warn({ to, subject }, 'Email skipped — SMTP not configured');
    return { delivered: false, reason: 'no_transport' };
  }
  try {
    const mail = { from: config.smtp.from, to, subject, html, text };
    if (replyTo) mail.replyTo = replyTo;
    await breakers.smtp.call(() => transport.sendMail(mail));
    logger.info({ to, subject }, 'Email sent');
    return { delivered: true };
  } catch (err) {
    logger.error({ to, subject, err }, 'Email delivery failed');
    return { delivered: false, reason: err.message };
  }
}

// ── Queue helpers (fire-and-forget) ───────────────────────────────────────────

function queue(jobName, payload, opts = {}) {
  return getQueue(QUEUE_NAMES.EMAIL).add(jobName, payload, { attempts: 3, ...opts });
}

// ── Public API ────────────────────────────────────────────────────────────────

const EmailService = {
  JOB,

  sendVerification(to, token) {
    return queue(JOB.VERIFY_EMAIL, { to, token });
  },

  sendPasswordChanged(to) {
    return queue(JOB.PASSWORD_CHANGED, { to });
  },

  sendPasswordReset(to, token) {
    return queue(JOB.PASSWORD_RESET, { to, token });
  },

  // Direct SMTP send for password reset — bypasses the in-memory queue so the email
  // is never lost if the Node.js process restarts before the job is processed.
  sendPasswordResetDirect(to, token) {
    const link = `${config.client.url}/reset-password?token=${token}`;
    return send({ to, subject: 'Reset your TriVanta password', html: tmplPasswordReset(link) });
  },

  sendNewMessage(to, { senderName, subject, preview }) {
    return queue(JOB.NEW_MESSAGE, { to, senderName, subject, preview });
  },

  sendAppointmentReminder(to, { title, startTime, location }) {
    return queue(JOB.APPOINTMENT_REMINDER, { to, title, startTime, location });
  },

  sendInvoiceCreated(to, { amount, description, dueDate }) {
    return queue(JOB.INVOICE_CREATED, { to, amount, description, dueDate });
  },

  sendMatterStatusChanged(to, { caseNumber, newStatus }) {
    return queue(JOB.MATTER_STATUS_CHANGED, { to, caseNumber, newStatus });
  },

  sendAttorneyPending(to, { firstName, lastName, email, role }) {
    return queue(JOB.ATTORNEY_PENDING, { to, firstName, lastName, email, role });
  },

  sendAttorneyDecision(to, { firstName, decision }) {
    return queue(JOB.ATTORNEY_DECISION, { to, firstName, decision });
  },

  sendContactSales({ name, email, company, phone, plan, message }) {
    const salesTo = config.smtp.user || 'legal@trivanta.com';
    return send({
      to:      salesTo,
      replyTo: email,
      subject: `[Sales Enquiry] ${name}${company ? ` — ${company}` : ''} (${plan} plan)`,
      html:    tmplContactSales({ name, email, company, phone, plan, message }),
    });
  },

  // Verify SMTP connectivity (used at boot and by admin test endpoint)
  async verifySmtp() {
    const transport = getTransport();
    if (!transport) {
      return {
        ok: false,
        reason: 'SMTP not configured — set SMTP_HOST and SMTP_USER in environment',
        configured: false,
      };
    }
    try {
      await transport.verify();
      return { ok: true, host: config.smtp.host, user: config.smtp.user, from: config.smtp.from };
    } catch (err) {
      return { ok: false, reason: err.message, host: config.smtp.host, user: config.smtp.user };
    }
  },

  // Send a test email directly (bypasses queue so admin gets immediate feedback)
  async sendTestDirect(to) {
    const now = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
    return send({
      to,
      subject: 'TriVanta — SMTP Test',
      html: wrap(`
        ${h2('SMTP Test Email')}
        ${p('This test confirms your TriVanta email delivery is working correctly.')}
        ${p(`<strong>Sent at:</strong> ${esc(now)}`)}
        ${p(`<strong>SMTP host:</strong> ${esc(config.smtp.host || '—')}`)}
        ${p(`<strong>From:</strong> ${esc(config.smtp.from || '—')}`)}
        <p style="color:#9ca3af;font-size:13px">If you received this, password reset and transactional emails are operational.</p>
      `),
    });
  },

  // Used by the email worker — processes one queued job
  async processJob(job) {
    const { name, data } = job;
    let mail;

    switch (name) {
      case JOB.VERIFY_EMAIL: {
        const link = `${config.client.url}/verify-email?token=${data.token}`;
        mail = { to: data.to, subject: 'Verify your TriVanta account', html: tmplVerify(link) };
        break;
      }
      case JOB.PASSWORD_CHANGED:
        mail = { to: data.to, subject: 'Your TriVanta password was changed', html: tmplPasswordChanged() };
        break;
      case JOB.PASSWORD_RESET: {
        const link = `${config.client.url}/reset-password?token=${data.token}`;
        mail = { to: data.to, subject: 'Reset your TriVanta password', html: tmplPasswordReset(link) };
        break;
      }
      case JOB.NEW_MESSAGE:
        mail = { to: data.to, subject: `New message: ${data.subject}`, html: tmplNewMessage(data) };
        break;
      case JOB.APPOINTMENT_REMINDER:
        mail = { to: data.to, subject: `Reminder: ${data.title}`, html: tmplAppointment(data) };
        break;
      case JOB.INVOICE_CREATED:
        mail = { to: data.to, subject: 'New invoice from TriVanta', html: tmplInvoice(data) };
        break;
      case JOB.MATTER_STATUS_CHANGED:
        mail = { to: data.to, subject: `Matter ${data.caseNumber} status updated`, html: tmplMatterStatus(data) };
        break;
      case JOB.ATTORNEY_PENDING:
        mail = {
          to: data.to,
          subject: `New ${esc(data.role)} pending approval — ${esc(data.firstName)} ${esc(data.lastName)}`,
          html: tmplAttorneyPending(data),
        };
        break;
      case JOB.ATTORNEY_DECISION:
        mail = {
          to: data.to,
          subject: data.decision === 'approved'
            ? 'Your TriVanta account has been approved'
            : 'Update on your TriVanta application',
          html: tmplAttorneyDecision(data),
        };
        break;
      default:
        logger.warn({ jobName: name }, 'Unknown email job type');
        return;
    }

    const result = await send(mail);
    if (!result.delivered) throw new Error(result.reason);
  },
};

module.exports = EmailService;

// ── Email templates ───────────────────────────────────────────────────────────

// Escape all user-supplied values before interpolating into HTML.
// Prevents stored XSS via attacker-controlled names, subjects, or message bodies.
function esc(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function wrap(inner) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr>
          <td style="background:#0f2057;padding:28px 40px;text-align:center">
            <div style="color:#d4a017;font-size:20px;font-weight:800;letter-spacing:1px">TRIVANTA</div>
            <div style="color:#93aadc;font-size:11px;margin-top:4px;letter-spacing:2px">LEGAL PLATFORM</div>
          </td>
        </tr>
        <tr><td style="padding:36px 40px">${inner}</td></tr>
        <tr>
          <td style="background:#f9fafb;padding:18px 40px;text-align:center;border-top:1px solid #e5e7eb">
            <p style="color:#9ca3af;font-size:12px;margin:0">© ${new Date().getFullYear()} TriVanta · All rights reserved</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const btn = (href, label) =>
  `<div style="text-align:center;margin:24px 0">
     <a href="${href}" style="display:inline-block;background:#0f2057;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px">${label}</a>
   </div>`;

const h2 = t => `<h2 style="color:#0f2057;margin:0 0 12px;font-size:22px">${t}</h2>`;
const p  = t => `<p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 16px">${t}</p>`;

function tmplVerify(link) {
  return wrap(`
    ${h2('Confirm your email address')}
    ${p('Thank you for creating a TriVanta account. Click below to verify your email.')}
    ${btn(link, 'Verify My Email')}
    <p style="color:#9ca3af;font-size:13px">Link expires in <strong>24 hours</strong>.</p>
  `);
}

function tmplPasswordChanged() {
  return wrap(`
    ${h2('Password changed')}
    ${p('Your TriVanta account password was just updated. If you did not make this change, please contact support immediately.')}
  `);
}

function tmplNewMessage({ senderName, subject, preview }) {
  return wrap(`
    ${h2(`New message from ${esc(senderName)}`)}
    ${p(`<strong>${esc(subject)}</strong>`)}
    ${p(esc(preview) || 'You have received a new message on TriVanta.')}
    ${btn(`${config.client.url}/messages`, 'View Message')}
  `);
}

function tmplAppointment({ title, startTime, location }) {
  return wrap(`
    ${h2('Appointment Reminder')}
    ${p(`<strong>${esc(title)}</strong>`)}
    ${p(`When: ${esc(new Date(startTime).toLocaleString())}`)}
    ${location ? p(`Where: ${esc(location)}`) : ''}
    ${btn(`${config.client.url}/appointments`, 'View Appointment')}
  `);
}

function tmplInvoice({ amount, description, dueDate }) {
  const dollars = (amount / 100).toFixed(2);
  return wrap(`
    ${h2('New Invoice')}
    ${p(esc(description))}
    ${p(`<strong>Amount due: $${esc(dollars)}</strong>${dueDate ? `&nbsp; · &nbsp;Due: ${esc(dueDate)}` : ''}`)}
    ${btn(`${config.client.url}/payments`, 'View &amp; Pay Invoice')}
  `);
}

function tmplMatterStatus({ caseNumber, newStatus }) {
  return wrap(`
    ${h2('Matter status updated')}
    ${p(`Case <strong>${esc(caseNumber)}</strong> has moved to <strong>${esc(newStatus)}</strong>.`)}
    ${btn(`${config.client.url}/matters`, 'View Matter')}
  `);
}

function tmplPasswordReset(link) {
  return wrap(`
    ${h2('Reset your password')}
    ${p('We received a request to reset your TriVanta account password. Click the button below to choose a new one.')}
    ${btn(link, 'Reset Password')}
    <p style="color:#9ca3af;font-size:13px">This link expires in <strong>1 hour</strong>. If you did not request a reset, you can safely ignore this email.</p>
  `);
}

function tmplAttorneyPending({ firstName, lastName, email, role }) {
  const adminUrl = `${config.client.url}/admin/users`;
  return wrap(`
    ${h2('New professional account pending approval')}
    ${p(`A new <strong>${esc(role)}</strong> has registered and is awaiting your approval:`)}
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:120px">Name</td>
          <td style="padding:8px 0;font-weight:600;font-size:14px">${esc(firstName)} ${esc(lastName)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Email</td>
          <td style="padding:8px 0;font-size:14px">${esc(email)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Role</td>
          <td style="padding:8px 0;font-size:14px;text-transform:capitalize">${esc(role)}</td></tr>
    </table>
    ${btn(adminUrl, 'Review in Admin Panel')}
    <p style="color:#9ca3af;font-size:13px">Log in to the admin panel to approve or reject this account.</p>
  `);
}

function tmplContactSales({ name, email, company, phone, plan, message }) {
  return wrap(`
    ${h2('New Sales Enquiry')}
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px">
      <tr><td style="padding:7px 0;color:#6b7280;width:110px">Name</td>
          <td style="padding:7px 0;font-weight:600">${esc(name)}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280">Email</td>
          <td style="padding:7px 0"><a href="mailto:${esc(email)}" style="color:#0f2057">${esc(email)}</a></td></tr>
      ${company ? `<tr><td style="padding:7px 0;color:#6b7280">Company</td>
          <td style="padding:7px 0">${esc(company)}</td></tr>` : ''}
      ${phone ? `<tr><td style="padding:7px 0;color:#6b7280">Phone</td>
          <td style="padding:7px 0">${esc(phone)}</td></tr>` : ''}
      <tr><td style="padding:7px 0;color:#6b7280">Plan</td>
          <td style="padding:7px 0"><strong>${esc(plan)}</strong></td></tr>
    </table>
    <div style="background:#f9fafb;border-left:3px solid #d4a017;padding:14px 18px;border-radius:4px;margin-bottom:20px">
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0">${esc(message).replace(/\n/g, '<br>')}</p>
    </div>
    ${btn(`mailto:${esc(email)}`, 'Reply to Enquiry')}
    <p style="color:#9ca3af;font-size:12px;margin:0">Reply-To is pre-set to the enquirer's email address.</p>
  `);
}

function tmplAttorneyDecision({ firstName, decision }) {
  const isApproved = decision === 'approved';
  return wrap(`
    ${h2(isApproved ? 'Your account has been approved!' : 'Update on your application')}
    ${p(`Hi ${esc(firstName)},`)}
    ${isApproved
      ? p('Great news — your TriVanta professional account has been <strong>approved</strong>. You can now log in and access the platform.')
      : p('After reviewing your application, we are unable to approve your TriVanta professional account at this time. Please contact support if you have questions.')
    }
    ${isApproved ? btn(`${config.client.url}/login`, 'Log In to TriVanta') : ''}
  `);
}