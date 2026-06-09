import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, RefreshCw, User, Briefcase, FileText, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { checklistApi } from '../api';
import MatterReadinessBar  from '../components/checklist/MatterReadinessBar';
import AttorneyReviewPanel from '../components/checklist/AttorneyReviewPanel';
import Skeleton   from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Badge      from '../components/ui/Badge';
import Button     from '../components/ui/Button';
import Avatar     from '../components/ui/Avatar';

const MATTER_TYPE_LABELS = {
  conservatorship:                    'Conservatorship',
  estate_administration:              'Estate Administration',
  guardianship:                       'Guardianship',
  joint_guardianship_conservatorship: 'Joint Guardianship & Conservatorship',
};

export default function ChecklistReview() {
  const [queue, setQueue]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [reviewItem, setReviewItem] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    checklistApi.getReviewQueue()
      .then(r => setQueue(r.data))
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleReviewed(updatedItem) {
    // Remove from queue if no longer 'submitted'
    setQueue(q => q.filter(i => i.id !== updatedItem.id));
  }

  // Group queue by matter for easier scanning
  const grouped = queue.reduce((acc, item) => {
    const key = item.matter_id || item.case_number;
    if (!acc[key]) acc[key] = { caseNumber: item.case_number, matterType: item.matter_type, clientFirst: item.client_first, clientLast: item.client_last, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck size={22} className="text-[#0f2057]" aria-hidden="true" />
            Checklist Review Queue
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Loading…' : `${queue.length} item${queue.length !== 1 ? 's' : ''} pending review`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw size={14} />}
          onClick={load}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="card p-4 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton.List rows={2} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && queue.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title="All caught up"
          description="No checklist items are waiting for review. New submissions will appear here."
          size="lg"
        />
      )}

      {/* Grouped review cards */}
      {!loading && queue.length > 0 && (
        <div className="space-y-5">
          {Object.values(grouped).map(group => (
            <div key={group.caseNumber} className="card overflow-hidden">
              {/* Matter header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0f2057]/5 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <Avatar
                    initials={`${group.clientFirst?.[0] ?? ''}${group.clientLast?.[0] ?? ''}`}
                    name={`${group.clientFirst} ${group.clientLast}`}
                    size="sm"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-800">
                      {group.clientFirst} {group.clientLast}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="flex items-center gap-1"><Briefcase size={11} />{group.caseNumber}</span>
                      <span>·</span>
                      <span>{MATTER_TYPE_LABELS[group.matterType] || group.matterType}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="warning">
                  {group.items.length} pending
                </Badge>
              </div>

              {/* Item rows */}
              <div className="divide-y divide-gray-100">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setReviewItem(item)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors text-left group"
                    aria-label={`Review: ${item.label}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText size={16} className="text-[#0f2057] flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 group-hover:text-[#0f2057] truncate">
                          {item.label}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{item.section}</span>
                          {item.file_name && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400 truncate max-w-[140px]">{item.file_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className="text-xs text-gray-400 flex items-center gap-1 whitespace-nowrap">
                        <Clock size={11} />
                        {item.updated_at
                          ? formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })
                          : '—'}
                      </span>
                      <span className="text-xs font-medium text-[#0f2057] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Review →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review panel modal */}
      <AttorneyReviewPanel
        item={reviewItem}
        onClose={() => setReviewItem(null)}
        onReviewed={handleReviewed}
      />
    </div>
  );
}