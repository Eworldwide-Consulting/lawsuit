const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const messages = db.prepare(`
    SELECT m.*, u.first_name || ' ' || u.last_name as from_name, u.avatar_initials as from_initials
    FROM messages m JOIN users u ON m.from_user_id = u.id
    WHERE m.to_user_id = ? ORDER BY m.created_at DESC
  `).all(req.user.id);
  res.json(messages);
});

router.get('/sent', requireAuth, (req, res) => {
  const db = getDb();
  const messages = db.prepare(`
    SELECT m.*, u.first_name || ' ' || u.last_name as to_name
    FROM messages m JOIN users u ON m.to_user_id = u.id
    WHERE m.from_user_id = ? ORDER BY m.created_at DESC
  `).all(req.user.id);
  res.json(messages);
});

router.post('/', requireAuth, (req, res) => {
  const { toUserId, matterId, subject, body } = req.body;
  if (!toUserId || !body) return res.status(400).json({ error: 'toUserId and body required' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO messages (matter_id, from_user_id, to_user_id, subject, body)
    VALUES (?, ?, ?, ?, ?)
  `).run(matterId || null, req.user.id, toUserId, subject || null, body);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(msg);
});

router.put('/:id/read', requireAuth, (req, res) => {
  const db = getDb();
  const result = db.prepare("UPDATE messages SET read_at = datetime('now') WHERE id = ? AND to_user_id = ?").run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Message not found' });
  res.json({ success: true });
});

router.get('/unread-count', requireAuth, (req, res) => {
  const db = getDb();
  const { count } = db.prepare('SELECT COUNT(*) as count FROM messages WHERE to_user_id = ? AND read_at IS NULL').get(req.user.id);
  res.json({ count });
});

module.exports = router;
