import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, Users, Briefcase, FileText,
  TrendingUp, TrendingDown, Calendar, Download,
  RefreshCw, BarChart2, AlertCircle,
} from 'lucide-react';
import reportsApi from '../api/reports.api';

const RANGE_OPTIONS = [
  { label: '30 Days',  months: 1  },
  { label: '90 Days',  months: 3  },
  { label: '6 Months', months: 6  },
  { label: '1 Year',   months: 12 },
  { label: '2 Years',  months: 24 },
];

const TABS = ['Overview', 'Revenue', 'Cases', 'Clients', 'Performance'];

const PIE_COLORS = ['#22c55e', '#1a3476', '#d4af37', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4'];

function fmt$(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format((cents || 0) / 100);
}
function fmtPct(n, total) {
  if (!total) return '0%';
  return ((n / total) * 100).toFixed(1) + '%';
}

function StatCard({ icon: Icon, label, value, sub, trend, color = 'green' }) {
  const colors = {
    green:  { bg: 'bg-green-50  dark:bg-green-900/20', icon: 'text-green-600 dark:text-green-400', ring: 'bg-green-100 dark:bg-green-800/40' },
    blue:   { bg: 'bg-blue-50   dark:bg-blue-900/20',  icon: 'text-blue-600  dark:text-blue-400',  ring: 'bg-blue-100  dark:bg-blue-800/40'  },
    gold:   { bg: 'bg-yellow-50 dark:bg-yellow-900/20',icon: 'text-yellow-600 dark:text-yellow-400',ring: 'bg-yellow-100 dark:bg-yellow-800/40'},
    red:    { bg: 'bg-red-50    dark:bg-red-900/20',   icon: 'text-red-600   dark:text-red-400',   ring: 'bg-red-100   dark:bg-red-800/40'   },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20',icon: 'text-purple-600 dark:text-purple-400',ring: 'bg-purple-100 dark:bg-purple-800/40'},
  };
  const c = colors[color] || colors.green;
  return (
    <div className={`rounded-xl p-5 border border-gray-200 dark:border-gray-700 ${c.bg}`}>
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${c.ring}`}>
          <Icon size={20} className={c.icon} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-1 ${trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">{children}</h3>;
}

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label, prefix = '', suffix = '', formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-xs">
      <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600 dark:text-gray-400">{p.name}:</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {formatter ? formatter(p.value) : `${prefix}${typeof p.value === 'number' && p.value > 1000 ? p.value.toLocaleString() : p.value}${suffix}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [tab, setTab]           = useState('Overview');
  const [range, setRange]       = useState(RANGE_OPTIONS[3]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [data, setData]         = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { months: range.months };
      const [overview, revenue, cases, clients, perf] = await Promise.all([
        reportsApi.overview(params),
        reportsApi.revenue(params),
        reportsApi.cases(params),
        reportsApi.clients(params),
        reportsApi.performance(params),
      ]);
      setData({
        overview:  overview.data,
        revenue:   revenue.data,
        cases:     cases.data,
        clients:   clients.data,
        perf:      perf.data,
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  function exportCsv(rows, filename) {
    if (!rows?.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename;
    a.click();
  }

  const stats = data.overview?.stats || {};

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics & Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Firm-wide performance metrics and financial insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
            {RANGE_OPTIONS.map(r => (
              <button
                key={r.months}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range.months === r.months
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-green-500 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={32} className="animate-spin text-green-500" />
        </div>
      )}

      {!loading && tab === 'Overview' && (
        <OverviewTab data={data} fmt$={fmt$} exportCsv={exportCsv} />
      )}
      {!loading && tab === 'Revenue' && (
        <RevenueTab data={data} fmt$={fmt$} exportCsv={exportCsv} fmtPct={fmtPct} />
      )}
      {!loading && tab === 'Cases' && (
        <CasesTab data={data} exportCsv={exportCsv} />
      )}
      {!loading && tab === 'Clients' && (
        <ClientsTab data={data} exportCsv={exportCsv} />
      )}
      {!loading && tab === 'Performance' && (
        <PerformanceTab data={data} fmtPct={fmtPct} exportCsv={exportCsv} />
      )}
    </div>
  );
}

function OverviewTab({ data, fmt$, exportCsv }) {
  const stats = data.overview?.stats || {};
  const revenueByMonth = data.overview?.revenueByMonth || [];
  const clientsByMonth = data.overview?.clientsByMonth || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={DollarSign}  label="Revenue Collected"     value={fmt$(stats.totalRevenueCents)}   color="green"  />
        <StatCard icon={AlertCircle} label="Outstanding Invoices"  value={fmt$(stats.pendingInvoicesCents)} color="red"   />
        <StatCard icon={Users}       label="Total Clients"         value={stats.totalClients || 0}          color="blue"  />
        <StatCard icon={Briefcase}   label="Active Matters"        value={stats.activeMatters || 0}         color="purple"/>
        <StatCard icon={FileText}    label="Total Documents"       value={stats.totalDocuments || 0}        color="gold"  />
        <StatCard icon={Calendar}    label="Appointments (30d)"    value={stats.appointmentsThisMonth || 0} color="blue"  />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Revenue Collected — by Month">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueByMonth}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => '$' + (v / 100).toLocaleString()} tick={{ fontSize: 11 }} width={65} />
              <Tooltip content={(props) => <CustomTooltip {...props} formatter={fmt$} />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" fill="url(#revenueGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <button onClick={() => exportCsv(revenueByMonth, 'revenue-by-month.csv')} className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:underline">
            <Download size={12} /> Export CSV
          </button>
        </ChartCard>

        <ChartCard title="New Clients — by Month">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={clientsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="new_clients" name="New Clients" fill="#1a3476" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <button onClick={() => exportCsv(clientsByMonth, 'clients-by-month.csv')} className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:underline">
            <Download size={12} /> Export CSV
          </button>
        </ChartCard>
      </div>
    </div>
  );
}

function RevenueTab({ data, fmt$, fmtPct, exportCsv }) {
  const byMonth       = data.revenue?.byMonth       || [];
  const byServiceType = data.revenue?.byServiceType || [];
  const cr            = data.revenue?.collectionRate || {};

  const collectionPct = cr.total_invoices
    ? ((cr.paid_invoices / cr.total_invoices) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={DollarSign} label="Total Collected"     value={fmt$(cr.collected_amount)}  color="green"  />
        <StatCard icon={AlertCircle}label="Total Outstanding"   value={fmt$(cr.total_amount - cr.collected_amount)} color="red" />
        <StatCard icon={TrendingUp} label="Collection Rate"     value={collectionPct + '%'}         color="blue"  />
      </div>

      <ChartCard title="Collected vs Outstanding — by Month">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => '$' + (v / 100 / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} width={55} />
            <Tooltip content={<CustomTooltip />} formatter={v => fmt$(v)} />
            <Legend />
            <Bar dataKey="collected"   name="Collected"   fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outstanding" name="Outstanding" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <button onClick={() => exportCsv(byMonth, 'revenue-detail.csv')} className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:underline">
          <Download size={12} /> Export CSV
        </button>
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Revenue by Service Type">
          {byServiceType.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byServiceType} dataKey="total" nameKey="service_type" cx="50%" cy="50%" outerRadius={90} label={({ service_type, percent }) => `${service_type} ${(percent * 100).toFixed(0)}%`}>
                  {byServiceType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => fmt$(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Invoice Metrics">
          <div className="space-y-3 mt-2">
            {[
              { label: 'Total Invoices',   value: cr.total_invoices || 0 },
              { label: 'Paid Invoices',    value: cr.paid_invoices  || 0 },
              { label: 'Collection Rate',  value: collectionPct + '%' },
              { label: 'Avg Invoice',      value: cr.total_invoices ? fmt$(Math.round(cr.total_amount / cr.total_invoices)) : '$0' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function CasesTab({ data, exportCsv }) {
  const byType       = data.cases?.byType       || [];
  const byStage      = data.cases?.byStage      || [];
  const byStatus     = data.cases?.byStatus     || [];
  const openedByMonth= data.cases?.openedByMonth|| [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {byStatus.map(s => (
          <div key={s.status} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.count}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-1">{s.status}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Cases Opened — by Month">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={openedByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="opened" name="Opened" stroke="#1a3476" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <button onClick={() => exportCsv(openedByMonth, 'cases-by-month.csv')} className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:underline">
            <Download size={12} /> Export CSV
          </button>
        </ChartCard>

        <ChartCard title="Cases by Matter Type">
          {byType.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No matter types found</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="matter_type" width={130} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Cases" fill="#d4af37" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Cases by Stage">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byStage}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Cases" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ClientsTab({ data, exportCsv }) {
  const growthByMonth    = data.clients?.growthByMonth    || [];
  const byApprovalStatus = data.clients?.byApprovalStatus || [];
  const recentClients    = data.clients?.recentClients    || [];

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Client Growth — by Month">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={growthByMonth}>
              <defs>
                <linearGradient id="clientGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1a3476" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1a3476" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="new_clients" name="New Clients" stroke="#1a3476" fill="url(#clientGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <button onClick={() => exportCsv(growthByMonth, 'client-growth.csv')} className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:underline">
            <Download size={12} /> Export CSV
          </button>
        </ChartCard>

        <ChartCard title="Clients by Approval Status">
          {byApprovalStatus.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byApprovalStatus} dataKey="count" nameKey="approval_status" cx="50%" cy="50%" outerRadius={90}
                  label={({ approval_status, percent }) => `${approval_status} ${(percent * 100).toFixed(0)}%`}>
                  {byApprovalStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Recent Clients">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Matter Type</th>
                <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentClients.map(c => (
                <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 font-medium text-gray-900 dark:text-white">{c.first_name} {c.last_name}</td>
                  <td className="py-2.5 text-gray-600 dark:text-gray-400">{c.email}</td>
                  <td className="py-2.5">
                    <span className={`badge ${c.approval_status === 'approved' ? 'badge-green' : c.approval_status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>
                      {c.approval_status}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-600 dark:text-gray-400 capitalize">{c.matter_type || '—'}</td>
                  <td className="py-2.5 text-gray-500 dark:text-gray-500 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {recentClients.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400 dark:text-gray-500">No clients found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <button onClick={() => exportCsv(recentClients, 'recent-clients.csv')} className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:underline">
          <Download size={12} /> Export CSV
        </button>
      </ChartCard>
    </div>
  );
}

function PerformanceTab({ data, fmtPct, exportCsv }) {
  const mattersByAttorney  = data.perf?.mattersByAttorney  || [];
  const taskCompletion     = data.perf?.taskCompletion     || {};
  const appointmentCompletion = data.perf?.appointmentCompletion || {};

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Task Completion</h4>
          <div className="text-4xl font-bold text-gray-900 dark:text-white">
            {fmtPct(taskCompletion.completed, taskCompletion.total)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {taskCompletion.completed || 0} of {taskCompletion.total || 0} tasks completed
          </div>
          <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-green-500 transition-all duration-500"
              style={{ width: taskCompletion.total ? `${(taskCompletion.completed / taskCompletion.total) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Appointment Completion</h4>
          <div className="text-4xl font-bold text-gray-900 dark:text-white">
            {fmtPct(appointmentCompletion.completed, appointmentCompletion.total)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {appointmentCompletion.completed || 0} of {appointmentCompletion.total || 0} appointments completed
          </div>
          <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: appointmentCompletion.total ? `${(appointmentCompletion.completed / appointmentCompletion.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      <ChartCard title="Attorney Performance">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Attorney</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Total Matters</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Active</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Closed</th>
                <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Close Rate</th>
              </tr>
            </thead>
            <tbody>
              {mattersByAttorney.map((a, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 font-medium text-gray-900 dark:text-white">{a.attorney_name}</td>
                  <td className="py-2.5 text-right text-gray-700 dark:text-gray-300">{a.total_matters}</td>
                  <td className="py-2.5 text-right text-blue-600 dark:text-blue-400">{a.active_matters}</td>
                  <td className="py-2.5 text-right text-green-600 dark:text-green-400">{a.closed_matters}</td>
                  <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">{fmtPct(a.closed_matters, a.total_matters)}</td>
                </tr>
              ))}
              {mattersByAttorney.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400 dark:text-gray-500">No attorney data</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <button onClick={() => exportCsv(mattersByAttorney, 'attorney-performance.csv')} className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:underline">
          <Download size={12} /> Export CSV
        </button>
      </ChartCard>
    </div>
  );
}

