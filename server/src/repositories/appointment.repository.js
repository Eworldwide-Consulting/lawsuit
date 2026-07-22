const { one, all, run } = require('../db');
const { inList } = require('../lib/sql');

const AppointmentRepository = {
  findByMattersAfter(ids, after, limit = 5) {
    const il = inList(ids);
    return all(
      `SELECT * FROM appointments
       WHERE matter_id IN (${il}) AND start_time >= ?
       ORDER BY start_time ASC LIMIT ?`,
      [...ids, after, limit]
    );
  },

  findByMatters(ids, { limit, offset } = {}) {
    const il = inList(ids);
    return all(
      `SELECT * FROM appointments WHERE matter_id IN (${il}) ORDER BY start_time ASC LIMIT ? OFFSET ?`,
      [...ids, limit, offset]
    );
  },

  findAllAfter(after, limit = 10) {
    return all(
      'SELECT * FROM appointments WHERE start_time >= ? ORDER BY start_time ASC LIMIT ?',
      [after, limit]
    );
  },

  findAll({ limit, offset } = {}) {
    return all(
      'SELECT * FROM appointments ORDER BY start_time ASC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  },

  findById(id) {
    return one('SELECT * FROM appointments WHERE id = ?', [id]);
  },

  findForAttorneyDashboard(after, limit = 5) {
    return all(
      `SELECT a.*, m.description AS matter_description, m.case_number
       FROM appointments a
       LEFT JOIN matters m ON a.matter_id = m.id
       WHERE a.start_time >= ?
       ORDER BY a.start_time ASC LIMIT ?`,
      [after, limit]
    );
  },

  async create({ matterId, title, type, startTime, endTime, location, notes }) {
    const r = await run(
      'INSERT INTO appointments (matter_id, title, type, start_time, end_time, location, notes) VALUES (?,?,?,?,?,?,?)',
      [matterId || null, title, type || 'teleconference', startTime, endTime || null, location || null, notes || null]
    );
    return one('SELECT * FROM appointments WHERE id = ?', [r.insertId]);
  },

  delete(id) {
    return run('DELETE FROM appointments WHERE id = ?', [id]);
  },

  updateStatus(id, status) {
    return run('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
  },

  async reschedule(id, { startTime, endTime }) {
    const original = await one('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!original) return null;

    const r = await run(
      'INSERT INTO appointments (matter_id, title, type, start_time, end_time, location, notes, status) VALUES (?,?,?,?,?,?,?,?)',
      [original.matter_id, original.title, original.type, startTime, endTime || null, original.location, original.notes, 'scheduled']
    );
    await run('UPDATE appointments SET status = ? WHERE id = ?', ['rescheduled', id]);

    return one('SELECT * FROM appointments WHERE id = ?', [r.insertId]);
  },
};

module.exports = AppointmentRepository;