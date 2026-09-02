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
  PAYMENT_CONFIRMED:     'payment_confirmed',
  DOCUMENT_UPLOADED:     'document_uploaded',
  DOCUMENT_REMINDER:     'document_reminder',
  DOCUMENT_AVAILABLE:    'document_available',
  DOCUMENT_REVIEWED:     'document_reviewed',
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

  // Direct send — the login flow is blocked until this code arrives, so it
  // must not sit in the in-memory queue behind other jobs.
  sendLoginCode(to, { firstName, code }) {
    return send({
      to,
      subject: `${code} is your TriVanta verification code`,
      html: tmplLoginCode({ firstName, code }),
      text: `Your TriVanta verification code is ${code}. It expires in 10 minutes.`,
    });
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

  // Direct send — same reasoning as sendLoginCode: the Google-signup verify
  // screen is blocked on this code arriving, so it must not sit in the queue.
  sendAttorneySignupCode(to, { firstName, code }) {
    return send({
      to,
      subject: `${code} is your TriVanta attorney verification code`,
      html: tmplAttorneySignupCode({ firstName, code }),
      text: `Your TriVanta attorney verification code is ${code}. It expires in 10 minutes.`,
    });
  },

  sendAttorneyDecision(to, { firstName, decision }) {
    return queue(JOB.ATTORNEY_DECISION, { to, firstName, decision });
  },

  // Account-lifecycle notices are sent directly rather than queued: the
  // suspension/deletion has already taken effect by the time this runs, so the
  // notice must not be lost if the process restarts before the queue drains.
  sendAccountSuspended(to, { firstName, reason }) {
    return send({
      to,
      subject: 'Your TriVanta account has been suspended',
      html: tmplAccountSuspended({ firstName, reason }),
    });
  },

  sendAccountReactivated(to, { firstName }) {
    return send({
      to,
      subject: 'Your TriVanta account has been restored',
      html: tmplAccountReactivated({ firstName }),
    });
  },

  sendAccountDeleted(to, { firstName }) {
    return send({
      to,
      subject: 'Your TriVanta account has been closed',
      html: tmplAccountDeleted({ firstName }),
    });
  },

  sendAttorneyInvite(to, { clientName, name, signupLink }) {
    return send({
      to,
      subject: `You've been invited to join TriVanta Legal Platform`,
      html: tmplAttorneyInvite({ to, clientName, name, signupLink }),
    });
  },

  // Sent to attorney when a client assigns them — they must accept or decline in the portal
  sendAttorneyCaseRequest(to, { attorneyName, clientName, caseNumber, matterType, dashboardUrl }) {
    return send({
      to,
      subject: `New Case Request — ${clientName} is requesting your representation`,
      html: tmplAttorneyCaseRequest({ attorneyName, clientName, caseNumber, matterType, dashboardUrl }),
    });
  },

  // Sent to client after attorney accepts their case
  sendClientCaseAccepted(to, { clientName, attorneyName, caseNumber, dashboardUrl }) {
    return send({
      to,
      subject: `Your attorney has accepted your case — ${caseNumber}`,
      html: tmplClientCaseAccepted({ clientName, attorneyName, caseNumber, dashboardUrl }),
    });
  },

  // Sent to client after attorney declines their case
  sendClientCaseDeclined(to, { clientName, attorneyName, caseNumber, reason, dashboardUrl }) {
    return send({
      to,
      subject: `Case request update — ${caseNumber}`,
      html: tmplClientCaseDeclined({ clientName, attorneyName, caseNumber, reason, dashboardUrl }),
    });
  },

  // Sent to client after a payment succeeds (invoice or Prime)
  sendPaymentConfirmed(to, { clientName, amount, description, invoiceId, paidAt, transactionId, isPrime }) {
    return queue(JOB.PAYMENT_CONFIRMED, { to, clientName, amount, description, invoiceId, paidAt, transactionId, isPrime });
  },

  // Sent to the matter's attorney when a client uploads documents
  sendDocumentUploaded(to, { attorneyName, clientName, caseNumber, docNames, reviewUrl }) {
    return queue(JOB.DOCUMENT_UPLOADED, { to, attorneyName, clientName, caseNumber, docNames, reviewUrl });
  },

  // Sent to the client — required documents still pending, hurting their
  // matter readiness score. Triggered by the daily sweep in
  // server/src/jobs/documentReminders.js, throttled per-matter there.
  sendDocumentUploadReminder(to, { firstName, caseNumber, missingCount, missingLabels }) {
    return queue(JOB.DOCUMENT_REMINDER, { to, firstName, caseNumber, missingCount, missingLabels });
  },

  // Sent to the client when their attorney/staff uploads a new document to
  // their matter.
  sendDocumentAvailable(to, { firstName, uploaderName, caseNumber, docName }) {
    return queue(JOB.DOCUMENT_AVAILABLE, { to, firstName, uploaderName, caseNumber, docName });
  },

  // Sent to the client when their attorney approves, rejects, or requests
  // corrections on a document they submitted.
  sendDocumentReviewed(to, { firstName, caseNumber, docName, status, note }) {
    return queue(JOB.DOCUMENT_REVIEWED, { to, firstName, caseNumber, docName, status, note });
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
      case JOB.PAYMENT_CONFIRMED:
        mail = {
          to: data.to,
          subject: data.isPrime
            ? 'TriVanta Prime — Payment Confirmed'
            : `Payment Confirmed — Invoice #${data.invoiceId}`,
          html: tmplPaymentConfirmed(data),
        };
        break;
      case JOB.DOCUMENT_UPLOADED:
        mail = {
          to: data.to,
          subject: `Action Required: New document uploaded — ${esc(data.caseNumber || 'your case')}`,
          html: tmplDocumentUploaded(data),
        };
        break;
      case JOB.DOCUMENT_REMINDER:
        mail = {
          to: data.to,
          subject: `${data.missingCount} document${data.missingCount !== 1 ? 's' : ''} still needed for your case`,
          html: tmplDocumentReminder(data),
        };
        break;
      case JOB.DOCUMENT_AVAILABLE:
        mail = {
          to: data.to,
          subject: `New document added to case ${esc(data.caseNumber || '')}`.trim(),
          html: tmplDocumentAvailable(data),
        };
        break;
      case JOB.DOCUMENT_REVIEWED:
        mail = {
          to: data.to,
          subject: `Document ${esc(data.status)} — ${esc(data.caseNumber || 'your case')}`,
          html: tmplDocumentReviewedEmail(data),
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

function tmplLoginCode({ firstName, code }) {
  return wrap(`
    ${h2('Your verification code')}
    ${p(`Hi ${esc(firstName || 'there')}, use this code to finish signing in to your TriVanta dashboard:`)}
    <div style="text-align:center;margin:24px 0">
      <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;padding:16px 32px;font-size:32px;font-weight:800;letter-spacing:10px;color:#0f2057;font-family:monospace">${esc(code)}</span>
    </div>
    <p style="color:#9ca3af;font-size:13px">This code expires in <strong>10 minutes</strong>. If you did not try to sign in, change your password immediately.</p>
  `);
}

function tmplAttorneySignupCode({ firstName, code }) {
  return wrap(`
    ${h2('Verify your attorney account')}
    ${p(`Hi ${esc(firstName || 'there')}, use this code to verify your email and finish creating your TriVanta attorney account:`)}
    <div style="text-align:center;margin:24px 0">
      <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;padding:16px 32px;font-size:32px;font-weight:800;letter-spacing:10px;color:#0f2057;font-family:monospace">${esc(code)}</span>
    </div>
    <p style="color:#9ca3af;font-size:13px">This code expires in <strong>10 minutes</strong>. Once verified, a TriVanta partner will review your account before you get full access.</p>
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

function tmplAccountSuspended({ firstName, reason }) {
  return wrap(`
    ${h2('Your account has been suspended')}
    ${p(`Hi ${esc(firstName)},`)}
    ${p('An administrator has suspended your TriVanta account. While it is suspended you cannot sign in, and any active session has been ended.')}
    ${reason ? p(`<strong>Reason:</strong> ${esc(reason)}`) : ''}
    ${p('Your case history, documents and messages are unchanged. Contact support if you believe this was a mistake.')}
  `);
}

function tmplAccountReactivated({ firstName }) {
  return wrap(`
    ${h2('Your account has been restored')}
    ${p(`Hi ${esc(firstName)},`)}
    ${p('Your TriVanta account has been reactivated. You can sign in again with your existing email and password.')}
    ${btn(`${config.client.url}/login`, 'Sign In to TriVanta')}
  `);
}

function tmplAccountDeleted({ firstName }) {
  return wrap(`
    ${h2('Your account has been closed')}
    ${p(`Hi ${esc(firstName)},`)}
    ${p('An administrator has closed your TriVanta account. You can no longer sign in with it.')}
    ${p('Your case records are retained as required for legal recordkeeping. If you need access again, you are free to register a new account with this same email address.')}
    ${btn(`${config.client.url}/register`, 'Create a New Account')}
  `);
}

function tmplAttorneyInvite({ to, clientName, name, signupLink }) {
  const greeting = name ? `Hi ${esc(name)},` : 'Hello,';
  return wrap(`
    ${h2('You\'ve been invited to TriVanta')}
    ${p(`${greeting}`)}
    ${p(`<strong>${esc(clientName)}</strong> is looking for legal representation and would like to work with you on their case through the <strong>TriVanta Legal Platform</strong>.`)}
    ${p('TriVanta helps attorneys manage client cases, documents, appointments, and billing — all in one secure platform.')}
    ${btn(signupLink, 'Create Your Attorney Account')}
    ${p(`After registering, ${esc(clientName)} will be able to connect their case to your account directly.`)}
    <p style="color:#9ca3af;font-size:13px">If you did not expect this invitation, you can safely ignore this email.</p>
  `);
}

function tmplAttorneyCaseRequest({ attorneyName, clientName, caseNumber, matterType, dashboardUrl }) {
  const greeting  = attorneyName ? `Hi ${esc(attorneyName)},` : 'Hello,';
  const typeLabel = (matterType || 'General').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return wrap(`
    ${h2('You have a new case request')}
    ${p(greeting)}
    ${p(`A client on TriVanta has requested your legal representation. Please review the details below and accept or decline the case from your dashboard.`)}
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280;width:40%">Client</td>
        <td style="padding:10px 0;font-weight:600;color:#111827">${esc(clientName)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 0;color:#6b7280">Case Number</td>
        <td style="padding:10px 0;font-weight:600;color:#111827">${esc(caseNumber)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280">Matter Type</td>
        <td style="padding:10px 0;font-weight:600;color:#111827">${esc(typeLabel)}</td>
      </tr>
    </table>
    ${p('Log in to your TriVanta dashboard to review the full case details, then accept or decline this request.')}
    ${btn(dashboardUrl, 'Review Case Request')}
    <p style="color:#9ca3af;font-size:13px">This request will remain pending until you take action. The client will be notified of your decision.</p>
  `);
}

function tmplClientCaseAccepted({ clientName, attorneyName, caseNumber, dashboardUrl }) {
  return wrap(`
    ${h2('Your attorney has accepted your case')}
    ${p(`Hi ${esc(clientName)},`)}
    ${p(`Great news! <strong>${esc(attorneyName)}</strong> has accepted your case request for <strong>${esc(caseNumber)}</strong> and is now your attorney of record on TriVanta.`)}
    ${p('You can now message your attorney directly, view your required document checklist, and track your case progress — all from your dashboard.')}
    ${btn(dashboardUrl, 'Go to Your Dashboard')}
    <p style="color:#9ca3af;font-size:13px">If you have questions, contact your attorney through the TriVanta messaging system.</p>
  `);
}

function tmplClientCaseDeclined({ clientName, attorneyName, caseNumber, reason, dashboardUrl }) {
  return wrap(`
    ${h2('Case request update')}
    ${p(`Hi ${esc(clientName)},`)}
    ${p(`<strong>${esc(attorneyName)}</strong> is unable to take on your case (<strong>${esc(caseNumber)}</strong>) at this time.`)}
    ${reason ? p(`<em>"${esc(reason)}"</em>`) : ''}
    ${p('You can return to your dashboard to choose a different attorney or invite your own attorney to the platform.')}
    ${btn(dashboardUrl, 'Choose Another Attorney')}
    <p style="color:#9ca3af;font-size:13px">We're sorry for the inconvenience. Our support team is available if you need help finding representation.</p>
  `);
}

function tmplPaymentConfirmed({ clientName, amount, description, invoiceId, paidAt, transactionId, isPrime }) {
  const dollars  = typeof amount === 'number' ? (amount / 100).toFixed(2) : amount;
  const dateStr  = paidAt ? new Date(paidAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const greeting = clientName ? `Hi ${esc(clientName)},` : 'Hi there,';
  return wrap(`
    ${h2(isPrime ? 'TriVanta Prime — Payment Confirmed' : 'Payment Confirmed')}
    ${p(greeting)}
    ${p(`Your payment of <strong>$${esc(dollars)}</strong> has been successfully processed. Here is a summary of your transaction:`)}
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
      <tr style="background:#f9fafb">
        <td style="padding:12px 16px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Description</td>
        <td style="padding:12px 16px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">${esc(description)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Amount Paid</td>
        <td style="padding:12px 16px;font-weight:700;color:#059669;border-bottom:1px solid #e5e7eb">$${esc(dollars)} USD</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:12px 16px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Payment Date</td>
        <td style="padding:12px 16px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">${esc(dateStr)}</td>
      </tr>
      ${invoiceId ? `<tr>
        <td style="padding:12px 16px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb">Invoice #</td>
        <td style="padding:12px 16px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb">${esc(String(invoiceId))}</td>
      </tr>` : ''}
      ${transactionId ? `<tr style="background:#f9fafb">
        <td style="padding:12px 16px;color:#6b7280;font-weight:500">Transaction ID</td>
        <td style="padding:12px 16px;font-size:12px;color:#6b7280;word-break:break-all">${esc(transactionId)}</td>
      </tr>` : ''}
    </table>
    ${isPrime ? p('Your <strong>TriVanta Prime</strong> membership is now active. Enjoy priority attorney access, unlimited document storage, and your monthly strategy call.') : ''}
    ${btn(`${config.client.url}/payments`, isPrime ? 'View Your Membership' : 'View Your Billing')}
    <p style="color:#9ca3af;font-size:13px">A receipt is available in your Billing portal. If you have questions about this charge, please contact support.</p>
  `);
}

function tmplDocumentUploaded({ attorneyName, clientName, caseNumber, docNames, reviewUrl }) {
  const greeting  = attorneyName ? `Hi ${esc(attorneyName)},` : 'Hello,';
  const docList   = Array.isArray(docNames) && docNames.length > 0
    ? `<ul style="margin:12px 0 20px;padding-left:20px">${docNames.map(n => `<li style="color:#374151;font-size:14px;padding:3px 0">${esc(n)}</li>`).join('')}</ul>`
    : '';
  return wrap(`
    ${h2('Action Required: Document Uploaded for Review')}
    ${p(greeting)}
    ${p(`Your client <strong>${esc(clientName)}</strong> has uploaded ${docNames?.length > 1 ? `<strong>${docNames.length} documents</strong>` : 'a <strong>new document</strong>'} to case <strong>${esc(caseNumber || 'your case')}</strong> that require${docNames?.length > 1 ? '' : 's'} your review.`)}
    ${docList}
    <div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 18px;border-radius:6px;margin:0 0 20px">
      <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 4px">Review Required</p>
      <p style="color:#92400e;font-size:13px;margin:0">Please review and mark the document(s) as accepted or request revisions from your client.</p>
    </div>
    ${btn(reviewUrl || `${config.client.url}/documents`, 'Review Documents Now')}
    <p style="color:#9ca3af;font-size:13px">You can accept, reject, or request changes from your TriVanta document dashboard. Your client will be notified of your decision.</p>
  `);
}

function tmplDocumentReminder({ firstName, caseNumber, missingCount, missingLabels }) {
  const shown = (missingLabels || []).slice(0, 6);
  const extra = (missingLabels || []).length - shown.length;
  const list  = shown.map(l => `<li style="color:#374151;font-size:14px;padding:3px 0">${esc(l)}</li>`).join('')
    + (extra > 0 ? `<li style="color:#6b7280;font-size:13px;padding:3px 0">+ ${extra} more</li>` : '');
  return wrap(`
    ${h2('A few documents are still needed')}
    ${p(`Hi ${esc(firstName) || 'there'}, your case${caseNumber ? ` <strong>${esc(caseNumber)}</strong>` : ''} still needs <strong>${missingCount} required document${missingCount !== 1 ? 's' : ''}</strong> to keep moving forward:`)}
    <ul style="margin:12px 0 20px;padding-left:20px">${list}</ul>
    ${p("Uploading these now keeps your case on track and speeds up your attorney's review.")}
    ${btn(`${config.client.url}/checklist`, 'Upload Documents')}
  `);
}

function tmplDocumentAvailable({ firstName, uploaderName, caseNumber, docName }) {
  return wrap(`
    ${h2('A new document was added to your case')}
    ${p(`Hi ${esc(firstName) || 'there'}, <strong>${esc(uploaderName) || 'your attorney'}</strong> added a new document${caseNumber ? ` to case <strong>${esc(caseNumber)}</strong>` : ''}:`)}
    <div style="background:#f3f4f6;border-radius:8px;padding:12px 16px;margin:0 0 20px;color:#374151;font-size:14px;font-weight:600">${esc(docName)}</div>
    ${btn(`${config.client.url}/documents`, 'View Document')}
  `);
}

function tmplDocumentReviewedEmail({ firstName, caseNumber, docName, status, note }) {
  const approved = status === 'accepted';
  return wrap(`
    ${h2(approved ? 'Document approved' : `Document ${esc(status)}`)}
    ${p(`Hi ${esc(firstName) || 'there'}, your document <strong>${esc(docName)}</strong>${caseNumber ? ` on case <strong>${esc(caseNumber)}</strong>` : ''} has been ${esc(status)} by your attorney.`)}
    ${note ? `
      <div style="background:#fef3c7;border-left:4px solid #d97706;padding:14px 18px;border-radius:6px;margin:0 0 20px">
        <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 4px">What to fix</p>
        <p style="color:#92400e;font-size:13px;margin:0">${esc(note)}</p>
      </div>
    ` : ''}
    ${btn(`${config.client.url}/documents`, approved ? 'View Document' : 'Upload Corrected File')}
  `);
}