const { one, all, run } = require('../db');
const { inList } = require('../lib/sql');

const TaskRepository = {
  findByMatters(ids, { limit, offset } = {}) {
    const il = inList(ids);
    return all(
      `SELECT * FROM tasks WHERE matter_id IN (${il}) ORDER BY due_date ASC LIMIT ? OFFSET ?`,
      [...ids, limit, offset]
    );
  },

  findAll({ limit, offset } = {}) {
    return all(
      'SELECT * FROM tasks ORDER BY due_date ASC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  },

  findById(id) {
    return one('SELECT id, assigned_to, matter_id FROM tasks WHERE id = ?', [id]);
  },

  // Single aggregation: replaces 4 separate COUNT queries in the client dashboard.
  async aggregateByMatters(ids, today) {
    const il = inList(ids);
    const row = await one(
      `SELECT
         COUNT(*)                                                                  AS total,
         SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END)                  AS open,
         SUM(CASE WHEN status = 'completed'  THEN 1 ELSE 0 END)                  AS completed,
         SUM(CASE WHEN status != 'completed' AND due_date < ? THEN 1 ELSE 0 END) AS overdue
       FROM tasks WHERE matter_id IN (${il})`,
      [today, ...ids]
    );
    return {
      total:     Number(row?.total)     || 0,
      open:      Number(row?.open)      || 0,
      completed: Number(row?.completed) || 0,
      overdue:   Number(row?.overdue)   || 0,
    };
  },

  // Fetches active tasks sorted by due date — enough rows to serve both the
  // task list and deadline tiles without a second query.
  findActiveByMatters(ids, limit = 10) {
    const il = inList(ids);
    return all(
      `SELECT id, title, description, status, due_date, action_label
       FROM tasks WHERE matter_id IN (${il}) AND status != 'completed'
       ORDER BY due_date ASC LIMIT ?`,
      [...ids, limit]
    );
  },

  findAllActiveForPartner(limit = 20) {
    return all(
      `SELECT tk.*,
              m.description AS matter_description,
              u.first_name || ' ' || u.last_name AS client_name
       FROM tasks tk
       LEFT JOIN matters m ON tk.matter_id  = m.id
       LEFT JOIN users   u ON tk.assigned_to = u.id
       WHERE tk.status != 'completed'
       ORDER BY tk.due_date ASC LIMIT ?`,
      [limit]
    );
  },

  async globalStats(today) {
    const row = await one(`
      SELECT
        COUNT(*)                                              AS total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status != 'completed' AND due_date < ? THEN 1 ELSE 0 END) AS overdue
      FROM tasks
    `, [today]);
    return {
      total:     Number(row?.total)     || 0,
      completed: Number(row?.completed) || 0,
      overdue:   Number(row?.overdue)   || 0,
    };
  },

  async create({ matterId, assignedTo, title, description, dueDate, priority, actionLabel }) {
    const r = await run(
      'INSERT INTO tasks (matter_id, assigned_to, title, description, due_date, priority, action_label) VALUES (?,?,?,?,?,?,?)',
      [matterId || null, assignedTo, title, description || null, dueDate || null,
       priority || 'normal', actionLabel || null]
    );
    return one('SELECT * FROM tasks WHERE id = ?', [r.insertId]);
  },

  updateStatus(id, status) {
    return run('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
  },
};

module.exports = TaskRepository;