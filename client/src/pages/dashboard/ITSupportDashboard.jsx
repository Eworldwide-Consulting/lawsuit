import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import {
  Users, CheckCircle, XCircle, Clock, AlertTriangle, Database,
  Activity, Server, Mail, CreditCard, Shield, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Check, X, MoreHorizontal, KeyRound,
  Ban, RotateCcw, Trash2,
} from 'lucide-react';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'blue', icon: Icon }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    red:    'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
      <div className="text-sm text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ── Health badge ──────────────────────────────────────────────────────────────

function HealthBadge({ status }) {
  if (status === 'ok')      return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full"><CheckCircle size={12} /> OK</span>;
  if (status === 'warning') return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full"><AlertTriangle size={12} /> Warning</span>;
  return                           <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2.5 py-1 rounded-full"><XCircle size={12} /> Error</span>;
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const map = {
    client:    'bg-blue-100 text-blue-700',
    attorney:  'bg-indigo-100 text-indigo-700',
    partner:   'bg-purple-100 text-purple-700',
    itsupport: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[role] || 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  );
}

// ── Approval status badge ─────────────────────────────────────────────────────

function ApprovalBadge({ status }) {
  if (!status) return null;
  const map = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// ── Account status badge ──────────────────────────────────────────────────────
// Only rendered for frozen accounts — active ones show nothing, so suspended
// users stand out in a long list.

function AccountStatusBadge({ status }) {
  if (status !== 'suspended') return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <Ban size={11} /> Suspended
    </span>
  );
}

