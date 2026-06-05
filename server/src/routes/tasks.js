const router = require('express').Router();
const { all, one, run }      = require('../db');
const { requireAuth }        = require('../middleware/auth');
const { inList, parsePagination } = require('../utils');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    if (req.user.role === 'client') {
      const matterRows = await all('SELECT id FROM matters WHERE client_id = ?', [req.user.id]);
      if (!matterRows.length) return res.json([]);
      const ids = matterRows.map((m) => m.id);
      return res.json(
        await all(
          `SELECT * FROM tasks WHERE matter_id IN (${inList(ids)}) ORDER BY due_date ASC LIMIT ? OFFSET ?`,
          [...ids, limit, offset]
        )
      );
    }

    res.json(
      await all('SELECT * FROM tasks ORDER BY due_date ASC LIMIT ? OFFSET ?', [limit, offset])
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { matterId, assignedTo, title, description, dueDate, priority, actionLabel } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const r = await run(
      'INSERT INTO tasks (matter_id, assigned_to, title, description, due_date, priority, action_label) VALUES (?,?,?,?,?,?,?)',
      [matterId || null, assignedTo || req.user.id, title, description || null, dueDate || null, priority || 'normal', actionLabel || null]
    );
    res.status(201).json(await one('SELECT * FROM tasks WHERE id = ?', [r.insertId]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const task = await one(
      'SELECT id, assigned_to, matter_id FROM tasks WHERE id = ?',
      [req.params.id]
    );
    if (!task) return res.status(404).json({ error: 'Not found' });

    // Clients can only update tasks assigned to them.
    // Staff (attorney/partner/itsupport) can update any task.
    const isAssignee = task.assigned_to === req.user.id;
    const isStaff    = ['attorney', 'partner', 'itsupport'].includes(req.user.role);
    if (!isAssignee && !isStaff)
      return res.status(403).json({ error: 'Forbidden' });

    await run('UPDATE tasks SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
