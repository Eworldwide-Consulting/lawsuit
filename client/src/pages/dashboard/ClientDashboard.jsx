import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, mattersApi, usersApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Calendar, FileText, CheckSquare, Upload, Eye, PenLine, Phone, MessageSquare,
         Shield, Check, CheckCircle, Briefcase, ArrowRight, Clock, UserCheck, X } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';

const ACTION_CFG = {
  Upload:  { Icon: Upload,      cls: 'bg-[#0f2057] hover:bg-[#1a3476]' },
  Review:  { Icon: Eye,         cls: 'bg-blue-600  hover:bg-blue-700'  },
  Sign:    { Icon: PenLine,     cls: 'bg-violet-600 hover:bg-violet-700' },
  Confirm: { Icon: CheckCircle, cls: 'bg-green-600  hover:bg-green-700' },
};

const STAGES     = ['Intake', 'Petition Filed', 'Hearing Prep', 'Guardian Appointed', 'Care Plan', 'Annual Review', 'Court Review'];
const STAGE_KEYS = ['intake', 'petition_filed', 'hearing_prep', 'guardian_appointed', 'care_plan', 'annual_review', 'court_review'];

// Orange for overdue (amber-600 reads as orange in most contexts)
const statusColor = status => {
  if (status === 'overdue') return 'text-orange-500';
  if (status === 'pending') return 'text-amber-600';
  return 'text-gray-500';
};

const shortCat = cat => cat.replace(/^\d+\.\s*/, '');

const ReadinessGauge = memo(function ReadinessGauge({ value }) {
  const r = 40, circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  const color = value >= 75 ? '#22c55e' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-gray-800">{value}%</div>
        <div className="text-xs text-gray-500">{value >= 75 ? 'On track' : value >= 50 ? 'Attention' : 'At risk'}</div>
      </div>
    </div>
  );
});

