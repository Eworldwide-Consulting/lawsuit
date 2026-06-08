/**
 * Skeleton — animated loading placeholders.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />          base element
 *   <Skeleton.Text lines={3} />                 text block
 *   <Skeleton.Card />                           card placeholder
 *   <Skeleton.TableRow cols={5} />              table row
 *   <Skeleton.Avatar size={8} />                avatar circle
 *   <Skeleton.List rows={5} showAvatar />       message/notification list
 *   <Skeleton.StatCard />                       dashboard stat card
 */

const base = 'animate-pulse bg-gray-200 rounded';

function SkeletonBase({ className = '' }) {
  return <div className={`${base} ${className}`} role="presentation" aria-hidden="true" />;
}

function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`${base} h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 space-y-4 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className={`${base} w-9 h-9 rounded-lg flex-shrink-0`} />
        <div className="flex-1 space-y-2">
          <div className={`${base} h-4 w-2/3`} />
          <div className={`${base} h-3 w-1/2`} />
        </div>
      </div>
      <div className={`${base} h-2 w-full`} />
      <div className={`${base} h-2 w-4/5`} />
      <div className={`${base} h-2 w-3/5`} />
    </div>
  );
}

const AVATAR_SIZES = {
  6: 'w-6 h-6', 7: 'w-7 h-7', 8: 'w-8 h-8', 10: 'w-10 h-10', 12: 'w-12 h-12',
};

function SkeletonAvatar({ size = 8, className = '' }) {
  return (
    <div
      className={`${base} rounded-full flex-shrink-0 ${AVATAR_SIZES[size] ?? AVATAR_SIZES[8]} ${className}`}
      aria-hidden="true"
    />
  );
}

function SkeletonTableRow({ cols = 5 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`${base} h-4 max-w-[120px]`} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonList({ rows = 5, showAvatar = false, className = '' }) {
  return (
    <div className={`divide-y divide-gray-100 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          {showAvatar && <SkeletonAvatar size={8} />}
          <div className="flex-1 space-y-2">
            <div className={`${base} h-4 w-1/2`} />
            <div className={`${base} h-3 w-3/4`} />
          </div>
          <div className={`${base} h-3 w-16 flex-shrink-0`} />
        </div>
      ))}
    </div>
  );
}

function SkeletonStatCard({ className = '' }) {
  return (
    <div className={`stat-card ${className}`} aria-hidden="true">
      <div className={`${base} w-9 h-9 rounded-lg`} />
      <div className={`${base} h-7 w-16 mt-1`} />
      <div className={`${base} h-3 w-24`} />
      <div className={`${base} h-3 w-20`} />
    </div>
  );
}

const Skeleton = Object.assign(SkeletonBase, {
  Text:      SkeletonText,
  Card:      SkeletonCard,
  Avatar:    SkeletonAvatar,
  TableRow:  SkeletonTableRow,
  List:      SkeletonList,
  StatCard:  SkeletonStatCard,
});

export default Skeleton;