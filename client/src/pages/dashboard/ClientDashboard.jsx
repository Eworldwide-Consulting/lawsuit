import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Calendar, FileText, CheckSquare, Upload, Eye, PenLine, Phone, MessageSquare, Shield, Check, CheckCircle } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';

// Fixed icon + colour per action type — same size & min-width for every button
const ACTION_CFG = {
  Upload:  { Icon: Upload,       cls: 'bg-[#0f2057] hover:bg-[#1a3476]' },
  Review:  { Icon: Eye,          cls: 'bg-blue-600  hover:bg-blue-700'  },
  Sign:    { Icon: PenLine,      cls: 'bg-violet-600 hover:bg-violet-700' },
  Confirm: { Icon: CheckCircle,  cls: 'bg-green-600  hover:bg-green-700' },
};

const STAGES     = ['Intake', 'Petition Filed', 'Hearing Prep', 'Guardian Appointed', 'Care Plan', 'Annual Review', 'Court Review'];
const STAGE_KEYS = ['intake', 'petition_filed', 'hearing_prep', 'guardian_appointed', 'care_plan', 'annual_review', 'court_review'];

function ReadinessGauge({ value }) {
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
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.client().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const matter   = data?.matter;
  const stageIdx = matter ? STAGE_KEYS.indexOf(matter.stage) : 0;

  const nextApptDays = data?.upcomingAppts?.length
    ? Math.ceil((new Date(data.upcomingAppts[0].start_time) - new Date()) / 86400000)
    : null;

  const readiness      = data?.readinessScore ?? 0;
  const readinessLabel = readiness >= 75 ? 'On track' : readiness >= 50 ? 'Needs attention' : 'At risk';

  const statusColor = status => {
    if (status === 'overdue') return 'text-red-600';
    if (status === 'pending') return 'text-amber-600';
    return 'text-gray-500';
  };

  // Strip "1. " prefix from category names for display
  const shortCat = cat => cat.replace(/^\d+\.\s*/, '');

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Welcome back, {user?.first_name}.</h1>
        <p className="text-gray-500 text-sm">Here's what needs your attention today.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Open Tasks',
            value: data?.openTasks ?? 0,
            sub: `${data?.overdueTasks ?? 0} overdue`,
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
            sub: `${data?.completedDocs ?? 0} of ${data?.totalDocs ?? 0} uploaded`,
            icon: FileText,
            color: 'text-orange-600 bg-orange-50',
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

          {/* Guardianship / Case Status */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-800">
                  {matter?.matter_type === 'guardianship' ? 'Guardianship' : 'Conservatorship'} Status
                </div>
                {matter && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {matter.description} · Attorney: {matter.attorney_name}
                  </div>
                )}
              </div>
              {matter && (
                <span className="badge badge-blue capitalize">{matter.stage?.replace(/_/g, ' ')}</span>
              )}
            </div>

            <div className="overflow-x-auto">
              {/* items-start + mt-3.5 connector aligns line to circle centre (h-7 / 2 = 14px = 3.5) */}
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
              <div className="mt-3 text-xs text-gray-500">
                Next Court Event:{' '}
                <span className="font-semibold text-gray-700">
                  {matter.important_date
                    ? new Date(matter.important_date).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'TBD'}
                </span>
              </div>
            )}
          </div>

          {/* Your Next Actions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800 text-sm">Your Next Actions</div>
              <button onClick={() => navigate('/care-tasks')} className="text-xs text-green-600 hover:text-green-700 font-medium">
                View all tasks →
              </button>
            </div>
            <div className="space-y-2">
              {(data?.tasks || []).slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task.status === 'overdue' ? 'bg-red-400' : task.status === 'completed' ? 'bg-green-400' : 'bg-amber-400'
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
                <div className="text-center py-6 text-gray-400 text-sm">No open tasks — you're all caught up!</div>
              )}
            </div>
          </div>

          {/* Document Upload Center */}
          <div className="card p-5">
            <div className="font-semibold text-gray-800 text-sm mb-3">Document Upload Center</div>
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
                <div className="font-bold text-gray-700">{data?.completedDocs ?? 0}/{data?.totalDocs ?? 0}</div>
                <div className="text-gray-400">Documents</div>
              </div>
              <div>
                <div className="font-bold text-gray-700">{data?.completedTasks ?? 0}/{data?.totalTasks ?? 0}</div>
                <div className="text-gray-400">Tasks Done</div>
              </div>
              <div>
                <div className={`font-bold ${(data?.overdueTasks ?? 0) > 0 ? 'text-red-500' : 'text-gray-700'}`}>
                  {data?.overdueTasks ?? 0}
                </div>
                <div className="text-gray-400">Overdue</div>
              </div>
            </div>
          </div>

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

          {/* Important deadlines — live from API */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Important Deadlines
              <button onClick={() => navigate('/care-tasks')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2.5">
              {(data?.deadlines || []).slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`text-xs font-bold w-14 text-center flex-shrink-0 leading-tight ${d.urgent ? 'text-red-500' : 'text-navy-900'}`}>
                    {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700 leading-snug">{d.title}</div>
                    <div className="text-xs text-gray-400">{d.description}</div>
                    <div className={`text-xs font-medium mt-0.5 ${d.urgent ? 'text-red-500' : 'text-gray-500'}`}>
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
    </div>
  );
}
