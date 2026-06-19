// Early crash reporter — stdout so it appears in Hostinger's log panel (stderr is hidden)
process.on('uncaughtException', (err) => {
  console.log('[FATAL] uncaughtException:', err.message);
  console.log('[FATAL] Stack:', err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.log('[FATAL] unhandledRejection:', reason);
  process.exit(1);
});
console.log('[BOOT] index.js top reached, Node', process.version);

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
console.log('[BOOT] dotenv loaded, NODE_ENV=' + process.env.NODE_ENV);

// ── Breadcrumb logs: pinpoint which require() fails if node_modules is missing ─
console.log('[BOOT] loading npm modules...');
const http        = require('http');
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const compression = require('compression');
const path        = require('path');
const pinoHttp    = require('pino-http');
console.log('[BOOT] npm modules loaded');

console.log('[BOOT] loading app modules...');
const logger        = require('./logger');
const config        = require('./config');
const requestId     = require('./middleware/requestId');
const errorHandler  = require('./middleware/errorHandler');
const cache         = require('./cache');
const ws            = require('./websocket');
const { initDatabase }  = require('./database');
const { runMigrations } = require('./migrations/runner');
const { startWorkers }  = require('./queue/workers');
const { queueStats }    = require('./queue');
const { breakers }      = require('./lib/circuit-breaker');
console.log('[BOOT] app modules loaded');

console.log('[BOOT] loading routes...');
const authRoutes        = require('./routes/auth');
const matterRoutes      = require('./routes/matters');
const documentRoutes    = require('./routes/documents');
const messageRoutes     = require('./routes/messages');
const appointmentRoutes = require('./routes/appointments');
const taskRoutes        = require('./routes/tasks');
const dashboardRoutes   = require('./routes/dashboard');
const userRoutes        = require('./routes/users');
const paymentRoutes     = require('./routes/payments');
const adminRoutes         = require('./routes/admin');
const notificationRoutes  = require('./routes/notifications');
const checklistRoutes     = require('./routes/checklists');
const contactRoutes       = require('./routes/contact');
console.log('[BOOT] routes loaded');

const app          = express();
const server       = http.createServer(app);
const { port: PORT, isProduction, client } = config;
const isDev        = !isProduction;

// Sync diagnostic — visible in hPanel runtime log viewer (console.log only)
console.log('[BOOT] PORT=' + PORT + ' isProduction=' + isProduction);
console.log('[BOOT] JWT_SECRET set=' + !!process.env.JWT_SECRET + ' len=' + (process.env.JWT_SECRET || '').length);
console.log('[BOOT] DATABASE_URL set=' + !!process.env.DATABASE_URL);
console.log('[BOOT] NODE_ENV=' + process.env.NODE_ENV);

app.set('trust proxy', 1);

// ── Production guard ──────────────────────────────────────────────────────────
if (isProduction) {
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('[FATAL] Missing required env vars: ' + missing.join(', '));
    logger.fatal({ missing }, 'Missing required production env vars — aborting');
    process.exit(1);
  }
  if (process.env.JWT_SECRET?.length < 32) {
    console.error('[FATAL] JWT_SECRET too short: ' + process.env.JWT_SECRET.length + ' chars (need 32+)');
    logger.fatal('JWT_SECRET is too short for production (min 32 chars) — aborting');
    process.exit(1);
  }
  console.log('[BOOT] production guard passed');
}

// ── Middleware ────────────────────────────────────────────────────────────────
// compression must be first — compresses all subsequent responses
app.use(compression({ threshold: 1024 }));
app.use(requestId);
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

// L1: Redirect HTTP → HTTPS in production (Hostinger terminates SSL but forwards
// the original scheme via X-Forwarded-Proto when trust proxy is enabled).
if (isProduction) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// H3: Enable CSP — allow inline styles (used by React/Vite) but block inline scripts.
// Adjust connect-src / img-src if you add third-party services.
const cspDirectives = {
  defaultSrc:     ["'self'"],
  scriptSrc:      ["'self'"],
  styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  imgSrc:         ["'self'", 'data:', 'blob:'],
  connectSrc:     ["'self'", client.url, 'wss:', 'https://accounts.google.com'],
  fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
  objectSrc:      ["'none'"],
  frameAncestors: ["'none'"],
};
if (isProduction) cspDirectives.upgradeInsecureRequests = [];

app.use(helmet({
  contentSecurityPolicy: { directives: cspDirectives },
  crossOriginEmbedderPolicy: false,
}));

