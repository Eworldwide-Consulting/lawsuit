const router  = require('express').Router();
const crypto  = require('crypto');
const { one, all, run }           = require('../db');
const { requireAuth, requireRole, invalidateUserCache } = require('../middleware/auth');

const guard = [requireAuth, requireRole('itsupport', 'partner')];

// Helper — shared expiry logic
function verificationExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

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

// ── Lookup user by email ──────────────────────────────────────────────────────

router.get('/users/by-email', ...guard, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const user = await one(
      'SELECT id, first_name, last_name, email, role, email_verified, approval_status, created_at FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    if (!user) return res.status(404).json({ error: 'User not found', registered: false });
    res.json({ registered: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Force-verify a user's email (IT Support bypass) ───────────────────────────

router.post('/users/:id/force-verify', ...guard, async (req, res) => {
  try {
    const user = await one('SELECT id, email, email_verified FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await run(
      'UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
      [req.params.id]
    );
    await invalidateUserCache(req.params.id);
    res.json({ success: true, email: user.email, was_verified: !!user.email_verified });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generate a fresh verification link for a user ────────────────────────────

router.post('/users/:id/resend-verification', ...guard, async (req, res) => {
  try {
    const user = await one('SELECT id, email, email_verified FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ success: true, note: 'Already verified' });

    const token = crypto.randomBytes(32).toString('hex');
    const exp   = verificationExpiry();
    await run(
      'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [token, exp, user.id]
    );

    // Return the raw link so admin can share it manually if SMTP is broken
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const link = `${clientUrl}/verify-email?token=${token}`;
    res.json({ success: true, email: user.email, verification_link: link });
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
