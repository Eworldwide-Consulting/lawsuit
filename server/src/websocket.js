// WebSocket server. When REDIS_URL is set, attaches the @socket.io/redis-adapter
// so that emitToUser() works correctly across multiple Node processes.
//
// Multi-instance upgrade path:
//   npm install @socket.io/redis-adapter
//   Set REDIS_URL — the adapter loads automatically on next boot.

const { Server }    = require('socket.io');
const jwt           = require('jsonwebtoken');
const logger        = require('./logger');
const config        = require('./config');

let io = null;

async function init(httpServer) {
  io = new Server(httpServer, {
    cors:          { origin: config.client.url, credentials: true },
    pingTimeout:   60_000,
    pingInterval:  25_000,
  });

  // Attach Redis pub/sub adapter when Redis is available — this is what
  // allows emitToUser() to reach sockets on *other* Node instances.
  if (config.redis.url) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient }  = require('redis');
      const pub = createClient({ url: config.redis.url });
      const sub = pub.duplicate();
      await Promise.all([pub.connect(), sub.connect()]);
      io.adapter(createAdapter(pub, sub));
      logger.info('Socket.io Redis adapter attached — multi-instance WebSocket active');
    } catch (err) {
      logger.warn({ err: err.message }, 'Redis adapter unavailable — using in-memory WebSocket (single-instance only)');
    }
  }

  // JWT auth middleware — H1: token from auth header only (never query string, which gets logged)
  // C1: reject tempTokens that haven't completed 2FA
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      if (decoded.twoFaPending) return next(new Error('2FA not completed'));
      socket.userId   = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    if (socket.userRole) socket.join(`role:${socket.userRole}`);
    logger.debug({ userId: socket.userId, role: socket.userRole }, 'WebSocket connected');

    // C3: verify the connecting user belongs to the requested matter before joining
    socket.on('join:matter', async (matterId) => {
      try {
        const { one } = require('./db');
        const matter = await one(
          'SELECT client_id, attorney_id FROM matters WHERE id = ?',
          [matterId]
        );
        if (!matter) return;
        const isAdmin = socket.userRole === 'partner' || socket.userRole === 'itsupport';
        const isMember = matter.client_id === socket.userId || matter.attorney_id === socket.userId;
        if (isAdmin || isMember) socket.join(`matter:${matterId}`);
      } catch (err) {
        logger.warn({ err: err.message, matterId }, 'join:matter auth check failed');
      }
    });

    socket.on('leave:matter', matterId => socket.leave(`matter:${matterId}`));
    socket.on('disconnect',   reason   => logger.debug({ userId: socket.userId, reason }, 'WebSocket disconnected'));
  });

  logger.info('WebSocket server initialized');
  return io;
}

function getIo()                       { return io; }
function emitToUser(userId, event, d)  { io?.to(`user:${userId}`).emit(event, d); }
function emitToMatter(mId, event, d)   { io?.to(`matter:${mId}`).emit(event, d); }
function emitToRole(role, event, d)    { io?.to(`role:${role}`).emit(event, d); }

module.exports = { init, getIo, emitToUser, emitToMatter, emitToRole };