// Complete class map — dynamic `h-${size}` breaks Tailwind's JIT scanner.
const SIZE_CLASSES = {
  3:  'h-3 w-3',
  4:  'h-4 w-4',
  5:  'h-5 w-5',
  6:  'h-6 w-6',
  7:  'h-7 w-7',
  8:  'h-8 w-8',
  10: 'h-10 w-10',
  12: 'h-12 w-12',
  16: 'h-16 w-16',
};

export default function Spinner({
  size = 5,
  color = 'text-green-500',
  label = 'Loading…',
  className = '',
}) {
  return (
    <svg
      role="status"
      aria-label={label}
      className={`animate-spin ${SIZE_CLASSES[size] ?? SIZE_CLASSES[5]} ${color} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}