// Stripe webhook needs raw body — must come before json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

const ALLOWED_ORIGINS = [
  client.url,
  process.env.ADMIN_URL || 'https://admin.gkasevault.io',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin (no Origin header) and any whitelisted origin
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// M3: In production, swap to a Redis-backed store so counters survive restarts
// and are shared across PM2 instances. Install rate-limit-redis and set REDIS_URL.
// Until then the in-memory store provides basic protection.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 2000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/api/auth/login',            authLimiter);
app.use('/api/auth/register',         authLimiter);
app.use('/api/auth/forgot-password',  authLimiter);
app.use('/api/auth/reset-password',   authLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/matters',      matterRoutes);
app.use('/api/documents',    documentRoutes);
app.use('/api/messages',     messageRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/tasks',        taskRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/payments',       paymentRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/checklists',     checklistRoutes);
app.use('/api/contact',        contactRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const { one } = require('./db');
  const [cacheHealth, queues, dbPing] = await Promise.allSettled([
    cache.healthCheck(),
    queueStats(),
    one('SELECT 1 AS alive'),
  ]);
  const dbOk     = dbPing.status === 'fulfilled';
  const allOk    = dbOk;
  const httpCode = allOk ? 200 : 503;
  res.status(httpCode).json({
    status:   allOk ? 'ok' : 'degraded',
    version:  process.env.npm_package_version || '1.0.0',
    env:      process.env.NODE_ENV,
    uptime:   Math.floor(process.uptime()),
    memory:   process.memoryUsage(),
    db:       dbOk ? 'ok' : { error: dbPing.reason?.message || 'unreachable' },
    cache:    cacheHealth.status === 'fulfilled' ? cacheHealth.value : { status: 'error' },
    queues:   queues.status === 'fulfilled' ? queues.value : {},
    circuits: Object.fromEntries(Object.entries(breakers).map(([k, b]) => [k, b.toJSON()])),
    timestamp: new Date().toISOString(),
  });
});

// ── Static (production) ───────────────────────────────────────────────────────
if (isProduction) {
  const clientBuild = path.join(__dirname, '../../client/dist');
  // Vite content-hashes every asset filename — safe to cache forever
  app.use('/assets', express.static(path.join(clientBuild, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));
  // index.html must never be cached — it's the entry point for all routes
  app.use(express.static(clientBuild, {
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  // Listen first so the proxy can reach us immediately, preventing 504 timeouts
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log('[BOOT] listening on port ' + PORT);
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'TriVanta API listening');

  try {
    await Promise.race([
      initDatabase(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('initDatabase timed out after 45 s')), 45_000)
      ),
    ]);
  } catch (err) {
    console.error('[FATAL] Database init failed: ' + err.message);
    logger.fatal({ err }, 'Database init failed — shutting down');
    process.exit(1);
  }

  // Run versioned migrations after DB is confirmed live
  try {
    await runMigrations();
  } catch (err) {
    console.error('[FATAL] Migrations failed: ' + err.message);
    logger.fatal({ err }, 'Migrations failed — shutting down');
    process.exit(1);
  }

  await ws.init(server);
  startWorkers();

  // SMTP health check — must happen after startWorkers() so the transport is warm
  const EmailService = require('./services/email.service');
  EmailService.verifySmtp().then(result => {
    if (result.ok) {
      console.log('[BOOT] SMTP OK — host=' + result.host + ' from=' + result.from);
      logger.info({ smtp: { host: result.host, from: result.from } }, 'SMTP connected');
    } else {
      console.warn('[BOOT] *** SMTP NOT AVAILABLE: ' + result.reason + ' ***');
      console.warn('[BOOT] Password reset & transactional emails will NOT be delivered.');
      console.warn('[BOOT] Add these to your .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM');
      logger.warn({ smtp: result }, 'SMTP unavailable — all outbound email will be dropped');
    }
  }).catch(err => console.warn('[BOOT] SMTP check threw: ' + err.message));

  console.log('[BOOT] fully started');
  logger.info('TriVanta fully started');
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(() => {
    logger.info('HTTP server closed');
    const redisClient = cache.getClient();
    if (redisClient) redisClient.quit(() => logger.info('Redis disconnected'));
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});

start().catch((err) => {
  console.error('[FATAL] start() failed: ' + err.message);
  console.error('[FATAL] Stack: ' + err.stack);
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
