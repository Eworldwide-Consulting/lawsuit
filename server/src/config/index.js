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
    secretKey:     optional('STRIPE_SECRET_KEY'),
    webhookSecret: optional('STRIPE_WEBHOOK_SECRET'),
  },

  google: {
    clientId:     optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
  },

  uploads: {
    dir:         optional('UPLOAD_DIR'),
    maxFileMb:   parseInt(optional('MAX_FILE_SIZE_MB', '20')),
  },

  server: {
    url: optional('SERVER_URL'),
  },
};

module.exports = config;