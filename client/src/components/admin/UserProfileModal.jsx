import { useState, useEffect } from 'react';
import { adminApi } from '../../api';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Mail, Phone, Calendar, Clock, ShieldCheck, Ban, Briefcase, Scale, CreditCard, Activity } from 'lucide-react';

const ROLE_COLORS = {
  client:    'bg-blue-100 text-blue-700',
  attorney:  'bg-indigo-100 text-indigo-700',
  partner:   'bg-purple-100 text-purple-700',
  itsupport: 'bg-gray-100 text-gray-700',
};

const STAGE_COLORS = {
  active: 'bg-green-100 text-green-700', at_risk: 'bg-red-100 text-red-700',
  new: 'bg-blue-100 text-blue-700', complete: 'bg-gray-100 text-gray-700',
};

function fmtDate(iso, withTime = false) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

function fmtMoney(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        <Icon size={13} /> {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 mt-0.5">{value ?? '—'}</span>
    </div>
  );
}

/**
 * UserProfileModal — read-only "complete dossier" view for admin/partner:
 * core account info, role-specific matters, payment history (clients), and
 * recent activity. Fetches fresh from /admin/users/:id/profile on open.
 */
export default function UserProfileModal({ userId, open, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setError('');
    setData(null);
    adminApi.userProfile(userId)
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Could not load this profile.'))
      .finally(() => setLoading(false));
  }, [open, userId]);

  const u = data?.user;
  const isClient = u?.role === 'client';
  const otherPartyLabel = isClient ? 'Attorney' : 'Client';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={u ? `${u.first_name} ${u.last_name}` : 'User Profile'}
      description={u?.email}
    >
      {loading && (
        <div className="flex justify-center py-12"><Spinner size={8} /></div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      )}

      {u && !loading && (
        <>
          <Section icon={ShieldCheck} title="Account">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                {u.role}
              </span>
              {u.email_verified
                ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Email verified</span>
                : <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Email unverified</span>}
              {u.approval_status && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                  u.approval_status === 'approved' ? 'bg-green-100 text-green-700'
                    : u.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {u.approval_status}
                </span>
              )}
              {u.status === 'suspended' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                  <Ban size={11} /> Suspended
                </span>
              )}
              {u.two_fa_enabled ? <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">2FA on</span> : null}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Email" value={<span className="flex items-center gap-1"><Mail size={12} />{u.email}</span>} />
              <Field label="Phone" value={u.phone ? <span className="flex items-center gap-1"><Phone size={12} />{u.phone}</span> : '—'} />
              <Field label="Sign-in method" value={u.login_provider === 'google' ? 'Google' : 'Email & password'} />
              <Field label="Joined" value={<span className="flex items-center gap-1"><Calendar size={12} />{fmtDate(u.created_at)}</span>} />
              <Field label="Last login" value={<span className="flex items-center gap-1"><Clock size={12} />{fmtDate(u.last_login, true)}</span>} />
              {u.status === 'suspended' && <Field label="Suspended reason" value={u.suspended_reason || '—'} />}
            </div>
          </Section>

          {data.profile && (
            <Section icon={Scale} title="Professional Profile">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Bar Number" value={data.profile.bar_number} />
                <Field label="State Bar" value={data.profile.state_bar} />
                <Field label="Years Experience" value={data.profile.years_experience} />
                <Field label="Firm Role" value={data.profile.firm_role} />
                <Field label="Specializations" value={data.profile.specializations} />
                <Field label="Practice Groups" value={data.profile.practice_groups} />
              </div>
            </Section>
          )}

          <Section icon={Briefcase} title={`Matters (${data.matters.length})`}>
            {data.matters.length === 0 ? (
              <p className="text-sm text-gray-400">No matters {isClient ? 'filed' : 'assigned'}.</p>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {data.matters.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 font-mono text-xs">{m.case_number}</div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        {(m.matter_type || '—').replace(/_/g, ' ')} · {otherPartyLabel}: {m.other_first_name ? `${m.other_first_name} ${m.other_last_name}` : 'Unassigned'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">{(m.stage || '—').replace(/_/g, ' ')}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STAGE_COLORS[m.status] || 'bg-gray-100 text-gray-600'}`}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {isClient && (
            <Section icon={CreditCard} title={`Payment History (${data.payments.length})`}>
              {data.payments.length === 0 ? (
                <p className="text-sm text-gray-400">No invoices.</p>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {data.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 truncate">{p.description || 'Invoice'}</div>
                        <div className="text-gray-400 text-xs mt-0.5">{fmtDate(p.created_at)}{p.case_number ? ` · ${p.case_number}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-semibold text-gray-800">{fmtMoney(p.amount)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'refunded' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section icon={Activity} title={`Recent Activity (${data.activity.length})`}>
            {data.activity.length === 0 ? (
              <p className="text-sm text-gray-400">No recorded activity.</p>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                {data.activity.map(a => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-50 last:border-0 text-sm">
                    <span className="text-gray-700 capitalize">{a.details}</span>
                    <span className="text-gray-400 text-xs flex-shrink-0">{fmtDate(a.created_at, true)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </Modal>
  );
}
