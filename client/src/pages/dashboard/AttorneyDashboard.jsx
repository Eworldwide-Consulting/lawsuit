import { useState, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardApi, mattersApi, documentsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { viewFileInPopup, downloadFile } from '../../lib/fileActions';
import {
  ChevronRight, Clock, Users, Phone, Mail, CheckCircle, XCircle, MessageSquare,
  FileText, Eye, AlertCircle, ChevronDown, UserCheck, RefreshCw, ThumbsUp, ThumbsDown,
  X, Briefcase, ExternalLink, Download,
} from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import DocumentUploadPanel from '../../components/ui/DocumentUploadPanel';

const MATTER_TYPE_LABELS = {
  guardianship:                  'Guardianship',
  conservatorship:               'Conservatorship',
  guardianship_conservatorship:  'Guardianship & Conservatorship',
  estate_administration:         'Estate Administration',
  unassigned:                    'No Matter Yet',
};

const MATTER_TYPE_COLORS = {
  guardianship:                  'bg-blue-100 text-blue-700',
  conservatorship:               'bg-purple-100 text-purple-700',
  guardianship_conservatorship:  'bg-indigo-100 text-indigo-700',
  estate_administration:         'bg-green-100 text-green-700',
  unassigned:                    'bg-gray-100 text-gray-600',
};

const STAGES = [
  { value: 'intake',              label: 'Intake' },
  { value: 'petition_filed',      label: 'Petition Filed' },
  { value: 'hearing_prep',        label: 'Hearing Prep' },
  { value: 'guardian_appointed',  label: 'Guardian Appointed' },
  { value: 'care_plan',           label: 'Care Plan' },
  { value: 'annual_review',       label: 'Annual Review' },
  { value: 'court_review',        label: 'Court Review' },
];

const fmt$ = n =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
  : `$${n}`;

const stageLabel = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

const HealthScore = memo(function HealthScore({ score }) {
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
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{score}</div>
        <div className="text-xs text-gray-500">/100</div>
      </div>
    </div>
  );
});

