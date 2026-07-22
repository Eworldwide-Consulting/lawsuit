// Centralised config — one place to add, validate, and document env vars.
// Routes and services import from here instead of reading process.env directly.
// This makes it trivial to mock config in tests and impossible to silently
// use undefined values deep in business logic.

const isProduction = process.env.NODE_ENV === 'production';

function required(name) {
  const val = process.env[name];
  if (isProduction && !val) throw new Error(`Missing required env var: ${name}`);
  return val || '';
}

function optional(name, defaultValue = '') {
  return process.env[name] || defaultValue;
}

const config = {
  env:        optional('NODE_ENV', 'development'),
  port:       parseInt(optional('PORT', '5000')),
  isProduction,

  jwt: {
    secret:    required('JWT_SECRET') || 'dev-secret-unsafe',
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },

  db: {
    url:    optional('DATABASE_URL') || optional('SUPABASE_DB_URL'),
    path:   optional('DB_PATH'),
  },

  redis: {
    url: optional('REDIS_URL'),
  },

  client: {
    url: optional('CLIENT_URL', 'http://localhost:5173'),
  },

  smtp: {
    host:   optional('SMTP_HOST'),
    port:   parseInt(optional('SMTP_PORT', '587')),
    secure: /^true$/i.test(optional('SMTP_SECURE')),
    user:   optional('SMTP_USER'),
    pass:   optional('SMTP_PASS'),
    // CRITICAL: When using Gmail SMTP, the From address MUST match the authenticated
    // SMTP_USER account. Sending from noreply@trivanta.com while authing as
    // user@gmail.com causes Gmail 553 rejection, and receiving servers (Hotmail,
    // Outlook) fail SPF since trivanta.com doesn't authorise Gmail IPs.
    // Fix: auto-derive From from SMTP_USER when SMTP_FROM is not explicitly set.
    from:   optional('SMTP_FROM') ||
            (optional('SMTP_USER') ? `"TriVanta" <${optional('SMTP_USER')}>` : '"TriVanta" <noreply@trivanta.com>'),
  },

  stripe: {
    secretKey:          optional('STRIPE_SECRET_KEY'),
    publishableKey:     optional('STRIPE_PUBLISHABLE_KEY'),
    webhookSecret:      optional('STRIPE_WEBHOOK_SECRET'),
    testWebhookSecret:  optional('STRIPE_TEST_WEBHOOK_SECRET'),
  },

  google: {
    clientId:     optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
  },

  sms: {
    accountSid: optional('TWILIO_ACCOUNT_SID'),
    authToken:  optional('TWILIO_AUTH_TOKEN'),
    fromNumber: optional('TWILIO_FROM_NUMBER'),
  },

  uploads: {
    dir:         optional('UPLOAD_DIR'),
    maxFileMb:   parseInt(optional('MAX_FILE_SIZE_MB', '20')),
  },

  server: {
    url: optional('SERVER_URL'),
  },
};

// ── Stripe mode safety check ─────────────────────────────────────────────────
// Runs once at module load so every boot prints which Stripe mode is active.
//
// IMPORTANT: a Stripe key/environment mismatch must never crash the whole
// process. This module is required at the very top of index.js — throwing
// here previously took down the ENTIRE platform (auth, documents, messaging,
// everything) over a payments-only misconfiguration, causing production
// deploys to crash-loop and fail health checks. Wrong-mode keys now disable
// Stripe gracefully (routes return 501) instead of killing the server.
(function validateStripeMode() {
  const key = config.stripe.secretKey;
  if (!key) return; // Stripe not configured — silent pass, routes return 501

  const isTestKey = key.startsWith('sk_test_');
  const isLiveKey = key.startsWith('sk_live_');

  if (!isTestKey && !isLiveKey) {
    console.error(
      `[Stripe] CRITICAL: Unrecognised key prefix in STRIPE_SECRET_KEY. ` +
      `Expected sk_test_... (dev) or sk_live_... (prod). Disabling Stripe.`
    );
    config.stripe.secretKey = '';
    return;
  }

  const mode = isTestKey ? 'TEST' : 'LIVE';
  // eslint-disable-next-line no-console
  console.log(`[Stripe] Running in ${mode} mode (${key.slice(0, 12)}...)`);

  // Live key in non-production → risk of accidental real charges against a
  // dev/staging box. Blast radius here is a single non-prod process, so a
  // hard crash is the right signal to force an immediate fix.
  if (isLiveKey && !isProduction) {
    throw new Error(
      `[Stripe] DANGER: sk_live_ key detected but NODE_ENV="${config.env}". ` +
      `Live keys must only be used in NODE_ENV=production. ` +
      `Switch to a sk_test_ key for development/staging.`
    );
  }

  // Test key in production → payments would silently fail for real users if
  // Stripe were left enabled. Disable Stripe (routes return 501) rather than
  // crashing the whole platform; log loudly so ops fixes the secret and
  // redeploys.
  if (isTestKey && isProduction) {
    console.error(
      `[Stripe] CRITICAL: sk_test_ key detected in NODE_ENV="production". ` +
      `Production requires a sk_live_ key — inject STRIPE_SECRET_KEY=sk_live_... ` +
      `via your secrets manager. Stripe is DISABLED for this boot; all other ` +
      `platform features remain online.`
    );
    config.stripe.secretKey = '';
  }
})();

module.exports = config;