// ── Format date ───────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function ITSupportDashboard() {
  const toast = useToast();
  const [stats,    setStats]    = useState(null);
  const [health,   setHealth]   = useState(null);
  const [pending,  setPending]  = useState([]);
  const [users,    setUsers]    = useState([]);
  const [activity, setActivity] = useState([]);
  const [dbStats,  setDbStats]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('overview');
  const [actionLoading, setActionLoading] = useState({});
  const [rejectModal, setRejectModal] = useState(null); // { id, name }
  const [rejectNotes, setRejectNotes] = useState('');
  const [roleModal, setRoleModal] = useState(null); // { id, name, current }
  const [usersSearch, setUsersSearch] = useState('');
  const [resetPwModal, setResetPwModal] = useState(null); // { id, name }
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [resetPwError, setResetPwError] = useState('');
  const [suspendModal, setSuspendModal] = useState(null); // { id, name }
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);   // { id, name, email }
  const [deleteConfirm, setDeleteConfirm] = useState(''); // must equal the email

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, h, p, u, a, d] = await Promise.all([
        adminApi.stats(),
        adminApi.health(),
        adminApi.pending(),
        adminApi.users(),
        adminApi.activity(),
        adminApi.dbStats(),
      ]);
      setStats(s.data);
      setHealth(h.data);
      setPending(p.data);
      setUsers(u.data);
      setActivity(a.data);
      setDbStats(d.data);
    } catch (err) {
      console.error('IT dashboard load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const withLoading = async (key, fn) => {
    setActionLoading(l => ({ ...l, [key]: true }));
    try { await fn(); await load(); }
    catch (err) { alert(err.response?.data?.error || 'Action failed'); }
    finally { setActionLoading(l => ({ ...l, [key]: false })); }
  };

  const handleApprove = id =>
    withLoading(`approve_${id}`, () => adminApi.approve(id));

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    await withLoading(`reject_${rejectModal.id}`, () =>
      adminApi.reject(rejectModal.id, rejectNotes)
    );
    setRejectModal(null);
    setRejectNotes('');
  };

  const handleRoleChange = (id, newRole) =>
    withLoading(`role_${id}`, () => adminApi.changeRole(id, newRole));

  const handleForceVerify = id =>
    withLoading(`verify_${id}`, () => adminApi.forceVerify(id));

  // Actually re-sends the verification email (unlike Force Verify, which bypasses
  // it) — the SMTP-down failure mode is silent by design (never blocks the
  // request), so a toast here is the only signal an admin gets that the send
  // was attempted, not a guarantee it was delivered.
  const handleResendVerification = id =>
    withLoading(`resend_${id}`, () =>
      adminApi.resendInvite(id).then(() => toast.success('Verification email re-sent.'))
    );

  const handleResetPasswordSubmit = async () => {
    if (!resetPwModal) return;
    setResetPwError('');
    if (newPw.length < 8) { setResetPwError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setResetPwError('Passwords do not match.'); return; }
    // withLoading alerts and swallows failures (same convention as reject/role-change
    // above) — matches existing behavior rather than introducing a new error path.
    await withLoading(`resetpw_${resetPwModal.id}`, () => adminApi.resetPassword(resetPwModal.id, newPw));
    setResetPwModal(null);
    setNewPw('');
    setConfirmPw('');
  };

  const handleSuspendSubmit = async () => {
    if (!suspendModal) return;
    await withLoading(`suspend_${suspendModal.id}`, () =>
      adminApi.suspend(suspendModal.id, suspendReason.trim())
    );
    setSuspendModal(null);
    setSuspendReason('');
  };

  const handleReactivate = id =>
    withLoading(`reactivate_${id}`, () => adminApi.reactivate(id));

  const handleDeleteSubmit = async () => {
    if (!deleteModal) return;
    await withLoading(`delete_${deleteModal.id}`, () => adminApi.deleteUser(deleteModal.id));
    setDeleteModal(null);
    setDeleteConfirm('');
  };

  // ── Filtered users ────────────────────────────────────────────────────────────

  const filteredUsers = users.filter(u => {
    const q = usersSearch.toLowerCase();
    return !q ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const s = stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IT Support Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">System monitoring and user management</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {['overview', 'pending', 'users', 'activity'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'pending' && pending.length > 0
              ? <span className="flex items-center gap-1.5">Pending <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{pending.length}</span></span>
              : t.charAt(0).toUpperCase() + t.slice(1)
            }
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* System Health */}
          {health && (
            <Section title="System Health">
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(health.checks).map(([key, check]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{check.label}</div>
                      {check.message && <div className="text-xs text-gray-400 mt-0.5">{check.message}</div>}
                    </div>
                    <HealthBadge status={check.status} />
                  </div>
                ))}
              </div>
              <div className="px-6 pb-4 text-xs text-gray-400">
                Uptime: {Math.floor(health.uptime / 60)}m · Node {health.nodeVersion}
              </div>
            </Section>
          )}

          {/* User Stats */}
          {s && (
            <div>
              <h2 className="text-base font-semibold text-gray-700 mb-3">Users</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard label="Total Users"         value={s.users.total}           icon={Users}     color="blue"   />
                <StatCard label="Clients"             value={s.users.clients}          icon={Users}     color="indigo" />
                <StatCard label="Attorneys"           value={s.users.attorneys}        icon={Shield}    color="purple" />
                <StatCard label="Partners"            value={s.users.partners}         icon={Shield}    color="blue"   />
                <StatCard label="Pending Approvals"   value={s.users.pendingApprovals} icon={Clock}     color="orange" />
                <StatCard label="Unverified Emails"   value={s.users.unverifiedEmails} icon={Mail}      color="red"    />
              </div>
            </div>
          )}

          {/* Other Stats */}
          {s && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Matters"    value={s.matters.total}      sub={`${s.matters.active} active · ${s.matters.atRisk} at risk`}    icon={Database}  color="blue"   />
              <StatCard label="Documents"        value={s.documents.total}    sub={`${s.documents.pending} pending review`}                         icon={Database}  color="indigo" />
              <StatCard label="Tasks"            value={s.tasks.total}        sub={`${s.tasks.overdue} overdue`}                                    icon={Activity}  color="orange" />
              <StatCard label="Messages"         value={s.messages.total}     sub={`${s.messages.unread} unread`}                                   icon={Mail}      color="purple" />
            </div>
          )}

          {/* DB Table Counts */}
          {dbStats.length > 0 && (
            <Section title="Database Table Counts">
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                {dbStats.map(({ table, count }) => (
                  <div key={table} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-700 font-medium">{table}</span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── Pending Approvals Tab ── */}
      {tab === 'pending' && (
        <Section title={`Pending Approvals (${pending.length})`}>
          {pending.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              No pending approvals
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pending.map(u => (
                <div key={u.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                    {u.avatar_initials || (u.first_name?.[0] + u.last_name?.[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{u.first_name} {u.last_name}</span>
                      <RoleBadge role={u.role} />
                      {!u.email_verified && <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Email unverified</span>}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">{u.email}</div>
                    {u.profile && (
                      <div className="text-xs text-gray-400 mt-1 flex gap-3 flex-wrap">
                        {u.profile.bar_number && <span>Bar: {u.profile.bar_number}</span>}
                        {u.profile.state_bar  && <span>State: {u.profile.state_bar}</span>}
                        {u.profile.years_experience && <span>{u.profile.years_experience} yrs exp</span>}
                        {u.profile.specializations && <span>{u.profile.specializations}</span>}
                        {u.profile.firm_role && <span>{u.profile.firm_role}</span>}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">Applied {fmtDate(u.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(u.id)}
                      disabled={!!actionLoading[`approve_${u.id}`]}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
                    >
                      {actionLoading[`approve_${u.id}`]
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Check size={14} />}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectModal({ id: u.id, name: `${u.first_name} ${u.last_name}` })}
                      className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <X size={14} /> Reject
                    </button>
                    {!u.email_verified && (
                      <>
                        <button
                          onClick={() => handleResendVerification(u.id)}
                          disabled={!!actionLoading[`resend_${u.id}`]}
                          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
                        >
                          {actionLoading[`resend_${u.id}`]
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Mail size={12} />}
                          Resend Verification
                        </button>
                        <button
                          onClick={() => handleForceVerify(u.id)}
                          disabled={!!actionLoading[`verify_${u.id}`]}
                          className="px-3 py-2 border border-gray-300 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
                        >
                          {actionLoading[`verify_${u.id}`] ? <Loader2 size={12} className="animate-spin" /> : 'Force Verify'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── All Users Tab ── */}
      {tab === 'users' && (
        <Section
          title={`All Users (${filteredUsers.length})`}
          action={
            <input
              value={usersSearch}
              onChange={e => setUsersSearch(e.target.value)}
              placeholder="Search users…"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Joined</th>
                  <th className="text-left px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{u.first_name} {u.last_name}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {u.email_verified
                          ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Verified</span>
                          : <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Unverified</span>}
                        {u.approval_status && <ApprovalBadge status={u.approval_status} />}
                        <AccountStatusBadge status={u.status} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(u.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {!u.email_verified && (
                          <>
                            <button
                              onClick={() => handleResendVerification(u.id)}
                              disabled={!!actionLoading[`resend_${u.id}`]}
                              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => handleForceVerify(u.id)}
                              disabled={!!actionLoading[`verify_${u.id}`]}
                              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                            >
                              Force Verify
                            </button>
                          </>
                        )}
                        <select
                          defaultValue={u.role}
                          onChange={e => {
                            if (e.target.value !== u.role) handleRoleChange(u.id, e.target.value);
                          }}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {['client', 'attorney', 'partner', 'itsupport'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setResetPwModal({ id: u.id, name: `${u.first_name} ${u.last_name}` }); setNewPw(''); setConfirmPw(''); setResetPwError(''); }}
                          title="Reset password"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
                        >
                          <KeyRound size={12} /> Reset Password
                        </button>

                        {u.status === 'suspended' ? (
                          <button
                            onClick={() => handleReactivate(u.id)}
                            disabled={!!actionLoading[`reactivate_${u.id}`]}
                            title="Restore account access"
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 disabled:opacity-50"
                          >
                            <RotateCcw size={12} /> Reactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => { setSuspendModal({ id: u.id, name: `${u.first_name} ${u.last_name}` }); setSuspendReason(''); }}
                            title="Freeze this account — blocks login and ends active sessions"
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600"
                          >
                            <Ban size={12} /> Suspend
                          </button>
                        )}

                        <button
                          onClick={() => { setDeleteModal({ id: u.id, name: `${u.first_name} ${u.last_name}`, email: u.email }); setDeleteConfirm(''); }}
                          title="Close this account and release its email"
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Activity Tab ── */}
      {tab === 'activity' && (
        <Section title="Recent Activity (last 50)">
          <div className="divide-y divide-gray-100">
            {activity.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 mt-0.5">
                  {a.actor_initials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800">
                    <span className="font-medium">{a.actor_name}</span>
                    {' · '}
                    <span className="text-gray-600">{a.details}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{fmtDate(a.created_at)}</div>
                </div>
                {a.actor_role && <RoleBadge role={a.actor_role} />}
              </div>
            ))}
            {activity.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No activity yet</div>
            )}
          </div>
        </Section>
      )}

      {/* ── Reject modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-1">Reject Application</h3>
            <p className="text-sm text-gray-500 mb-4">
              Rejecting account for <strong>{rejectModal.name}</strong>. Add a note (optional):
            </p>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              placeholder="Reason for rejection…"
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectModal(null); setRejectNotes(''); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!!actionLoading[`reject_${rejectModal.id}`]}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading[`reject_${rejectModal.id}`]
                  ? <Loader2 size={14} className="animate-spin" />
                  : null}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Suspend modal ── */}
      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-1">Suspend Account</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{suspendModal.name}</strong> will be signed out immediately and blocked from
              logging in. Case data, documents and messages are untouched, and you can reactivate
              the account at any time.
            </p>
            <textarea
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="Reason (optional — included in the email they receive)"
              rows={3}
              maxLength={500}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setSuspendModal(null); setSuspendReason(''); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendSubmit}
                disabled={!!actionLoading[`suspend_${suspendModal.id}`]}
                className="flex-1 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading[`suspend_${suspendModal.id}`]
                  ? <Loader2 size={14} className="animate-spin" />
                  : null}
                Suspend Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ── */}
      {/* Typing the email is required: deletion cannot be undone from the UI,
          so a mis-click on the wrong row must not be enough to close an account. */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-gray-900 mb-1">Delete Account</h3>
            <p className="text-sm text-gray-500 mb-3">
              This closes <strong>{deleteModal.name}</strong>'s account permanently. It cannot be
              undone from this screen.
            </p>
            <ul className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 space-y-1.5">
              <li>· They are signed out and can never log in with this account again.</li>
              <li>· Matters, documents, invoices and messages are <strong>retained</strong> for legal recordkeeping.</li>
              <li>· <strong>{deleteModal.email}</strong> is released — they can register a brand new account with it.</li>
            </ul>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Type <span className="font-mono text-gray-900">{deleteModal.email}</span> to confirm
            </label>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={deleteModal.email}
              autoComplete="off"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setDeleteModal(null); setDeleteConfirm(''); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={
                  deleteConfirm.trim().toLowerCase() !== deleteModal.email.toLowerCase() ||
                  !!actionLoading[`delete_${deleteModal.id}`]
                }
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading[`delete_${deleteModal.id}`]
                  ? <Loader2 size={14} className="animate-spin" />
                  : null}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password modal ── */}
      {resetPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">
              Set a new password for <strong>{resetPwModal.name}</strong>. They'll be notified this happened.
            </p>
            {resetPwError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                {resetPwError}
              </div>
            )}
            <div className="space-y-3">
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="New password (min. 8 characters)"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setResetPwModal(null); setNewPw(''); setConfirmPw(''); setResetPwError(''); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPasswordSubmit}
                disabled={!!actionLoading[`resetpw_${resetPwModal.id}`]}
                className="flex-1 py-2.5 bg-navy-900 text-white rounded-xl text-sm font-semibold hover:bg-navy-800 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {actionLoading[`resetpw_${resetPwModal.id}`]
                  ? <Loader2 size={14} className="animate-spin" />
                  : null}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
