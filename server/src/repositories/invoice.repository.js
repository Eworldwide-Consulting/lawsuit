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