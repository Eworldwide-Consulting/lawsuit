import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      role="group"
      aria-label="Theme switcher"
      className={`relative flex items-center p-1 rounded-xl bg-gray-100 dark:bg-gray-700/80 gap-0.5 ${className}`}
    >
      {/* sliding indicator */}
      <span
        aria-hidden="true"
        className={`absolute top-1 bottom-1 rounded-lg shadow-sm transition-all duration-200 ease-in-out
          ${isDark
            ? 'bg-gray-800 left-[calc(50%+2px)] right-1'
            : 'bg-white left-1 right-[calc(50%+2px)]'
          }`}
      />

      {/* Light button */}
      <button
        onClick={() => setTheme('light')}
        aria-pressed={!isDark}
        aria-label="Switch to light mode"
        className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500
          ${!isDark ? 'text-gray-900' : 'text-gray-400 hover:text-gray-300'}`}
      >
        <Sun size={13} strokeWidth={2.2} />
        <span className="hidden sm:inline">Light</span>
      </button>

      {/* Dark button */}
      <button
        onClick={() => setTheme('dark')}
        aria-pressed={isDark}
        aria-label="Switch to dark mode"
        className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500
          ${isDark ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
      >
        <Moon size={13} strokeWidth={2.2} />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
