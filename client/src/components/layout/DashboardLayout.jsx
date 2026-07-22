import { useState, useEffect, useRef } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { messagesApi } from '../../api';
import { Bell, Menu, Search, LayoutDashboard, FileText, Folder, Calendar, MessageSquare, ClipboardList } from 'lucide-react';
import TwoFASetupModal from '../ui/TwoFASetupModal';
import ProfileCompletionModal from '../ui/ProfileCompletionModal';
import NotificationPanel from '../notifications/NotificationPanel';
import Avatar from '../ui/Avatar';
import ThemeToggle from '../ui/ThemeToggle';

export default function DashboardLayout({ children }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [unreadMsg, setUnreadMsg]           = useState(0);
  const [unreadNotif, setUnreadNotif]       = useState(0);
  const [notifOpen, setNotifOpen]           = useState(false);
  const [show2FA, setShow2FA]               = useState(false);
  const [showProfileComplete, setShowProfileComplete] = useState(false);
  const navigate   = useNavigate();
  const socketRef  = useRef(null);
  const bellRef    = useRef(null);

  // Profile completion prompt for new Google-registered clients
  useEffect(() => {
    if (!user || user.role !== 'client') return;
    if (sessionStorage.getItem('lp_needs_profile') === '1') {
      const t = setTimeout(() => setShowProfileComplete(true), 800);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  // 2FA prompt — optional for all roles; shown once if not yet set up and not dismissed
  useEffect(() => {
    if (!user) return;
    if (showProfileComplete) return; // don't stack modals
    const shouldShow = !user.two_fa_enabled && !user.two_fa_prompt_shown;
    if (!shouldShow) return;
    const t = setTimeout(() => setShow2FA(true), 1500);
    return () => clearTimeout(t);
  }, [user?.id, showProfileComplete]);

  // WebSocket — message count + notification count
  useEffect(() => {
    const refreshUnreadMsg = () => messagesApi.unreadCount().then(r => setUnreadMsg(r.data.count)).catch(() => {});
    refreshUnreadMsg();

    const token  = localStorage.getItem('lp_token');
    const socket = io({ auth: { token }, transports: ['websocket'], reconnectionDelay: 2000 });
    socketRef.current = socket;

    socket.on('message:new',      ()      => setUnreadMsg(n => n + 1));
    socket.on('notification:new', ()      => setUnreadNotif(n => n + 1));
    socket.on('invoice:paid',     ()      => {}); // panels handle their own state

    // The Messages page marks messages read locally (it doesn't own this
    // badge's state) — it dispatches this event so the count re-syncs here.
    window.addEventListener('lp:messages-read', refreshUnreadMsg);

    return () => {
      socket.disconnect(); socketRef.current = null;
      window.removeEventListener('lp:messages-read', refreshUnreadMsg);
    };
  }, []);

  const mobileClientNav = [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Home'      },
    { to: '/my-case',      icon: FileText,        label: 'Case'      },
    { to: '/checklist',    icon: ClipboardList,   label: 'Checklist' },
    { to: '/documents',    icon: Folder,          label: 'Docs'      },
    { to: '/messages',     icon: MessageSquare,   label: 'Messages'  },
  ];

  const mobileStaffNav = [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Home'     },
    { to: '/matters',      icon: FileText,        label: 'Matters'  },
    { to: '/documents',    icon: Folder,          label: 'Docs'     },
    { to: '/appointments', icon: Calendar,        label: 'Appts'    },
    { to: '/messages',     icon: MessageSquare,   label: 'Messages' },
  ];

  const mobileNav = user?.role === 'client' ? mobileClientNav : mobileStaffNav;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar unreadMessages={unreadMsg} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-shrink-0">
            <Sidebar unreadMessages={unreadMsg} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Top header ── */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-3 flex items-center gap-3 safe-top flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                placeholder="Search matters, clients, documents…"
                aria-label="Search"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {/* Notification bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                aria-label={`Notifications${unreadNotif > 0 ? `, ${unreadNotif} unread` : ''}`}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                <Bell size={20} className="text-gray-600" />
                {unreadNotif > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5"
                  >
                    {unreadNotif > 99 ? '99+' : unreadNotif}
                  </span>
                )}
              </button>

              {/* NotificationPanel anchored below the bell */}
              <NotificationPanel
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                socket={socketRef.current}
              />
            </div>

            {/* User menu */}
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              aria-label="Account settings"
            >
              <Avatar
                initials={user?.avatar_initials || `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`}
                name={`${user?.first_name} ${user?.last_name}`}
                size="md"
              />
              <div className="hidden md:block text-right">
                <div className="text-sm font-medium text-gray-800 leading-tight">
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-xs text-gray-500 capitalize leading-tight">
                  {user?.role === 'partner'   ? 'Managing Partner'
                   : user?.role === 'attorney' ? 'Attorney at Law'
                   : user?.role === 'itsupport' ? 'IT Support'
                   : 'Client'}
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="page-transition">
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mobile-nav z-40"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-around px-2 pt-2">
            {mobileNav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${isActive ? 'text-green-600' : 'text-gray-500'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <Icon size={22} className={isActive ? 'text-green-600' : 'text-gray-400'} />
                      {label === 'Messages' && unreadMsg > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                          {unreadMsg > 9 ? '9+' : unreadMsg}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      {showProfileComplete && (
        <ProfileCompletionModal onClose={() => setShowProfileComplete(false)} />
      )}

      {show2FA && (
        <TwoFASetupModal
          onClose={() => setShow2FA(false)}
          mandatory={false}
        />
      )}
    </div>
  );
}