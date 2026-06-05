const router = require('express').Router();
const { all, one, run } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { emitToUser } = require('../websocket');

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT m.*,
              u.first_name || ' ' || u.last_name AS from_name,
              u.avatar_initials AS from_initials
       FROM messages m
       LEFT JOIN users u ON m.from_user_id = u.id
       WHERE m.to_user_id = ?
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, 'GET /messages failed');
    res.status(500).json({ error: err.message });
  }
});

router.get('/sent', requireAuth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT m.*,
              u.first_name || ' ' || u.last_name AS to_name
       FROM messages m
       LEFT JOIN users u ON m.to_user_id = u.id
       WHERE m.from_user_id = ?
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }, 'GET /messages/sent failed');
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const row = await one(
      'SELECT COUNT(*) c FROM messages WHERE to_user_id = ? AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ count: Number(row.c) || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, validate(schemas.sendMessage), async (req, res) => {
  try {
    const { toUserId, matterId, subject, body } = req.validated.body;

    const recipient = await one('SELECT id FROM users WHERE id = ?', [toUserId]);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    const r = await run(
      'INSERT INTO messages (matter_id, from_user_id, to_user_id, subject, body) VALUES (?, ?, ?, ?, ?)',
      [matterId || null, req.user.id, toUserId, subject || null, body]
    );
    const msg = await one('SELECT * FROM messages WHERE id = ?', [r.insertId]);

    // Real-time push to recipient if connected
    emitToUser(toUserId, 'message:new', {
      id:         msg.id,
      from_name:  `${req.user.first_name} ${req.user.last_name}`,
      subject:    msg.subject,
      preview:    body.slice(0, 120),
      created_at: msg.created_at,
    });

    res.status(201).json(msg);
  } catch (err) {
    req.log?.error({ err }, 'POST /messages failed');
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const msg = await one(
      'SELECT id FROM messages WHERE id = ? AND to_user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!msg) return res.status(404).json({ error: 'Not found' });
    await run("UPDATE messages SET read_at = datetime('now') WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
