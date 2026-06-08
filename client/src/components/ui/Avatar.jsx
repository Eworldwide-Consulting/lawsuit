// Deterministic color from name avoids colour changes across re-renders or SSR.
const PALETTE = [
  'bg-blue-600',    'bg-violet-600', 'bg-pink-600',    'bg-orange-600',
  'bg-teal-600',    'bg-cyan-700',   'bg-emerald-600', 'bg-rose-600',
  'bg-indigo-600',  'bg-amber-600',
];

function colorFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg',
};

/**
 * Avatar — shows a user photo or deterministic-colored initials.
 *
 * Props:
 *   initials  string — 1-2 chars shown when no src
 *   src       string — photo URL
 *   name      string — used for aria-label and color derivation
 *   size      'xs' | 'sm' | 'md' | 'lg' | 'xl'
 */
export default function Avatar({ initials, src, name, size = 'md', className = '' }) {
  const sizeClass  = SIZES[size] ?? SIZES.md;
  const colorClass = colorFor(name || initials || '');
  const label      = name || initials || 'User';

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  const letters = ((initials || name || '?').toUpperCase().slice(0, 2));

  return (
    <div
      role="img"
      aria-label={label}
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none ${className}`}
    >
      {letters}
    </div>
  );
}