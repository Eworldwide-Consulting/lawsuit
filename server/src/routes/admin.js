const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { one, all, run }   = require('../db');
const { requireAuth, requireRole, invalidateUserCache } = require('../middleware/auth');
const UserRepo        = require('../repositories/user.repository');
const EmailService    = require('../services/email.service');
const NotificationService = require('../services/notification.service');
const { in24Hours }   = require('../lib/dates');
const { parsePagination } = require('../lib/pagination');
const config          = require('../config');
const AuditService    = require('../services/audit.service');

const guard = [requireAuth, requireRole('itsupport', 'partner')];

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', ...guard, async (req, res, next) => {
  try {
    const [u, m, d, t, msg] = await Promise.all([
      one(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN role='client'    THEN 1 ELSE 0 END) AS clients,
        SUM(CASE WHEN role='attorney'  THEN 1 ELSE 0 END) AS attorneys,
        SUM(CASE WHEN role='partner'   THEN 1 ELSE 0 END) AS partners,
        SUM(CASE WHEN approval_status='pending' THEN 1 ELSE 0 END) AS pendingApprovals,
        SUM(CASE WHEN email_verified=0 THEN 1 ELSE 0 END) AS unverifiedEmails
        FROM users`),
      one(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status='active'  THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='at_risk' THEN 1 ELSE 0 END) AS atRisk
        FROM matters`),
      one(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
        FROM documents`),
      one(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status NOT IN ('done','complete') AND due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END) AS overdue
        FROM tasks`, [new Date().toISOString().slice(0, 10)]),
      one(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unread
        FROM messages`),
    ]);
    res.json({
      users:     { total: +u.total, clients: +u.clients, attorneys: +u.attorneys, partners: +u.partners, pendingApprovals: +u.pendingApprovals, unverifiedEmails: +u.unverifiedEmails },
      matters:   { total: +m.total, active: +m.active, atRisk: +m.atRisk },
      documents: { total: +d.total, pending: +d.pending },
      tasks:     { total: +t.total, overdue: +t.overdue },
      messages:  { total: +msg.total, unread: +msg.unread },
    });
  } catch (err) { next(err); }
});

// ── Pending approvals ─────────────────────────────────────────────────────────

router.get('/pending', ...guard, async (req, res, next) => {
  try {
    const rows = await all(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.role,
             u.email_verified, u.approval_status, u.created_at, u.avatar_initials,
             up.bar_number, up.state_bar, up.years_experience,
             up.specializations, up.firm_role, up.practice_groups
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.approval_status = 'pending'
      ORDER BY u.created_at ASC
    `);
    res.json(rows.map(r => ({
      id: r.id, first_name: r.first_name, last_name: r.last_name,
      email: r.email, role: r.role,
      email_verified: r.email_verified, approval_status: r.approval_status,
      created_at: r.created_at, avatar_initials: r.avatar_initials,
      profile: (r.bar_number || r.state_bar || r.years_experience || r.specializations || r.firm_role || r.practice_groups)
        ? { bar_number: r.bar_number, state_bar: r.state_bar, years_experience: r.years_experience, specializations: r.specializations, firm_role: r.firm_role, practice_groups: r.practice_groups }
        : null,
    })));
  } catch (err) { next(err); }
});

// ── Health check ─────────────────────────────────────────────────────────────

router.get('/health', ...guard, async (req, res, next) => {
  try {
    let dbStatus = 'ok', dbMsg = null;
    try { await one('SELECT 1 AS ping'); } catch (e) { dbStatus = 'error'; dbMsg = e.message; }

    let queueStatus = 'ok';
    try {
      const { getQueue, QUEUE_NAMES } = require('../queue');
      await getQueue(QUEUE_NAMES.EMAIL).getJobCounts();
    } catch { queueStatus = 'warning'; }

    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    res.json({
      status: dbStatus === 'ok' ? 'ok' : 'error',
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version,
      checks: {
        database: { label: 'Database',  status: dbStatus,  message: dbMsg },
        queue:    { label: 'Job Queue', status: queueStatus },
        memory:   { label: 'Memory',    status: memMb < 400 ? 'ok' : 'warning', message: `${memMb} MB used` },
        server:   { label: 'Server',    status: 'ok', message: process.env.NODE_ENV },
      },
    });
  } catch (err) { next(err); }
});

// ── SMTP diagnostics ─────────────────────────────────────────────────────────

// GET  /admin/smtp-status  — check if SMTP is reachable (no email sent)
router.get('/smtp-status', ...guard, async (req, res, next) => {
  try {
    const result = await EmailService.verifySmtp();
    res.json(result);
  } catch (err) { next(err); }
});

