const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    if (req.user.role === 'client') {
      const ids = db.prepare('SELECT id FROM matters WHERE client_id=?').all(req.user.id).map(m => m.id);
      if (!ids.length) return res.json([]);
      return res.json(db.prepare(`SELECT * FROM tasks WHERE matter_id IN (${ids.map(()=>'?').join(',')}) ORDER BY due_date ASC`).all(...ids));
    }
    res.json(db.prepare('SELECT * FROM tasks ORDER BY due_date ASC').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, (req, res) => {
  try {
    const { matterId, assignedTo, title, description, dueDate, priority, actionLabel } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const db = getDb();
    const r  = db.prepare('INSERT INTO tasks (matter_id,assigned_to,title,description,due_date,priority,action_label) VALUES (?,?,?,?,?,?,?)')
      .run(matterId||null, assignedTo||req.user.id, title, description||null, dueDate||null, priority||'normal', actionLabel||null);
    res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const db   = getDb();
    const task = db.prepare('SELECT id FROM tasks WHERE id=?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    db.prepare('UPDATE tasks SET status=? WHERE id=?').run(req.body.status, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
