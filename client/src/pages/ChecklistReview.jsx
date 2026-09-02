import { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, Briefcase, FileText, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { checklistApi } from '../api';
import AttorneyReviewPanel from '../components/checklist/AttorneyReviewPanel';
import Skeleton   from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Badge      from '../components/ui/Badge';
import Button     from '../components/ui/Button';
import Avatar     from '../components/ui/Avatar';

const fmtType = t => t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

const DOC_STATUS_CFG = {
  submitted:        { badge: 'warning', label: 'Pending Review' },
  accepted:         { badge: 'success', label: 'Accepted' },
  needs_correction: { badge: 'error',   label: 'Needs Correction' },
  not_applicable:   { badge: 'default', label: 'N/A' },
};

function ReadinessBadge({ pct }) {
  if (pct >= 80) return <span className="flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle size={12} />{pct}% Ready</span>;
  if (pct >= 50) return <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700"><Clock size={12} />{pct}% In Progress</span>;
  return <span className="flex items-center gap-1 text-xs font-semibold text-red-700"><AlertCircle size={12} />{pct}% Needs Attention</span>;
}

export default function ChecklistReview() {
  const [overview, setOverview]     = useState([]);
  const [queue, setQueue]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [reviewItem, setReviewItem] = useState(null);
  const [expanded, setExpanded]     = useState({});
  const [allItemsByMatter, setAllItemsByMatter] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([checklistApi.clientOverview(), checklistApi.getReviewQueue()])
      .then(([ovRes, qRes]) => {
        setOverview(ovRes.data);
        setQueue(qRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleReviewed(updatedItem) {
    setQueue(q => q.filter(i => i.id !== updatedItem.id));
    setAllItemsByMatter(m => {
      const key = updatedItem.matter_id;
      if (!m[key]) return m;
      return { ...m, [key]: m[key].map(i => i.id === updatedItem.id ? { ...i, ...updatedItem } : i) };
    });
  }

  function toggleClient(client) {
    const willOpen = !expanded[client.user_id];
    setExpanded(e => ({ ...e, [client.user_id]: willOpen }));
    if (willOpen) {
      client.matters.forEach(m => {
        if (allItemsByMatter[m.matter_id]) return; // already loaded
        checklistApi.getAllItems(m.matter_id)
          .then(r => setAllItemsByMatter(prev => ({ ...prev, [m.matter_id]: r.data })))
          .catch(() => {});
      });
    }
  }

  // Group overview rows by user_id
  const clientMap = {};
  for (const row of overview) {
    if (!clientMap[row.user_id]) {
      clientMap[row.user_id] = {
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        avatar_initials: row.avatar_initials,
        matters: [],
      };
    }
    if (row.matter_id) {
      const neededNow = Number(row.needed_now) || 0;
      const accepted  = Number(row.accepted_count) || 0;
      const progress  = neededNow > 0 ? Math.round((accepted / neededNow) * 100) : 0;
      clientMap[row.user_id].matters.push({
        matter_id:      row.matter_id,
        case_number:    row.case_number,
        matter_type:    row.matter_type,
        stage:          row.stage,
        status:         row.status,
        total_items:    Number(row.total_items) || 0,
        needed_now:     neededNow,
        accepted_count: accepted,
        pending_review: Number(row.pending_review) || 0,
        progress,
      });
    }
  }

  const clients = Object.values(clientMap);

  // Queue items grouped by matter for the expanded review section
  const queueByMatter = queue.reduce((acc, item) => {
    const key = item.matter_id || item.case_number;
    if (!acc[key]) acc[key] = { caseNumber: item.case_number, matterType: item.matter_type, clientFirst: item.client_first, clientLast: item.client_last, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});

  const totalPending = queue.length;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={22} className="text-[#0f2057]" />
            Client Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Loading…' : `${clients.length} client${clients.length !== 1 ? 's' : ''} · ${totalPending} item${totalPending !== 1 ? 's' : ''} pending review`}
          </p>
        </div>
        <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="card p-4 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton.List rows={2} />
            </div>
          ))}
        </div>
      )}

      {!loading && clients.length === 0 && (
        <EmptyState icon={Users} title="No clients yet" description="Clients assigned to your matters will appear here." size="lg" />
      )}

      {/* Client list */}
      {!loading && clients.length > 0 && (
        <div className="space-y-4 mb-8">
          {clients.map(client => {
            const isOpen = expanded[client.user_id];
            const pendingForClient = queue.filter(q => {
              const m = client.matters.find(mat => mat.matter_id === q.matter_id);
              return !!m;
            });
            return (
              <div key={client.user_id} className="card overflow-hidden">
                {/* Client header */}
                <button
                  onClick={() => toggleClient(client)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#0f2057]/5 border-b border-gray-200 hover:bg-[#0f2057]/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      initials={client.avatar_initials || `${client.first_name?.[0] ?? ''}${client.last_name?.[0] ?? ''}`}
                      name={`${client.first_name} ${client.last_name}`}
                      size="sm"
                    />
                    <div className="text-left">
                      <div className="text-sm font-semibold text-gray-800">{client.first_name} {client.last_name}</div>
                      <div className="text-xs text-gray-500">{client.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingForClient.length > 0 && (
                      <Badge variant="warning">{pendingForClient.length} pending review</Badge>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Matter rows — always visible */}
                {client.matters.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-400 italic">No matters assigned</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {client.matters.map(m => (
                      <div key={m.matter_id} className="px-4 py-3 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-[#0f2057]">{m.case_number || `Matter #${m.matter_id}`}</div>
                            <div className="text-xs text-gray-500">{fmtType(m.matter_type)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={m.stage === 'active' ? 'success' : 'info'}>{fmtType(m.stage) || '—'}</Badge>
                        </div>
                        {/* Readiness bar */}
                        <div className="flex-1 min-w-[160px]">
                          <div className="flex items-center justify-between mb-1">
                            <ReadinessBadge pct={m.progress} />
                            <span className="text-xs text-gray-400">{m.accepted_count}/{m.needed_now} docs</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-700 ${m.progress >= 80 ? 'bg-green-500' : m.progress >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${m.progress}%` }}
                            />
                          </div>
                        </div>
                        {m.pending_review > 0 && (
                          <Badge variant="warning">{m.pending_review} to review</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Expandable document list for this client — every checklist
                    item that has a file, any status, pending review first */}
                {isOpen && (() => {
                  const items = client.matters.flatMap(m => allItemsByMatter[m.matter_id] || []);
                  const statusRank = { submitted: 0, needs_correction: 1, accepted: 2, not_applicable: 3 };
                  const sorted = [...items].sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9));
                  if (!items.length) {
                    return (
                      <div className="px-4 py-3 text-xs text-gray-400 italic border-t border-gray-100">
                        No documents uploaded yet.
                      </div>
                    );
                  }
                  return (
                    <div className="border-t border-gray-200">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50">Documents</div>
                      <div className="divide-y divide-gray-100">
                        {sorted.map(item => {
                          const badge = DOC_STATUS_CFG[item.status] || DOC_STATUS_CFG.submitted;
                          return (
                            <button
                              key={item.id}
                              onClick={() => setReviewItem(item)}
                              className={`w-full flex items-center justify-between px-4 py-3 transition-colors text-left group ${
                                item.status === 'submitted' ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'
                              }`}
                              aria-label={`View: ${item.label}`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <FileText size={15} className="text-[#0f2057] flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 group-hover:text-[#0f2057] truncate">{item.label}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-500">{item.section}</span>
                                    {item.file_name && (
                                      <><span className="text-gray-300">·</span><span className="text-xs text-gray-400 truncate max-w-[140px]">{item.file_name}</span></>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                                <Badge variant={badge.badge} size="sm">{badge.label}</Badge>
                                <span className="text-xs text-gray-400 flex items-center gap-1 whitespace-nowrap">
                                  <Clock size={11} />
                                  {item.updated_at ? formatDistanceToNow(new Date(item.updated_at), { addSuffix: true }) : '—'}
                                </span>
                                <span className="text-xs font-medium text-[#0f2057] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">View →</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Review panel modal */}
      <AttorneyReviewPanel item={reviewItem} onClose={() => setReviewItem(null)} onReviewed={handleReviewed} />
    </div>
  );
}