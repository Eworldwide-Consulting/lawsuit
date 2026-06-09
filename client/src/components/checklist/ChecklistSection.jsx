import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ChecklistItem from './ChecklistItem';

const STATUS_ORDER = ['needs_correction', 'needed_now', 'submitted', 'if_available', 'upload_later', 'attorney_will_request', 'accepted', 'not_applicable'];

function sectionStats(items) {
  const total    = items.length;
  const accepted = items.filter(i => i.status === 'accepted').length;
  const pending  = items.filter(i => i.status === 'submitted').length;
  const correction = items.filter(i => i.status === 'needs_correction').length;
  return { total, accepted, pending, correction };
}

export default function ChecklistSection({ section, items, onItemUpdated, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const stats = sectionStats(items);

  // Sort items: corrections first, then needed_now, then submitted, etc.
  const sorted = [...items].sort((a, b) =>
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Section header — accordion toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-800">{section}</span>
        </div>

        {/* Summary chips */}
        <div className="flex items-center gap-2 text-xs" aria-label="Section summary">
          {stats.correction > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
              {stats.correction} correction{stats.correction !== 1 ? 's' : ''}
            </span>
          )}
          {stats.pending > 0 && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
              {stats.pending} pending
            </span>
          )}
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
            {stats.accepted}/{stats.total}
          </span>
        </div>
      </button>

      {/* Items */}
      {open && (
        <div className="p-3 space-y-2 bg-white">
          {sorted.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              onUpdated={onItemUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}