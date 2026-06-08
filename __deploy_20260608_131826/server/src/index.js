require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const http       = require('http');
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const pinoHttp   = require('pino-http');

const logger        = require('./logger');
const requestId     = require('./middleware/requestId');
const cache         = require('./cache');
const ws            = require('./websocket');
const { initDatabase } = require('./database');

const authRoutes        = require('./routes/auth');
const matterRoutes      = require('./routes/matters');
const documentRoutes    = require('./routes/documents');
const messageRoutes     = require('./routes/messages');
const appointmentRoutes = require('./routes/appointments');
const taskRoutes        = require('./routes/tasks');
const dashboardRoutes   = require('./routes/dashboard');
const userRoutes        = require('./routes/users');
const paymentRoutes     = require('./routes/payments');
const adminRoutes       = require('./routes/admin');

const app          = express();
const server       = http.createServer(app);
const PORT         = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const isDev        = !isProduction;

app.set('trust proxy', 1);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(requestId);
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
app.use(helmet({ contentSecurityPolicy: false }));

// Stripe webhook needs raw body — must come before json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(cors({
  origin: isProduction ? true : (process.env.CLIENT_URL || 'http://localhost:5173'),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting (in-memory; swap store for Redis when horizontal-scaling) ──
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
app.use('/api/auth/login',        authLimiter);
app.use('/api/auth/register',     authLimiter);
app.use('/api/auth/check-email',  authLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/matters',      matterRoutes);
app.use('/api/documents',    documentRoutes);
app.use('/api/messages',     messageRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/tasks',        taskRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/admin',        adminRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const [cacheHealth] = await Promise.allSettled([cache.healthCheck()]);
  res.json({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV,
    uptime: Math.floor(process.uptime()),
    cache: cacheHealth.status === 'fulfilled' ? cacheHealth.value : { status: 'error' },
    timestamp: new Date().toISOString(),
  });
});

// ── Static (production) ───────────────────────────────────────────────────────
if (isProduction) {
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild, { maxAge: '1d', etag: true }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  req.log?.error({ err, requestId: req.id }, 'Unhandled error');
  res.status(status).json({
    error: isProduction ? 'Internal server error' : err.message,
    requestId: req.id,
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  await initDatabase();
  ws.init(server);
  server.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, 'TriVanta API started');
  });
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
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
