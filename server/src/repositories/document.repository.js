const { one, all, run } = require('../db');
const { inList } = require('../lib/sql');

const DocumentRepository = {
  findByMatter(matterId, { limit, offset } = {}) {
    return all(
      `SELECT d.*, u.first_name AS uploader_first, u.last_name AS uploader_last
       FROM documents d LEFT JOIN users u ON u.id = d.user_id
       WHERE d.matter_id = ? ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
      [matterId, limit, offset]
    );
  },

  findByMatters(ids, { limit, offset } = {}) {
    const il = inList(ids);
    return all(
      `SELECT d.*, u.first_name AS uploader_first, u.last_name AS uploader_last
       FROM documents d LEFT JOIN users u ON u.id = d.user_id
       WHERE d.matter_id IN (${il}) ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
      [...ids, limit, offset]
    );
  },

  // All docs a client can see: their matter docs + any they uploaded without a matter
  findByClientAll(userId, matterIds, { limit, offset } = {}) {
    if (matterIds.length > 0) {
      const il = inList(matterIds);
      return all(
        `SELECT d.*, u.first_name AS uploader_first, u.last_name AS uploader_last
         FROM documents d LEFT JOIN users u ON u.id = d.user_id
         WHERE d.matter_id IN (${il}) OR (d.user_id = ? AND d.matter_id IS NULL)
         ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
        [...matterIds, userId, limit, offset]
      );
    }
    return all(
      `SELECT d.*, u.first_name AS uploader_first, u.last_name AS uploader_last
       FROM documents d LEFT JOIN users u ON u.id = d.user_id
       WHERE d.user_id = ? ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
  },

  // attorneyId omitted → firm-wide (partner/itsupport). Provided → only
  // documents on that attorney's own matters (documents has no attorney_id
  // column itself, so this joins through matters).
  findAll({ limit, offset } = {}, attorneyId = null) {
    if (!attorneyId) {
      return all(
        `SELECT d.*, u.first_name AS uploader_first, u.last_name AS uploader_last
         FROM documents d LEFT JOIN users u ON u.id = d.user_id
         ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
    }
    return all(
      `SELECT d.*, u.first_name AS uploader_first, u.last_name AS uploader_last
       FROM documents d
       LEFT JOIN users u ON u.id = d.user_id
       JOIN matters m ON m.id = d.matter_id
       WHERE m.attorney_id = ?
       ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
      [attorneyId, limit, offset]
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

  update(id, { name, category }) {
    return run('UPDATE documents SET name = ?, category = ? WHERE id = ?', [name, category ?? null, id]);
  },

  updateStatus(id, status) {
    return run('UPDATE documents SET status = ? WHERE id = ?', [status, id]);
  },

  // Attorney review verdict — stores who reviewed, when, and the note the
  // client sees (rejection reason). Note is cleared on approval.
  setReviewStatus(id, { status, note = null, reviewedBy = null }) {
    return run(
      'UPDATE documents SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, note, reviewedBy, id]
    );
  },

  // Client re-upload after rejection — swaps the file and puts the document
  // straight back into the attorney's review queue with review fields reset.
  replaceFile(id, { filename, size, name }) {
    return run(
      `UPDATE documents
       SET file_path = ?, file_size = ?, name = ?,
           status = 'pending', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL
       WHERE id = ?`,
      [filename, size, name, id]
    );
  },

  delete(id) {
    return run('DELETE FROM documents WHERE id = ?', [id]);
  },
};

module.exports = DocumentRepository;