import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

const TIER_COLORS = [
  { min: 80, bar: 'bg-green-500',  text: 'text-green-700',  label: 'Ready for Review' },
  { min: 50, bar: 'bg-yellow-400', text: 'text-yellow-700', label: 'In Progress' },
  { min: 0,  bar: 'bg-red-400',    text: 'text-red-700',    label: 'Needs Attention' },
];

function tier(pct) {
  return TIER_COLORS.find(t => pct >= t.min) || TIER_COLORS[2];
}

export default function MatterReadinessBar({ progress = 0, totalItems = 0, className = '' }) {
  const t = tier(progress);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Matter Readiness</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Based on required documents marked <span className="font-medium">Needed Now</span>
          </p>
        </div>
        <div className={`text-3xl font-bold ${t.text}`} aria-label={`${progress}% complete`}>
          {progress}%
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full bg-gray-100 rounded-full h-3 overflow-hidden"
      >
        <div
          className={`h-3 rounded-full transition-all duration-700 ease-out ${t.bar}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between mt-3">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${t.text}`}>
          {progress === 100 ? (
            <CheckCircle size={14} />
          ) : progress >= 50 ? (
            <Clock size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {t.label}
        </div>
        <span className="text-xs text-gray-400">{totalItems} total items</span>
      </div>
    </div>
  );
}