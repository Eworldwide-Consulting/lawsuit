import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Calendar, FileText, CheckSquare, Upload, Eye, PenLine, Phone, MessageSquare, Shield } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';

const STAGES = ['Intake', 'Petition Filed', 'Hearing Prep', 'Guardian Appointed', 'Care Plan', 'Annual Review', 'Court Review'];
const STAGE_KEYS = ['intake', 'petition_filed', 'hearing_prep', 'guardian_appointed', 'care_plan', 'annual_review', 'court_review'];

function ReadinessGauge({ value }) {
  const r = 40, circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="10"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
        <div className="text-2xl font-bold text-gray-800">{value}%</div>
        <div className="text-xs text-gray-500">On track</div>
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.client().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const matter = data?.matter;
  const stageIdx = matter ? STAGE_KEYS.indexOf(matter.stage) : 0;

  const actionIcon = (label) => {
    if (label === 'Upload') return <Upload size={14} />;
    if (label === 'Sign') return <PenLine size={14} />;
    return <Eye size={14} />;
  };

  const statusColor = (status) => {
    if (status === 'overdue') return 'text-red-600';
    if (status === 'pending') return 'text-amber-600';
    return 'text-gray-500';
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Welcome back, {user?.first_name}.</h1>
        <p className="text-gray-500 text-sm">Here's what needs your attention today for your guardianship responsibilities.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Open Tasks', value: data?.openTasks || 0, sub: `${data?.overdueTasks || 0} overdue`, icon: CheckSquare, color: 'text-blue-600 bg-blue-50' },
          { label: 'Upcoming Appointments', value: data?.upcomingAppts?.length || 0, sub: 'Next in 3 days', icon: Calendar, color: 'text-green-600 bg-green-50' },
          { label: 'Required Documents', value: data?.requiredDocsPending || 0, sub: 'Last upload 7 days ago', icon: FileText, color: 'text-orange-600 bg-orange-50' },
          { label: 'Guardian Readiness', value: '84%', sub: 'On track', icon: Shield, color: 'text-purple-600 bg-purple-50' },
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
        {/* Left: case + tasks */}
        <div className="lg:col-span-2 space-y-5">
          {/* Guardianship Status */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-gray-800">Guardianship Status</div>
                {matter && <div className="text-xs text-gray-500 mt-0.5">{matter.description} · Attorney: {matter.attorney_name}</div>}
              </div>
              {matter && <span className="badge badge-blue capitalize">{matter.stage?.replace(/_/g, ' ')}</span>}
            </div>

            {/* Stage progress */}
            <div className="overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max pb-2">
                {STAGES.map((stage, i) => {
                  const done = i <= stageIdx;
                  const curr = i === stageIdx;
                  return (
                    <div key={stage} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? (curr ? 'bg-navy-900 text-white ring-2 ring-navy-300' : 'bg-green-500 text-white') : 'bg-gray-200 text-gray-400'}`}>
                          {done && !curr ? '✓' : i + 1}
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1 text-center w-14 leading-tight">{stage}</div>
                      </div>
                      {i < STAGES.length - 1 && <div className={`w-8 h-0.5 mx-0.5 mb-4 ${i < stageIdx ? 'bg-green-500' : 'bg-gray-200'}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {matter && (
              <div className="mt-3 text-xs text-gray-500">
                Next Court Event: <span className="font-semibold text-gray-700">{matter.important_date || 'TBD'}</span> — Annual Review Hearing
              </div>
            )}
          </div>

          {/* Your Next Actions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-800 text-sm">Your Next Actions</div>
              <button onClick={() => navigate('/care-tasks')} className="text-xs text-green-600 hover:text-green-700 font-medium">View all tasks →</button>
            </div>
            <div className="space-y-2">
              {(data?.tasks || []).slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'overdue' ? 'bg-red-400' : task.status === 'completed' ? 'bg-green-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{task.title}</div>
                    <div className="text-xs text-gray-400 truncate">{task.description}</div>
                  </div>
                  <div className={`text-xs font-medium flex-shrink-0 ${statusColor(task.status)}`}>
                    {task.status === 'overdue' ? 'Overdue' : task.due_date ? `Due in ${Math.max(0, Math.ceil((new Date(task.due_date) - new Date()) / 86400000))} days` : 'No due date'}
                  </div>
                  {task.action_label && (
                    <button className="flex items-center gap-1 text-xs bg-navy-900 text-white px-3 py-1 rounded-lg hover:bg-navy-800 transition-colors flex-shrink-0">
                      {actionIcon(task.action_label)} {task.action_label}
                    </button>
                  )}
                </div>
              ))}
              {(!data?.tasks || data.tasks.length === 0) && (
                <div className="text-center py-6 text-gray-400 text-sm">No open tasks — you're all caught up! 🎉</div>
              )}
            </div>
          </div>

          {/* Document Upload Center */}
          <div className="card p-5">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              Document Upload Center
              <span className="text-xs text-gray-400 font-normal">ⓘ</span>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { label: 'Court Orders', uploaded: 2, total: 3 },
                { label: 'Care Plan', uploaded: 1, total: 2 },
                { label: 'Medical Records', uploaded: 2, total: 4 },
                { label: 'Appointment Notes', uploaded: 0, total: 3 },
              ].map(({ label, uploaded, total }) => (
                <div key={label} className="flex items-center gap-3">
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{label}</span>
                      <span className="text-gray-400">{uploaded} / {total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: total ? `${(uploaded / total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-green-400 transition-colors cursor-pointer" onClick={() => navigate('/documents')}>
              <Upload size={20} className="mx-auto text-gray-400 mb-1" />
              <div className="text-sm text-gray-500">Drag & drop files here</div>
              <div className="text-xs text-gray-400">PDF, JPG, PNG • Max 20MB</div>
              <button className="mt-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg font-medium">Choose Files</button>
            </div>
          </div>
        </div>

        {/* Right: Guardian readiness, appointments, deadlines, messages, help */}
        <div className="space-y-4">
          {/* Guardian readiness */}
          <div className="card p-4 text-center">
            <div className="font-semibold text-gray-800 text-sm mb-3">Guardian Readiness</div>
            <ReadinessGauge value={84} />
            <div className="mt-3 grid grid-cols-3 gap-1 text-center text-xs">
              <div><div className="font-bold text-gray-700">16/20</div><div className="text-gray-400">Documents</div></div>
              <div><div className="font-bold text-gray-700">14/20</div><div className="text-gray-400">Tasks Done</div></div>
              <div><div className="font-bold text-gray-700 text-red-500">5</div><div className="text-gray-400">Days Until Due</div></div>
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
                  <div className="text-xs font-semibold">{new Date(appt.start_time).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</div>
                  <div className="text-2xl font-bold">{new Date(appt.start_time).getDate()}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{appt.title}</div>
                  <div className="text-xs text-gray-500">{new Date(appt.start_time).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                  <div className="text-xs text-gray-400">{new Date(appt.start_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })} · {appt.location}</div>
                  <button className="mt-2 text-xs bg-navy-900 text-white px-3 py-1 rounded-lg hover:bg-navy-800">Join Appointment</button>
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
              Important Deadlines <button onClick={() => navigate('/deadlines')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Annual Guardian Report Due', desc: 'Covers May 1, 2024 – Apr 30, 2025', date: 'MAY 30', daysLeft: 18, urgent: true },
                { label: 'Care Plan Update Due', desc: 'Review and upload updated care plan', date: 'JUN 05', daysLeft: 24, urgent: false },
                { label: 'Review Hearing', desc: 'Annual review with the court', date: 'JUN 18', daysLeft: 37, urgent: false },
              ].map(d => (
                <div key={d.label} className="flex items-start gap-2.5">
                  <div className={`text-xs font-bold w-12 text-center flex-shrink-0 ${d.urgent ? 'text-red-500' : 'text-navy-900'}`}>{d.date}</div>
                  <div>
                    <div className="text-xs font-semibold text-gray-700">{d.label}</div>
                    <div className="text-xs text-gray-400">{d.desc}</div>
                    <div className={`text-xs font-medium mt-0.5 ${d.urgent ? 'text-red-500' : 'text-gray-500'}`}>In {d.daysLeft} days</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Messages from Your Legal Team <button onClick={() => navigate('/messages')} className="text-xs text-green-600">View all</button>
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
                      <div className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</div>
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
              <button onClick={() => navigate('/messages')} className="w-full flex items-center gap-2 border border-gray-300 bg-white rounded-lg p-2 text-xs font-medium hover:bg-gray-50">
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
