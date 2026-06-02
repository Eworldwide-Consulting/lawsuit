const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    if (req.user.role === 'client') {
      const ids = db.prepare('SELECT id FROM matters WHERE client_id=?').all(req.user.id).map(m => m.id);
      if (!ids.length) return res.json([]);
      return res.json(db.prepare(`SELECT * FROM appointments WHERE matter_id IN (${ids.map(()=>'?').join(',')}) ORDER BY start_time ASC`).all(...ids));
    }
    res.json(db.prepare('SELECT * FROM appointments ORDER BY start_time ASC').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/upcoming', requireAuth, (req, res) => {
  try {
    const db  = getDb();
    const now = new Date().toISOString();
    if (req.user.role === 'client') {
      const ids = db.prepare('SELECT id FROM matters WHERE client_id=?').all(req.user.id).map(m => m.id);
      if (!ids.length) return res.json([]);
      return res.json(db.prepare(`SELECT * FROM appointments WHERE matter_id IN (${ids.map(()=>'?').join(',')}) AND start_time>=? ORDER BY start_time ASC LIMIT 5`).all(...ids, now));
    }
    res.json(db.prepare('SELECT * FROM appointments WHERE start_time>=? ORDER BY start_time ASC LIMIT 10').all(now));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, (req, res) => {
  try {
    const { matterId, title, type, startTime, endTime, location, notes } = req.body;
    if (!title || !startTime) return res.status(400).json({ error: 'title and startTime required' });
    const db = getDb();
    const r  = db.prepare('INSERT INTO appointments (matter_id,title,type,start_time,end_time,location,notes) VALUES (?,?,?,?,?,?,?)')
      .run(matterId||null, title, type||'teleconference', startTime, endTime||null, location||null, notes||null);
    res.status(201).json(db.prepare('SELECT * FROM appointments WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const a  = db.prepare('SELECT id FROM appointments WHERE id=?').get(req.params.id);
    if (!a) return res.status(404).json({ error: 'Appointment not found' });
    db.prepare('DELETE FROM appointments WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
