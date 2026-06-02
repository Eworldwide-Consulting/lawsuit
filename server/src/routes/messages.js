const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT m.*, u.first_name||' '||u.last_name AS from_name, u.avatar_initials AS from_initials
      FROM messages m LEFT JOIN users u ON m.from_user_id=u.id
      WHERE m.to_user_id=? ORDER BY m.created_at DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sent', requireAuth, (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT m.*, u.first_name||' '||u.last_name AS to_name
      FROM messages m LEFT JOIN users u ON m.to_user_id=u.id
      WHERE m.from_user_id=? ORDER BY m.created_at DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/unread-count', requireAuth, (req, res) => {
  try {
    const { c } = getDb().prepare('SELECT COUNT(*) c FROM messages WHERE to_user_id=? AND read_at IS NULL').get(req.user.id);
    res.json({ count: c || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, (req, res) => {
  try {
    const { toUserId, matterId, subject, body } = req.body;
    if (!toUserId || !body) return res.status(400).json({ error: 'toUserId and body required' });
    const db = getDb();
    const r  = db.prepare('INSERT INTO messages (matter_id,from_user_id,to_user_id,subject,body) VALUES (?,?,?,?,?)')
      .run(matterId||null, req.user.id, toUserId, subject||null, body);
    res.status(201).json(db.prepare('SELECT * FROM messages WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/read', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const msg = db.prepare('SELECT * FROM messages WHERE id=? AND to_user_id=?').get(req.params.id, req.user.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    db.prepare("UPDATE messages SET read_at=datetime('now') WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
