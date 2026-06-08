import { forwardRef } from 'react';
import Spinner from './Spinner';

// Use complete class strings — dynamic interpolation breaks Tailwind's JIT purge.
const VARIANTS = {
  primary:   'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white border border-transparent shadow-sm',
  secondary: 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-300 shadow-sm',
  ghost:     'bg-transparent hover:bg-gray-100 active:bg-gray-200 text-gray-600 border border-transparent',
  danger:    'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white border border-transparent shadow-sm',
  outline:   'bg-transparent hover:bg-green-50 active:bg-green-100 text-green-600 border border-green-500',
  navy:      'bg-[#0f2057] hover:bg-[#1a3476] active:bg-[#0a1840] text-white border border-transparent shadow-sm',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-lg gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
};

const SPINNER_COLORS = {
  primary:   'text-white',
  secondary: 'text-gray-500',
  ghost:     'text-gray-500',
  danger:    'text-white',
  outline:   'text-green-600',
  navy:      'text-white',
};

const SPINNER_SIZES = { sm: 3, md: 4, lg: 5 };

/**
 * Button — standardized button with variants, sizes, loading and icon slots.
 *
 * Props:
 *   variant   'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'navy'
 *   size      'sm' | 'md' | 'lg'
 *   loading   bool — shows spinner and disables interaction
 *   disabled  bool
 *   leftIcon  ReactNode
 *   rightIcon ReactNode
 *   fullWidth bool
 *   as        component — renders as a different element (e.g. NavLink)
 */
export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className = '',
    as: Component = 'button',
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      disabled={Component === 'button' ? isDisabled : undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2',
        'select-none whitespace-nowrap',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        fullWidth ? 'w-full' : '',
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size={SPINNER_SIZES[size] ?? 4} color={SPINNER_COLORS[variant] ?? 'text-white'} label="Loading…" />
          {children && <span className="opacity-75">{children}</span>}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </Component>
  );
});

export default Button;