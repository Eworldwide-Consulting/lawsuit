const router = require('express').Router();
const { all, one, run }      = require('../db');
const { requireAuth }        = require('../middleware/auth');
const { inList, nowIso, parsePagination } = require('../utils');

// ── List all ──────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    if (req.user.role === 'client') {
      const matterRows = await all('SELECT id FROM matters WHERE client_id = ?', [req.user.id]);
      if (!matterRows.length) return res.json([]);
      const ids = matterRows.map((m) => m.id);
      return res.json(
        await all(
          `SELECT * FROM appointments WHERE matter_id IN (${inList(ids)}) ORDER BY start_time ASC LIMIT ? OFFSET ?`,
          [...ids, limit, offset]
        )
      );
    }

    res.json(
      await all('SELECT * FROM appointments ORDER BY start_time ASC LIMIT ? OFFSET ?', [limit, offset])
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Upcoming ──────────────────────────────────────────────────────────────────

router.get('/upcoming', requireAuth, async (req, res) => {
  try {
    const now = nowIso();

    if (req.user.role === 'client') {
      const matterRows = await all('SELECT id FROM matters WHERE client_id = ?', [req.user.id]);
      if (!matterRows.length) return res.json([]);
      const ids = matterRows.map((m) => m.id);
      return res.json(
        await all(
          `SELECT * FROM appointments WHERE matter_id IN (${inList(ids)}) AND start_time >= ? ORDER BY start_time ASC LIMIT 5`,
          [...ids, now]
        )
      );
    }

    res.json(
      await all(
        'SELECT * FROM appointments WHERE start_time >= ? ORDER BY start_time ASC LIMIT 10',
        [now]
      )
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create ────────────────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  try {
    const { matterId, title, type, startTime, endTime, location, notes } = req.body;
    if (!title || !startTime)
      return res.status(400).json({ error: 'title and startTime required' });

    const r = await run(
      'INSERT INTO appointments (matter_id, title, type, start_time, end_time, location, notes) VALUES (?,?,?,?,?,?,?)',
      [matterId || null, title, type || 'teleconference', startTime, endTime || null, location || null, notes || null]
    );
    res.status(201).json(await one('SELECT * FROM appointments WHERE id = ?', [r.insertId]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete — staff only ───────────────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const appt = await one('SELECT id FROM appointments WHERE id = ?', [req.params.id]);
    if (!appt) return res.status(404).json({ error: 'Not found' });
    await run('DELETE FROM appointments WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
