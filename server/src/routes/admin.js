const router = require('express').Router();
const { one, all, run }           = require('../db');
const { requireAuth, requireRole, invalidateUserCache } = require('../middleware/auth');

const guard = [requireAuth, requireRole('itsupport', 'partner')];

// ── Stats — single aggregation query instead of 6 separate COUNTs ─────────────

router.get('/stats', ...guard, async (req, res) => {
  try {
    // One round-trip to the DB instead of six parallel COUNT(*) queries.
    // Each subquery hits a different table so they can't be combined further,
    // but wrapping them in a single SELECT avoids 5 extra network round-trips.
    const row = await one(`
      SELECT
        (SELECT COUNT(*) FROM users)        AS users,
        (SELECT COUNT(*) FROM matters)      AS matters,
        (SELECT COUNT(*) FROM documents)    AS documents,
        (SELECT COUNT(*) FROM messages)     AS messages,
        (SELECT COUNT(*) FROM appointments) AS appointments,
        (SELECT COUNT(*) FROM tasks)        AS tasks
    `);
    res.json({
      users:        Number(row.users),
      matters:      Number(row.matters),
      documents:    Number(row.documents),
      messages:     Number(row.messages),
      appointments: Number(row.appointments),
      tasks:        Number(row.tasks),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User list ─────────────────────────────────────────────────────────────────

router.get('/users', ...guard, async (req, res) => {
  try {
    res.json(
      await all(
        'SELECT id, first_name, last_name, email, role, email_verified, approval_status, created_at FROM users ORDER BY created_at DESC'
      )
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Approve / reject ──────────────────────────────────────────────────────────

router.put('/users/:id/approve', ...guard, async (req, res) => {
  try {
    await run("UPDATE users SET approval_status = 'approved' WHERE id = ?", [req.params.id]);
    // Evict cached user so the approval takes effect on their next request
    await invalidateUserCache(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/reject', ...guard, async (req, res) => {
  try {
    await run("UPDATE users SET approval_status = 'rejected' WHERE id = ?", [req.params.id]);
    await invalidateUserCache(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
