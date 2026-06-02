const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('attorney','partner'), (req, res) => {
  try {
    res.json(getDb().prepare('SELECT id,first_name,last_name,email,role,phone,avatar_initials,created_at FROM users ORDER BY created_at DESC').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/attorneys', requireAuth, (req, res) => {
  try {
    res.json(getDb().prepare("SELECT id,first_name,last_name,email,role,avatar_initials FROM users WHERE role IN ('attorney','partner') ORDER BY first_name ASC").all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clients', requireAuth, requireRole('attorney','partner'), (req, res) => {
  try {
    res.json(getDb().prepare("SELECT id,first_name,last_name,email,phone,avatar_initials,created_at FROM users WHERE role='client' ORDER BY last_name ASC").all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
