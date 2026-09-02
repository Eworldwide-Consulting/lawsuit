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

  // attorneyId omitted → firm-wide (partner/itsupport). Provided → only
  // appointments on that attorney's own matters (appointments has no
  // attorney_id column of its own, so this joins through matters).
  findAllAfter(after, limit = 10, attorneyId = null) {
    if (!attorneyId) {
      return all(
        'SELECT * FROM appointments WHERE start_time >= ? ORDER BY start_time ASC LIMIT ?',
        [after, limit]
      );
    }
    return all(
      `SELECT a.* FROM appointments a
       JOIN matters m ON a.matter_id = m.id
       WHERE a.start_time >= ? AND m.attorney_id = ?
       ORDER BY a.start_time ASC LIMIT ?`,
      [after, attorneyId, limit]
    );
  },

  findAll({ limit, offset } = {}, attorneyId = null) {
    if (!attorneyId) {
      return all(
        'SELECT * FROM appointments ORDER BY start_time ASC LIMIT ? OFFSET ?',
        [limit, offset]
      );
    }
    return all(
      `SELECT a.* FROM appointments a
       JOIN matters m ON a.matter_id = m.id
       WHERE m.attorney_id = ?
       ORDER BY a.start_time ASC LIMIT ? OFFSET ?`,
      [attorneyId, limit, offset]
    );
  },

  findById(id) {
    return one('SELECT * FROM appointments WHERE id = ?', [id]);
  },

  // attorneyId omitted → firm-wide (partner dashboard). Provided → that
  // attorney's own matters' appointments only (attorney dashboard) — was
  // previously unscoped, leaking every attorney's calendar to every other.
  findForAttorneyDashboard(after, limit = 5, attorneyId = null) {
    const where = attorneyId ? 'WHERE a.start_time >= ? AND m.attorney_id = ?' : 'WHERE a.start_time >= ?';
    const args  = attorneyId ? [after, attorneyId, limit] : [after, limit];
    return all(
      `SELECT a.*, m.description AS matter_description, m.case_number
       FROM appointments a
       LEFT JOIN matters m ON a.matter_id = m.id
       ${where}
       ORDER BY a.start_time ASC LIMIT ?`,
      args
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