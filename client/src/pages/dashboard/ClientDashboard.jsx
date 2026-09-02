import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, documentsApi, checklistApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar, FileText, CheckSquare, Upload, Eye, PenLine, Phone, MessageSquare,
  Shield, Check, CheckCircle, Briefcase, ArrowRight, Clock, UserCheck,
  Mail, RefreshCw, ExternalLink,
} from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import AttorneyStatusBadge from '../../components/attorney/AttorneyStatusBadge';
import AttorneyPickerModal from '../../components/attorney/AttorneyPickerModal';
import InviteAttorneyModal from '../../components/attorney/InviteAttorneyModal';
import { STAGE_KEYS, getStageLabels } from '../../constants/caseStages';

const ACTION_CFG = {
  Upload:  { Icon: Upload,      cls: 'bg-[#0f2057] hover:bg-[#1a3476]' },
  Review:  { Icon: Eye,         cls: 'bg-blue-600  hover:bg-blue-700'  },
  Sign:    { Icon: PenLine,     cls: 'bg-violet-600 hover:bg-violet-700' },
  Confirm: { Icon: CheckCircle, cls: 'bg-green-600  hover:bg-green-700' },
};

const statusColor = s => s === 'overdue' ? 'text-orange-500' : s === 'pending' ? 'text-amber-600' : 'text-gray-500';
const docStatusBadge = s => s === 'accepted' ? 'badge-green' : s === 'rejected' ? 'badge-red' : 'badge-yellow';
const docStatusLabel = s => s === 'accepted' ? 'Approved' : s === 'rejected' ? 'Needs Revision' : 'Under Review';
const shortCat = c => c.replace(/^\d+\.\s*/, '');

// ── Readiness gauge ──────────────────────────────────────────────────────────
const ReadinessGauge = memo(function ReadinessGauge({ value }) {
  const r = 40, circ = 2 * Math.PI * r;
  const color = value >= 75 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${(value / 100) * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-gray-800 dark:text-white">{value}%</div>
        <div className="text-xs text-gray-500">{value >= 75 ? 'On track' : value >= 50 ? 'Attention' : 'At risk'}</div>
      </div>
    </div>
  );
});

