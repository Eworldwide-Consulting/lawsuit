const router = require('express').Router();
const { all, one, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'client') {
      const ids = (await all('SELECT id FROM matters WHERE client_id=?', [req.user.id])).map(m => m.id);
      if (!ids.length) return res.json([]);
      return res.json(await all(`SELECT * FROM appointments WHERE matter_id IN (${ids.map(()=>'?').join(',')}) ORDER BY start_time ASC`, ids));
    }
    res.json(await all('SELECT * FROM appointments ORDER BY start_time ASC'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/upcoming', requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString().slice(0, 19);
    if (req.user.role === 'client') {
      const ids = (await all('SELECT id FROM matters WHERE client_id=?', [req.user.id])).map(m => m.id);
      if (!ids.length) return res.json([]);
      return res.json(await all(`SELECT * FROM appointments WHERE matter_id IN (${ids.map(()=>'?').join(',')}) AND start_time>=? ORDER BY start_time ASC LIMIT 5`, [...ids, now]));
    }
    res.json(await all('SELECT * FROM appointments WHERE start_time>=? ORDER BY start_time ASC LIMIT 10', [now]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { matterId, title, type, startTime, endTime, location, notes } = req.body;
    if (!title || !startTime) return res.status(400).json({ error: 'title and startTime required' });
    const r = await run('INSERT INTO appointments (matter_id,title,type,start_time,end_time,location,notes) VALUES (?,?,?,?,?,?,?)',
      [matterId||null, title, type||'teleconference', startTime, endTime||null, location||null, notes||null]);
    res.status(201).json(await one('SELECT * FROM appointments WHERE id=?', [r.insertId]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const a = await one('SELECT id FROM appointments WHERE id=?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Not found' });
    await run('DELETE FROM appointments WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
