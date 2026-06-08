import { useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell, X, CheckCheck,
  MessageSquare, FileText, CheckSquare,
  Briefcase, DollarSign, Info,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';

// Icon + colour per notification type
const TYPE_CFG = {
  new_message:          { Icon: MessageSquare, cls: 'bg-blue-100   text-blue-600'   },
  document_reviewed:    { Icon: FileText,      cls: 'bg-orange-100 text-orange-600' },
  task_assigned:        { Icon: CheckSquare,   cls: 'bg-purple-100 text-purple-600' },
  task_due_soon:        { Icon: CheckSquare,   cls: 'bg-yellow-100 text-yellow-600' },
  appointment_reminder: { Icon: Bell,          cls: 'bg-teal-100   text-teal-600'   },
  matter_updated:       { Icon: Briefcase,     cls: 'bg-green-100  text-green-600'  },
  invoice_created:      { Icon: DollarSign,    cls: 'bg-indigo-100 text-indigo-600' },
  invoice_paid:         { Icon: DollarSign,    cls: 'bg-green-100  text-green-600'  },
};

const FALLBACK_CFG = { Icon: Info, cls: 'bg-gray-100 text-gray-500' };

/**
 * NotificationPanel — dropdown anchored to the bell icon in the header.
 *
 * Props:
 *   open    bool
 *   onClose () => void
 *   socket  Socket.io socket instance for real-time updates
 */
export default function NotificationPanel({ open, onClose, socket }) {
  const panelRef = useRef(null);
  const { notifications, unreadCount, loading, markRead, markAllRead } =
    useNotifications({ socket });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    // setTimeout avoids catching the click that opened the panel
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [open, onClose]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifications"
        className={[
          'absolute right-0 top-full mt-2 z-40',
          'w-96 max-w-[calc(100vw-1rem)] max-h-[min(600px,calc(100vh-6rem))]',
          'bg-white rounded-2xl shadow-2xl border border-gray-100',
          'flex flex-col overflow-hidden animate-slideUp',
        ].join(' ')}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-gray-600" aria-hidden="true" />
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread`}
                className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck size={13} aria-hidden="true" /> Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <Skeleton.List rows={6} showAvatar className="p-1" />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="All caught up"
              description="You have no notifications yet."
              size="sm"
            />
          ) : (
            notifications.map((notif) => {
              const cfg    = TYPE_CFG[notif.type] ?? FALLBACK_CFG;
              const Icon   = cfg.Icon;
              const unread = !notif.read_at;

              return (
                <button
                  key={notif.id}
                  onClick={() => unread && markRead(notif.id)}
                  className={[
                    'w-full flex items-start gap-3 px-4 py-3 text-left',
                    'hover:bg-gray-50 transition-colors',
                    'border-b border-gray-50 last:border-0',
                    unread ? 'bg-blue-50/40' : '',
                  ].join(' ')}
                >
                  {/* Type icon */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.cls}`}
                    aria-hidden="true"
                  >
                    <Icon size={14} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.body}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {unread && (
                    <span
                      className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"
                      aria-label="Unread"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 flex-shrink-0 text-center">
            <p className="text-xs text-gray-400">
              Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </>
  );
}