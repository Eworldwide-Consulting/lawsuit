const router   = require('express').Router();
const supabase = require('../supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendVerificationEmail } = require('../email');

const requireIT = [requireAuth, requireRole('itsupport', 'partner')];

// ── System-wide stats ─────────────────────────────────────────────────────────
router.get('/stats', ...requireIT, async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: clients },
      { count: attorneys },
      { count: partners },
      { count: pendingApprovals },
      { count: unverifiedEmails },
      { count: totalMatters },
      { count: activeMatters },
      { count: atRiskMatters },
      { count: totalDocs },
      { count: pendingDocs },
      { count: totalTasks },
      { count: overdueTasks },
      { count: totalMessages },
      { count: unreadMessages },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'attorney'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'partner'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('email_verified', false),
      supabase.from('matters').select('*', { count: 'exact', head: true }),
      supabase.from('matters').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('matters').select('*', { count: 'exact', head: true }).eq('status', 'at_risk'),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('required', true),
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'completed').lt('due_date', new Date().toISOString().slice(0, 10)),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }).is('read_at', null),
    ]);

    res.json({
      users: { total: totalUsers, clients, attorneys, partners, pendingApprovals, unverifiedEmails },
      matters: { total: totalMatters, active: activeMatters, atRisk: atRiskMatters },
      documents: { total: totalDocs, pending: pendingDocs },
      tasks: { total: totalTasks, overdue: overdueTasks },
      messages: { total: totalMessages, unread: unreadMessages },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── All users with profiles ───────────────────────────────────────────────────
router.get('/users', ...requireIT, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, phone, avatar_initials, email_verified, approval_status, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('*');

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

    const result = (users || []).map(u => ({
      ...u,
      profile: profileMap[u.id] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Pending approvals ─────────────────────────────────────────────────────────
router.get('/pending', ...requireIT, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, phone, email_verified, approval_status, created_at')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const userIds = (users || []).map(u => u.id);
    let profiles = [];
    if (userIds.length) {
      const { data } = await supabase.from('user_profiles').select('*').in('user_id', userIds);
      profiles = data || [];
    }
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.user_id] = p; });

    res.json((users || []).map(u => ({ ...u, profile: profileMap[u.id] || null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Approve user ──────────────────────────────────────────────────────────────
router.post('/users/:id/approve', ...requireIT, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: user } = await supabase.from('users').select('email, role, first_name').eq('id', id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    await supabase.from('users').update({ approval_status: 'approved' }).eq('id', id);
    await supabase.from('user_profiles').update({
      approved_at: new Date().toISOString(),
      approved_by: req.user.id,
    }).eq('user_id', id);

    // Log activity
    await supabase.from('activity_log').insert({
      user_id: req.user.id,
      action: 'approved',
      resource_type: 'user',
      resource_id: parseInt(id),
      details: `Approved ${user.role} account for ${user.email}`,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Reject user ───────────────────────────────────────────────────────────────
router.post('/users/:id/reject', ...requireIT, async (req, res) => {
  try {
    const { id }    = req.params;
    const { notes } = req.body;
    const { data: user } = await supabase.from('users').select('email, role').eq('id', id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    await supabase.from('users').update({ approval_status: 'rejected' }).eq('id', id);
    await supabase.from('user_profiles').update({ approval_notes: notes || null }).eq('user_id', id);

    await supabase.from('activity_log').insert({
      user_id: req.user.id,
      action: 'rejected',
      resource_type: 'user',
      resource_id: parseInt(id),
      details: `Rejected ${user.role} account for ${user.email}. Notes: ${notes || 'none'}`,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Change user role ──────────────────────────────────────────────────────────
router.put('/users/:id/role', requireAuth, requireRole('itsupport'), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['client', 'attorney', 'partner', 'itsupport'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const { error } = await supabase.from('users').update({ role }).eq('id', req.params.id);
    if (error) throw error;

    await supabase.from('activity_log').insert({
      user_id: req.user.id,
      action: 'role_changed',
      resource_type: 'user',
      resource_id: parseInt(req.params.id),
      details: `Role changed to ${role}`,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Force-verify email ────────────────────────────────────────────────────────
router.post('/users/:id/verify-email', requireAuth, requireRole('itsupport'), async (req, res) => {
  try {
    await supabase.from('users').update({ email_verified: true, verification_token: null }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Resend approval notification ──────────────────────────────────────────────
router.post('/users/:id/resend-invite', requireAuth, requireRole('itsupport'), async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('email, verification_token').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.verification_token) {
      sendVerificationEmail(user.email, user.verification_token).catch(() => {});
    }
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Recent activity log ───────────────────────────────────────────────────────
router.get('/activity', ...requireIT, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*, actor:user_id(first_name, last_name, role, avatar_initials)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    res.json((data || []).map(a => ({
      ...a,
      actor_name:     a.actor ? `${a.actor.first_name} ${a.actor.last_name}` : 'System',
      actor_initials: a.actor?.avatar_initials,
      actor_role:     a.actor?.role,
      actor: undefined,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── System health ─────────────────────────────────────────────────────────────
router.get('/health', ...requireIT, async (req, res) => {
  const checks = {};

  // Database check
  try {
    await supabase.from('users').select('id').limit(1);
    checks.database = { status: 'ok', label: 'Supabase DB' };
  } catch {
    checks.database = { status: 'error', label: 'Supabase DB' };
  }

  // Email check (just config presence)
  checks.email = process.env.SMTP_HOST
    ? { status: 'ok', label: 'SMTP Email' }
    : { status: 'warning', label: 'SMTP Email', message: 'SMTP not configured' };

  // Stripe check
  checks.stripe = process.env.STRIPE_SECRET_KEY
    ? { status: 'ok', label: 'Stripe Payments' }
    : { status: 'warning', label: 'Stripe Payments', message: 'Not configured' };

  // Google OAuth check
  checks.google = process.env.GOOGLE_CLIENT_ID
    ? { status: 'ok', label: 'Google OAuth' }
    : { status: 'warning', label: 'Google OAuth', message: 'Not configured' };

  const allOk = Object.values(checks).every(c => c.status !== 'error');
  res.json({ healthy: allOk, checks, uptime: process.uptime(), nodeVersion: process.version });
});

// ── Database table counts ─────────────────────────────────────────────────────
router.get('/db-stats', ...requireIT, async (req, res) => {
  try {
    const tables = ['users', 'matters', 'documents', 'messages', 'appointments', 'tasks', 'invoices', 'activity_log'];
    const counts = await Promise.all(
      tables.map(async t => {
        const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
        return { table: t, count: count || 0 };
      })
    );
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
