const { one, all, run } = require('../db');

const MessageRepository = {
  findByRecipient(userId) {
    return all(
      `SELECT m.*,
              u.first_name || ' ' || u.last_name AS from_name,
              u.avatar_initials AS from_initials
       FROM messages m
       LEFT JOIN users u ON m.from_user_id = u.id
       WHERE m.to_user_id = ?
       ORDER BY m.created_at DESC`,
      [userId]
    );
  },

  findBySender(userId) {
    return all(
      `SELECT m.*,
              u.first_name || ' ' || u.last_name AS to_name
       FROM messages m
       LEFT JOIN users u ON m.to_user_id = u.id
       WHERE m.from_user_id = ?
       ORDER BY m.created_at DESC`,
      [userId]
    );
  },

  async unreadCount(userId) {
    const row = await one(
      'SELECT COUNT(*) c FROM messages WHERE to_user_id = ? AND read_at IS NULL',
      [userId]
    );
    return Number(row?.c) || 0;
  },

  findById(id) {
    return one('SELECT * FROM messages WHERE id = ?', [id]);
  },

  findOwnedById(id, userId) {
    return one(
      'SELECT id FROM messages WHERE id = ? AND to_user_id = ?',
      [id, userId]
    );
  },

  findRecentForUser(userId, limit = 5) {
    return all(
      `SELECT m.*,
              u.first_name || ' ' || u.last_name AS from_name,
              u.avatar_initials AS from_initials
       FROM messages m
       LEFT JOIN users u ON m.from_user_id = u.id
       WHERE m.to_user_id = ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  },

  async create({ matterId, fromUserId, toUserId, subject, body }) {
    const r = await run(
      'INSERT INTO messages (matter_id, from_user_id, to_user_id, subject, body) VALUES (?, ?, ?, ?, ?)',
      [matterId || null, fromUserId, toUserId, subject || null, body]
    );
    return one('SELECT * FROM messages WHERE id = ?', [r.insertId]);
  },

  markRead(id) {
    return run('UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  },
};

module.exports = MessageRepository;