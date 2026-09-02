import Button from './Button';

const SIZES = {
  sm: { icon: 24, title: 'text-sm',   desc: 'text-xs',  wrapper: 'py-8'  },
  md: { icon: 40, title: 'text-base', desc: 'text-sm',  wrapper: 'py-12' },
  lg: { icon: 56, title: 'text-lg',   desc: 'text-base', wrapper: 'py-20' },
};

/**
 * EmptyState — consistent zero-data placeholder.
 *
 * Props:
 *   icon        Lucide icon component
 *   title       string
 *   description string
 *   action      { label, onClick, icon? } | ReactNode
 *   size        'sm' | 'md' | 'lg'
 *   className   string
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}) {
  const s = SIZES[size] ?? SIZES.md;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${s.wrapper} ${className}`}
      role="status"
      aria-label={title || 'No data'}
    >
      {Icon && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-full inline-flex">
          <Icon size={s.icon} className="text-gray-300 dark:text-gray-500" aria-hidden="true" />
        </div>
      )}

      {title && (
        <p className={`font-semibold text-gray-700 dark:text-gray-200 ${s.title}`}>{title}</p>
      )}

      {description && (
        <p className={`text-gray-400 dark:text-gray-500 mt-1.5 max-w-xs ${s.desc}`}>{description}</p>
      )}

      {action && (
        <div className="mt-5">
          {action.onClick ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={action.onClick}
              leftIcon={action.icon ? <action.icon size={14} /> : undefined}
            >
              {action.label}
            </Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}