const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const DashboardService   = require('../services/dashboard.service');
const MatterRepo         = require('../repositories/matter.repository');
const { all }            = require('../db');

router.get('/client', requireAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, max-age=30');
    res.json(await DashboardService.clientDashboard(req.user.id));
  } catch (err) { next(err); }
});

router.get('/attorney', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  try {
    res.json(await DashboardService.attorneyDashboard(req.user.id));
  } catch (err) { next(err); }
});

// Attorneys (law firm associates) see only clients whose matter they're the
// responsible attorney on. Partners/itsupport (law firm heads) see every
// client firm-wide. Previously had no role gate at all and no filtering —
// any authenticated user, including clients, could list every client in the firm.
router.get('/attorney/clients', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  try {
    const scoped = req.user.role === 'attorney';
    const clients = await all(`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.phone,
        u.avatar_initials, u.created_at,
        m.id          AS matter_id,
        m.case_number, m.matter_type, m.stage, m.status,
        m.important_date, m.description
      FROM users u
      LEFT JOIN matters m ON m.client_id = u.id
      WHERE u.role = 'client' ${scoped ? 'AND m.attorney_id = ?' : ''}
      ORDER BY u.last_name ASC, u.first_name ASC
    `, scoped ? [req.user.id] : []);

    const grouped = {};
    for (const c of clients) {
      const key = c.matter_type || 'unassigned';
      (grouped[key] = grouped[key] || []).push(c);
    }

    res.json({ clients, grouped });
  } catch (err) { next(err); }
});

// Firm-wide financials — law firm heads (partners) and platform admins only.
router.get('/partner', requireAuth, requireRole('partner', 'itsupport'), async (req, res, next) => {
  try {
    res.json(await DashboardService.partnerDashboard(req.user.id));
  } catch (err) { next(err); }
});

module.exports = router;