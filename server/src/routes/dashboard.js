const router = require('express').Router();
const { requireAuth }    = require('../middleware/auth');
const DashboardService   = require('../services/dashboard.service');
const MatterRepo         = require('../repositories/matter.repository');
const { all }            = require('../db');

router.get('/client', requireAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, max-age=30');
    res.json(await DashboardService.clientDashboard(req.user.id));
  } catch (err) { next(err); }
});

router.get('/attorney', requireAuth, async (req, res, next) => {
  try {
    res.json(await DashboardService.attorneyDashboard(req.user.id));
  } catch (err) { next(err); }
});

router.get('/attorney/clients', requireAuth, async (req, res, next) => {
  try {
    const clients = await all(`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.phone,
        u.avatar_initials, u.created_at,
        m.id          AS matter_id,
        m.case_number, m.matter_type, m.stage, m.status,
        m.important_date, m.description
      FROM users u
      LEFT JOIN matters m ON m.client_id = u.id
      WHERE u.role = 'client'
      ORDER BY u.last_name ASC, u.first_name ASC
    `);

    const grouped = {};
    for (const c of clients) {
      const key = c.matter_type || 'unassigned';
      (grouped[key] = grouped[key] || []).push(c);
    }

    res.json({ clients, grouped });
  } catch (err) { next(err); }
});

router.get('/partner', requireAuth, async (req, res, next) => {
  try {
    res.json(await DashboardService.partnerDashboard());
  } catch (err) { next(err); }
});

module.exports = router;