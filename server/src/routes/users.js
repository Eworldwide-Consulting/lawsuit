const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('attorney', 'partner'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, first_name, last_name, email, role, phone, avatar_initials, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

router.get('/attorneys', requireAuth, (req, res) => {
  const db = getDb();
  const attorneys = db.prepare("SELECT id, first_name, last_name, email, role, avatar_initials FROM users WHERE role IN ('attorney', 'partner') ORDER BY first_name").all();
  res.json(attorneys);
});

router.get('/clients', requireAuth, requireRole('attorney', 'partner'), (req, res) => {
  const db = getDb();
  const clients = db.prepare("SELECT id, first_name, last_name, email, phone, avatar_initials, created_at FROM users WHERE role = 'client' ORDER BY last_name").all();
  res.json(clients);
});

module.exports = router;
