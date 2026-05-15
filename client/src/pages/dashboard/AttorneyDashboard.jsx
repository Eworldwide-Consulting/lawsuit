import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { ChevronRight } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import DocumentUploadPanel from '../../components/ui/DocumentUploadPanel';

const fmt$ = n =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
  : `$${n}`;

function HealthScore({ score }) {
  const r = 52, circ = 2 * Math.PI * r;
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-gray-900">{score}</div>
        <div className="text-xs text-gray-500">/100</div>
      </div>
    </div>
  );
}

export default function AttorneyDashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.attorney().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

  // Dynamic financial alerts derived from real data
  const alerts = [];
  if ((data?.missingDocs ?? 0) > 0)
    alerts.push({ icon: '📄', msg: `${data.missingDocs} required document${data.missingDocs > 1 ? 's' : ''} pending from clients`, sub: 'Review document checklist', urgent: data.missingDocs > 5 });
  if ((data?.atRiskMatters ?? 0) > 0)
    alerts.push({ icon: '⚠️', msg: `${data.atRiskMatters} matter${data.atRiskMatters > 1 ? 's' : ''} flagged at risk`, sub: 'Immediate attorney attention required', urgent: true });
  if ((data?.overdueTasks ?? 0) > 0)
    alerts.push({ icon: '📋', msg: `${data.overdueTasks} overdue task${data.overdueTasks > 1 ? 's' : ''} across all matters`, sub: 'Client action required', urgent: data.overdueTasks > 3 });
  if ((data?.outstandingAR ?? 0) > 0)
    alerts.push({ icon: '📈', msg: `Outstanding A/R: ${fmt$(data.outstandingAR)}`, sub: 'Review collections pipeline', urgent: false });

  // Financial snapshot metrics derived from data
  const ytdRevenue     = data?.ytdRevenue ?? 0;
  const collectionRate = ytdRevenue > 0
    ? Math.min(100, Math.round(((data?.collectedMonth ?? 0) * 12 / ytdRevenue) * 100))
    : 80;
  const arRatioPct = ytdRevenue > 0
    ? Math.max(0, Math.round(100 - ((data?.outstandingAR ?? 0) / ytdRevenue) * 100))
    : 80;

  const revenueGoalYTD = Math.round(ytdRevenue * 1.12);
  const currentMonthIdx = (data?.revenueData ?? []).filter(d => d.revenue > 0).length - 1;
  const billedYTD = (data?.revenueData ?? []).reduce((s, d) => s + d.revenue * 1000, 0);
  const realizationRate = billedYTD > 0 ? Math.round((data?.collectedMonth ?? 0) * 12 / billedYTD * 100) : 80;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good morning, {user?.first_name}.</h1>
        <p className="text-gray-500 text-sm">Here's your practice-level financial overview.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'YTD Revenue',          value: fmt$(data?.ytdRevenue ?? 0),      sub: `${data?.totalMatters ?? 0} total matters`,  icon: '📈', subColor: 'text-green-600' },
          { label: 'Collected This Month', value: fmt$(data?.collectedMonth ?? 0),  sub: `${collectionRate}% of monthly target`,      icon: '💳', subColor: 'text-green-600' },
          { label: 'Outstanding A/R',      value: fmt$(data?.outstandingAR ?? 0),   sub: (data?.atRiskMatters ?? 0) > 0 ? '⚠ Needs attention' : 'Within target', icon: '📋', subColor: (data?.atRiskMatters ?? 0) > 0 ? 'text-red-500' : 'text-gray-500' },
          { label: 'Matter Profitability', value: `${data?.profitability ?? 0}%`,   sub: 'Average margin',                            icon: '(%)', subColor: 'text-gray-500' },
          { label: 'Partner Draws',        value: fmt$(data?.partnerDraws ?? 0),    sub: 'YTD',                                       icon: '💼', subColor: 'text-gray-500' },
        ].map(({ label, value, sub, icon, subColor }) => (
          <div key={label} className="stat-card">
            <div className="text-2xl">{icon}</div>
            <div className="text-xl font-bold text-gray-900">{value}</div>
            <div className="text-xs font-medium text-gray-600">{label}</div>
            <div className={`text-xs ${subColor}`}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Matter table */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-800 text-sm">Firm Matter & Financial Overview</div>
              <button onClick={() => navigate('/matters')} className="text-xs text-green-600 font-medium">View all matters</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Matter', 'Client', 'Responsible Attorney', 'Stage', 'Status'].map(h => (
                      <th key={h} className="text-left py-2 pr-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.matters || []).slice(0, 8).map(m => (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/matters/${m.id}`)}>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-800">{m.case_number}</div>
                        <div className="text-gray-400 truncate max-w-[120px]">{m.description}</div>
                      </td>
                      <td className="pr-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-navy-900 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">
                            {m.client_initials || '?'}
                          </div>
                          <span className="truncate max-w-[80px] text-gray-700">{m.client_name}</span>
                        </div>
                      </td>
                      <td className="pr-3 text-gray-600">{m.attorney_name || '—'}</td>
                      <td className="pr-3">
                        <span className="badge badge-blue">{stageLabel(m.stage)}</span>
                      </td>
                      <td>
                        <span className={`badge ${m.status === 'active' ? 'badge-green' : m.status === 'at_risk' ? 'badge-red' : 'badge-gray'}`}>
                          {m.status === 'at_risk' ? 'At Risk' : m.status === 'active' ? 'On Track' : m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue & Collections chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-gray-800 text-sm">Revenue & Collections Performance</div>
                <div className="flex gap-4 mt-1">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-3 h-0.5 bg-navy-900 inline-block rounded" /> Revenue
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Collections
                  </span>
                </div>
              </div>
              <select className="text-xs border border-gray-200 rounded-lg px-2 py-1">
                <option>YTD</option><option>Last Year</option>
              </select>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.revenueData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}K`} />
                  <Tooltip formatter={(v, n) => [`$${v}K`, n === 'revenue' ? 'Revenue' : 'Collected']} />
                  <Area type="monotone" dataKey="revenue"   stroke="#0f2057" fill="#e8edf8" strokeWidth={2} />
                  <Area type="monotone" dataKey="collected" stroke="#22c55e" fill="#dcfce7" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
              <div>
                <div className="text-gray-500">Revenue Goal (YTD)</div>
                <div className="font-bold text-gray-800">{fmt$(revenueGoalYTD)}</div>
              </div>
              <div>
                <div className="text-gray-500">Billed (YTD)</div>
                <div className="font-bold text-gray-800">{fmt$(billedYTD)}</div>
              </div>
              <div>
                <div className="text-gray-500">Realization Rate</div>
                <div className="font-bold text-gray-800">{realizationRate}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Financial alerts — dynamic */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Key Financial Alerts <button className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2">
              {alerts.length > 0 ? alerts.map((alert, i) => (
                <button key={i} className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 text-left transition-colors">
                  <span className="text-base flex-shrink-0">{alert.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${alert.urgent ? 'text-red-600' : 'text-gray-700'}`}>{alert.msg}</div>
                    <div className="text-xs text-gray-400">{alert.sub}</div>
                  </div>
                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                </button>
              )) : (
                <div className="text-xs text-green-600 text-center py-3">No alerts — firm is on track</div>
              )}
            </div>
          </div>

          {/* Partner financial snapshot */}
          <div className="card p-4 text-center">
            <div className="font-semibold text-gray-800 text-sm mb-3">Partner Financial Snapshot</div>
            <HealthScore score={data?.healthScore ?? 75} />
            <div className="text-xs text-gray-500 mt-2">Financial Health Score</div>
            <button className="mt-3 text-xs text-green-600 font-medium">View details</button>
            <div className="grid grid-cols-2 gap-3 mt-4 text-left">
              {[
                { label: 'Active matters',       value: `${data?.activeMatters ?? 0}` },
                { label: 'Collection rate',      value: `${collectionRate}%` },
                { label: 'Matter profitability', value: `${data?.profitability ?? 0}%` },
                { label: 'A/R ratio',            value: `${arRatioPct}%` },
                { label: 'Missing documents',    value: `${data?.missingDocs ?? 0}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming appointments */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Upcoming Appointments
              <button onClick={() => navigate('/appointments')} className="text-xs text-green-600">View calendar</button>
            </div>
            <div className="space-y-2.5">
              {(data?.upcomingAppts || []).slice(0, 3).map(appt => (
                <div key={appt.id} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="bg-blue-50 text-navy-900 text-xs font-bold w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                    <div>{new Date(appt.start_time).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</div>
                    <div className="text-lg leading-tight">{new Date(appt.start_time).getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">{appt.title}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(appt.start_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })} · {appt.location}
                    </div>
                  </div>
                  <button className="text-xs border border-gray-300 px-2 py-1 rounded-lg hover:bg-gray-50">Join</button>
                </div>
              ))}
              {(!data?.upcomingAppts || !data.upcomingAppts.length) && (
                <div className="text-xs text-gray-400 text-center py-2">No upcoming appointments</div>
              )}
            </div>
          </div>

          {/* Recent messages */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Partner Messages
              <button onClick={() => navigate('/messages')} className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2.5">
              {(data?.recentMessages || []).slice(0, 3).map(msg => (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
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
              {(!data?.recentMessages || !data.recentMessages.length) && (
                <div className="text-xs text-gray-400 text-center py-2">No messages</div>
              )}
            </div>
          </div>

          {/* Document upload panel */}
          <DocumentUploadPanel matters={data?.matters || []} />
        </div>
      </div>
    </div>
  );
}
