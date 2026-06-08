import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  success: { Icon: CheckCircle,  bar: 'bg-green-500', icon: 'text-green-500' },
  error:   { Icon: XCircle,      bar: 'bg-red-500',   icon: 'text-red-500'   },
  warning: { Icon: AlertTriangle, bar: 'bg-yellow-500', icon: 'text-yellow-500' },
  info:    { Icon: Info,         bar: 'bg-blue-500',  icon: 'text-blue-500'  },
};

const DEFAULT_DURATION = { success: 4000, info: 4000, warning: 5000, error: 6000 };
const MAX_TOASTS = 5;
let _id = 0;

// ── Single Toast Item ─────────────────────────────────────────────────────────

function ToastItem({ toast, onRemove }) {
  const cfg  = TYPE_CONFIG[toast.type] ?? TYPE_CONFIG.info;
  const Icon = cfg.Icon;

  return (
    <div
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-slideInRight"
    >
      {/* Left accent bar */}
      <div className={`w-1 self-stretch flex-shrink-0 ${cfg.bar}`} aria-hidden="true" />

      <Icon size={18} className={`flex-shrink-0 mt-3.5 ${cfg.icon}`} aria-hidden="true" />

      <div className="flex-1 min-w-0 py-3 pr-1">
        {toast.title && (
          <p className="font-semibold text-sm text-gray-900 leading-snug">{toast.title}</p>
        )}
        <p className={`text-sm text-gray-600 leading-snug ${toast.title ? 'mt-0.5' : ''}`}>
          {toast.message}
        </p>
      </div>

      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss"
        className="flex-shrink-0 p-2 mt-2 mr-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  // Clean up all timers on unmount
  useEffect(() => {
    const refs = timers.current;
    return () => Object.values(refs).forEach(clearTimeout);
  }, []);

  const add = useCallback((type, message, options = {}) => {
    const id       = ++_id;
    const duration = options.duration ?? DEFAULT_DURATION[type] ?? 4000;

    setToasts(prev => {
      const next = [...prev, { id, type, message, title: options.title ?? null }];
      return next.slice(-MAX_TOASTS); // oldest dropped when over limit
    });

    if (duration > 0) {
      timers.current[id] = setTimeout(() => remove(id), duration);
    }

    return id;
  }, [remove]);

  const toast = {
    success: (msg, opts) => add('success', msg, opts),
    error:   (msg, opts) => add('error',   msg, opts),
    warning: (msg, opts) => add('warning', msg, opts),
    info:    (msg, opts) => add('info',    msg, opts),
    dismiss: (id)        => remove(id),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div
          aria-label="Notifications"
          className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none"
        >
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onRemove={remove} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

/**
 * useToast — returns { success, error, warning, info, dismiss }.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong', { title: 'Upload failed', duration: 8000 });
 *   const id = toast.info('Processing…', { duration: 0 }); // persistent
 *   toast.dismiss(id); // manual dismiss
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}