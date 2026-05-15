import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import DocumentUploadPanel from '../../components/ui/DocumentUploadPanel';

const LIFECYCLE      = ['Intake', 'Hearing Preparation', 'Initial Inventory', 'Monthly Records', 'Annual Return Prep', 'Court Review', 'Case Complete'];
const LIFECYCLE_KEYS = ['intake', 'hearing_prep', 'initial_inventory', 'monthly_records', 'annual_return_prep', 'court_review', 'complete'];

function CircleGauge({ value, max = 100, color = '#22c55e', label }) {
  const r = 32, circ = 2 * Math.PI * r;
  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${(value / max) * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-lg font-bold text-gray-900">{value}{max === 100 ? '%' : ''}</div>
        {label && <div className="text-[9px] text-gray-400 text-center leading-tight px-1">{label}</div>}
      </div>
    </div>
  );
}

// Strip "1. " numeric prefix from category names
const shortCat = cat => cat?.replace(/^\d+\.\s*/, '') ?? cat;

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.partner().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

  const readinessScore      = data?.readinessScore ?? 0;
  const annualProgress      = data?.annualReturnProgress ?? 0;
  const lifecycleStageIdx   = data?.lifecycleStageIdx ?? 0;

  // Dynamic priority alerts derived from real data
  const priorityAlerts = [
    data?.overdueTasks > 0 && {
      msg: `${data.overdueTasks} task${data.overdueTasks > 1 ? 's are' : ' is'} overdue across matters`,
      sub: 'Immediate client action required',
      color: 'bg-red-50 border-red-200', icon: '🔴',
    },
    data?.annualDeadlines > 0 && {
      msg: `${data.annualDeadlines} court deadline${data.annualDeadlines > 1 ? 's' : ''} within the next 40 days`,
      sub: 'Review upcoming obligations',
      color: 'bg-amber-50 border-amber-200', icon: '🟡',
    },
    data?.missingDocs > 0 && {
      msg: `${data.missingDocs} required document${data.missingDocs > 1 ? 's' : ''} pending from clients`,
      sub: 'Documents needed before filing',
      color: 'bg-blue-50 border-blue-200', icon: '🔵',
    },
  ].filter(Boolean);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good morning, {user?.first_name}.</h1>
        <p className="text-gray-500 text-sm">Here's your practice overview for today.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active Matters',    value: data?.activeMatters ?? 0,   sub: `${data?.readyForReview ?? 0} ready for review`, icon: '📁', subColor: 'text-green-600' },
          { label: 'Annual Deadlines',  value: data?.annualDeadlines ?? 0, sub: 'Due within 40 days',                           icon: '📅', subColor: 'text-amber-600' },
          { label: 'Missing Documents', value: data?.missingDocs ?? 0,     sub: `Across ${data?.activeMatters ?? 0} matters`,   icon: '📂', subColor: 'text-red-500'   },
          { label: 'Ready for Review',  value: data?.readyForReview ?? 0,  sub: 'Awaiting your review',                         icon: '✅', subColor: 'text-green-600' },
        ].map(({ label, value, sub, icon, subColor }) => (
          <div key={label} className="stat-card">
            <div className="text-2xl">{icon}</div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs font-medium text-gray-700">{label}</div>
            <div className={`text-xs ${subColor}`}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Matter overview table — no Math.random() */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-800 text-sm">Matter Overview</div>
              <button onClick={() => navigate('/matters')} className="text-xs text-green-600 font-medium">View all matters</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Matter', 'Client', 'Stage', 'Due Date', 'Readiness', 'Missing', 'Status'].map(h => (
                      <th key={h} className="text-left py-2 pr-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.matters || []).slice(0, 8).map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/matters/${m.id}`)}>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-800">{m.case_number}</div>
                        <div className="text-gray-400 text-[10px] truncate max-w-[120px]">{m.description}</div>
                      </td>
                      <td className="pr-3">
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full bg-navy-900 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">
                            {m.client_initials || '?'}
                          </div>
                          <span className="truncate max-w-[70px] text-gray-700">{m.client_name}</span>
                        </div>
                      </td>
                      <td className="pr-3 whitespace-nowrap">
                        <span className="badge badge-blue">{stageLabel(m.stage)}</span>
                      </td>
                      <td className="pr-3 whitespace-nowrap text-gray-600">
                        {m.important_date
                          ? new Date(m.important_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })
                          : '—'}
                      </td>
                      <td className="pr-3">
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${m.readiness_pct ?? 0}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400">{m.readiness_pct ?? 0}%</span>
                        </div>
                      </td>
                      <td className="pr-3 text-gray-600">{m.missing_docs_count ?? 0}</td>
                      <td>
                        <span className={`badge ${m.status === 'active' ? 'badge-green' : m.status === 'at_risk' ? 'badge-red' : 'badge-gray'}`}>
                          {m.status === 'at_risk' ? 'At Risk' : m.status === 'complete' ? 'Complete' : 'On Track'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conservatorship Lifecycle — stage driven by real data */}
          <div className="card p-5">
            <div className="font-semibold text-gray-800 text-sm mb-1">Georgia Conservatorship Lifecycle</div>
            <div className="text-xs text-gray-500 mb-4">
              Most common active stage across {data?.activeMatters ?? 0} matter{(data?.activeMatters ?? 0) !== 1 ? 's' : ''}.
            </div>
            <div className="overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max pb-2">
                {LIFECYCLE.map((stage, i) => {
                  const done = i < lifecycleStageIdx;
                  const curr = i === lifecycleStageIdx;
                  return (
                    <div key={stage} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          done ? 'bg-green-500 text-white' : curr ? 'bg-navy-900 text-white ring-2 ring-blue-200' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {done ? '✓' : i + 1}
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1 text-center w-16 leading-tight">{stage}</div>
                      </div>
                      {i < LIFECYCLE.length - 1 && (
                        <div className={`w-10 h-0.5 mx-0.5 mb-5 ${i < lifecycleStageIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Annual Return Progress + Readiness Score */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Annual return progress — fully dynamic */}
            <div className="card p-5">
              <div className="font-semibold text-gray-800 text-sm mb-3">Annual Return Preparation</div>
              <div className="flex items-center gap-4">
                <CircleGauge value={annualProgress} color="#22c55e" label="Annual Progress" />
                <div className="space-y-1.5 flex-1">
                  {[
                    { label: 'Documents Uploaded', value: `${data?.totalUploaded ?? 0} / ${data?.totalRequired ?? 0}`, pct: annualProgress },
                    { label: 'Client Tasks Done',  value: `${data?.completedTasks ?? 0} / ${data?.totalTasks ?? 0}`,   pct: data?.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0 },
                    { label: 'Overdue Tasks',      value: `${data?.overdueTasks ?? 0}`,                                pct: data?.totalTasks > 0 ? Math.max(0, Math.round((1 - (data.overdueTasks / data.totalTasks)) * 100)) : 100 },
                    { label: 'Cases Ready',        value: `${data?.readyForReview ?? 0} ready`,                        pct: data?.activeMatters > 0 ? Math.round(((data.readyForReview ?? 0) / data.activeMatters) * 100) : 0 },
                  ].map(({ label, value, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
                        <span>{label}</span><span className="font-medium">{value}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Readiness score — fully dynamic */}
            <div className="card p-5">
              <div className="font-semibold text-gray-800 text-sm mb-3">Readiness Score</div>
              <div className="flex items-center gap-4">
                <CircleGauge value={readinessScore} color="#3b82f6" label="of 100" />
                <div className="space-y-1.5 flex-1 text-xs">
                  <div className="text-gray-500 text-[10px] font-medium">Based on:</div>
                  {['Document completeness', 'Deadline compliance', 'Client task completion', 'Court submission readiness'].map(item => (
                    <div key={item} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />{item}
                    </div>
                  ))}
                  {(data?.overdueTasks ?? 0) > 0 && (
                    <div className="text-[10px] text-amber-600 font-medium mt-1">
                      ▼ {data.overdueTasks} overdue task{data.overdueTasks > 1 ? 's' : ''} affecting score
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => navigate('/documents')} className="mt-3 text-xs text-green-600 font-medium">
                View Document Center
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Client tasks — live from API */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Client Tasks & Reminders
              <button onClick={() => navigate('/care-tasks')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2">
              {(data?.clientTasks || []).map(t => {
                const overdue = t.days_left < 0 || t.status === 'overdue';
                return (
                  <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${overdue ? 'text-red-500' : 'text-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700">{t.title}</div>
                      <div className="text-xs text-gray-400 truncate">{t.matter_description}</div>
                    </div>
                    <span className={`text-[10px] font-semibold whitespace-nowrap ${overdue ? 'text-red-500' : 'text-amber-600'}`}>
                      {overdue ? 'Overdue' : `Due in ${t.days_left}d`}
                    </span>
                  </div>
                );
              })}
              {(!data?.clientTasks || data.clientTasks.length === 0) && (
                <div className="text-xs text-green-600 text-center py-3">No pending client tasks</div>
              )}
            </div>
          </div>

          {/* Upcoming appointments — live from API */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Upcoming Appointments
              <button onClick={() => navigate('/appointments')} className="text-xs text-green-600">View calendar</button>
            </div>
            <div className="space-y-2.5">
              {(data?.upcomingAppts || []).slice(0, 3).map(appt => (
                <div key={appt.id} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="bg-blue-50 text-navy-900 text-xs font-bold w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                    <div className="text-[9px]">{new Date(appt.start_time).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</div>
                    <div className="text-lg leading-tight">{new Date(appt.start_time).getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">{appt.title}</div>
                    <div className="text-[10px] text-gray-400 truncate">{appt.matter_description}</div>
                  </div>
                  <button className="text-xs border border-gray-300 px-2 py-1 rounded-lg hover:bg-gray-50">View</button>
                </div>
              ))}
              {(!data?.upcomingAppts || !data.upcomingAppts.length) && (
                <div className="text-xs text-gray-400 text-center py-2">No upcoming appointments</div>
              )}
            </div>
          </div>

          {/* Priority alerts — dynamic */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3">Priority Alerts</div>
            <div className="space-y-2">
              {priorityAlerts.length > 0 ? priorityAlerts.map((a, i) => (
                <button key={i} className={`w-full flex items-start gap-2 p-2.5 rounded-lg border ${a.color} text-left`}>
                  <span>{a.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-800">{a.msg}</div>
                    <div className="text-[10px] text-gray-500">{a.sub}</div>
                  </div>
                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                </button>
              )) : (
                <div className="text-xs text-green-600 text-center py-3">No priority alerts — all matters on track</div>
              )}
            </div>
          </div>

          {/* Documents & Compliance Checklist — live from API */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Documents & Compliance
              <button onClick={() => navigate('/documents')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2">
              {(data?.docStats || []).map(({ category, uploaded, total }) => {
                const pct = total > 0 ? Math.round((uploaded / total) * 100) : 0;
                const ok  = pct === 100;
                return (
                  <div key={category} className="flex items-center gap-2.5">
                    <span className="text-sm">{ok ? '✅' : '⚠️'}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-700">{shortCat(category)}</span>
                        <span className={ok ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                          {uploaded} / {total}
                        </span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full">
                        <div className={`h-full rounded-full ${ok ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!data?.docStats || data.docStats.length === 0) && (
                <div className="text-xs text-gray-400 text-center py-2">No document data</div>
              )}
            </div>
            <button onClick={() => navigate('/documents')} className="mt-3 text-xs text-green-600 font-medium">
              Go to Document Center
            </button>
          </div>

          {/* Document upload panel */}
          <DocumentUploadPanel matters={data?.matters || []} />
        </div>
      </div>
    </div>
  );
}
