// Unified notification service — persists to DB and pushes real-time
// via WebSocket. Components call this; nothing emits directly to socket.io.

const { run, all, one } = require('../db');
const ws     = require('../websocket');
const logger = require('../logger');
const { getQueue, QUEUE_NAMES } = require('../queue');

const TYPES = {
  NEW_MESSAGE:          'new_message',
  DOCUMENT_REVIEWED:    'document_reviewed',
  TASK_ASSIGNED:        'task_assigned',
  TASK_DUE_SOON:        'task_due_soon',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  MATTER_UPDATED:       'matter_updated',
  INVOICE_CREATED:      'invoice_created',
  INVOICE_PAID:         'invoice_paid',
};

const JOB_NAME = 'deliver_notification';

// Create a notification — persists to DB, then pushes via WebSocket
async function create({ userId, type, title, body, entityType, entityId }) {
  let notifId;
  try {
    const result = await run(
      `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, type, title, body, entityType || null, entityId || null]
    );
    notifId = result.insertId;
  } catch (err) {
    logger.error({ err, userId, type }, 'Notification DB insert failed');
    return null;
  }

  // Push real-time via WebSocket (best-effort — user may not be connected)
  const payload = { id: notifId, type, title, body, entityType, entityId, createdAt: new Date().toISOString() };
  ws.emitToUser(userId, 'notification:new', payload);

  // Also queue for any secondary delivery (e.g. email digest)
  getQueue(QUEUE_NAMES.NOTIFICATION).add(JOB_NAME, { userId, notifId, ...payload });

  return notifId;
}

// Convenience builders — callers use these instead of knowing the shape
const NotificationService = {
  TYPES,
  create,

  newMessage(toUserId, { fromName, subject, messageId }) {
    return create({
      userId:     toUserId,
      type:       TYPES.NEW_MESSAGE,
      title:      `New message from ${fromName}`,
      body:       subject,
      entityType: 'message',
      entityId:   messageId,
    });
  },

  documentReviewed(toUserId, { docName, status, matterId, note }) {
    return create({
      userId:     toUserId,
      type:       TYPES.DOCUMENT_REVIEWED,
      title:      `Document ${status}`,
      body:       note ? `${docName} — ${note}` : docName,
      entityType: 'matter',
      entityId:   matterId,
    });
  },

  taskAssigned(toUserId, { taskTitle, taskId }) {
    return create({
      userId:     toUserId,
      type:       TYPES.TASK_ASSIGNED,
      title:      'New task assigned',
      body:       taskTitle,
      entityType: 'task',
      entityId:   taskId,
    });
  },

  matterUpdated(toUserId, { caseNumber, matterId }) {
    return create({
      userId:     toUserId,
      type:       TYPES.MATTER_UPDATED,
      title:      'Matter updated',
      body:       `Case ${caseNumber} was updated`,
      entityType: 'matter',
      entityId:   matterId,
    });
  },

  invoiceCreated(toUserId, { amount, invoiceId }) {
    const dollars = (amount / 100).toFixed(2);
    return create({
      userId:     toUserId,
      type:       TYPES.INVOICE_CREATED,
      title:      'New invoice',
      body:       `$${dollars} due`,
      entityType: 'invoice',
      entityId:   invoiceId,
    });
  },

  // Data access methods used by the notifications route
  async getForUser(userId, { limit = 50, offset = 0 } = {}) {
    return all(
      `SELECT id, type, title, body, entity_type, entity_id, read_at, created_at
       FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
  },

  async getUnreadCount(userId) {
    const row = await one(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );
    return Number(row?.cnt || 0);
  },

  async markRead(id, userId) {
    return run(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
  },

  async markAllRead(userId) {
    return run(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );
  },
};

module.exports = NotificationService;