// ── Required Documents panel ─────────────────────────────────────────────────
// Real checklist data — not a static per-type list. Checklist items don't
// exist until the attorney accepts the case (server auto-initialises them
// from the matter-type template in POST /matters/:id/accept), so a brand new
// client with no attorney yet has nothing to fetch and this panel stays
// hidden rather than showing a generic/inaccurate placeholder list.
function RequiredDocsPanel({ matterId, matterType, caseAccepted }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matterId || !caseAccepted) { setLoading(false); return; }
    checklistApi.getByMatter(matterId)
      .then(r => {
        const needed = (r.data?.sections || [])
          .flatMap(s => s.items)
          .filter(i => i.default_status === 'needed_now');
        setItems(needed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matterId, caseAccepted]);

  if (!caseAccepted || loading || !items.length) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
          <FileText size={14} className="text-[#0f2057] dark:text-blue-400" />
          Required Documents for Your Case
        </div>
        <span className="text-xs text-gray-400 capitalize">{matterType?.replace(/_/g, ' ')}</span>
      </div>
      <div className="space-y-1.5">
        {items.map(item => {
          const uploaded = ['submitted', 'accepted'].includes(item.status);
          return (
            <div key={item.id} className={`flex items-center gap-3 py-1.5 px-3 rounded-lg ${
              uploaded ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/40'
            }`}>
              {uploaded
                ? <Check size={14} className="text-green-600 flex-shrink-0" />
                : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-gray-500 flex-shrink-0" />}
              <span className={`flex-1 text-xs ${uploaded
                ? 'text-green-700 dark:text-green-400 line-through'
                : 'text-gray-700 dark:text-gray-300'}`}>{item.label}</span>
              {!uploaded && <span className="text-xs text-amber-600 font-medium">Needed</span>}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Completing these documents speeds up your case significantly.
      </p>
    </div>
  );
}

// ── Attorney-reviewed documents ───────────────────────────────────────────────
function ReviewedDocsPanel({ matterId }) {
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matterId) { setLoading(false); return; }
    documentsApi.list({ matterId })
      .then(r => setDocs((r.data.documents || r.data || []).filter(d => d.status && d.status !== 'pending')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matterId]);

  if (loading || !docs.length) return null;

  return (
    <div className="card p-5">
      <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-3 flex items-center gap-2">
        <CheckCircle size={14} className="text-green-500" /> Attorney-Reviewed Documents
      </div>
      <div className="space-y-2">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
            <FileText size={13} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{doc.name}</div>
              <div className="text-xs text-gray-400">{doc.category || 'General'}</div>
            </div>
            <span className={`badge ${docStatusBadge(doc.status)}`}>{docStatusLabel(doc.status)}</span>
            <a href={documentsApi.viewUrl(doc.id)} target="_blank" rel="noreferrer"
              className="text-gray-400 hover:text-[#0f2057] dark:hover:text-blue-400 transition-colors flex-shrink-0">
              <ExternalLink size={13} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const [data, setData]                     = useState(null);
  const [loading, setLoading]               = useState(true);
  const [showAttyPicker, setShowAttyPicker] = useState(false);
  const [showInvite, setShowInvite]         = useState(false);
  const [assignMsg, setAssignMsg]           = useState('');

  const loadDashboard = () =>
    dashboardApi.client().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));

  useEffect(() => { loadDashboard(); }, []);

  function handleAssigned(msg, isError) {
    setAssignMsg(msg);
    setTimeout(() => setAssignMsg(''), isError ? 4000 : 5000);
    if (!isError) { setLoading(true); loadDashboard(); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const matter        = data?.matter;
  const STAGES        = getStageLabels(matter?.matter_type);
  const stageIdx      = matter ? STAGE_KEYS.indexOf(matter.stage) : 0;
  const readiness     = data?.readinessScore ?? 0;
  const docsUploaded  = data?.checklistUploaded ?? data?.completedDocs ?? 0;
  const docsTotal     = data?.checklistTotal    ?? data?.totalDocs     ?? 0;
  const checklistPend = Math.max(0, (data?.checklistTotal ?? 0) - (data?.checklistAccepted ?? 0));
  const displayTasks  = (data?.openTasks ?? 0) > 0 ? data.openTasks : checklistPend;
  const courtDate     = matter?.important_date ? new Date(matter.important_date) : null;
  const daysToCount   = courtDate ? Math.ceil((courtDate - new Date()) / 86400000) : null;
  const nextApptDays  = data?.upcomingAppts?.length
    ? Math.ceil((new Date(data.upcomingAppts[0].start_time) - new Date()) / 86400000)
    : null;
  const hasAttorney   = Boolean(matter?.attorney_id);
  const caseAccepted  = matter?.case_accepted === 1 || matter?.case_accepted === true;
  const pendingAccept = hasAttorney && !caseAccepted;

  // Concrete next actions behind the readiness score, ordered by what
  // actually unblocks progress first (attorney → uploads → review → tasks).
  const readinessSteps = [];
  if (matter) {
    if (!hasAttorney) {
      readinessSteps.push('Select an attorney to begin working your case.');
    } else if (!caseAccepted) {
      readinessSteps.push("Waiting on your attorney to accept the case — send a message if it's been a while.");
    }
    if (docsUploaded < docsTotal) {
      const remaining = docsTotal - docsUploaded;
      readinessSteps.push(`Upload the ${remaining} remaining required document${remaining !== 1 ? 's' : ''}.`);
    }
    const docsAwaitingReview = docsUploaded - (data?.checklistAccepted ?? 0);
    if (docsAwaitingReview > 0) {
      readinessSteps.push(`${docsAwaitingReview} uploaded document${docsAwaitingReview !== 1 ? 's' : ''} still awaiting attorney review.`);
    }
    const openTasksCount = Math.max(0, (data?.totalTasks ?? 0) - (data?.completedTasks ?? 0));
    if (openTasksCount > 0) {
      const overdueCount = data?.overdueTasks ?? 0;
      readinessSteps.push(
        overdueCount > 0
          ? `Complete ${openTasksCount} open task${openTasksCount !== 1 ? 's' : ''} — ${overdueCount} ${overdueCount !== 1 ? 'are' : 'is'} overdue.`
          : `Complete ${openTasksCount} remaining task${openTasksCount !== 1 ? 's' : ''}.`
      );
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Status banner */}
      {assignMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 border ${
          assignMsg.includes('sent')
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
        }`}>
          <Check size={15} /> {assignMsg}
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Welcome back, {user?.first_name}.</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Here's what needs your attention today.</p>
      </div>

      {/* No matter — onboarding card */}
      {!matter && (
        <div className="rounded-2xl bg-gradient-to-r from-[#0f2057] to-[#1a3476] text-white p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Briefcase size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base">Set up your case to get started</div>
            <div className="text-blue-200 text-sm mt-0.5">Tell us what type of legal matter you need help with.</div>
          </div>
          <button onClick={() => navigate('/my-case')}
            className="flex items-center gap-2 bg-white text-[#0f2057] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap flex-shrink-0">
            Get Started <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Pending attorney acceptance */}
      {pendingAccept && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
          <Clock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">Waiting for Attorney Acceptance</div>
            <div className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              <strong>{matter.attorney_name || 'Your attorney'}</strong> will review and accept shortly.
            </div>
          </div>
          <button onClick={() => navigate('/messages')}
            className="text-xs bg-amber-100 dark:bg-amber-800/60 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-200 dark:hover:bg-amber-800 flex items-center gap-1">
            <MessageSquare size={12} /> Message
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Tasks', value: displayTasks,
            sub: checklistPend > 0 ? `${checklistPend} checklist · ${data?.overdueTasks ?? 0} overdue` : `${data?.overdueTasks ?? 0} overdue`,
            icon: CheckSquare, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Upcoming Appointments', value: data?.upcomingAppts?.length ?? 0,
            sub: nextApptDays != null ? `Next in ${nextApptDays}d` : 'None scheduled',
            icon: Calendar, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
          { label: 'Required Documents', value: data?.requiredDocsPending ?? 0,
            sub: `${docsUploaded} of ${docsTotal} uploaded${daysToCount !== null ? ` · ${daysToCount < 0 ? 'Past due' : `${daysToCount}d left`}` : ''}`,
            icon: FileText, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Matter Readiness', value: `${readiness}%`,
            sub: readiness >= 75 ? 'On track' : readiness >= 50 ? 'Needs attention' : 'At risk',
            icon: Shield, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}><Icon size={18} /></div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</div>
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</div>
            <div className="text-xs text-gray-400">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Case Status */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  {matter?.matter_type === 'guardianship'                   ? 'Guardianship'
                   : matter?.matter_type === 'conservatorship'              ? 'Conservatorship'
                   : matter?.matter_type === 'guardianship_conservatorship' ? 'Guardianship & Conservatorship'
                   : matter?.matter_type === 'estate_administration'        ? 'Estate Administration'
                   : 'Case'} Status
                </div>
                {matter?.case_number && (
                  <div className="text-xs text-gray-500 mt-1">
                    Client Number:{' '}
                    <span className="font-mono font-semibold text-[#0f2057] dark:text-blue-400">{matter.case_number}</span>
                  </div>
                )}
                {matter && (
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {matter.description && <span>{matter.description} ·</span>}
                    {matter.attorney_name
                      ? <span className="flex items-center gap-1.5">
                          <UserCheck size={11} className={caseAccepted ? 'text-green-500' : 'text-amber-500'} />
                          {matter.attorney_name}
                          <AttorneyStatusBadge hasAttorney caseAccepted={caseAccepted} />
                        </span>
                      : <button onClick={() => setShowAttyPicker(true)}
                          className="text-amber-600 font-medium hover:text-amber-700 underline underline-offset-2">
                          Attorney not yet assigned — click to select
                        </button>
                    }
                  </div>
                )}
              </div>
              {matter && <span className="badge badge-blue capitalize">{matter.stage?.replace(/_/g, ' ')}</span>}
            </div>

            {/* Stage progress bar */}
            <div className="overflow-x-auto">
              <ol className="flex items-start min-w-max pb-2">
                {STAGES.map((stage, i) => {
                  const done = i <= stageIdx, curr = i === stageIdx, last = i === STAGES.length - 1;
                  return (
                    <li key={stage} className="flex items-start">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          curr ? 'bg-[#0f2057] dark:bg-blue-500 border-[#0f2057] dark:border-blue-500 text-white ring-2 ring-[#0f2057]/20 dark:ring-blue-400/30 shadow-md'
                               : done ? 'bg-green-500 border-green-500 text-white shadow-sm'
                               : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                        }`}>
                          {done && !curr ? <Check size={12} strokeWidth={3} /> : i + 1}
                        </div>
                        <div className={`text-[9px] mt-1 text-center w-14 leading-tight font-medium ${
                          curr ? 'text-[#0f2057] dark:text-blue-400 font-semibold' : done ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                        }`}>{stage}</div>
                      </div>
                      {!last && (
                        <div className={`w-8 h-0.5 mt-3.5 mx-0.5 flex-shrink-0 rounded-full transition-colors ${
                          i < stageIdx ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                        }`} />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {matter && (
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Next Court Event:{' '}
                  <span className={`font-semibold ${daysToCount !== null && daysToCount < 30 ? 'text-orange-500' : 'text-gray-700 dark:text-gray-300'}`}>
                    {courtDate ? courtDate.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}
                  </span>
                </span>
                {daysToCount !== null && (
                  <span className={`flex items-center gap-1 font-medium ${
                    daysToCount < 0 ? 'text-red-500' : daysToCount < 14 ? 'text-orange-500' : 'text-gray-500'
                  }`}>
                    <Clock size={11} />
                    {daysToCount < 0 ? `${Math.abs(daysToCount)}d overdue` : `${daysToCount}d to court`}
                  </span>
                )}
              </div>
            )}

            {caseAccepted && matter?.attorney_id && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap">
                <button onClick={() => navigate('/messages')}
                  className="flex items-center gap-1.5 text-xs font-medium bg-[#0f2057] text-white px-3 py-1.5 rounded-lg hover:bg-[#1a3476] transition-colors">
                  <MessageSquare size={13} /> Message Your Attorney
                </button>
                <button onClick={() => navigate('/appointments')}
                  className="flex items-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <Calendar size={13} /> Schedule Appointment
                </button>
                <button onClick={() => navigate('/checklist')}
                  className="flex items-center gap-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <CheckSquare size={13} /> View Checklist
                </button>
              </div>
            )}
          </div>

          {/* Required docs — real checklist, only once an attorney has accepted */}
          {matter?.id && (
            <RequiredDocsPanel matterId={matter.id} matterType={matter.matter_type} caseAccepted={caseAccepted} />
          )}

          {/* Attorney-reviewed docs */}
          {matter?.id && <ReviewedDocsPanel matterId={matter.id} />}

          {/* Next Actions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Your Next Actions</div>
              <button onClick={() => navigate('/open-tasks')} className="text-xs text-green-600 hover:text-green-700 font-medium">View all →</button>
            </div>
            <div className="space-y-2">
              {(data?.tasks || []).slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task.status === 'overdue' ? 'bg-orange-400' : task.status === 'completed' ? 'bg-green-400' : 'bg-amber-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{task.title}</div>
                    <div className="text-xs text-gray-400 truncate">{task.description}</div>
                  </div>
                  <div className={`text-xs font-medium flex-shrink-0 ${statusColor(task.status)}`}>
                    {task.status === 'overdue' ? 'Overdue'
                      : task.due_date ? `Due in ${Math.max(0, Math.ceil((new Date(task.due_date) - new Date()) / 86400000))}d`
                      : 'No due date'}
                  </div>
                  {task.action_label && (() => {
                    const cfg = ACTION_CFG[task.action_label] || ACTION_CFG.Review;
                    return (
                      <button className={`flex items-center justify-center gap-1.5 text-xs font-semibold min-w-[80px] ${cfg.cls} text-white px-3 py-1.5 rounded-lg transition-colors flex-shrink-0`}>
                        <cfg.Icon size={13} /> {task.action_label}
                      </button>
                    );
                  })()}
                </div>
              ))}
              {(!data?.tasks || data.tasks.length === 0) && (
                <div className="text-center py-6 text-gray-400 text-sm">No open tasks — you're all caught up!</div>
              )}
            </div>
          </div>

          {/* Document Upload Center */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Document Upload Center</div>
              {daysToCount !== null && (
                <span className={`text-xs font-medium flex items-center gap-1 ${
                  daysToCount < 0 ? 'text-red-500' : daysToCount < 14 ? 'text-orange-500' : 'text-gray-500'
                }`}>
                  <Clock size={11} />
                  {daysToCount < 0 ? 'Court date passed' : `${daysToCount}d until court`}
                </span>
              )}
            </div>
            <div className="space-y-2 mb-4">
              {(data?.uploadedDocs || []).map(({ category, uploaded, total }) => (
                <div key={category} className="flex items-center gap-3">
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{shortCat(category)}</span>
                      <span className="text-gray-400">{uploaded}/{total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: total ? `${(uploaded / total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.uploadedDocs || data.uploadedDocs.length === 0) && (
                <div className="text-xs text-gray-400 text-center py-2">No documents on file yet</div>
              )}
            </div>
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-4 text-center hover:border-green-400 transition-colors cursor-pointer"
              onClick={() => navigate('/documents')}>
              <Upload size={20} className="mx-auto text-gray-400 mb-1" />
              <div className="text-sm text-gray-500 dark:text-gray-400">Drag & drop files here</div>
              <div className="text-xs text-gray-400">PDF, JPG, PNG · Max 20 MB</div>
              <button className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-lg font-medium">
                Choose Files
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Matter Readiness */}
          <div className="card p-4 text-center">
            <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-3">Matter Readiness</div>
            <ReadinessGauge value={readiness} />
            <div className="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
              <div>
                <div className="font-bold text-gray-700 dark:text-gray-300">{docsUploaded}/{docsTotal}</div>
                <div className="text-gray-400">Docs</div>
              </div>
              <div>
                <div className="font-bold text-gray-700 dark:text-gray-300">{data?.completedTasks ?? 0}/{data?.totalTasks ?? 0}</div>
                <div className="text-gray-400">Tasks Done</div>
              </div>
              <div>
                <div className={`font-bold ${(data?.overdueTasks ?? 0) > 0 ? 'text-orange-500' : 'text-gray-700 dark:text-gray-300'}`}>
                  {data?.overdueTasks ?? 0}
                </div>
                <div className="text-gray-400">Overdue</div>
              </div>
            </div>
            {readinessSteps.length > 0 && (
              <div className={`mt-3 text-left rounded-xl p-3 border ${
                readiness < 50
                  ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800'
                  : 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800'
              }`}>
                <div className={`text-xs font-semibold mb-2 ${readiness < 50 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {readiness < 50 ? 'At risk — here\'s what to do next' : 'Steps to complete your readiness'}
                </div>
                <ul className="space-y-1.5">
                  {readinessSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[10px] mt-0.5 ${
                        readiness < 50 ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600'
                      }`}>{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Attorney selection */}
          {matter && !matter.attorney_id && (
            <div className="card p-4 border-2 border-amber-200 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10">
              <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-1 flex items-center gap-1.5">
                <UserCheck size={14} className="text-amber-600" /> Select Your Attorney
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Choose a registered attorney or invite your own to the platform.
              </p>
              <button onClick={() => setShowAttyPicker(true)}
                className="w-full py-2 bg-[#0f2057] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3476] transition-colors mb-2">
                View Available Attorneys
              </button>
              <button onClick={() => setShowInvite(true)}
                className="w-full py-2 border border-[#0f2057] dark:border-blue-500 text-[#0f2057] dark:text-blue-400 text-sm font-medium rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2">
                <Mail size={14} /> Invite My Attorney by Email
              </button>
            </div>
          )}

          {/* Attorney card — assigned */}
          {matter?.attorney_id && (
            <div className={`card p-4 ${caseAccepted ? 'border-green-200 dark:border-green-700' : 'border-amber-200 dark:border-amber-700'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#0f2057] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {matter.attorney_initials || matter.attorney_name?.split(' ').map(n => n[0]).join('') || 'AT'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{matter.attorney_name || 'Your Attorney'}</div>
                  <AttorneyStatusBadge hasAttorney caseAccepted={caseAccepted} />
                </div>
              </div>
              <div className="flex gap-2">
                {caseAccepted && (
                  <button onClick={() => navigate('/messages')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#0f2057] text-white text-xs font-semibold rounded-lg hover:bg-[#1a3476] transition-colors">
                    <MessageSquare size={13} /> Message
                  </button>
                )}
                <button onClick={() => setShowAttyPicker(true)}
                  className={`flex items-center justify-center gap-1.5 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${caseAccepted ? 'flex-1' : 'w-full'}`}>
                  <RefreshCw size={12} /> Change Attorney
                </button>
              </div>
            </div>
          )}

          {/* Upcoming appointment */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-green-500" /> Upcoming Appointment
            </div>
            {(data?.upcomingAppts || []).slice(0, 1).map(appt => (
              <div key={appt.id} className="flex items-start gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl px-3 py-2 text-center flex-shrink-0">
                  <div className="text-xs font-semibold">{new Date(appt.start_time).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</div>
                  <div className="text-2xl font-bold">{new Date(appt.start_time).getDate()}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{appt.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(appt.start_time).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                  <div className="text-xs text-gray-400">{new Date(appt.start_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })} · {appt.location}</div>
                  <button className="mt-2 text-xs bg-[#0f2057] text-white px-3 py-1 rounded-lg hover:bg-[#1a3476] transition-colors">Join Appointment</button>
                </div>
              </div>
            ))}
            {(!data?.upcomingAppts || !data.upcomingAppts.length) && (
              <div className="text-sm text-gray-400 text-center py-3">No upcoming appointments</div>
            )}
          </div>

          {/* Important deadlines */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-3 flex items-center justify-between">
              Important Deadlines
              <button onClick={() => navigate('/care-tasks')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2.5">
              {(data?.deadlines || []).slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`text-xs font-bold w-14 text-center flex-shrink-0 leading-tight ${d.urgent ? 'text-orange-500' : 'text-[#0f2057] dark:text-blue-400'}`}>
                    {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-snug">{d.title}</div>
                    <div className="text-xs text-gray-400">{d.description}</div>
                    <div className={`text-xs font-medium mt-0.5 ${d.urgent ? 'text-orange-500' : 'text-gray-500'}`}>
                      In {d.days_left} day{d.days_left !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.deadlines || data.deadlines.length === 0) && (
                <div className="text-sm text-gray-400 text-center py-2">No upcoming deadlines</div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-3 flex items-center justify-between">
              Messages from Your Legal Team
              <button onClick={() => navigate('/messages')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2.5">
              {(data?.messages || []).slice(0, 3).map(msg => (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-[#0f2057] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {msg.from_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{msg.from_name}</div>
                      <div className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{msg.body}</div>
                  </div>
                </div>
              ))}
              {(!data?.messages || !data.messages.length) && (
                <div className="text-sm text-gray-400 text-center py-2">No messages yet</div>
              )}
            </div>
          </div>

          {/* Help */}
          <div className="card p-4 bg-gray-50 dark:bg-gray-700/30">
            <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm mb-1">Need Help?</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">We're here to support you every step of the way.</div>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg p-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
                <Phone size={14} className="text-[#0f2057] dark:text-blue-400" /> Schedule a Call
              </button>
              <button onClick={() => navigate('/messages')}
                className="w-full flex items-center gap-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg p-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
                <MessageSquare size={14} className="text-[#0f2057] dark:text-blue-400" /> Contact Support
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-2 text-center">Call us: (855) 555-1212</div>
          </div>
        </div>
      </div>

      <AttorneyPickerModal
        open={showAttyPicker}
        onClose={() => setShowAttyPicker(false)}
        matterId={matter?.id}
        currentAttorneyId={matter?.attorney_id}
        onAssigned={handleAssigned}
        onInviteInstead={() => setShowInvite(true)}
      />

      {showInvite && <InviteAttorneyModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
