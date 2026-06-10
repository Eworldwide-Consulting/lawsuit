import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import ChecklistItem from './ChecklistItem';

const STATUS_ORDER = ['needs_correction', 'needed_now', 'submitted', 'if_available', 'upload_later', 'attorney_will_request', 'accepted', 'not_applicable'];

function sectionStats(items) {
  const total      = items.length;
  const accepted   = items.filter(i => i.status === 'accepted').length;
  const pending    = items.filter(i => i.status === 'submitted').length;
  const correction = items.filter(i => i.status === 'needs_correction').length;
  const done       = items.filter(i => ['accepted', 'not_applicable'].includes(i.status)).length;
  return { total, accepted, pending, correction, done };
}

export default function ChecklistSection({ section, items, onItemUpdated, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const stats = sectionStats(items);
  const allDone = stats.done === stats.total && stats.total > 0;

  const sorted = [...items].sort((a, b) =>
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );

  // Progress percentage for mini bar
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${allDone ? 'border-green-200' : 'border-gray-200'}`}>
      {/* Section header */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${
          allDone ? 'bg-green-50 hover:bg-green-100/60' : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {allDone
            ? <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
            : open
            ? <ChevronDown size={15} className="text-gray-500 flex-shrink-0" />
            : <ChevronRight size={15} className="text-gray-500 flex-shrink-0" />
          }
          <span className={`text-sm font-semibold truncate ${allDone ? 'text-green-800' : 'text-gray-800'}`}>
            {section}
          </span>
        </div>

        {/* Right side: mini progress bar + chips */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          {/* Mini progress bar */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-[#0f2057]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-medium">{pct}%</span>
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-1.5 text-xs">
            {stats.correction > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
                {stats.correction} fix
              </span>
            )}
            {stats.pending > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                {stats.pending} pending
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full font-medium ${allDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {stats.done}/{stats.total}
            </span>
          </div>
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