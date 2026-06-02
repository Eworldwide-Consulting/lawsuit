const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

const requireIT = [requireAuth, requireRole('itsupport', 'partner')];

router.get('/stats', ...requireIT, (req, res) => {
  try {
    const db = getDb();
    res.json({
      users:        db.prepare('SELECT COUNT(*) c FROM users').get().c,
      matters:      db.prepare('SELECT COUNT(*) c FROM matters').get().c,
      documents:    db.prepare('SELECT COUNT(*) c FROM documents').get().c,
      messages:     db.prepare('SELECT COUNT(*) c FROM messages').get().c,
      appointments: db.prepare('SELECT COUNT(*) c FROM appointments').get().c,
      tasks:        db.prepare('SELECT COUNT(*) c FROM tasks').get().c,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', ...requireIT, (req, res) => {
  try {
    res.json(getDb().prepare('SELECT id,first_name,last_name,email,role,email_verified,approval_status,created_at FROM users ORDER BY created_at DESC').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/approve', ...requireIT, (req, res) => {
  try {
    getDb().prepare("UPDATE users SET approval_status='approved' WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/reject', ...requireIT, (req, res) => {
  try {
    getDb().prepare("UPDATE users SET approval_status='rejected' WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
