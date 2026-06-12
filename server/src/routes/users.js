const router = require('express').Router();
const { all }  = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    res.json(await all(
      'SELECT id,first_name,last_name,email,role,phone,avatar_initials,created_at FROM users ORDER BY created_at DESC'
    ));
  } catch (err) { next(err); }
});

router.get('/attorneys', requireAuth, async (req, res, next) => {
  try {
    res.json(await all(
      "SELECT id,first_name,last_name,email,role,avatar_initials FROM users WHERE role IN ('attorney','partner') ORDER BY first_name ASC"
    ));
  } catch (err) { next(err); }
});

// Available (approved + verified) attorneys that clients can self-assign
router.get('/available-attorneys', requireAuth, async (req, res, next) => {
  try {
    res.json(await all(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_initials, u.role,
              up.specializations, up.years_experience, up.firm_role
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.role IN ('attorney','partner')
         AND u.email_verified = 1
         AND (u.approval_status = 'approved' OR u.approval_status IS NULL)
       ORDER BY u.first_name ASC`
    ));
  } catch (err) { next(err); }
});

router.get('/clients', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    res.json(await all(
      "SELECT id,first_name,last_name,email,phone,avatar_initials,created_at FROM users WHERE role='client' ORDER BY last_name ASC"
    ));
  } catch (err) { next(err); }
});

// Clients whose matters are assigned to the current attorney
router.get('/my-clients', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_initials, u.created_at,
              m.id AS matter_id, m.case_number, m.matter_type, m.stage, m.status, m.description
       FROM matters m
       JOIN users u ON u.id = m.client_id
       WHERE m.attorney_id = ? AND u.role = 'client'
       ORDER BY u.last_name ASC, u.first_name ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;