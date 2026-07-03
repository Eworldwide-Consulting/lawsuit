import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard, Plus, CheckCircle, Clock, AlertCircle, ExternalLink, X,
  DollarSign, Star, Zap, Shield, Phone, FileText, Download, RotateCcw,
  Filter,
} from 'lucide-react';
import { paymentsApi, usersApi, mattersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';

const PRIME_BENEFITS = [
  { icon: Zap,    text: 'Priority attorney response within 4 hours' },
  { icon: Shield, text: 'Unlimited secure document storage' },
  { icon: Phone,  text: 'Monthly 30-min strategy call with your attorney' },
  { icon: Star,   text: 'Dedicated case manager assigned to your matter' },
];

const fmt = cents => `$${(cents / 100).toFixed(2)}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const STATUS_CFG = {
  paid:     { label: 'Paid',     cls: 'badge-green',  Icon: CheckCircle },
  pending:  { label: 'Pending',  cls: 'badge-yellow', Icon: Clock },
  overdue:  { label: 'Overdue',  cls: 'badge-red',    Icon: AlertCircle },
  failed:   { label: 'Failed',   cls: 'badge-red',    Icon: AlertCircle },
  refunded: { label: 'Refunded', cls: 'badge-gray',   Icon: RotateCcw },
};

const SERVICE_TYPES = [
  { value: 'consultation',  label: 'Initial Consultation',   price: 25000 },
  { value: 'retainer',      label: 'Monthly Retainer',        price: 50000 },
  { value: 'filing',        label: 'Document Filing Fee',     price: 15000 },
  { value: 'annual_return', label: 'Annual Return Filing',    price: 30000 },
  { value: 'general',       label: 'Custom Amount',           price: 0 },
];

const STATUS_TABS = ['all', 'pending', 'paid', 'refunded', 'failed'];

export default function Payments() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [invoices, setInvoices]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [paying, setPaying]             = useState(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [clients, setClients]           = useState([]);
  const [matters, setMatters]           = useState([]);
  const [successMsg, setSuccessMsg]     = useState('');
  const [errorMsg, setErrorMsg]         = useState('');
  const [primeLoading, setPrimeLoading] = useState(false);
  const [isPrime, setIsPrime]           = useState(Boolean(user?.is_prime));
  const [activeTab, setActiveTab]       = useState('all');
  const [exporting, setExporting]       = useState(false);
  const [refunding, setRefunding]       = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(null); // invoice object

  const [form, setForm] = useState({
    clientId: '', matterId: '', serviceType: 'consultation',
    amount: '', description: '', dueDate: '',
  });

  const isStaff = user?.role === 'attorney' || user?.role === 'partner' || user?.role === 'itsupport';

  // Auto-dismiss success banner after 5 seconds
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // Handle Stripe redirect back
  useEffect(() => {
    const sessionId      = searchParams.get('session_id');
    const cancelled      = searchParams.get('cancelled');
    const primeSuccess   = searchParams.get('prime_success');
    const primeCancelled = searchParams.get('prime_cancelled');

    if (cancelled || primeCancelled) { setErrorMsg('Payment was cancelled.'); return; }

    if (primeSuccess) {
      setSuccessMsg('Welcome to TriVanta Prime! Your account has been upgraded.');
      // Fetch plan status AND reload invoices so the Prime transaction appears
      paymentsApi.planStatus().then(r => setIsPrime(r.data.is_prime)).catch(() => {});
      load();
      return;
    }

    if (sessionId) {
      paymentsApi.confirm(sessionId)
        .then(r => { if (r.data.paid) setSuccessMsg('Payment received. Thank you!'); })
        .catch(() => {})
        .finally(() => load());
    }
  }, []);

  function load() {
    setLoading(true);
    paymentsApi.list()
      .then(r => setInvoices(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    if (isStaff) {
      usersApi.clients().then(r => setClients(r.data)).catch(() => {});
      mattersApi.list().then(r => setMatters(r.data)).catch(() => {});
    }
  }, []);

  async function handlePrimeUpgrade() {
    setPrimeLoading(true);
    try {
      const r = await paymentsApi.primeCheckout();
      window.location.href = r.data.url;
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not start Prime checkout. Please try again.');
      setPrimeLoading(false);
    }
  }

  async function handlePay(invoice) {
    setPaying(invoice.id);
    try {
      const r = await paymentsApi.checkout(invoice.id);
      window.location.href = r.data.url;
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not start payment. Please try again.');
      setPaying(null);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const svc   = SERVICE_TYPES.find(s => s.value === form.serviceType);
    const cents = form.serviceType === 'general'
      ? Math.round(parseFloat(form.amount) * 100)
      : svc.price;
    if (!cents || cents < 50) { setErrorMsg('Amount must be at least $0.50'); return; }
    try {
      await paymentsApi.createInvoice({
        clientId:    parseInt(form.clientId),
        matterId:    form.matterId ? parseInt(form.matterId) : null,
        serviceType: form.serviceType,
        amount:      cents / 100,
        description: form.description || svc.label,
        dueDate:     form.dueDate || null,
      });
      setShowCreate(false);
      setForm({ clientId: '', matterId: '', serviceType: 'consultation', amount: '', description: '', dueDate: '' });
      load();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create invoice.');
    }
  }

  async function handleRefund() {
    if (!showRefundModal) return;
    setRefunding(showRefundModal.id);
    try {
      await paymentsApi.refund(showRefundModal.id, refundReason);
      setSuccessMsg(`Refund of ${fmt(showRefundModal.amount)} issued for invoice #${showRefundModal.id}.`);
      setShowRefundModal(null);
      setRefundReason('');
      load();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Refund failed. Please try again.');
    } finally {
      setRefunding(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const r = await paymentsApi.exportCsv(params);
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function openReceipt(invoiceId) {
    window.open(paymentsApi.receipt(invoiceId), '_blank', 'noopener');
  }

  const filtered = activeTab === 'all' ? invoices : invoices.filter(i => i.status === activeTab);
  const pending  = invoices.filter(i => i.status === 'pending');
  const paid     = invoices.filter(i => i.status === 'paid');
  const refunded = invoices.filter(i => i.status === 'refunded');
  const total    = paid.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Billing & Payments</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isStaff ? `${invoices.length} invoices total` : `${pending.length} outstanding · ${paid.length} paid`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {exporting ? <Spinner size={4} /> : <Download size={15} />}
              Export CSV
            </button>
          )}
          {isStaff && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#0f2057] hover:bg-[#1a3476] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              <Plus size={16} /> Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-green-800 text-sm font-medium">{successMsg}</div>
          <button onClick={() => setSuccessMsg('')}><X size={16} className="text-green-400 hover:text-green-600" /></button>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-red-800 text-sm font-medium">{errorMsg}</div>
          <button onClick={() => setErrorMsg('')}><X size={16} className="text-red-400 hover:text-red-600" /></button>
        </div>
      )}

      {/* ── Prime Plan card (clients only) ── */}
      {!isStaff && (
        <div className={`mb-6 rounded-2xl overflow-hidden border-2 ${isPrime ? 'border-yellow-400' : 'border-[#0f2057]/20'}`}>
          <div className="bg-gradient-to-r from-[#0f2057] to-[#1a3476] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-yellow-400 fill-yellow-400" />
              <span className="text-white font-bold text-base">TriVanta Prime</span>
              {isPrime && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-400 text-[#0f2057] text-xs font-bold rounded-full">ACTIVE</span>
              )}
            </div>
            <span className="text-white/80 text-sm font-semibold">$299 / month</span>
          </div>
          <div className="bg-white px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {PRIME_BENEFITS.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm text-gray-600">
                  <Icon size={14} className="text-[#0f2057] flex-shrink-0" />
                  {text}
                </div>
              ))}
            </div>
            {isPrime ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                <CheckCircle size={16} /> You are a Prime member — thank you!
              </div>
            ) : (
              <button
                onClick={handlePrimeUpgrade}
                disabled={primeLoading}
                className="flex items-center gap-2 bg-[#0f2057] hover:bg-[#1a3476] disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                {primeLoading
                  ? <Spinner size={4} color="text-white" />
                  : <><Star size={14} className="fill-yellow-400 text-yellow-400" /> Upgrade to Prime — $299/mo</>
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Outstanding</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(pending.reduce((s, i) => s + i.amount, 0))}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{pending.length} invoice{pending.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Total Paid</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmt(total)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{paid.length} payment{paid.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">Refunded</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            {fmt(refunded.reduce((s, i) => s + (i.refund_amount || i.amount), 0))}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{refunded.length} refund{refunded.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium">All Invoices</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{invoices.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Across all matters</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        <Filter size={14} className="text-gray-400 mr-1 mb-1" />
        {STATUS_TABS.map(tab => {
          const count = tab === 'all' ? invoices.length : invoices.filter(i => i.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
                ${activeTab === tab
                  ? 'text-[#0f2057] border-[#0f2057]'
                  : 'text-gray-500 border-transparent hover:text-gray-700'}`}
            >
              {tab} {count > 0 && <span className="ml-1 text-xs text-gray-400">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Invoice list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={8} /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {activeTab === 'all' ? 'No invoices yet' : `No ${activeTab} invoices`}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {isStaff && activeTab === 'all' ? 'Create your first invoice using the button above.' : 'Your billing history will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => {
            const cfg      = STATUS_CFG[inv.status] || STATUS_CFG.pending;
            const isPaying = paying === inv.id;
            const isPaid   = inv.status === 'paid';
            const isRefund = inv.status === 'refunded';
            return (
              <div key={inv.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                  ${isRefund ? 'bg-orange-50' : isPaid ? 'bg-green-50' : 'bg-blue-50'}`}>
                  <DollarSign size={18} className={isRefund ? 'text-orange-500' : isPaid ? 'text-green-600' : 'text-[#0f2057]'} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{inv.description}</span>
                    <span className={cfg.cls}><cfg.Icon size={10} className="mr-0.5" />{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    {inv.case_number && <span>Case #{inv.case_number}</span>}
                    {isStaff && inv.client_name && <span>· {inv.client_name}</span>}
                    {inv.due_date  && <span>· Due {fmtDate(inv.due_date)}</span>}
                    {inv.paid_at   && <span>· Paid {fmtDate(inv.paid_at)}</span>}
                    {inv.refunded_at && <span>· Refunded {fmtDate(inv.refunded_at)}</span>}
                    {inv.failure_reason && <span className="text-red-500">· {inv.failure_reason}</span>}
                    <span>· {fmtDate(inv.created_at)}</span>
                  </div>
                  {isRefund && inv.refund_amount > 0 && (
                    <p className="text-xs text-orange-600 mt-0.5 font-medium">
                      Refunded {fmt(inv.refund_amount)}{inv.refund_reason ? ` — ${inv.refund_reason}` : ''}
                    </p>
                  )}
                </div>

                {/* Amount + actions */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <span className={`text-lg font-bold ${isRefund ? 'text-orange-500 line-through' : 'text-gray-900'}`}>
                    {fmt(inv.amount)}
                  </span>

                  {/* Client: pay button */}
                  {inv.status === 'pending' && user?.role === 'client' && (
                    <button
                      onClick={() => handlePay(inv)}
                      disabled={isPaying}
                      className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      {isPaying ? <Spinner size={4} color="text-white" /> : <ExternalLink size={14} />}
                      {isPaying ? 'Redirecting…' : 'Pay Now'}
                    </button>
                  )}

                  {/* Receipt button for paid/refunded */}
                  {(isPaid || isRefund) && (
                    <button
                      onClick={() => openReceipt(inv.id)}
                      className="flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                      title="View receipt"
                    >
                      <FileText size={14} />
                      Receipt
                    </button>
                  )}

                  {/* Staff: refund button for paid invoices */}
                  {isPaid && isStaff && (
                    <button
                      onClick={() => { setShowRefundModal(inv); setRefundReason(''); }}
                      className="flex items-center gap-1.5 border border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                      title="Issue refund"
                    >
                      <RotateCcw size={14} />
                      Refund
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-gray-900">Create Invoice</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="form-label">Client *</label>
                <select required value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  className="form-input">
                  <option value="">— select client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Matter <span className="text-gray-400 font-normal">(optional)</span></label>
                <select value={form.matterId}
                  onChange={e => setForm(f => ({ ...f, matterId: e.target.value }))}
                  className="form-input">
                  <option value="">— no matter —</option>
                  {matters.map(m => (
                    <option key={m.id} value={m.id}>#{m.case_number} · {m.description?.slice(0, 40)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Service Type *</label>
                <select required value={form.serviceType}
                  onChange={e => {
                    const svc = SERVICE_TYPES.find(s => s.value === e.target.value);
                    setForm(f => ({ ...f, serviceType: e.target.value, amount: svc?.price ? (svc.price / 100).toFixed(2) : '' }));
                  }}
                  className="form-input">
                  {SERVICE_TYPES.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}{s.price ? ` — ${fmt(s.price)}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Amount (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input required type="number" min="0.50" step="0.01"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="form-input pl-7"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Description *</label>
                <input required value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Initial consultation — guardianship matter"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Due Date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="date" value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="form-input"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-gray-900">Issue Refund</h2>
              <button onClick={() => setShowRefundModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-orange-50 rounded-xl p-4 text-sm text-orange-800">
                <p className="font-semibold mb-1">Refunding {fmt(showRefundModal.amount)}</p>
                <p className="text-xs text-orange-600">Invoice #{showRefundModal.id} — {showRefundModal.description}</p>
              </div>
              <div>
                <label className="form-label">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="e.g. Client cancelled service"
                  className="form-input"
                />
              </div>
              <p className="text-xs text-gray-400">
                This will issue a full refund via Stripe and cannot be undone.
              </p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowRefundModal(null)} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleRefund}
                  disabled={refunding === showRefundModal.id}
                  className="btn-primary bg-orange-500 hover:bg-orange-600 flex items-center gap-2"
                >
                  {refunding === showRefundModal.id ? <Spinner size={4} color="text-white" /> : <RotateCcw size={14} />}
                  Confirm Refund
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
