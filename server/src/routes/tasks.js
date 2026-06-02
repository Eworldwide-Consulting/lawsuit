const router = require('express').Router();
const { all, one, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'client') {
      const ids = (await all('SELECT id FROM matters WHERE client_id=?', [req.user.id])).map(m => m.id);
      if (!ids.length) return res.json([]);
      return res.json(await all(`SELECT * FROM tasks WHERE matter_id IN (${ids.map(()=>'?').join(',')}) ORDER BY due_date ASC`, ids));
    }
    res.json(await all('SELECT * FROM tasks ORDER BY due_date ASC'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { matterId, assignedTo, title, description, dueDate, priority, actionLabel } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const r = await run('INSERT INTO tasks (matter_id,assigned_to,title,description,due_date,priority,action_label) VALUES (?,?,?,?,?,?,?)',
      [matterId||null, assignedTo||req.user.id, title, description||null, dueDate||null, priority||'normal', actionLabel||null]);
    res.status(201).json(await one('SELECT * FROM tasks WHERE id=?', [r.insertId]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const task = await one('SELECT id FROM tasks WHERE id=?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE tasks SET status=? WHERE id=?', [req.body.status, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
