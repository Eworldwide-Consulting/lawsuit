const { one, all, run } = require('../db');
const { inList } = require('../lib/sql');

const MatterRepository = {
  findById(id) {
    return one(
      `SELECT m.*,
              c.first_name || ' ' || c.last_name AS client_name,
              c.email AS client_email,
              c.phone AS client_phone,
              a.first_name || ' ' || a.last_name AS attorney_name
       FROM matters m
       LEFT JOIN users c ON m.client_id   = c.id
       LEFT JOIN users a ON m.attorney_id = a.id
       WHERE m.id = ?`,
      [id]
    );
  },

  findByClientId(clientId, { limit, offset } = {}) {
    const args = limit != null
      ? [clientId, limit, offset]
      : [clientId];
    const pagination = limit != null ? 'LIMIT ? OFFSET ?' : '';
    return all(
      `SELECT m.*,
              a.first_name || ' ' || a.last_name AS attorney_name
       FROM matters m
       LEFT JOIN users a ON m.attorney_id = a.id
       WHERE m.client_id = ?
       ORDER BY m.updated_at DESC ${pagination}`,
      args
    );
  },

  findAll({ limit, offset } = {}) {
    return all(
      `SELECT m.*,
              a.first_name || ' ' || a.last_name AS attorney_name,
              c.first_name || ' ' || c.last_name AS client_name,
              c.avatar_initials AS client_initials
       FROM matters m
       LEFT JOIN users a ON m.attorney_id = a.id
       LEFT JOIN users c ON m.client_id   = c.id
       ORDER BY m.updated_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  },

  // Returns only IDs — for building IN (...) clauses efficiently.
  idsByClientId(clientId) {
    return all('SELECT id FROM matters WHERE client_id = ?', [clientId]);
  },

  async stats() {
    const row = await one(`
      SELECT
        COUNT(*)                                              AS total,
        SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'at_risk'  THEN 1 ELSE 0 END) AS at_risk,
        SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS complete
      FROM matters
    `);
    return {
      total:    Number(row.total),
      active:   Number(row.active),
      atRisk:   Number(row.at_risk),
      complete: Number(row.complete),
    };
  },

  findLatestForClient(clientId) {
    return one(
      `SELECT m.*,
              a.first_name || ' ' || a.last_name AS attorney_name,
              a.email AS attorney_email
       FROM matters m
       LEFT JOIN users a ON m.attorney_id = a.id
       WHERE m.client_id = ?
       ORDER BY m.updated_at DESC
       LIMIT 1`,
      [clientId]
    );
  },

  findForAttorneyDashboard() {
    return all(
      `SELECT m.*,
              c.first_name || ' ' || c.last_name AS client_name,
              c.avatar_initials AS client_initials,
              a.first_name || ' ' || a.last_name AS attorney_name
       FROM matters m
       LEFT JOIN users c ON m.client_id   = c.id
       LEFT JOIN users a ON m.attorney_id = a.id
       ORDER BY m.updated_at DESC
       LIMIT 10`
    );
  },

  async create({ clientId, matterType, description, court, county, urgent,
                 importantDate, hasDocuments, workedWithFirmBefore, additionalNotes, status }) {
    return run(
      `INSERT INTO matters
         (client_id, matter_type, stage, description, court, county,
          urgent, important_date, has_documents, worked_with_firm_before,
          additional_notes, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clientId, matterType || null, 'intake',
        description || null, court || null, county || null,
        urgent ? 1 : 0, importantDate || null,
        hasDocuments ? 1 : 0, workedWithFirmBefore ? 1 : 0,
        additionalNotes || null, status || 'active',
      ]
    );
  },

  setCaseNumber(id, caseNumber) {
    return run('UPDATE matters SET case_number = ? WHERE id = ?', [caseNumber, id]);
  },

  update(id, fields) {
    const allowed = ['attorney_id', 'stage', 'status', 'matter_type', 'description', 'court', 'county',
                     'urgent', 'important_date', 'additional_notes'];
    const sets = [];
    const vals = [];
    for (const k of allowed) {
      if (k in fields) {
        sets.push(`${k} = ?`);
        vals.push(fields[k]);
      }
    }
    if (!sets.length) return Promise.resolve();
    sets.push('updated_at = CURRENT_TIMESTAMP');
    return run(`UPDATE matters SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  },

  findAttorneyById(id) {
    return one(
      "SELECT id, email_verified, approval_status FROM users WHERE id = ? AND role IN ('attorney','partner')",
      [id]
    );
  },

  findStageAndClient(id) {
    return one('SELECT stage, client_id FROM matters WHERE id = ?', [id]);
  },
};

module.exports = MatterRepository;