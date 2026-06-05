const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('./logger');

let io = null;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // JWT is signed with { userId, role } — match the signToken() shape in auth.js
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const room = `user:${socket.userId}`;
    socket.join(room);
    logger.debug({ userId: socket.userId }, 'WebSocket connected');

    socket.on('join:matter', (matterId) => {
      socket.join(`matter:${matterId}`);
    });

    socket.on('leave:matter', (matterId) => {
      socket.leave(`matter:${matterId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: socket.userId, reason }, 'WebSocket disconnected');
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

function getIo() {
  return io;
}

function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

function emitToMatter(matterId, event, data) {
  if (!io) return;
  io.to(`matter:${matterId}`).emit(event, data);
}

function emitToRole(role, event, data) {
  if (!io) return;
  io.emit(event, data);
}

module.exports = { init, getIo, emitToUser, emitToMatter, emitToRole };
