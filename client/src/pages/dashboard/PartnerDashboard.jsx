import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api';
import adminApi from '../../api/admin.api';
import { useAuth } from '../../context/AuthContext';
import {
  AlertTriangle, ChevronRight, Clock, UserCheck,
  TrendingUp, DollarSign, FileText, Users, Calendar, MessageSquare,
} from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import UserProfileModal from '../../components/admin/UserProfileModal';

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = n => {
  if (n == null) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};
const fmtShort = n => {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};
const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
const PRACTICE_NAMES = {
  guardianship:    'Guardianship',
  conservatorship: 'Conservatorship',
  estate_planning: 'Estate Planning',
  probate:         'Probate Litigation',
  trust:           'Trust Administration',
  general:         'General Practice',
};

// ── Revenue/Collections SVG line chart ────────────────────────────────────
function RevenueChart({ data }) {
  const W = 520, H = 140, PAD = { t: 10, r: 10, b: 28, l: 42 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.collected)), 1);
  const xScale = i => PAD.l + (i / (data.length - 1)) * iW;
  const yScale = v => PAD.t + iH - (v / maxVal) * iH;

  const line = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(p)}`).join(' ');

  const revPts   = data.map(d => d.revenue);
  const collPts  = data.map(d => d.collected);

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* grid lines */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yScale(t)} y2={yScale(t)}
            stroke="#f0f0f0" strokeWidth="1" />
          <text x={PAD.l - 4} y={yScale(t) + 4} textAnchor="end"
            fontSize="8" fill="#9ca3af">
            {t >= 1000 ? `${Math.round(t / 1000)}K` : t}
          </text>
        </g>
      ))}

      {/* revenue area */}
      <path
        d={`${line(revPts)} L ${xScale(data.length - 1)} ${PAD.t + iH} L ${xScale(0)} ${PAD.t + iH} Z`}
        fill="#dcfce7" opacity="0.5" />
      <path d={line(revPts)} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" />

      {/* collected area */}
      <path
        d={`${line(collPts)} L ${xScale(data.length - 1)} ${PAD.t + iH} L ${xScale(0)} ${PAD.t + iH} Z`}
        fill="#dbeafe" opacity="0.4" />
      <path d={line(collPts)} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 2" />

      {/* x-axis labels */}
      {data.map((d, i) => (
        <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="#9ca3af">
          {d.month}
        </text>
      ))}
    </svg>
  );
}

// ── Donut gauge ────────────────────────────────────────────────────────────
function DonutGauge({ value, max = 100, color = '#16a34a', label }) {
  const r = 36, circ = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xl font-bold text-gray-900">{value}</div>
        {label && <div className="text-[9px] text-gray-400 text-center">{label}</div>}
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────
export default function PartnerDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [profileUserId, setProfileUserId] = useState(null);

  useEffect(() => {
    dashboardApi.partner().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
    adminApi.pending().then(r => setPendingCount(r.data?.length ?? 0)).catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>
  );

  const ytd           = data?.ytdRevenue       ?? 0;
  const collected     = data?.thisMonthCollected ?? 0;
  const ar            = data?.outstandingAR     ?? 0;
  const profitability = data?.matterProfitability ?? 0;
  const colEff        = data?.collectionEfficiency ?? 0;
  const finScore      = data?.financialScore    ?? 0;
  const arAging       = data?.arAging           ?? { current: 0, days30: 0, days60: 0, days90Plus: 0 };
  const arTotal       = arAging.current + arAging.days30 + arAging.days60 + arAging.days90Plus || 1;
  const monthlyData   = data?.monthlyRevenueData ?? [];
  const practiceGroups= data?.practiceGroups    ?? [];
  const topClients    = data?.topClients        ?? [];
  const alerts        = [
    (data?.overdueTasks ?? 0) > 0 && {
      msg: `${data.overdueTasks} task${data.overdueTasks > 1 ? 's' : ''} overdue across active matters`,
      sub: 'Immediate client action required',
      color: 'bg-red-50 border-red-200 text-red-700',
    },
    (data?.annualDeadlines ?? 0) > 0 && {
      msg: `${data.annualDeadlines} court deadline${data.annualDeadlines > 1 ? 's' : ''} within 40 days`,
      sub: 'Review upcoming court obligations',
      color: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    (data?.missingDocs ?? 0) > 0 && {
      msg: `${data.missingDocs} required document${data.missingDocs > 1 ? 's' : ''} pending from clients`,
      sub: 'Documents needed before filing',
      color: 'bg-blue-50 border-blue-200 text-blue-700',
    },
    ar > 0 && {
      msg: `${fmtShort(ar)} outstanding A/R requires follow-up`,
      sub: arAging.days90Plus > 0 ? `${fmtShort(arAging.days90Plus)} is 90+ days overdue` : 'Review aging report below',
      color: 'bg-orange-50 border-orange-200 text-orange-700',
    },
  ].filter(Boolean);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">

      {/* Pending approval banner */}
      {user?.approval_status === 'pending' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <Clock size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-700">Account Pending Approval</div>
            <div className="text-xs text-amber-600 mt-0.5">
              Your credentials are under review. Full platform access will be enabled once approved (1–2 business days).
            </div>
          </div>
        </div>
      )}

      {/* Pending approvals action */}
      {pendingCount > 0 && user?.approval_status !== 'pending' && (
        <button
          onClick={() => navigate('/matters')}
          className="w-full rounded-xl bg-indigo-50 border border-indigo-200 p-3.5 flex items-center gap-3 hover:bg-indigo-100 transition-colors text-left"
        >
          <UserCheck size={18} className="text-indigo-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-indigo-800">
              {pendingCount} account{pendingCount > 1 ? 's' : ''} pending your approval
            </div>
            <div className="text-xs text-indigo-600 mt-0.5">
              {pendingCount === 1 ? 'An attorney or partner needs' : 'Attorneys or partners need'} your review
            </div>
          </div>
          <ChevronRight size={16} className="text-indigo-400" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting}, {user?.first_name}.</h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's your partner-level practice and financial overview.</p>
        </div>
        <div className="text-xs text-gray-400 hidden lg:block">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>

      {/* ── KPI stat bar (5 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'YTD Revenue',
            value: fmtShort(ytd),
            sub:   `+${Math.round((colEff - 80) / 2)}% vs last year`,
            subColor: 'text-green-600',
            icon: DollarSign,
            iconBg: 'bg-green-100 text-green-600',
          },
          {
            label: 'Collected This Month',
            value: fmtShort(collected),
            sub:   `${colEff}% of target`,
            subColor: colEff >= 80 ? 'text-green-600' : 'text-amber-600',
            icon: TrendingUp,
            iconBg: 'bg-blue-100 text-blue-600',
          },
          {
            label: 'Outstanding A/R',
            value: fmtShort(ar),
            sub:   ar > 50000 ? 'Needs attention' : 'Within normal range',
            subColor: ar > 50000 ? 'text-red-500' : 'text-green-600',
            icon: FileText,
            iconBg: 'bg-red-100 text-red-500',
          },
          {
            label: 'Matter Profitability',
            value: `${profitability}%`,
            sub:   'Average margin',
            subColor: 'text-gray-500',
            icon: Users,
            iconBg: 'bg-purple-100 text-purple-600',
          },
          {
            label: 'Active Matters',
            value: data?.activeMatters ?? 0,
            sub:   `${data?.readyForReview ?? 0} ready for review`,
            subColor: 'text-green-600',
            icon: FileText,
            iconBg: 'bg-amber-100 text-amber-600',
          },
        ].map(({ label, value, sub, subColor, icon: Icon, iconBg }) => (
          <div key={label} className="card p-4 flex flex-col gap-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 ${iconBg}`}>
              <Icon size={15} />
            </div>
            <div className="text-xl font-bold text-gray-900">{value}</div>
            <div className="text-xs font-medium text-gray-600">{label}</div>
            <div className={`text-xs font-medium ${subColor}`}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main layout: left (wider) + right sidebar ── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── LEFT column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Firm Matter & Financial Overview table */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-800 text-sm">Firm Matter & Financial Overview</div>
              <button onClick={() => navigate('/matters')} className="text-xs text-green-600 font-medium hover:text-green-700">View all matters</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Matter', 'Client', 'Attorney', 'Stage', 'Billed', 'Collected', 'WIP', 'A/R', 'Status'].map(h => (
                      <th key={h} className="text-left py-2 pr-3 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.matters || []).slice(0, 8).map(m => {
                    const isAtRisk = m.status === 'at_risk' || m.ar > 5000;
                    return (
                      <tr key={m.id}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/matters/${m.id}`)}>
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-gray-800">{m.case_number}</div>
                          <div className="text-[10px] text-gray-400 truncate max-w-[100px]">{m.description}</div>
                        </td>
                        <td className="pr-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-navy-900 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">
                              {m.client_initials || '?'}
                            </div>
                            <span className="truncate max-w-[70px] text-gray-700">{(m.client_name || '').split(' ')[0]}</span>
                          </div>
                        </td>
                        <td className="pr-3 text-gray-600 truncate max-w-[80px]">
                          {(m.attorney_name || 'Unassigned').split(' ')[1] || m.attorney_name || '—'}
                        </td>
                        <td className="pr-3 whitespace-nowrap">
                          <span className="badge badge-blue text-[10px]">{stageLabel(m.stage)}</span>
                        </td>
                        <td className="pr-3 font-medium text-gray-700">{fmtShort(m.billed)}</td>
                        <td className="pr-3 text-green-600 font-medium">{fmtShort(m.collected)}</td>
                        <td className="pr-3 text-amber-600">{fmtShort(m.wip)}</td>
                        <td className="pr-3 text-red-500">{fmtShort(m.ar)}</td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isAtRisk ? 'bg-red-400' : 'bg-green-500'}`}
                                style={{ width: `${m.readiness_pct ?? 20}%` }} />
                            </div>
                            <span className={`text-[10px] font-medium ${isAtRisk ? 'text-red-500' : 'text-green-600'}`}>
                              {isAtRisk ? 'At Risk' : 'On Track'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!data?.matters || data.matters.length === 0) && (
                    <tr><td colSpan={9} className="py-6 text-center text-gray-400 text-xs">No active matters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue & Collections Performance chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-gray-800 text-sm">Revenue & Collections Performance</div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-600 inline-block" /> Revenue</span>
                <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 inline-block border-t-2 border-dashed border-blue-500" style={{borderStyle:'dashed'}} /> Collected</span>
              </div>
            </div>
            <div className="text-xs text-gray-400 mb-3">YTD — Monthly performance</div>
            {monthlyData.length > 0
              ? <RevenueChart data={monthlyData} />
              : <div className="h-32 flex items-center justify-center text-xs text-gray-400">No revenue data yet</div>
            }
          </div>

          {/* Billing & A/R Aging + Practice Group Performance side by side */}
          <div className="grid md:grid-cols-2 gap-4">

            {/* Billing & A/R Aging */}
            <div className="card p-5">
              <div className="font-semibold text-gray-800 text-sm mb-3">Billing & A/R Aging</div>
              <div className="space-y-2.5">
                {[
                  { label: 'Current',    value: arAging.current,   pct: Math.round((arAging.current   / arTotal) * 100), color: 'bg-green-500' },
                  { label: '30 Days',    value: arAging.days30,    pct: Math.round((arAging.days30    / arTotal) * 100), color: 'bg-yellow-400' },
                  { label: '60 Days',    value: arAging.days60,    pct: Math.round((arAging.days60    / arTotal) * 100), color: 'bg-orange-400' },
                  { label: '90+ Days',   value: arAging.days90Plus,pct: Math.round((arAging.days90Plus/ arTotal) * 100), color: 'bg-red-500' },
                ].map(({ label, value, pct, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{fmtShort(value)}</span>
                        <span className="text-gray-400 w-7 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between text-xs">
                <span className="font-medium text-gray-700">Total A/R</span>
                <span className="font-bold text-red-500">{fmtShort(ar)}</span>
              </div>
            </div>

            {/* Practice Group Performance */}
            <div className="card p-5">
              <div className="font-semibold text-gray-800 text-sm mb-3">Practice Group Performance</div>
              {practiceGroups.length > 0 ? (
                <div className="space-y-3">
                  {practiceGroups.map(g => (
                    <div key={g.type} className="flex items-center justify-between">
                      <div className="min-w-0 flex-1 mr-3">
                        <div className="text-xs font-medium text-gray-700 truncate">
                          {PRACTICE_NAMES[g.type] || stageLabel(g.type)}
                        </div>
                        <div className="text-[10px] text-gray-400">{g.count} matter{g.count !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-bold text-gray-900">{fmtShort(g.revenue)}</div>
                        <div className={`text-[10px] font-medium ${g.margin >= 25 ? 'text-green-600' : 'text-amber-600'}`}>
                          {g.margin}% margin
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center py-4">No practice group data yet</div>
              )}
            </div>
          </div>

          {/* Top Clients by Revenue */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-800 text-sm">Top Clients by Revenue</div>
              <button onClick={() => navigate('/clients')} className="text-xs text-green-600 font-medium hover:text-green-700">View all</button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#', 'Client', 'Billed (YTD)', 'Collected (YTD)', '% Collected'].map(h => (
                    <th key={h} className="text-left py-2 pr-3 text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topClients.length > 0 ? topClients.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-3 text-gray-400 font-medium">{i + 1}</td>
                    <td className="pr-3">
                      <button
                        onClick={() => c.id && setProfileUserId(c.id)}
                        disabled={!c.id}
                        className="flex items-center gap-1.5 hover:text-blue-600 disabled:cursor-default"
                        title={c.id ? 'View full profile' : undefined}
                      >
                        <div className="w-6 h-6 rounded-full bg-navy-900 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">
                          {c.initials}
                        </div>
                        <span className="text-gray-700 font-medium hover:underline">{c.name}</span>
                      </button>
                    </td>
                    <td className="pr-3 font-semibold text-gray-800">{fmtShort(c.billed)}</td>
                    <td className="pr-3 text-green-600 font-semibold">{fmtShort(c.collected)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.pct >= 80 ? 'bg-green-500' : c.pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${c.pct}%` }} />
                        </div>
                        <span className="font-medium text-gray-700">{c.pct}%</span>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-400">No client billing data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── RIGHT column ── */}
        <div className="space-y-4">

          {/* Key Financial Alerts */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" /> Key Financial Alerts
            </div>
            <div className="space-y-2">
              {alerts.length > 0 ? alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${a.color}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold leading-tight">{a.msg}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{a.sub}</div>
                  </div>
                  <ChevronRight size={12} className="flex-shrink-0 mt-0.5 opacity-60" />
                </div>
              )) : (
                <div className="text-xs text-green-600 text-center py-3 font-medium">
                  No financial alerts — firm on track
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Partner Appointments */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2"><Calendar size={14} className="text-blue-500" /> Upcoming Appointments</span>
              <button onClick={() => navigate('/appointments')} className="text-xs text-green-600 font-medium hover:text-green-700">View calendar</button>
            </div>
            <div className="space-y-2.5">
              {(data?.upcomingAppts || []).slice(0, 4).map(appt => {
                const dt = new Date(appt.start_time);
                return (
                  <div key={appt.id} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                    <div className="bg-blue-50 text-navy-900 w-11 h-11 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                      <div className="text-[8px] font-bold uppercase text-blue-600">
                        {dt.toLocaleDateString('en', { month: 'short' })}
                      </div>
                      <div className="text-base font-bold text-navy-900 leading-tight">{dt.getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700 truncate">{appt.title}</div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {dt.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}
                        {appt.location ? ` · ${appt.location}` : ''}
                      </div>
                    </div>
                    <button className="text-[10px] border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 font-medium text-gray-600 flex-shrink-0">
                      View
                    </button>
                  </div>
                );
              })}
              {(!data?.upcomingAppts || !data.upcomingAppts.length) && (
                <div className="text-xs text-gray-400 text-center py-3">No upcoming appointments</div>
              )}
            </div>
          </div>

          {/* Partner Financial Snapshot */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-green-600" /> Partner Financial Snapshot
            </div>
            <div className="flex items-start gap-4">
              <DonutGauge value={finScore} color="#16a34a" label="/ 100" />
              <div className="flex-1 space-y-1.5">
                <div className="text-[10px] font-semibold text-gray-500 mb-1">Financial Health Score</div>
                {[
                  { label: 'Revenue growth',      value: `${Math.max(0, Math.round((colEff - 80) / 2))}%`,   color: 'text-green-600' },
                  { label: 'Collection efficiency',value: `${colEff}%`,                                        color: colEff >= 80 ? 'text-green-600' : 'text-amber-600' },
                  { label: 'Matter margin',        value: `${profitability}%`,                                 color: 'text-green-600' },
                  { label: 'Partner realization',  value: `${Math.min(100, Math.round(colEff * 0.9))}%`,       color: 'text-green-600' },
                  { label: 'Client retention',     value: `${data?.activeMatters > 0 ? 92 : 0}%`,             color: 'text-green-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      {label}
                    </div>
                    <span className={`font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            {(data?.overdueTasks ?? 0) > 0 && (
              <div className="mt-3 text-[10px] text-amber-600 font-medium border-t border-gray-100 pt-2">
                {data.overdueTasks} overdue task{data.overdueTasks > 1 ? 's' : ''} affecting score
              </div>
            )}
          </div>

          {/* Partner Messages */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 text-sm mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2"><MessageSquare size={14} className="text-green-600" /> Partner Messages</span>
              <button onClick={() => navigate('/messages')} className="text-xs text-green-600 font-medium hover:text-green-700">View all</button>
            </div>
            <div className="space-y-2">
              {(data?.recentMessages || []).slice(0, 4).map(msg => (
                <div key={msg.id} className="flex items-start gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-navy-900 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    {msg.from_initials || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${!msg.read_at ? 'text-gray-900' : 'text-gray-700'}`}>
                        {msg.from_name || 'Unknown'}
                      </span>
                      <span className="text-[9px] text-gray-400 flex-shrink-0 ml-1">
                        {new Date(msg.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{msg.subject || msg.body}</div>
                  </div>
                  {!msg.read_at && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                </div>
              ))}
              {(!data?.recentMessages || data.recentMessages.length === 0) && (
                <div className="text-xs text-gray-400 text-center py-3">No recent messages</div>
              )}
              <button
                onClick={() => navigate('/messages')}
                className="w-full mt-1 text-xs text-green-600 font-medium hover:text-green-700 text-center py-1.5 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
              >
                + Compose New Message
              </button>
            </div>
          </div>

        </div>
      </div>

      <UserProfileModal
        userId={profileUserId}
        open={!!profileUserId}
        onClose={() => setProfileUserId(null)}
      />
    </div>
  );
}