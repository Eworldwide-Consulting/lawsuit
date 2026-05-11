const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  let appts;
  if (req.user.role === 'client') {
    appts = db.prepare(`
      SELECT a.* FROM appointments a
      JOIN matters m ON a.matter_id = m.id
      WHERE m.client_id = ? ORDER BY a.start_time ASC
    `).all(req.user.id);
  } else {
    appts = db.prepare('SELECT * FROM appointments ORDER BY start_time ASC').all();
  }
  res.json(appts);
});

router.get('/upcoming', requireAuth, (req, res) => {
  const db = getDb();
  let appts;
  if (req.user.role === 'client') {
    appts = db.prepare(`
      SELECT a.* FROM appointments a
      JOIN matters m ON a.matter_id = m.id
      WHERE m.client_id = ? AND a.start_time >= datetime('now')
      ORDER BY a.start_time ASC LIMIT 5
    `).all(req.user.id);
  } else {
    appts = db.prepare(`
      SELECT * FROM appointments WHERE start_time >= datetime('now')
      ORDER BY start_time ASC LIMIT 10
    `).all();
  }
  res.json(appts);
});

router.post('/', requireAuth, (req, res) => {
  const { matterId, title, type, startTime, endTime, location, notes } = req.body;
  if (!title || !startTime) return res.status(400).json({ error: 'title and startTime required' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO appointments (matter_id, title, type, start_time, end_time, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(matterId || null, title, type || 'teleconference', startTime, endTime || null, location || null, notes || null);
  res.status(201).json(db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
