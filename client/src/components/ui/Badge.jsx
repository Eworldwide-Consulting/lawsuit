// Complete class strings per variant — no dynamic interpolation.
const VARIANTS = {
  default: 'bg-gray-100   text-gray-600',
  success: 'bg-green-100  text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error:   'bg-red-100    text-red-800',
  info:    'bg-blue-100   text-blue-800',
  purple:  'bg-purple-100 text-purple-800',
  orange:  'bg-orange-100 text-orange-700',
  navy:    'bg-blue-950/10 text-[#0f2057]',
};

const DOT_COLORS = {
  default: 'bg-gray-400',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
  purple:  'bg-purple-500',
  orange:  'bg-orange-500',
  navy:    'bg-[#0f2057]',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-0.5 text-xs',
};

/**
 * Badge — inline status/label chip.
 *
 * Props:
 *   variant   'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'orange' | 'navy'
 *   size      'sm' | 'md'
 *   dot       bool — prepend a colored dot
 */
export default function Badge({ children, variant = 'default', size = 'md', dot = false, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        VARIANTS[variant] ?? VARIANTS.default,
        SIZES[size] ?? SIZES.md,
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[variant] ?? DOT_COLORS.default}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/**
 * Convenience: map a document/matter status string → Badge variant.
 */
export function statusVariant(status) {
  const map = {
    approved:    'success',
    active:      'success',
    completed:   'success',
    paid:        'success',
    uploaded:    'info',
    in_progress: 'info',
    pending:     'warning',
    overdue:     'error',
    rejected:    'error',
    cancelled:   'error',
    at_risk:     'error',
    draft:       'default',
  };
  return map[status] ?? 'default';
}