// POST /admin/test-email  — send a live test email and return delivery result
router.post('/test-email', ...guard, async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: '"to" email address is required' });

    // Verify SMTP config before attempting send
    const smtpStatus = await EmailService.verifySmtp();
    if (!smtpStatus.ok) {
      return res.status(503).json({
        delivered: false,
        smtpError: smtpStatus.reason,
        hint: 'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in the server .env file. ' +
              'When using Gmail, SMTP_FROM must be the same Gmail address as SMTP_USER.',
      });
    }

    const result = await EmailService.sendTestDirect(to);
    AuditService.log({
      userId: req.user.id, action: 'admin.smtp_test',
      meta: { to, delivered: result.delivered },
      ip: req.ip,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ── Activity log ─────────────────────────────────────────────────────────────

router.get('/activity', ...guard, async (req, res, next) => {
  try {
    const rows = await all(`
      SELECT a.id, a.action, a.entity, a.entity_id, a.created_at,
             u.first_name, u.last_name, u.avatar_initials, u.role AS actor_role
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 50
    `);
    res.json(rows.map(r => ({
      id: r.id,
      action: r.action,
      actor_name:     r.first_name ? `${r.first_name} ${r.last_name}` : 'System',
      actor_initials: r.avatar_initials || 'SY',
      actor_role:     r.actor_role || null,
      details:        r.action.replace(/\./g, ' · ').replace(/_/g, ' '),
      created_at:     r.created_at,
    })));
  } catch (err) { next(err); }
});

// ── DB table row counts ───────────────────────────────────────────────────────

router.get('/db-stats', ...guard, async (req, res, next) => {
  try {
    const tables = ['users', 'matters', 'documents', 'messages', 'appointments', 'tasks', 'invoices', 'audit_log'];
    const counts = await Promise.all(
      tables.map(t => one(`SELECT COUNT(*) AS cnt FROM \`${t}\``).catch(() => ({ cnt: 0 })))
    );
    res.json(tables.map((t, i) => ({ table: t, count: Number(counts[i].cnt) })));
  } catch (err) { next(err); }
});

// ── List users ────────────────────────────────────────────────────────────────

router.get('/users', ...guard, async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    res.json(await UserRepo.findAll({ limit, offset }));
  } catch (err) { next(err); }
});

router.get('/users/by-email', ...guard, async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = await UserRepo.findByEmailSafe(email);
    if (!user) return res.status(404).json({ error: 'User not found', registered: false });
    res.json({ registered: true, user });
  } catch (err) { next(err); }
});

// ── User actions ──────────────────────────────────────────────────────────────

router.post('/users/:id/force-verify', ...guard, async (req, res, next) => {
  try {
    const user = await one('SELECT id, email, email_verified FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await UserRepo.markVerified(req.params.id);
    await invalidateUserCache(req.params.id);
    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.ADMIN_FORCE_VERIFY,
      entity: 'user', entityId: req.params.id,
      meta: { targetEmail: user.email },
      ip: req.ip,
    });
    res.json({ success: true, email: user.email, was_verified: !!user.email_verified });
  } catch (err) { next(err); }
});

router.post('/users/:id/resend-verification', ...guard, async (req, res, next) => {
  try {
    const user = await one('SELECT id, email, email_verified FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.json({ success: true, note: 'Already verified' });
    const token = crypto.randomBytes(32).toString('hex');
    await UserRepo.setVerificationToken(user.id, token, in24Hours());
    EmailService.sendVerification(user.email, token);
    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.ADMIN_RESEND_VERIFY,
      entity: 'user', entityId: req.params.id,
      meta: { targetEmail: user.email },
      ip: req.ip,
    });
    res.json({ success: true, email: user.email });
  } catch (err) { next(err); }
});

// Master/admin action: directly set a new password for any user, bypassing
// the normal forgot-password token flow — the admin sets the value here
// rather than the account holder proving control of their own inbox/phone.
router.put('/users/:id/reset-password', ...guard, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await one('SELECT id, email, first_name FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await run('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 12), req.params.id]);
    await invalidateUserCache(req.params.id);

    NotificationService.create({
      userId:     user.id,
      type:       'account_updated',
      title:      'Password reset by administrator',
      body:       'Your password was reset by a system administrator. If you did not expect this, contact support immediately.',
      entityType: 'user',
      entityId:   user.id,
    });

    AuditService.log({
      userId: req.user.id, action: 'admin.reset_password',
      entity: 'user', entityId: req.params.id,
      meta: { targetEmail: user.email },
      ip: req.ip,
    });

    res.json({ success: true, email: user.email });
  } catch (err) { next(err); }
});

