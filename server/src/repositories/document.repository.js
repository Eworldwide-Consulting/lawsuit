const { one, all, run } = require('../db');
const { inList } = require('../lib/sql');

const DocumentRepository = {
  findByMatter(matterId, { limit, offset } = {}) {
    return all(
      'SELECT * FROM documents WHERE matter_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [matterId, limit, offset]
    );
  },

  findByMatters(ids, { limit, offset } = {}) {
    const il = inList(ids);
    return all(
      `SELECT * FROM documents WHERE matter_id IN (${il}) ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...ids, limit, offset]
    );
  },

  // All docs a client can see: their matter docs + any they uploaded without a matter
  findByClientAll(userId, matterIds, { limit, offset } = {}) {
    if (matterIds.length > 0) {
      const il = inList(matterIds);
      return all(
        `SELECT * FROM documents
         WHERE matter_id IN (${il}) OR (user_id = ? AND matter_id IS NULL)
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...matterIds, userId, limit, offset]
      );
    }
    return all(
      `SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
  },

  findAll({ limit, offset } = {}) {
    return all(
      'SELECT * FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  },

  // Returns doc joined with its matter's client_id — needed for ownership checks.
  findByIdWithMatter(id) {
    return one(
      `SELECT d.*, m.client_id
       FROM documents d
       LEFT JOIN matters m ON d.matter_id = m.id
       WHERE d.id = ?`,
      [id]
    );
  },

  findById(id) {
    return one('SELECT * FROM documents WHERE id = ?', [id]);
  },

  // Lightweight select for dashboard aggregation — avoids transferring file_path etc.
  findCategoryStatsByMatters(ids) {
    const il = inList(ids);
    return all(
      `SELECT category, status, required FROM documents WHERE matter_id IN (${il})`,
      ids
    );
  },

  async create({ matterId, userId, name, category, docType, filename, size }) {
    const r = await run(
      'INSERT INTO documents (matter_id, user_id, name, category, doc_type, file_path, file_size, status) VALUES (?,?,?,?,?,?,?,?)',
      [matterId || null, userId, name, category || null, docType || null, filename, size, 'uploaded']
    );
    return one('SELECT * FROM documents WHERE id = ?', [r.insertId]);
  },

  updateStatus(id, status) {
    return run('UPDATE documents SET status = ? WHERE id = ?', [status, id]);
  },

  delete(id) {
    return run('DELETE FROM documents WHERE id = ?', [id]);
  },
};

module.exports = DocumentRepository;