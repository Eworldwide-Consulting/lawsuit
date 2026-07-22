// SMS delivery for the phone-based password reset flow. Gracefully disabled
// until TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER are set —
// same "no-op until configured" pattern already used for Stripe (payments.js)
// and SMTP (email.service.js), so this ships safely with no credentials yet.

const config = require('../config');

const client = (config.sms.accountSid && config.sms.authToken)
  ? require('twilio')(config.sms.accountSid, config.sms.authToken)
  : null;

async function sendResetCode(phone, code) {
  if (!client) return { delivered: false, reason: 'SMS not configured' };
  try {
    await client.messages.create({
      body: `Your TriVanta password reset code is ${code}. It expires in 10 minutes.`,
      from: config.sms.fromNumber,
      to:   phone,
    });
    return { delivered: true };
  } catch (err) {
    return { delivered: false, reason: err.message };
  }
}

module.exports = {
  sendResetCode,
  isConfigured: () => Boolean(client),
};
