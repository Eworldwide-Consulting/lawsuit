import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';

const LIFECYCLE = ['Intake', 'Hearing Preparation', 'Initial Inventory', 'Monthly Records', 'Annual Return Prep', 'Court Review', 'Case Complete'];
const LIFECYCLE_KEYS = ['intake', 'hearing_prep', 'initial_inventory', 'monthly_records', 'annual_return_prep', 'court_review', 'complete'];

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.partner().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

  const readinessScore = data?.readinessScore || 78;
  const r = 52, circ = 2 * Math.PI * r;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good morning, {user?.first_name}.</h1>
        <p className="text-gray-500 text-sm">Here's your practice overview for today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active Matters', value: data?.activeMatters || 0, sub: '↑ 4 from last week', icon: '📁', subColor: 'text-green-600' },
          { label: 'Annual Deadlines', value: data?.annualDeadlines || 0, sub: 'Due within 40 days', icon: '📅', subColor: 'text-amber-600' },
          { label: 'Missing Documents', value: data?.missingDocs || 0, sub: 'Across 12 matters', icon: '📂', subColor: 'text-red-500' },
          { label: 'Ready for Review', value: data?.readyForReview || 0, sub: 'Awaiting your review', icon: '✅', subColor: 'text-green-600' },
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
          {/* Matter Overview */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-800 text-sm">Matter Overview</div>
              <button onClick={() => navigate('/matters')} className="text-xs text-green-600 font-medium">View all matters</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Matter', 'Client', 'Stage', 'Due Date', 'Readiness', 'Missing Items', 'Status'].map(h => (
                      <th key={h} className="text-left py-2 pr-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.matters || []).slice(0, 8).map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/matters/${m.id}`)}>
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
                        {m.important_date ? new Date(m.important_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                      </td>
                      <td className="pr-3">
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.random() * 50 + 40}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="pr-3 text-gray-600">{Math.floor(Math.random() * 8)}</td>
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

          {/* Georgia Conservatorship Lifecycle */}
          <div className="card p-5">
            <div className="font-semibold text-gray-800 text-sm mb-1">Georgia Conservatorship Lifecycle</div>
            <div className="text-xs text-gray-500 mb-4">Track progress across all stages of the conservatorship lifecycle.</div>
            <div className="overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max pb-2">
                {LIFECYCLE.map((stage, i) => {
                  const currentStageIdx = 2; // "Initial Inventory" as example
                  const done = i < currentStageIdx;
                  const curr = i === currentStageIdx;
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
                        <div className={`w-10 h-0.5 mx-0.5 mb-5 ${i < currentStageIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <button className="mt-2 text-xs text-green-600 font-medium">Learn more</button>
          </div>

          {/* Annual Return Progress + Readiness */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="font-semibold text-gray-800 text-sm mb-3 flex justify-between">
                Annual Return Preparation Progress <button className="text-xs text-green-600">View all</button>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#22c55e" strokeWidth="10"
                      strokeDasharray={`${(72/100) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-lg font-bold text-gray-900">72%</div>
                    <div className="text-[9px] text-gray-400">Annual Progress</div>
                  </div>
                </div>
                <div className="space-y-1.5 flex-1">
                  {[
                    { label: 'Documents Collected', value: '128 / 180', pct: 71 },
                    { label: 'Points Collected', value: '45 / 60', pct: 75 },
                    { label: 'Client Tasks', value: '23 / 40', pct: 58 },
                    { label: 'Days Until Due', value: '31 On Track', pct: 80 },
                  ].map(({ label, value, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
                        <span>{label}</span><span className="font-medium">{value}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full"><div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="font-semibold text-gray-800 text-sm mb-3">Readiness Score</div>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#3b82f6" strokeWidth="10"
                      strokeDasharray={`${(readinessScore/100) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-lg font-bold text-gray-900">{readinessScore}</div>
                    <div className="text-[9px] text-gray-400">of 100</div>
                  </div>
                </div>
                <div className="space-y-1.5 flex-1 text-xs">
                  <div className="text-gray-500 text-[10px] font-medium">Based on:</div>
                  {['Document completeness', 'Deadline compliance', 'Client task completion', 'Court submission readiness'].map(item => (
                    <div key={item} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                  <div className="text-[10px] text-amber-600 font-medium mt-1">▼ 8 pts from last month</div>
                </div>
              </div>
              <button onClick={() => navigate('/documents')} className="mt-3 text-xs text-green-600 font-medium">View ditals</button>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Client Tasks & Reminders */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Client Tasks & Reminders <button className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Upload bank statement', client: 'Estate of Margaret Allen', urgent: true, tag: 'Overdue' },
                { label: 'Sign Annual Return', client: 'Estate of Patricia Davis', urgent: true, tag: 'Due in 5 days' },
                { label: 'Review proposed expenses', client: 'Estate of Thomas Brooks', urgent: false, tag: 'Due in 4 days' },
                { label: 'Provide updated contact info', client: 'Estate of Linda Cortez', urgent: false, tag: 'Due in 8 days' },
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                  <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${t.urgent ? 'text-red-500' : 'text-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700">{t.label}</div>
                    <div className="text-xs text-gray-400 truncate">{t.client}</div>
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${t.urgent ? 'text-red-500' : 'text-amber-600'}`}>{t.tag}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Upcoming Appointments <button onClick={() => navigate('/appointments')} className="text-xs text-green-600">View calendar</button>
            </div>
            <div className="space-y-2.5">
              {(data?.matters?.slice(0, 3) || []).map((m, i) => {
                const dates = ['May 29', 'Jun 02', 'Jun 05'];
                const labels = ['Court Hearing', 'Client Meeting', 'Quarterly Finance Review'];
                return (
                  <div key={m.id} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="bg-blue-50 text-navy-900 text-xs font-bold w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                      <div className="text-[9px]">{dates[i].split(' ')[0].toUpperCase()}</div>
                      <div className="text-lg leading-tight">{dates[i].split(' ')[1]}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700">{labels[i]}</div>
                      <div className="text-[10px] text-gray-400 truncate">{m.description}</div>
                    </div>
                    <button className="text-xs border border-gray-300 px-2 py-1 rounded-lg hover:bg-gray-50">View</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Priority Alerts */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3">Priority Alerts</div>
            <div className="space-y-2">
              {[
                { msg: '3 matters have overdue items', sub: 'Immediate attention required', color: 'bg-red-50 border-red-200', icon: '🔴' },
                { msg: '18 deadlines due within 30 days', sub: 'Review upcoming obligations', color: 'bg-amber-50 border-amber-200', icon: '🟡' },
                { msg: 'GA Annual Return changes', sub: 'New form version available', color: 'bg-blue-50 border-blue-200', icon: '🔵' },
              ].map((a, i) => (
                <button key={i} className={`w-full flex items-start gap-2 p-2.5 rounded-lg border ${a.color} text-left`}>
                  <span>{a.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-800">{a.msg}</div>
                    <div className="text-[10px] text-gray-500">{a.sub}</div>
                  </div>
                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Documents & Compliance Checklist */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Documents & Compliance Checklist <button onClick={() => navigate('/documents')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Petition & Court Orders', val: '24 / 24', ok: true },
                { label: 'Inventory & Appraisal', val: '20 / 24', ok: false },
                { label: 'Financial Account Statements', val: '18 / 24', ok: false },
                { label: 'Receipts & Invoices', val: '17 / 24', ok: false },
                { label: 'Annual Return form', val: '12 / 24', ok: false },
              ].map(({ label, val, ok }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className="text-sm">{ok ? '✅' : '⚠️'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-700">{label}</span>
                      <span className={ok ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>{val}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full">
                      <div className={`h-full rounded-full ${ok ? 'bg-green-500' : 'bg-amber-400'}`}
                        style={{ width: `${(parseInt(val) / parseInt(val.split('/')[1])) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/documents')} className="mt-3 text-xs text-green-600 font-medium">Go to Document Center</button>
          </div>
        </div>
      </div>
    </div>
  );
}