// Attorney card used inside the picker modal
function AttorneyCard({ attorney, onAssign, assigning }) {
  const specs = attorney.specializations
    ? attorney.specializations.split(',').slice(0, 2).join(', ')
    : null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#0f2057]/30 hover:bg-blue-50/30 transition-all">
      <div className="w-10 h-10 rounded-full bg-[#0f2057] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {attorney.avatar_initials || `${attorney.first_name[0]}${attorney.last_name[0]}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800">
          {attorney.first_name} {attorney.last_name}
          <span className="ml-1.5 text-xs text-gray-400 font-normal capitalize">{attorney.role}</span>
        </div>
        {specs && <div className="text-xs text-gray-500 truncate">{specs}</div>}
        {attorney.years_experience && (
          <div className="text-xs text-gray-400">{attorney.years_experience} yrs experience</div>
        )}
      </div>
      <button
        onClick={() => onAssign(attorney.id)}
        disabled={assigning}
        className="flex-shrink-0 text-xs font-semibold bg-[#0f2057] text-white px-3 py-1.5 rounded-lg hover:bg-[#1a3476] disabled:opacity-50 transition-colors"
      >
        {assigning ? '...' : 'Select'}
      </button>
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showAttyPicker, setShowAttyPicker] = useState(false);
  const [attorneys, setAttorneys]   = useState([]);
  const [attysLoading, setAttysLoading] = useState(false);
  const [assigning, setAssigning]   = useState(false);
  const [assignMsg, setAssignMsg]   = useState('');

  const loadDashboard = () =>
    dashboardApi.client().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));

  useEffect(() => { loadDashboard(); }, []);

  async function openAttyPicker() {
    setShowAttyPicker(true);
    if (attorneys.length) return;
    setAttysLoading(true);
    try {
      const r = await usersApi.availableAttorneys();
      setAttorneys(r.data || []);
    } finally {
      setAttysLoading(false);
    }
  }

  async function handleAssignAttorney(attorneyId) {
    if (!data?.matter?.id) return;
    setAssigning(true);
    try {
      await mattersApi.assignAttorney(data.matter.id, attorneyId);
      setShowAttyPicker(false);
      setAssignMsg('Attorney assigned successfully!');
      setTimeout(() => setAssignMsg(''), 4000);
      // Reload dashboard so attorney name appears
      setLoading(true);
      loadDashboard();
    } catch (err) {
      setAssignMsg(err.response?.data?.error || 'Failed to assign attorney');
      setTimeout(() => setAssignMsg(''), 4000);
    } finally {
      setAssigning(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const matter   = data?.matter;
  const stageIdx = matter ? STAGE_KEYS.indexOf(matter.stage) : 0;

  const nextApptDays = data?.upcomingAppts?.length
    ? Math.ceil((new Date(data.upcomingAppts[0].start_time) - new Date()) / 86400000)
    : null;

  const readiness      = data?.readinessScore ?? 0;
  const readinessLabel = readiness >= 75 ? 'On track' : readiness >= 50 ? 'Needs attention' : 'At risk';

  // Tasks: show pending checklist count when no explicit open tasks
  const checklistPending = Math.max(0, (data?.checklistTotal ?? 0) - (data?.checklistAccepted ?? 0));
  const displayTasks     = (data?.openTasks ?? 0) > 0 ? data.openTasks : checklistPending;

  // Docs: use uploaded count (includes submitted-not-yet-reviewed) for the gauge
  const docsUploaded = data?.checklistUploaded ?? data?.completedDocs ?? 0;
  const docsTotal    = data?.checklistTotal    ?? data?.totalDocs     ?? 0;

  // Days until court date / important date (for document deadline prompt)
  const courtDate   = matter?.important_date ? new Date(matter.important_date) : null;
  const daysToCount = courtDate ? Math.ceil((courtDate - new Date()) / 86400000) : null;
  const courtUrgent = daysToCount !== null && daysToCount < 30;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Success banner */}
      {assignMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
          assignMsg.includes('success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {assignMsg.includes('success') ? <Check size={15} /> : null}
          {assignMsg}
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Welcome back, {user?.first_name}.</h1>
        <p className="text-gray-500 text-sm">Here's what needs your attention today.</p>
      </div>

      {/* No-matter onboarding banner */}
      {!data?.matter && (
        <div className="rounded-2xl bg-gradient-to-r from-[#0f2057] to-[#1a3476] text-white p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Briefcase size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base">Set up your case to get started</div>
            <div className="text-blue-200 text-sm mt-0.5">
              Tell us what type of legal matter you need help with and your legal team will be ready to assist.
            </div>
          </div>
          <button
            onClick={() => navigate('/my-case')}
            className="flex items-center gap-2 bg-white text-[#0f2057] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap flex-shrink-0"
          >
            Get Started <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Tasks',
            value: displayTasks,
            sub: checklistPending > 0
              ? `${checklistPending} checklist pending · ${data?.overdueTasks ?? 0} overdue`
              : `${data?.overdueTasks ?? 0} overdue`,
            icon: CheckSquare,
            color: 'text-blue-600 bg-blue-50',
          },
          {
            label: 'Upcoming Appointments',
            value: data?.upcomingAppts?.length ?? 0,
            sub: nextApptDays != null ? `Next in ${nextApptDays} day${nextApptDays !== 1 ? 's' : ''}` : 'None scheduled',
            icon: Calendar,
            color: 'text-green-600 bg-green-50',
          },
          {
            label: 'Required Documents',
            value: data?.requiredDocsPending ?? 0,
            sub: daysToCount !== null
              ? `${docsUploaded} of ${docsTotal} uploaded · ${daysToCount < 0 ? 'Past due!' : `${daysToCount}d left`}`
              : `${docsUploaded} of ${docsTotal} uploaded`,
            icon: FileText,
            color: daysToCount !== null && daysToCount < 14
              ? 'text-orange-500 bg-orange-50'
              : 'text-orange-600 bg-orange-50',
          },
          {
            label: 'Guardian Readiness',
            value: `${readiness}%`,
            sub: readinessLabel,
            icon: Shield,
            color: 'text-purple-600 bg-purple-50',
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}><Icon size={18} /></div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
            <div className="text-xs font-medium text-gray-700">{label}</div>
            <div className="text-xs text-gray-400">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: case status + tasks + documents */}
        <div className="lg:col-span-2 space-y-5">

          {/* Case Status */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-800">
                  {matter?.matter_type === 'guardianship'                        ? 'Guardianship'
                   : matter?.matter_type === 'conservatorship'                   ? 'Conservatorship'
                   : matter?.matter_type === 'guardianship_conservatorship'      ? 'Guardianship & Conservatorship'
                   : matter?.matter_type === 'estate_administration'             ? 'Estate Administration'
                   : 'Case'} Status
                </div>
                {matter && (
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {matter.description && <span>{matter.description} ·</span>}
                    {matter.attorney_name
                      ? <span className="flex items-center gap-1"><UserCheck size={11} className="text-green-500" /> {matter.attorney_name}</span>
                      : (
                        <button
                          onClick={openAttyPicker}
                          className="text-amber-600 font-medium hover:text-amber-700 flex items-center gap-1 underline underline-offset-2"
                        >
                          Attorney not yet assigned â€” click to select
                        </button>
                      )}
                  </div>
                )}
              </div>
              {matter && (
                <span className="badge badge-blue capitalize">{matter.stage?.replace(/_/g, ' ')}</span>
              )}
            </div>

            <div className="overflow-x-auto">
              <ol className="flex items-start min-w-max pb-2">
                {STAGES.map((stage, i) => {
                  const done = i <= stageIdx;
                  const curr = i === stageIdx;
                  const last = i === STAGES.length - 1;
                  return (
                    <li key={stage} className="flex items-start">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          curr ? 'bg-[#0f2057] border-[#0f2057] text-white ring-2 ring-[#0f2057]/20 shadow-md' :
                          done ? 'bg-green-500 border-green-500 text-white shadow-sm' :
                                 'bg-white border-gray-300 text-gray-400'
                        }`}>
                          {done && !curr ? <Check size={12} strokeWidth={3} /> : i + 1}
                        </div>
                        <div className={`text-[9px] mt-1 text-center w-14 leading-tight font-medium ${
                          curr ? 'text-[#0f2057] font-semibold' : done ? 'text-green-600' : 'text-gray-400'
                        }`}>{stage}</div>
                      </div>
                      {!last && (
                        <div className={`w-8 h-0.5 mt-3.5 mx-0.5 flex-shrink-0 rounded-full transition-colors ${
                          i < stageIdx ? 'bg-green-500' : 'bg-gray-200'
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
                  <span className={`font-semibold ${courtUrgent ? 'text-orange-500' : 'text-gray-700'}`}>
                    {courtDate
                      ? courtDate.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })
                      : 'TBD'}
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
          </div>

          {/* Your Next Actions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800 text-sm">Your Next Actions</div>
              <button onClick={() => navigate('/open-tasks')} className="text-xs text-green-600 hover:text-green-700 font-medium">
                View all tasks â†’
              </button>
            </div>
            <div className="space-y-2">
              {(data?.tasks || []).slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task.status === 'overdue' ? 'bg-orange-400' : task.status === 'completed' ? 'bg-green-400' : 'bg-amber-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{task.title}</div>
                    <div className="text-xs text-gray-400 truncate">{task.description}</div>
                  </div>
                  <div className={`text-xs font-medium flex-shrink-0 ${statusColor(task.status)}`}>
                    {task.status === 'overdue'
                      ? 'Overdue'
                      : task.due_date
                        ? `Due in ${Math.max(0, Math.ceil((new Date(task.due_date) - new Date()) / 86400000))} days`
                        : 'No due date'}
                  </div>
                  {task.action_label && (() => {
                    const cfg = ACTION_CFG[task.action_label] || ACTION_CFG.Review;
                    return (
                      <button className={`flex items-center justify-center gap-1.5 text-xs font-semibold min-w-[88px] ${cfg.cls} text-white px-3 py-1.5 rounded-lg transition-colors flex-shrink-0`}>
                        <cfg.Icon size={13} /> {task.action_label}
                      </button>
                    );
                  })()}
                </div>
              ))}
              {(!data?.tasks || data.tasks.length === 0) && (
                <div className="text-center py-6 text-gray-400 text-sm">No open tasks â€” you're all caught up!</div>
              )}
            </div>
          </div>

          {/* Document Upload Center */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800 text-sm">Document Upload Center</div>
              {daysToCount !== null && (
                <span className={`text-xs font-medium flex items-center gap-1 ${
                  daysToCount < 0 ? 'text-red-500' : daysToCount < 14 ? 'text-orange-500' : 'text-gray-500'
                }`}>
                  <Clock size={11} />
                  {daysToCount < 0 ? 'Court date passed' : `${daysToCount} days until court`}
                </span>
              )}
            </div>
            <div className="space-y-2 mb-4">
              {(data?.uploadedDocs || []).map(({ category, uploaded, total }) => (
                <div key={category} className="flex items-center gap-3">
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{shortCat(category)}</span>
                      <span className="text-gray-400">{uploaded} / {total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: total ? `${(uploaded / total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.uploadedDocs || data.uploadedDocs.length === 0) && (
                <div className="text-xs text-gray-400 text-center py-2">No documents on file yet</div>
              )}
            </div>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-green-400 transition-colors cursor-pointer"
              onClick={() => navigate('/documents')}
            >
              <Upload size={20} className="mx-auto text-gray-400 mb-1" />
              <div className="text-sm text-gray-500">Drag & drop files here</div>
              <div className="text-xs text-gray-400">PDF, JPG, PNG · Max 20 MB</div>
              <button className="mt-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg font-medium">
                Choose Files
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Guardian Readiness gauge */}
          <div className="card p-4 text-center">
            <div className="font-semibold text-gray-800 text-sm mb-3">Guardian Readiness</div>
            <ReadinessGauge value={readiness} />
            <div className="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
              <div>
                <div className="font-bold text-gray-700">{docsUploaded}/{docsTotal}</div>
                <div className="text-gray-400">Docs</div>
              </div>
              <div>
                <div className="font-bold text-gray-700">{data?.completedTasks ?? 0}/{data?.totalTasks ?? 0}</div>
                <div className="text-gray-400">Tasks Done</div>
              </div>
              <div>
                <div className={`font-bold ${(data?.overdueTasks ?? 0) > 0 ? 'text-orange-500' : 'text-gray-700'}`}>
                  {data?.overdueTasks ?? 0}
                </div>
                <div className="text-gray-400">Overdue</div>
              </div>
            </div>
            {docsUploaded > 0 && (data?.checklistAccepted ?? 0) < docsUploaded && (
              <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                {docsUploaded - (data?.checklistAccepted ?? 0)} doc{docsUploaded - (data?.checklistAccepted ?? 0) !== 1 ? 's' : ''} pending attorney review
              </div>
            )}
          </div>

          {/* Attorney assignment â€” shown when no attorney assigned and matter exists */}
          {matter && !matter.attorney_id && (
            <div className="card p-4 border-2 border-amber-200 bg-amber-50/40">
              <div className="font-semibold text-gray-800 text-sm mb-1 flex items-center gap-1.5">
                <UserCheck size={14} className="text-amber-600" /> Select Your Attorney
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Choose an attorney from our team to handle your case and enable direct messaging.
              </p>
              <button
                onClick={openAttyPicker}
                className="w-full py-2 bg-[#0f2057] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3476] transition-colors"
              >
                View Available Attorneys
              </button>
            </div>
          )}

          {/* Upcoming appointment */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-green-500" /> Upcoming Appointment
            </div>
            {(data?.upcomingAppts || []).slice(0, 1).map(appt => (
              <div key={appt.id} className="flex items-start gap-3">
                <div className="bg-green-50 text-green-700 rounded-xl px-3 py-2 text-center flex-shrink-0">
                  <div className="text-xs font-semibold">
                    {new Date(appt.start_time).toLocaleDateString('en', { month: 'short' }).toUpperCase()}
                  </div>
                  <div className="text-2xl font-bold">{new Date(appt.start_time).getDate()}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{appt.title}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(appt.start_time).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(appt.start_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })} · {appt.location}
                  </div>
                  <button className="mt-2 text-xs bg-navy-900 text-white px-3 py-1 rounded-lg hover:bg-navy-800">
                    Join Appointment
                  </button>
                </div>
              </div>
            ))}
            {(!data?.upcomingAppts || !data.upcomingAppts.length) && (
              <div className="text-sm text-gray-400 text-center py-3">No upcoming appointments</div>
            )}
          </div>

          {/* Important deadlines */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Important Deadlines
              <button onClick={() => navigate('/care-tasks')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2.5">
              {(data?.deadlines || []).slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`text-xs font-bold w-14 text-center flex-shrink-0 leading-tight ${d.urgent ? 'text-orange-500' : 'text-navy-900'}`}>
                    {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 leading-snug">{d.title}</div>
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

          {/* Messages from legal team */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Messages from Your Legal Team
              <button onClick={() => navigate('/messages')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2.5">
              {(data?.messages || []).slice(0, 3).map(msg => (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-navy-900 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {msg.from_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <div className="text-xs font-semibold text-gray-700">{msg.from_name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(msg.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{msg.body}</div>
                  </div>
                </div>
              ))}
              {(!data?.messages || !data.messages.length) && (
                <div className="text-sm text-gray-400 text-center py-2">No messages yet</div>
              )}
            </div>
          </div>

          {/* Help */}
          <div className="card p-4 bg-gray-50">
            <div className="font-semibold text-gray-800 text-sm mb-1">Need Help?</div>
            <div className="text-xs text-gray-500 mb-3">We're here to support you every step of the way.</div>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 border border-gray-300 bg-white rounded-lg p-2 text-xs font-medium hover:bg-gray-50">
                <Phone size={14} className="text-navy-900" /> Schedule a Call
              </button>
              <button
                onClick={() => navigate('/messages')}
                className="w-full flex items-center gap-2 border border-gray-300 bg-white rounded-lg p-2 text-xs font-medium hover:bg-gray-50"
              >
                <MessageSquare size={14} className="text-navy-900" /> Contact Support
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-2 text-center">Call us: (855) 555-1212</div>
          </div>
        </div>
      </div>

      {/* Attorney Picker Modal */}
      {showAttyPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="font-bold text-gray-900">Choose Your Attorney</div>
                <div className="text-xs text-gray-500">Select an attorney to handle your case</div>
              </div>
              <button onClick={() => setShowAttyPicker(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {attysLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : attorneys.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No attorneys available at this time</div>
              ) : attorneys.map(a => (
                <AttorneyCard
                  key={a.id}
                  attorney={a}
                  onAssign={handleAssignAttorney}
                  assigning={assigning}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}