// ── Decline Reason Modal ──────────────────────────────────────────────────────
function DeclineModal({ request, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy]     = useState(false);

  async function submit() {
    setBusy(true);
    await onConfirm(request.id, reason);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Decline Case Request</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Case #{request.case_number} · {request.client_name}
            </p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-4">
          <label className="form-label">Reason for Declining <span className="text-xs text-gray-400">(optional)</span></label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Briefly explain why you cannot take this case..."
            className="form-input resize-none" />
          <p className="text-xs text-gray-400 mt-1">The client will be notified and can request another attorney.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={submit} disabled={busy}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Spinner size={4} /> : <XCircle size={15} />} Decline Case
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Document Review Panel ─────────────────────────────────────────────────────
function DocumentReviewPanel({ onRefresh }) {
  const toast = useToast();
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState({});
  const [expanded, setExpanded] = useState(null);
  const [denyId, setDenyId]     = useState(null);
  const [denyNote, setDenyNote] = useState('');

  async function handleView(doc) {
    try {
      await viewFileInPopup(documentsApi.viewBlob(doc.id));
    } catch (err) {
      toast.error(err.code === 'POPUP_BLOCKED' ? err.message : 'Could not open document. Please try again.');
    }
  }

  async function handleDownload(doc) {
    try {
      await downloadFile(documentsApi.downloadBlob(doc.id), doc.name);
    } catch {
      toast.error('Download failed. Please try again.');
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    documentsApi.pendingReview()
      .then(r => setDocs(r.data?.documents || r.data || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function reviewDoc(id, status, note) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await documentsApi.updateStatus(id, status, note);
      setDocs(prev => prev.filter(d => d.id !== id));
      setDenyId(null);
      setDenyNote('');
      onRefresh?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  }

  if (loading) return (
    <div className="card p-5">
      <div className="flex items-center justify-center py-6"><Spinner /></div>
    </div>
  );

  if (!docs.length) return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
          <FileText size={14} className="text-blue-500" /> Document Review
        </div>
      </div>
      <div className="flex flex-col items-center py-6 text-gray-400">
        <CheckCircle size={28} className="text-green-400 mb-2" />
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">All caught up!</div>
        <div className="text-xs">No documents pending review</div>
      </div>
    </div>
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
          <FileText size={14} className="text-blue-500" /> Document Review
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full">{docs.length}</span>
        </div>
        <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors"><RefreshCw size={13} /></button>
      </div>
      <div className="space-y-3">
        {docs.map(doc => (
          <div key={doc.id} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 dark:text-white truncate">{doc.name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-[#0f2057] dark:text-blue-400">{doc.client_name}</span>
                  {doc.category && <><span>·</span><span>{doc.category}</span></>}
                  {doc.matter_type && <><span>·</span><span className="capitalize">{doc.matter_type.replace(/_/g, ' ')}</span></>}
                </div>
              </div>
              <button onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}
                className="text-gray-400 hover:text-gray-600 p-1 transition-colors">
                <ChevronDown size={14} className={`transition-transform ${expanded === doc.id ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Expanded preview */}
            {expanded === doc.id && (
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  {doc.file_size && (
                    <div><span className="text-gray-400">Size:</span> <span className="font-medium text-gray-700 dark:text-gray-300">{(doc.file_size / 1024).toFixed(0)} KB</span></div>
                  )}
                  {doc.created_at && (
                    <div><span className="text-gray-400">Uploaded:</span> <span className="font-medium text-gray-700 dark:text-gray-300">{new Date(doc.created_at).toLocaleDateString()}</span></div>
                  )}
                  {doc.case_number && (
                    <div><span className="text-gray-400">Case #:</span> <span className="font-medium font-mono text-gray-700 dark:text-gray-300">{doc.case_number}</span></div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleView(doc)}
                    className="flex items-center gap-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">
                    <Eye size={12} /> Preview
                  </button>
                  <button onClick={() => handleDownload(doc)}
                    className="flex items-center gap-1.5 text-xs border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>
            )}

            {/* Action footer */}
            {denyId === doc.id ? (
              <div className="p-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                <textarea
                  value={denyNote}
                  onChange={e => setDenyNote(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="Reason for rejection — the client sees this before re-uploading"
                  className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewDoc(doc.id, 'rejected', denyNote.trim())}
                    disabled={busy[doc.id] || !denyNote.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors">
                    {busy[doc.id] ? <Spinner size={3} /> : <ThumbsDown size={12} />} Confirm Deny
                  </button>
                  <button
                    onClick={() => { setDenyId(null); setDenyNote(''); }}
                    disabled={busy[doc.id]}
                    className="flex-1 py-1.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 p-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => reviewDoc(doc.id, 'approved')}
                  disabled={busy[doc.id]}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors">
                  {busy[doc.id] ? <Spinner size={3} /> : <ThumbsUp size={12} />} Approve
                </button>
                <button
                  onClick={() => { setDenyId(doc.id); setDenyNote(''); }}
                  disabled={busy[doc.id]}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors">
                  <ThumbsDown size={12} /> Deny
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Client Requests Panel ─────────────────────────────────────────────────────
function ClientRequestsPanel({ onAccepted }) {
  const navigate = useNavigate();
  const [requests, setRequests]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [busy, setBusy]               = useState({});
  const [declineTarget, setDecline]   = useState(null);
  const [stageEdits, setStageEdits]   = useState({});
  const [typeEdits, setTypeEdits]     = useState({});
  const [toast, setToast]             = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(() => {
    setLoading(true);
    mattersApi.pendingRequests()
      .then(r => setRequests(r.data?.matters || r.data || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function accept(id) {
    setBusy(b => ({ ...b, [id]: 'accepting' }));
    try {
      // Apply any stage/type changes before accepting
      const updates = {};
      if (stageEdits[id]) updates.stage = stageEdits[id];
      if (typeEdits[id])  updates.matter_type = typeEdits[id];
      if (Object.keys(updates).length) await mattersApi.update(id, updates);
      await mattersApi.accept(id);
      setRequests(prev => prev.filter(r => r.id !== id));
      showToast('Case accepted! The client has been notified.');
      onAccepted?.();
    } catch (e) {
      showToast(e.response?.data?.error || 'Failed to accept case', false);
    } finally {
      setBusy(b => ({ ...b, [id]: null }));
    }
  }

  async function decline(id, reason) {
    setBusy(b => ({ ...b, [id]: 'declining' }));
    try {
      await mattersApi.decline(id, reason);
      setRequests(prev => prev.filter(r => r.id !== id));
      setDecline(null);
      showToast('Case declined. The client has been notified.');
    } catch (e) {
      showToast(e.response?.data?.error || 'Failed to decline case', false);
    } finally {
      setBusy(b => ({ ...b, [id]: null }));
    }
  }

  if (loading) return (
    <div className="card p-5">
      <div className="flex items-center justify-center py-6"><Spinner /></div>
    </div>
  );

  if (!requests.length) return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
          <Briefcase size={14} className="text-[#0f2057]" /> Client Requests
        </div>
      </div>
      <div className="flex flex-col items-center py-6 text-gray-400">
        <CheckCircle size={28} className="text-green-400 mb-2" />
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">No pending requests</div>
        <div className="text-xs">All client requests have been handled</div>
      </div>
    </div>
  );

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl shadow-lg px-4 py-3 text-sm font-medium flex items-center gap-2 max-w-sm animate-slideUp ${
          toast.ok
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-gray-800 dark:text-white text-sm flex items-center gap-2">
            <Briefcase size={14} className="text-[#0f2057]" /> Client Requests
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {requests.length} Pending
            </span>
          </div>
          <button onClick={load} className="text-gray-400 hover:text-gray-600 transition-colors"><RefreshCw size={13} /></button>
        </div>

        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="border border-amber-100 dark:border-amber-800/40 rounded-2xl overflow-hidden bg-amber-50/30 dark:bg-amber-900/10">
              {/* Request Header */}
              <div className="flex items-center gap-3 p-4 border-b border-amber-100 dark:border-amber-800/40">
                <div className="w-10 h-10 rounded-full bg-[#0f2057] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {req.client_initials || (req.client_name || '??').split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{req.client_name}</div>
                  <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-gray-400">{req.case_number}</span>
                    {req.client_email && <><span>·</span><span>{req.client_email}</span></>}
                    {req.client_phone && <><span>·</span><span>{req.client_phone}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <Clock size={11} /> Awaiting your response
                  </span>
                </div>
              </div>

              {/* Request body */}
              <div className="p-4 space-y-3">
                {req.request_note && (
                  <div className="text-xs bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl px-3 py-2.5 text-gray-600 dark:text-gray-300 italic">
                    "{req.request_note}"
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Matter type — editable */}
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Matter Type</label>
                    <select
                      value={typeEdits[req.id] ?? req.matter_type ?? ''}
                      onChange={e => setTypeEdits(prev => ({ ...prev, [req.id]: e.target.value }))}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      <option value="">Select type…</option>
                      {Object.entries(MATTER_TYPE_LABELS).filter(([k]) => k !== 'unassigned').map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  </div>

                  {/* Stage — editable */}
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Case Stage</label>
                    <select
                      value={stageEdits[req.id] ?? req.stage ?? 'intake'}
                      onChange={e => setStageEdits(prev => ({ ...prev, [req.id]: e.target.value }))}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Current info chips */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {req.matter_type && (
                    <span className={`px-2 py-0.5 rounded-full font-medium ${MATTER_TYPE_COLORS[req.matter_type] || 'bg-gray-100 text-gray-600'}`}>
                      {MATTER_TYPE_LABELS[req.matter_type] || req.matter_type}
                    </span>
                  )}
                  {req.stage && (
                    <span className="badge badge-blue">{stageLabel(req.stage)}</span>
                  )}
                  {req.description && (
                    <span className="text-gray-400 text-xs">{req.description}</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => accept(req.id)}
                    disabled={!!busy[req.id]}
                    className="flex items-center gap-1.5 py-2 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-colors">
                    {busy[req.id] === 'accepting' ? <Spinner size={3} /> : <CheckCircle size={13} />}
                    Accept Case
                  </button>
                  <button
                    onClick={() => setDecline(req)}
                    disabled={!!busy[req.id]}
                    className="flex items-center gap-1.5 py-2 px-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-semibold rounded-xl disabled:opacity-50 transition-colors">
                    {busy[req.id] === 'declining' ? <Spinner size={3} /> : <XCircle size={13} />}
                    Decline
                  </button>
                  <button
                    onClick={() => navigate('/messages')}
                    className="flex items-center gap-1.5 py-2 px-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <MessageSquare size={12} /> Message Client
                  </button>
                  <button
                    onClick={() => navigate(`/matters/${req.id}`)}
                    className="flex items-center gap-1.5 py-2 px-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <ExternalLink size={12} /> View Case
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {declineTarget && (
        <DeclineModal
          request={declineTarget}
          onConfirm={decline}
          onCancel={() => setDecline(null)}
        />
      )}
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AttorneyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [clients, setClients]       = useState({ clients: [], grouped: {} });
  const [clientsTab, setClientsTab] = useState('all');

  const loadDashboard = useCallback(() => {
    dashboardApi.attorney().then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
    dashboardApi.attorneyClients().then(r => setClients(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const alerts = [];
  if ((data?.missingDocs ?? 0) > 0)
    alerts.push({ icon: '📄', msg: `${data.missingDocs} required document${data.missingDocs > 1 ? 's' : ''} pending from clients`, sub: 'Review document checklist', urgent: data.missingDocs > 5 });
  if ((data?.atRiskMatters ?? 0) > 0)
    alerts.push({ icon: '⚠️', msg: `${data.atRiskMatters} matter${data.atRiskMatters > 1 ? 's' : ''} flagged at risk`, sub: 'Immediate attorney attention required', urgent: true });
  if ((data?.overdueTasks ?? 0) > 0)
    alerts.push({ icon: '📋', msg: `${data.overdueTasks} overdue task${data.overdueTasks > 1 ? 's' : ''} across all matters`, sub: 'Client action required', urgent: data.overdueTasks > 3 });
  if ((data?.outstandingAR ?? 0) > 0)
    alerts.push({ icon: '📈', msg: `Outstanding A/R: ${fmt$(data.outstandingAR)}`, sub: 'Review collections pipeline', urgent: false });

  const ytdRevenue     = data?.ytdRevenue ?? 0;
  const collectionRate = ytdRevenue > 0
    ? Math.min(100, Math.round(((data?.collectedMonth ?? 0) * 12 / ytdRevenue) * 100))
    : 80;
  const arRatioPct = ytdRevenue > 0
    ? Math.max(0, Math.round(100 - ((data?.outstandingAR ?? 0) / ytdRevenue) * 100))
    : 80;

  const revenueGoalYTD  = Math.round(ytdRevenue * 1.12);
  const billedYTD       = (data?.revenueData ?? []).reduce((s, d) => s + d.revenue * 1000, 0);
  const realizationRate = billedYTD > 0 ? Math.round((data?.collectedMonth ?? 0) * 12 / billedYTD * 100) : 80;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">

      {/* Pending approval banner */}
      {user?.approval_status === 'pending' && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
          <Clock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">Account Pending Approval</div>
            <div className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Our team is reviewing your credentials. Full platform access will be enabled once approved (1–2 business days). You'll receive an email when your account is approved.
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Good morning, {user?.first_name}.</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Here's your practice-level financial overview.</p>
      </div>

      {/* ── NEW: Client Requests + Document Review side-by-side ── */}
      <div className="grid lg:grid-cols-2 gap-5">
        <ClientRequestsPanel onAccepted={loadDashboard} />
        <DocumentReviewPanel onRefresh={loadDashboard} />
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
            <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</div>
            <div className={`text-xs ${subColor}`}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Matter table */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-gray-800 dark:text-white text-sm">Firm Matter & Financial Overview</div>
              <button onClick={() => navigate('/matters')} className="text-xs text-green-600 font-medium">View all matters</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {['Matter', 'Client', 'Responsible Attorney', 'Stage', 'Status'].map(h => (
                      <th key={h} className="text-left py-2 pr-3 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.matters || []).slice(0, 8).map(m => (
                    <tr key={m.id} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                      onClick={() => navigate(`/matters/${m.id}`)}>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-800 dark:text-white">{m.case_number}</div>
                        <div className="text-gray-400 truncate max-w-[120px]">{m.description}</div>
                      </td>
                      <td className="pr-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#0f2057] text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">
                            {m.client_initials || '?'}
                          </div>
                          <span className="truncate max-w-[80px] text-gray-700 dark:text-gray-300">{m.client_name}</span>
                        </div>
                      </td>
                      <td className="pr-3 text-gray-600 dark:text-gray-400">{m.attorney_name || '—'}</td>
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
                <div className="font-semibold text-gray-800 dark:text-white text-sm">Revenue & Collections Performance</div>
                <div className="flex gap-4 mt-1">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-3 h-0.5 bg-[#0f2057] inline-block rounded" /> Revenue
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="w-3 h-0.5 bg-green-500 inline-block rounded" /> Collections
                  </span>
                </div>
              </div>
              <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 dark:bg-gray-700 dark:text-gray-300">
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
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs">
              <div>
                <div className="text-gray-500">Revenue Goal (YTD)</div>
                <div className="font-bold text-gray-800 dark:text-white">{fmt$(revenueGoalYTD)}</div>
              </div>
              <div>
                <div className="text-gray-500">Billed (YTD)</div>
                <div className="font-bold text-gray-800 dark:text-white">{fmt$(billedYTD)}</div>
              </div>
              <div>
                <div className="text-gray-500">Realization Rate</div>
                <div className="font-bold text-gray-800 dark:text-white">{realizationRate}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Financial alerts */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 dark:text-white text-sm mb-3 flex items-center justify-between">
              Key Financial Alerts <button className="text-xs text-green-600">View all</button>
            </div>
            <div className="space-y-2">
              {alerts.length > 0 ? alerts.map((alert, i) => (
                <button key={i} className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 text-left transition-colors">
                  <span className="text-base flex-shrink-0">{alert.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${alert.urgent ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>{alert.msg}</div>
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
            <div className="font-semibold text-gray-800 dark:text-white text-sm mb-3">Partner Financial Snapshot</div>
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
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming appointments */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 dark:text-white text-sm mb-3 flex items-center justify-between">
              Upcoming Appointments
              <button onClick={() => navigate('/appointments')} className="text-xs text-green-600">View calendar</button>
            </div>
            <div className="space-y-2.5">
              {(data?.upcomingAppts || []).slice(0, 3).map(appt => (
                <div key={appt.id} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div className="bg-blue-50 dark:bg-blue-900/20 text-[#0f2057] dark:text-blue-400 text-xs font-bold w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                    <div>{new Date(appt.start_time).toLocaleDateString('en', { month: 'short' }).toUpperCase()}</div>
                    <div className="text-lg leading-tight">{new Date(appt.start_time).getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{appt.title}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(appt.start_time).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })} · {appt.location}
                    </div>
                  </div>
                  <button className="text-xs border border-gray-300 dark:border-gray-600 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">Join</button>
                </div>
              ))}
              {(!data?.upcomingAppts || !data.upcomingAppts.length) && (
                <div className="text-xs text-gray-400 text-center py-2">No upcoming appointments</div>
              )}
            </div>
          </div>

          {/* Recent messages */}
          <div className="card p-4">
            <div className="font-semibold text-gray-800 dark:text-white text-sm mb-3 flex items-center justify-between">
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
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{msg.from_name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(msg.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{msg.body}</div>
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

      {/* ── Registered Clients by Matter Type ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0f2057]" />
            <span className="font-semibold text-gray-800 dark:text-white text-sm">Registered Clients by Matter Type</span>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5 font-medium">{clients.clients.length}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            { key: 'all', label: `All (${clients.clients.length})` },
            ...Object.keys(clients.grouped).filter(k => k !== 'unassigned').map(k => ({
              key: k,
              label: `${MATTER_TYPE_LABELS[k] || k} (${clients.grouped[k].length})`,
            })),
            ...(clients.grouped.unassigned?.length
              ? [{ key: 'unassigned', label: `No Matter Yet (${clients.grouped.unassigned.length})` }]
              : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setClientsTab(tab.key)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                clientsTab === tab.key
                  ? 'bg-[#0f2057] text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Client list */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                {['Client', 'Matter Type', 'Case #', 'Stage', 'Status', 'Joined', 'Contact'].map(h => (
                  <th key={h} className="text-left py-2 pr-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(clientsTab === 'all' ? clients.clients : (clients.grouped[clientsTab] || [])).map(c => (
                <tr key={`${c.id}-${c.matter_id}`} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#0f2057] text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                        {c.avatar_initials || `${c.first_name?.[0]}${c.last_name?.[0]}`}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white">{c.first_name} {c.last_name}</div>
                        <div className="text-gray-400 truncate max-w-[140px]">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="pr-3">
                    {c.matter_type
                      ? <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${MATTER_TYPE_COLORS[c.matter_type] || 'bg-gray-100 text-gray-600'}`}>
                          {MATTER_TYPE_LABELS[c.matter_type] || c.matter_type}
                        </span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="pr-3 text-gray-600 dark:text-gray-400 font-mono">{c.case_number || '—'}</td>
                  <td className="pr-3">
                    {c.stage
                      ? <span className="badge badge-blue">{c.stage.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase())}</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="pr-3">
                    {c.status
                      ? <span className={`badge ${c.status === 'active' ? 'badge-green' : c.status === 'at_risk' ? 'badge-red' : 'badge-gray'}`}>
                          {c.status === 'at_risk' ? 'At Risk' : c.status === 'active' ? 'On Track' : c.status}
                        </span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="pr-3 text-gray-500 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-gray-400 hover:text-[#0f2057] transition-colors">
                          <Phone size={12} />
                        </a>
                      )}
                      <a href={`mailto:${c.email}`} className="text-gray-400 hover:text-[#0f2057] transition-colors">
                        <Mail size={12} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {(clientsTab === 'all' ? clients.clients : (clients.grouped[clientsTab] || [])).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-gray-400">No clients in this category</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
