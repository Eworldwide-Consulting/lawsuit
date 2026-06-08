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

router.get('/clients', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    res.json(await all(
      "SELECT id,first_name,last_name,email,phone,avatar_initials,created_at FROM users WHERE role='client' ORDER BY last_name ASC"
    ));
  } catch (err) { next(err); }
});

module.exports = router;