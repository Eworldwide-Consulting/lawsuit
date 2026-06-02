const router = require('express').Router();
const { all, one, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await all(`SELECT m.*, CONCAT(u.first_name,' ',u.last_name) AS from_name, u.avatar_initials AS from_initials FROM messages m LEFT JOIN users u ON m.from_user_id=u.id WHERE m.to_user_id=? ORDER BY m.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sent', requireAuth, async (req, res) => {
  try {
    const rows = await all(`SELECT m.*, CONCAT(u.first_name,' ',u.last_name) AS to_name FROM messages m LEFT JOIN users u ON m.to_user_id=u.id WHERE m.from_user_id=? ORDER BY m.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const row = await one('SELECT COUNT(*) c FROM messages WHERE to_user_id=? AND read_at IS NULL', [req.user.id]);
    res.json({ count: row.c || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { toUserId, matterId, subject, body } = req.body;
    if (!toUserId || !body) return res.status(400).json({ error: 'toUserId and body required' });
    const r = await run('INSERT INTO messages (matter_id,from_user_id,to_user_id,subject,body) VALUES (?,?,?,?,?)', [matterId||null, req.user.id, toUserId, subject||null, body]);
    res.status(201).json(await one('SELECT * FROM messages WHERE id=?', [r.insertId]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const msg = await one('SELECT id FROM messages WHERE id=? AND to_user_id=?', [req.params.id, req.user.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE messages SET read_at=NOW() WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