router.put('/users/:id/role', ...guard, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['client', 'attorney', 'partner', 'itsupport'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    const user = await one('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    await invalidateUserCache(req.params.id);
    AuditService.log({
      userId: req.user.id, action: 'admin.change_role',
      entity: 'user', entityId: req.params.id,
      meta: { newRole: role }, ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Account lifecycle: suspend / reactivate / delete ──────────────────────────

// Shared preconditions for the lifecycle actions below. An admin may not act on
// their own account (instant self-lockout), and the last admin who can still
// sign in may not be frozen or removed — that would leave nobody able to reach
// the admin portal at all.
async function loadLifecycleTarget(req, res, { requireAdminHeadroom = true } = {}) {
  const user = await one(
    'SELECT id, email, first_name, last_name, role, status FROM users WHERE id = ?',
    [req.params.id]
  );
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }
  if (String(user.id) === String(req.user.id)) {
    res.status(400).json({ error: 'You cannot perform this action on your own account.' });
    return null;
  }
  if (requireAdminHeadroom && ['itsupport', 'partner'].includes(user.role)) {
    const { cnt } = await UserRepo.countActiveAdmins(user.id);
    if (Number(cnt) === 0) {
      res.status(400).json({ error: 'This is the last active admin account — it cannot be suspended or deleted.' });
      return null;
    }
  }
  return user;
}

router.put('/users/:id/suspend', ...guard, async (req, res, next) => {
  try {
    const user = await loadLifecycleTarget(req, res);
    if (!user) return;

    const reason = (req.body?.reason || '').trim().slice(0, 500) || null;
    await UserRepo.suspend(user.id, { byUserId: req.user.id, reason });
    // Drops the cached copy so requireAuth re-reads the frozen status on the
    // target's very next request instead of up to USER_CACHE_TTL later.
    await invalidateUserCache(user.id);

    NotificationService.create({
      userId:     user.id,
      type:       'account_updated',
      title:      'Account suspended',
      body:       reason
        ? `Your account has been suspended by an administrator. Reason: ${reason}`
        : 'Your account has been suspended by an administrator. Contact support to restore access.',
      entityType: 'user',
      entityId:   user.id,
    });
    EmailService.sendAccountSuspended(user.email, { firstName: user.first_name, reason });

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.ADMIN_SUSPEND_USER,
      entity: 'user', entityId: user.id,
      meta: { targetEmail: user.email, reason },
      ip: req.ip,
    });

    res.json({ success: true, id: user.id, status: 'suspended', email: user.email });
  } catch (err) { next(err); }
});

router.put('/users/:id/reactivate', ...guard, async (req, res, next) => {
  try {
    // No admin-headroom check — restoring access can never lock anyone out.
    const user = await loadLifecycleTarget(req, res, { requireAdminHeadroom: false });
    if (!user) return;
    if (user.status === 'deleted')
      return res.status(400).json({ error: 'Deleted accounts cannot be reactivated.' });

    await UserRepo.reactivate(user.id);
    await invalidateUserCache(user.id);

    NotificationService.create({
      userId:     user.id,
      type:       'account_updated',
      title:      'Account restored',
      body:       'Your account has been reactivated. You can sign in again.',
      entityType: 'user',
      entityId:   user.id,
    });
    EmailService.sendAccountReactivated(user.email, { firstName: user.first_name });

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.ADMIN_REACTIVATE_USER,
      entity: 'user', entityId: user.id,
      meta: { targetEmail: user.email },
      ip: req.ip,
    });

    res.json({ success: true, id: user.id, status: 'active', email: user.email });
  } catch (err) { next(err); }
});

// Soft delete — see migration 012 for why this is not a hard DELETE. The row
// survives so matters/documents/invoices stay referentially intact, but the
// email is released so the same person can register again from scratch.
router.delete('/users/:id', ...guard, async (req, res, next) => {
  try {
    const user = await loadLifecycleTarget(req, res);
    if (!user) return;
    if (user.status === 'deleted')
      return res.status(400).json({ error: 'Account is already deleted.' });

    // Send before the address is tombstoned — afterwards the column no longer
    // holds a deliverable address.
    EmailService.sendAccountDeleted(user.email, { firstName: user.first_name });

    await UserRepo.softDelete(user.id, { byUserId: req.user.id, email: user.email });
    await invalidateUserCache(user.id);

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.ADMIN_DELETE_USER,
      entity: 'user', entityId: user.id,
      meta: { targetEmail: user.email, targetRole: user.role },
      ip: req.ip,
    });

    res.json({
      success: true,
      id: user.id,
      email: user.email,
      emailReleased: true,
      note: 'Case history is retained. This email can be used to register a new account.',
    });
  } catch (err) { next(err); }
});

router.put('/users/:id/approve', ...guard, async (req, res, next) => {
  try {
    const user = await one('SELECT id, email, first_name FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await UserRepo.setApprovalStatus(req.params.id, 'approved');
    await invalidateUserCache(req.params.id);
    EmailService.sendAttorneyDecision(user.email, { firstName: user.first_name, decision: 'approved' });
    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.ADMIN_APPROVE_USER,
      entity: 'user', entityId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/users/:id/reject', ...guard, async (req, res, next) => {
  try {
    const user = await one('SELECT id, email, first_name FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await UserRepo.setApprovalStatus(req.params.id, 'rejected');
    await invalidateUserCache(req.params.id);
    EmailService.sendAttorneyDecision(user.email, { firstName: user.first_name, decision: 'rejected' });
    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.ADMIN_REJECT_USER,
      entity: 'user', entityId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;