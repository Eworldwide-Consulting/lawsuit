import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, RefreshCw, AlertCircle, Briefcase } from 'lucide-react';
import { checklistApi, mattersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import MatterReadinessBar from '../components/checklist/MatterReadinessBar';
import ChecklistSection   from '../components/checklist/ChecklistSection';
import Skeleton  from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';

const MATTER_TYPE_LABELS = {
  conservatorship:                    'Conservatorship',
  estate_administration:              'Estate Administration',
  guardianship:                       'Guardianship',
  joint_guardianship_conservatorship: 'Joint Guardianship & Conservatorship',
};

export default function Checklist() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [matters, setMatters]   = useState([]);
  const [matterId, setMatterId] = useState(null);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    mattersApi.list()
      .then(r => {
        const list = r.data?.matters || r.data || [];
        setMatters(list);
        if (list.length > 0) {
          setMatterId(list[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setError('Could not load matters.');
        setLoading(false);
      });
  }, []);

  const load = useCallback(() => {
    if (!matterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    checklistApi.getByMatter(matterId)
      .then(r => setData(r.data))
      .catch(() => setError('Could not load checklist.'))
      .finally(() => setLoading(false));
  }, [matterId]);

  useEffect(() => { load(); }, [load]);

  // When an item is updated (upload), patch it in local state
  function handleItemUpdated(updatedItem) {
    if (!data) return;
    setData(prev => {
      const sections = prev.sections.map(sec => ({
        ...sec,
        items: sec.items.map(i => i.id === updatedItem.id ? updatedItem : i),
      }));
      // Recalculate progress
      const allItems  = sections.flatMap(s => s.items);
      const neededNow = allItems.filter(i => i.default_status === 'needed_now');
      const accepted  = neededNow.filter(i => i.status === 'accepted');
      const progress  = neededNow.length > 0
        ? Math.round((accepted.length / neededNow.length) * 100)
        : 0;
      return { ...prev, sections, progress };
    });
  }

  const currentMatter = matters.find(m => m.id === matterId);
  const matterLabel   = currentMatter
    ? (MATTER_TYPE_LABELS[currentMatter.matter_type] || currentMatter.matter_type)
    : '';

  // Count items needing attention
  const attentionCount = data?.sections
    .flatMap(s => s.items)
    .filter(i => i.status === 'needs_correction').length ?? 0;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList size={22} className="text-[#0f2057]" aria-hidden="true" />
              Document Checklist
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Upload what you have. Answer what you know. Your legal team will help identify anything missing.
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

        {/* Matter selector (if client has multiple matters) */}
        {matters.length > 1 && (
          <div className="mt-3">
            <label htmlFor="matter-select" className="form-label">Matter</label>
            <select
              id="matter-select"
              value={matterId || ''}
              onChange={e => setMatterId(Number(e.target.value))}
              className="form-input w-auto text-sm"
            >
              {matters.map(m => (
                <option key={m.id} value={m.id}>
                  {m.case_number} — {MATTER_TYPE_LABELS[m.matter_type] || m.matter_type}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Attention banner */}
      {attentionCount > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <AlertCircle size={18} className="flex-shrink-0 text-red-500" />
          <span>
            <strong>{attentionCount} item{attentionCount !== 1 ? 's' : ''} need correction.</strong>
            {' '}Check the highlighted sections below and re-upload the corrected files.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          <button onClick={load} className="ml-2 underline font-medium">Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          {[1, 2, 3].map(n => (
            <div key={n} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-12 bg-gray-50 px-4 flex items-center">
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="p-3 space-y-2">
                {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No matter */}
      {!loading && !error && matters.length === 0 && (
        <div className="card p-10 text-center">
          <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
          <div className="text-gray-700 font-semibold mb-1">No active matter yet</div>
          <div className="text-gray-400 text-sm mb-5">
            Your document checklist will appear once your case is set up. Start by telling us about your situation.
          </div>
          <button
            onClick={() => navigate('/my-case')}
            className="inline-flex items-center gap-2 bg-[#0f2057] hover:bg-[#1a3476] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Briefcase size={16} /> Set Up My Case
          </button>
        </div>
      )}

      {/* Checklist */}
      {!loading && !error && data && (
        <div className="space-y-4">
          <MatterReadinessBar
            progress={data.progress}
            totalItems={data.totalItems}
          />

          {matterLabel && (
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide px-1">
              {matterLabel} — {data.sections.length} section{data.sections.length !== 1 ? 's' : ''}
            </p>
          )}

          {data.sections.map((sec, idx) => (
            <ChecklistSection
              key={sec.section}
              section={sec.section}
              items={sec.items}
              onItemUpdated={handleItemUpdated}
              defaultOpen={idx < 2 || sec.items.some(i => i.status === 'needs_correction')}
            />
          ))}
        </div>
      )}
    </div>
  );
}