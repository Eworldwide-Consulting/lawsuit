const router        = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { all, one }  = require('../db');
const { getDb }     = require('../database');

// Only attorneys, partners can access reports
const staffOnly = [requireAuth, requireRole('attorney', 'partner', 'itsupport')];

function dateFn(column) {
  const db = getDb();
  if (db.type === 'mysql') return `DATE_FORMAT(${column}, '%Y-%m')`;
  return `strftime('%Y-%m', ${column})`;
}

function monthsAgo(n) {
  const db = getDb();
  if (db.type === 'mysql') return `DATE_SUB(NOW(), INTERVAL ${n} MONTH)`;
  return `datetime('now', '-${n} months')`;
}

router.get('/overview', ...staffOnly, async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;

    const [
      totalClients,
      activeMatters,
      totalRevenue,
      pendingInvoices,
      totalDocuments,
      appointmentsThisMonth,
    ] = await Promise.all([
      one(`SELECT COUNT(*) AS n FROM users WHERE role = 'client'`),
      one(`SELECT COUNT(*) AS n FROM matters WHERE status = 'active'`),
      one(`SELECT COALESCE(SUM(amount),0) AS n FROM invoices WHERE status = 'paid' AND created_at >= ${monthsAgo(months)}`),
      one(`SELECT COALESCE(SUM(amount),0) AS n FROM invoices WHERE status = 'pending'`),
      one(`SELECT COUNT(*) AS n FROM documents`),
      one(`SELECT COUNT(*) AS n FROM appointments WHERE created_at >= ${monthsAgo(1)}`),
    ]);

    const revenueByMonth = await all(
      `SELECT ${dateFn('created_at')} AS month, COALESCE(SUM(amount),0) AS revenue, COUNT(*) AS invoices
       FROM invoices WHERE status = 'paid' AND created_at >= ${monthsAgo(months)}
       GROUP BY ${dateFn('created_at')} ORDER BY month ASC`
    );

    const clientsByMonth = await all(
      `SELECT ${dateFn('created_at')} AS month, COUNT(*) AS new_clients
       FROM users WHERE role = 'client' AND created_at >= ${monthsAgo(months)}
       GROUP BY ${dateFn('created_at')} ORDER BY month ASC`
    );

    res.json({
      stats: {
        totalClients:          totalClients?.n   || 0,
        activeMatters:         activeMatters?.n  || 0,
        totalRevenueCents:     totalRevenue?.n   || 0,
        pendingInvoicesCents:  pendingInvoices?.n || 0,
        totalDocuments:        totalDocuments?.n  || 0,
        appointmentsThisMonth: appointmentsThisMonth?.n || 0,
      },
      revenueByMonth,
      clientsByMonth,
    });
  } catch (err) { next(err); }
});

router.get('/revenue', ...staffOnly, async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;

    const [byMonth, byServiceType, collectionRate] = await Promise.all([
      all(
        `SELECT ${dateFn('created_at')} AS month,
                COALESCE(SUM(CASE WHEN status='paid'    THEN amount ELSE 0 END),0) AS collected,
                COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) AS outstanding,
                COUNT(*) AS total_invoices
         FROM invoices WHERE created_at >= ${monthsAgo(months)}
         GROUP BY ${dateFn('created_at')} ORDER BY month ASC`
      ),
      all(
        `SELECT service_type, COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
         FROM invoices WHERE status='paid' AND created_at >= ${monthsAgo(months)}
         GROUP BY service_type ORDER BY total DESC`
      ),
      one(
        `SELECT
           COUNT(*) AS total_invoices,
           SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) AS paid_invoices,
           COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS collected_amount,
           COALESCE(SUM(amount),0) AS total_amount
         FROM invoices WHERE created_at >= ${monthsAgo(months)}`
      ),
    ]);

    res.json({ byMonth, byServiceType, collectionRate });
  } catch (err) { next(err); }
});

router.get('/cases', ...staffOnly, async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;

    const [byType, byStage, byStatus, openedByMonth] = await Promise.all([
      all(`SELECT matter_type, COUNT(*) AS count FROM matters GROUP BY matter_type ORDER BY count DESC`),
      all(`SELECT stage, COUNT(*) AS count FROM matters GROUP BY stage ORDER BY count DESC`),
      all(`SELECT status, COUNT(*) AS count FROM matters GROUP BY status`),
      all(
        `SELECT ${dateFn('created_at')} AS month, COUNT(*) AS opened
         FROM matters WHERE created_at >= ${monthsAgo(months)}
         GROUP BY ${dateFn('created_at')} ORDER BY month ASC`
      ),
    ]);

    res.json({ byType, byStage, byStatus, openedByMonth });
  } catch (err) { next(err); }
});

router.get('/clients', ...staffOnly, async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;

    const [growthByMonth, byApprovalStatus, recentClients] = await Promise.all([
      all(
        `SELECT ${dateFn('created_at')} AS month, COUNT(*) AS new_clients
         FROM users WHERE role='client' AND created_at >= ${monthsAgo(months)}
         GROUP BY ${dateFn('created_at')} ORDER BY month ASC`
      ),
      all(
        `SELECT approval_status, COUNT(*) AS count
         FROM users WHERE role='client' GROUP BY approval_status`
      ),
      all(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.approval_status, u.created_at,
                m.matter_type, m.status AS matter_status
         FROM users u
         LEFT JOIN matters m ON m.client_id = u.id
         WHERE u.role='client'
         ORDER BY u.created_at DESC LIMIT 10`
      ),
    ]);

    res.json({ growthByMonth, byApprovalStatus, recentClients });
  } catch (err) { next(err); }
});

router.get('/documents', ...staffOnly, async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;

    const [byMonth, total] = await Promise.all([
      all(
        `SELECT ${dateFn('created_at')} AS month, COUNT(*) AS uploads
         FROM documents WHERE created_at >= ${monthsAgo(months)}
         GROUP BY ${dateFn('created_at')} ORDER BY month ASC`
      ),
      one(`SELECT COUNT(*) AS n FROM documents`),
    ]);

    res.json({ byMonth, total: total?.n || 0 });
  } catch (err) { next(err); }
});

router.get('/performance', ...staffOnly, async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;

    const [mattersByAttorney, taskCompletion, appointmentCompletion] = await Promise.all([
      all(
        `SELECT u.first_name || ' ' || u.last_name AS attorney_name,
                COUNT(m.id) AS total_matters,
                SUM(CASE WHEN m.status='closed' THEN 1 ELSE 0 END) AS closed_matters,
                SUM(CASE WHEN m.status='active' THEN 1 ELSE 0 END) AS active_matters
         FROM users u
         LEFT JOIN matters m ON m.attorney_id = u.id
         WHERE u.role IN ('attorney','partner')
         GROUP BY u.id, u.first_name, u.last_name
         ORDER BY total_matters DESC`
      ),
      one(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
         FROM tasks WHERE created_at >= ${monthsAgo(months)}`
      ),
      one(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
         FROM appointments WHERE created_at >= ${monthsAgo(months)}`
      ),
    ]);

    res.json({ mattersByAttorney, taskCompletion, appointmentCompletion });
  } catch (err) { next(err); }
});

module.exports = router;
