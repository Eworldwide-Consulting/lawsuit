import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SIZES = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-4xl',
};

const FOCUSABLE = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Modal — accessible dialog with focus trap, ESC key, scroll lock, and portal rendering.
 *
 * Props:
 *   open            bool
 *   onClose         () => void
 *   title           string
 *   description     string
 *   size            'sm' | 'md' | 'lg' | 'xl' | 'full'
 *   closeOnBackdrop bool (default true)
 *   showCloseButton bool (default true)
 *   footer          ReactNode — rendered in a sticky footer row
 *   children        ReactNode — scrollable body
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  showCloseButton = true,
  children,
  footer,
}) {
  const dialogRef      = useRef(null);
  const previousFocus  = useRef(null);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    const el = dialogRef.current;
    if (!el) return;

    const getFocusable = () => [...el.querySelectorAll(FOCUSABLE)].filter(n => !n.disabled);
    setTimeout(() => (getFocusable()[0] || el).focus(), 0);

    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (!nodes.length) { e.preventDefault(); return; }
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      previousFocus.current?.focus();
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-desc' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={[
          'relative w-full bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]',
          'focus:outline-none animate-slideUp',
          SIZES[size] ?? SIZES.md,
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
            <div>
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-gray-900 leading-snug">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="text-sm text-gray-500 mt-0.5">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="ml-4 flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-4 border-t border-gray-100 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}