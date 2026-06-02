const router = require('express').Router();
const { one, all, run } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const guard = [requireAuth, requireRole('itsupport','partner')];

router.get('/stats', ...guard, async (req, res) => {
  try {
    const [users,matters,documents,messages,appointments,tasks] = await Promise.all([
      one('SELECT COUNT(*) c FROM users'),
      one('SELECT COUNT(*) c FROM matters'),
      one('SELECT COUNT(*) c FROM documents'),
      one('SELECT COUNT(*) c FROM messages'),
      one('SELECT COUNT(*) c FROM appointments'),
      one('SELECT COUNT(*) c FROM tasks'),
    ]);
    res.json({ users:users.c, matters:matters.c, documents:documents.c, messages:messages.c, appointments:appointments.c, tasks:tasks.c });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', ...guard, async (req, res) => {
  try { res.json(await all('SELECT id,first_name,last_name,email,role,email_verified,approval_status,created_at FROM users ORDER BY created_at DESC')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/approve', ...guard, async (req, res) => {
  try { await run("UPDATE users SET approval_status='approved' WHERE id=?", [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/reject', ...guard, async (req, res) => {
  try { await run("UPDATE users SET approval_status='rejected' WHERE id=?", [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
