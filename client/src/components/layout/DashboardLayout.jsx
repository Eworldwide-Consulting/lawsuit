import { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { messagesApi } from '../../api';
import { Bell, Menu, X, Search, LayoutDashboard, FileText, Folder, Calendar, MessageSquare, Settings } from 'lucide-react';
import TwoFASetupModal from '../ui/TwoFASetupModal';

export default function DashboardLayout({ children }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [show2FA, setShow2FA] = useState(false);
  const navigate = useNavigate();

  // Attorneys and partners must enable 2FA — popup reappears every session until done.
  // Clients see it once; if skipped it never shows again.
  useEffect(() => {
    if (!user) return;
    const isMandatory = user.role === 'attorney' || user.role === 'partner';
    const shouldShow = isMandatory
      ? !user.two_fa_enabled
      : !user.two_fa_enabled && !user.two_fa_prompt_shown;
    if (shouldShow) {
      const t = setTimeout(() => setShow2FA(true), 1500);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  useEffect(() => {
    messagesApi.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    const interval = setInterval(() => {
      messagesApi.unreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const mobileClientNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/my-case', icon: FileText, label: 'Case' },
    { to: '/documents', icon: Folder, label: 'Docs' },
    { to: '/appointments', icon: Calendar, label: 'Appts' },
    { to: '/messages', icon: MessageSquare, label: 'Messages' },
  ];

  const mobileStaffNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/matters', icon: FileText, label: 'Matters' },
    { to: '/documents', icon: Folder, label: 'Docs' },
    { to: '/appointments', icon: Calendar, label: 'Appts' },
    { to: '/messages', icon: MessageSquare, label: 'Messages' },
  ];

  const mobileNav = user?.role === 'client' ? mobileClientNav : mobileStaffNav;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar unreadMessages={unread} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-shrink-0">
            <Sidebar unreadMessages={unread} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center gap-3 safe-top flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
            <Menu size={20} />
          </button>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input placeholder="Search matters, clients, documents..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50" />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-gray-100">
              <Bell size={20} className="text-gray-600" />
              {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
            </button>

            <button onClick={() => navigate('/settings')}
              className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors">
              <div className="w-8 h-8 bg-navy-900 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {user?.avatar_initials || user?.first_name?.[0]}
              </div>
              <div className="hidden md:block text-right">
                <div className="text-sm font-medium text-gray-800">{user?.first_name} {user?.last_name}</div>
                <div className="text-xs text-gray-500 capitalize">{user?.role === 'partner' ? 'Managing Partner' : user?.role === 'attorney' ? 'Attorney at Law' : 'Client'}</div>
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
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 mobile-nav z-40">
          <div className="flex items-center justify-around px-2 pt-2">
            {mobileNav.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/dashboard'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${isActive ? 'text-green-600' : 'text-gray-500'}`
                }>
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <Icon size={22} className={isActive ? 'text-green-600' : 'text-gray-400'} />
                      {label === 'Messages' && unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{unread}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium ${isActive ? 'text-green-600' : 'text-gray-500'}`}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      {show2FA && (
        <TwoFASetupModal
          onClose={() => setShow2FA(false)}
          mandatory={user?.role === 'attorney' || user?.role === 'partner'}
        />
      )}
    </div>
  );
}
