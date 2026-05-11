const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  let tasks;
  if (req.user.role === 'client') {
    tasks = db.prepare(`
      SELECT t.* FROM tasks t
      JOIN matters m ON t.matter_id = m.id
      WHERE m.client_id = ? ORDER BY t.due_date ASC
    `).all(req.user.id);
  } else {
    tasks = db.prepare('SELECT * FROM tasks ORDER BY due_date ASC').all();
  }
  res.json(tasks);
});

router.post('/', requireAuth, (req, res) => {
  const { matterId, assignedTo, title, description, dueDate, priority, actionLabel } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO tasks (matter_id, assigned_to, title, description, due_date, priority, action_label)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(matterId || null, assignedTo || req.user.id, title, description || null, dueDate || null, priority || 'normal', actionLabel || null);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const db = getDb();
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

module.exports = router;
