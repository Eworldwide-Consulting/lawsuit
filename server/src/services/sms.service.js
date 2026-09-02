// SMS delivery for the phone-based password reset flow. Gracefully disabled
// until TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER are set —
// same "no-op until configured" pattern already used for Stripe (payments.js)
// and SMTP (email.service.js), so this ships safely with no credentials yet.

const config = require('../config');

const client = (config.sms.accountSid && config.sms.authToken)
  ? require('twilio')(config.sms.accountSid, config.sms.authToken)
  : null;

// Twilio accepts exactly one of messagingServiceSid / from — never both.
function senderParams() {
  if (config.sms.messagingServiceSid) return { messagingServiceSid: config.sms.messagingServiceSid };
  if (config.sms.fromNumber)          return { from: config.sms.fromNumber };
  return null;
}

async function sendResetCode(phone, code) {
  const sender = senderParams();
  if (!client || !sender) return { delivered: false, reason: 'SMS not configured' };
  try {
    await client.messages.create({
      body: `Your TriVanta password reset code is ${code}. It expires in 10 minutes.`,
      to:   phone,
      ...sender,
    });
    return { delivered: true };
  } catch (err) {
    return { delivered: false, reason: err.message };
  }
}

// Generic short-text alert — used for document/message/interaction
// notifications. Callers are responsible for checking the recipient has a
// phone number before calling this; it stays a thin, safe no-op otherwise.
async function sendAlert(phone, text) {
  const sender = senderParams();
  if (!phone || !client || !sender) return { delivered: false, reason: 'SMS not configured' };
  try {
    await client.messages.create({ body: text, to: phone, ...sender });
    return { delivered: true };
  } catch (err) {
    return { delivered: false, reason: err.message };
  }
}

module.exports = {
  sendResetCode,
  sendAlert,
  isConfigured: () => Boolean(client && senderParams()),
};
