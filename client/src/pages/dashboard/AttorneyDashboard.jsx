import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';

const revenueData = [
  { month: 'Jan', revenue: 120, collected: 98 },
  { month: 'Feb', revenue: 145, collected: 120 },
  { month: 'Mar', revenue: 160, collected: 135 },
  { month: 'Apr', revenue: 155, collected: 148 },
  { month: 'May', revenue: 175, collected: 160 },
  { month: 'Jun', revenue: 190, collected: 174 },
  { month: 'Jul', revenue: 180, collected: 165 },
  { month: 'Aug', revenue: 210, collected: 192 },
  { month: 'Sep', revenue: 200, collected: 188 },
  { month: 'Oct', revenue: 220, collected: 205 },
  { month: 'Nov', revenue: 195, collected: 180 },
  { month: 'Dec', revenue: 230, collected: 215 },
];

const fmt$ = n => n >= 1000000 ? `$${(n/1000000).toFixed(2)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;

function HealthScore({ score }) {
  const r = 52, circ = 2 * Math.PI * r;
  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#22c55e" strokeWidth="12"
          strokeDasharray={`${(score/100)*circ} ${circ}`} strokeLinecap="round" />
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.attorney().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good morning, {user?.first_name}.</h1>
        <p className="text-gray-500 text-sm">Here's your practice-level financial overview.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'YTD Revenue', value: fmt$(data?.ytdRevenue || 0), sub: '+12% vs last year', icon: '📈', subColor: 'text-green-600' },
          { label: 'Collected This Month', value: fmt$(data?.collectedMonth || 0), sub: '87% of target', icon: '💳', subColor: 'text-green-600' },
          { label: 'Outstanding A/R', value: fmt$(data?.outstandingAR || 0), sub: '⚠ Needs attention', icon: '📋', subColor: 'text-red-500' },
          { label: 'Matter Profitability', value: `${data?.profitability || 0}%`, sub: 'Average margin', icon: '(%)', subColor: 'text-gray-500' },
          { label: 'Partner Draws', value: fmt$(data?.partnerDraws || 0), sub: 'This month', icon: '💼', subColor: 'text-gray-500' },
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
          {/* Firm Matter & Financial Overview */}
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
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/matters/${m.id}`)}>
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

          {/* Revenue chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-gray-800 text-sm">Revenue & Collections Performance</div>
                <div className="flex gap-4 mt-1">
                  <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-0.5 bg-navy-900 inline-block rounded" /> Revenue</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Collections</span>
                </div>
              </div>
              <select className="text-xs border border-gray-200 rounded-lg px-2 py-1">
                <option>YTD</option><option>Last Year</option>
              </select>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}K`} />
                  <Tooltip formatter={(v, n) => [`$${v}K`, n === 'revenue' ? 'Revenue' : 'Collected']} />
                  <Area type="monotone" dataKey="revenue" stroke="#0f2057" fill="#e8edf8" strokeWidth={2} />
                  <Area type="monotone" dataKey="collected" stroke="#22c55e" fill="#dcfce7" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
              <div><div className="text-gray-500">Revenue Goal (YTD)</div><div className="font-bold text-gray-800">$1.95M</div></div>
              <div><div className="text-gray-500">Billed (YTD)</div><div className="font-bold text-gray-800">$1.47M <span className="text-gray-400 font-normal">75% of year</span></div></div>
              <div><div className="text-gray-500">Realization Rate</div><div className="font-bold text-gray-800">80% <span className="text-green-600 font-normal">▲ 4% vs last year</span></div></div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Key Financial Alerts */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Key Financial Alerts <button className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2">
              {[
                { icon: '📄', msg: '3 invoices overdue more than 60 days', sub: 'Total outstanding: $87,400', urgent: true },
                { icon: '📉', msg: 'Collections below monthly target', sub: 'Average at 80% trailing target', urgent: true },
                { icon: '⚖️', msg: '2 high-value matters need partner review', sub: 'Total WIP: $41,900', urgent: false },
                { icon: '📈', msg: 'A/R balance increased this week', sub: 'Up $22,000 (7.4%)', urgent: false },
              ].map((alert, i) => (
                <button key={i} className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 text-left transition-colors">
                  <span className="text-base flex-shrink-0">{alert.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${alert.urgent ? 'text-red-600' : 'text-gray-700'}`}>{alert.msg}</div>
                    <div className="text-xs text-gray-400">{alert.sub}</div>
                  </div>
                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Partner Financial Snapshot */}
          <div className="card p-4 text-center">
            <div className="font-semibold text-gray-800 text-sm mb-3">Partner Financial Snapshot</div>
            <HealthScore score={84} />
            <div className="text-xs text-gray-500 mt-2">Financial Health Score</div>
            <div className="text-xs text-red-500 mt-1">▼ 8 pts last month</div>
            <button className="mt-3 text-xs text-green-600 font-medium">View details</button>
            <div className="grid grid-cols-2 gap-3 mt-4 text-left">
              {[
                { label: 'Revenue growth', value: '12%', icon: '↑' },
                { label: 'Collections efficiency', value: '87%', icon: '✓' },
                { label: 'Matter margin', value: '31%', icon: '%' },
                { label: 'Partner realization', value: '80%', icon: '%' },
                { label: 'Client retention', value: '82%', icon: '♥' },
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
              Upcoming Partner Appointments <button onClick={() => navigate('/appointments')} className="text-xs text-green-600">View calendar</button>
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
                    <div className="text-xs text-gray-400">{new Date(appt.start_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })} · {appt.location}</div>
                  </div>
                  <button className="text-xs border border-gray-300 px-2 py-1 rounded-lg hover:bg-gray-50">Join</button>
                </div>
              ))}
              {(!data?.upcomingAppts || !data.upcomingAppts.length) && (
                <div className="text-xs text-gray-400 text-center py-2">No upcoming appointments</div>
              )}
            </div>
          </div>

          {/* Partner Messages */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              Partner Messages <button onClick={() => navigate('/messages')} className="text-xs text-green-600">View all</button>
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
                      <div className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</div>
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
        </div>
      </div>
    </div>
  );
}
