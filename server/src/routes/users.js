const router = require('express').Router();
const { all, one } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const EmailService  = require('../services/email.service');
const config        = require('../config');

// Full user directory across every role — law firm heads / platform admins
// only. Not attorney-accessible: a regular attorney has no legitimate need
// to enumerate every account in the firm, including other attorneys'.
router.get('/', requireAuth, requireRole('partner', 'itsupport'), async (req, res, next) => {
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

// Attorneys see only clients whose matter they're the responsible attorney
// on; partners/itsupport (law firm heads) see every client firm-wide.
// Previously unscoped for attorneys too — e.g. leaked the full client list
// into the invoice-creation dropdown on Payments.jsx.
router.get('/clients', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    if (req.user.role === 'attorney') {
      return res.json(await all(
        `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_initials, u.created_at
         FROM users u
         JOIN matters m ON m.client_id = u.id
         WHERE u.role = 'client' AND m.attorney_id = ?
         ORDER BY u.last_name ASC`,
        [req.user.id]
      ));
    }
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

// Client invites an attorney by email — sends a registration invite
router.post('/invite-attorney', requireAuth, async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'email is required' });

    // Check if attorney already registered
    const existing = await one(
      `SELECT id, first_name, last_name, role FROM users WHERE email = ? LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    if (existing && ['attorney', 'partner'].includes(existing.role)) {
      return res.json({
        alreadyRegistered: true,
        attorney: existing,
        message: 'Attorney already on platform — you can select them from the list.',
      });
    }

    const clientName = `${req.user.first_name} ${req.user.last_name}`;
    const signupLink = `${config.client.url}/register`;
    await EmailService.sendAttorneyInvite(email.trim(), { clientName, name: name?.trim() || '', signupLink });

    res.json({ sent: true, email: email.trim() });
  } catch (err) { next(err); }
});

module.exports = router;