const { one, all, run } = require('../db');

const InvoiceRepository = {
  findByClient(clientId, { limit, offset } = {}) {
    return all(
      `SELECT i.*,
              u.first_name || ' ' || u.last_name AS created_by_name,
              m.case_number
       FROM invoices i
       LEFT JOIN users   u ON i.created_by = u.id
       LEFT JOIN matters m ON i.matter_id  = m.id
       WHERE i.client_id = ?
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [clientId, limit, offset]
    );
  },

  findAll({ limit, offset } = {}) {
    return all(
      `SELECT i.*,
              c.first_name || ' ' || c.last_name AS client_name,
              m.case_number
       FROM invoices i
       LEFT JOIN users   c ON i.client_id = c.id
       LEFT JOIN matters m ON i.matter_id = m.id
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  },

  findById(id) {
    return one('SELECT * FROM invoices WHERE id = ?', [id]);
  },

  async create({ clientId, matterId, createdBy, amount, description, serviceType, dueDate }) {
    const r = await run(
      'INSERT INTO invoices (client_id, matter_id, created_by, amount, description, service_type, due_date, status) VALUES (?,?,?,?,?,?,?,?)',
      [clientId, matterId || null, createdBy, Math.round(amount * 100),
       description, serviceType || 'general', dueDate || null, 'pending']
    );
    return one('SELECT * FROM invoices WHERE id = ?', [r.insertId]);
  },

  setStripeSession(id, sessionId) {
    return run('UPDATE invoices SET stripe_session_id = ? WHERE id = ?', [sessionId, id]);
  },

  markPaid(id, paymentIntentId) {
    return run(
      `UPDATE invoices
       SET status = 'paid', paid_at = CURRENT_TIMESTAMP, stripe_payment_intent_id = ?
       WHERE id = ? AND status != 'paid'`,
      [paymentIntentId, id]
    );
  },

  findWithDetails(id) {
    return one(
      `SELECT i.*,
              c.first_name  AS client_first, c.last_name AS client_last,
              c.email       AS client_email,
              a.first_name  AS attorney_first, a.last_name AS attorney_last,
              m.case_number, m.matter_type
       FROM invoices i
       LEFT JOIN users   c ON c.id = i.client_id
       LEFT JOIN users   a ON a.id = i.created_by
       LEFT JOIN matters m ON m.id = i.matter_id
       WHERE i.id = ?`,
      [id]
    );
  },

  update(id, fields) {
    const allowed = ['description', 'amount', 'service_type', 'due_date', 'status', 'receipt_url'];
    const sets = [], vals = [];
    for (const k of allowed) {
      if (k in fields) { sets.push(`${k} = ?`); vals.push(fields[k]); }
    }
    if (!sets.length) return Promise.resolve();
    sets.push('updated_at = CURRENT_TIMESTAMP');
    return run(`UPDATE invoices SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  },

  delete(id) {
    return run('DELETE FROM invoices WHERE id = ? AND status != ?', [id, 'paid']);
  },

  markRefunded(id, { refundAmount, reason, stripeRefundId }) {
    return run(
      `UPDATE invoices
       SET status = 'refunded', refund_amount = ?, refund_reason = ?,
           refunded_at = CURRENT_TIMESTAMP, stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?)
       WHERE id = ?`,
      [refundAmount, reason || null, stripeRefundId || null, id]
    );
  },

  markFailed(id, reason) {
    return run(
      `UPDATE invoices SET status = 'failed', failure_reason = ?, failed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reason || null, id]
    );
  },

  findForExport({ clientId, status, from, to } = {}) {
    const conds = ['1=1'];
    const vals  = [];
    if (clientId) { conds.push('i.client_id = ?'); vals.push(clientId); }
    if (status)   { conds.push('i.status = ?');    vals.push(status); }
    if (from)     { conds.push('i.created_at >= ?'); vals.push(from); }
    if (to)       { conds.push('i.created_at <= ?'); vals.push(to + ' 23:59:59'); }
    return require('../db').all(
      `SELECT i.id, i.status, i.amount, i.description, i.service_type, i.due_date,
              i.created_at, i.paid_at, i.refunded_at,
              (c.first_name || ' ' || c.last_name) AS client_name, c.email AS client_email,
              m.case_number
       FROM invoices i
       LEFT JOIN users   c ON c.id = i.client_id
       LEFT JOIN matters m ON m.id = i.matter_id
       WHERE ${conds.join(' AND ')}
       ORDER BY i.created_at DESC LIMIT 5000`,
      vals
    );
  },

  // YTD revenue and per-month breakdown — used by attorney/partner dashboards.
  ytdRevenue() {
    return one("SELECT COALESCE(SUM(amount), 0) AS ytd FROM invoices WHERE status = 'paid'");
  },

  monthlyRevenue(dbType) {
    const monthExpr =
      dbType === 'postgres' ? 'EXTRACT(MONTH FROM paid_at)::int'
      : dbType === 'mysql'  ? 'MONTH(paid_at)'
      : "CAST(strftime('%m', paid_at) AS INTEGER)";
    return require('../db').all(
      `SELECT ${monthExpr} AS month_num, SUM(amount) AS revenue
       FROM invoices WHERE status = 'paid' GROUP BY month_num`
    );
  },
};

module.exports = InvoiceRepository;