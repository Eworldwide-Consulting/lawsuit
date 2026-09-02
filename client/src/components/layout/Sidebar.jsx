import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { mattersApi } from '../../api';
import Logo from '../ui/Logo';
import {
  LayoutDashboard, FileText, Users, CreditCard,
  Calendar, BarChart2, MessageSquare, Settings, LogOut, FileCheck,
  Briefcase, CheckSquare, Folder, ClipboardList, ClipboardCheck, Scale,
} from 'lucide-react';

// Lowercase, mid-sentence phrasing for "We're here to support your ___ journey" —
// deliberately not the formal Title Case labels used elsewhere (Checklist.jsx etc).
const CASE_TYPE_PHRASE = {
  guardianship:                 'guardianship',
  conservatorship:              'conservatorship',
  guardianship_conservatorship: 'guardianship & conservatorship',
  estate_administration:        'estate administration',
};

const clientNav = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/my-case',     icon: Briefcase,       label: 'My Case' },
  { to: '/checklist',   icon: ClipboardList,   label: 'Checklist' },
  { to: '/intake-form',  icon: Scale,          label: 'Case Form' },
  { to: '/open-tasks',  icon: CheckSquare,     label: 'Tasks' },
  { to: '/documents',   icon: Folder,          label: 'Documents' },
  { to: '/appointments',icon: Calendar,        label: 'Appointments' },
  { to: '/messages',    icon: MessageSquare,   label: 'Messages' },
  { to: '/payments',    icon: CreditCard,      label: 'Billing' },
  { to: '/settings',    icon: Settings,        label: 'Settings' },
];

const attorneyNav = [
  { to: '/dashboard',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/matters',           icon: FileText,        label: 'Matters' },
  { to: '/clients',           icon: Users,           label: 'Clients' },
  { to: '/checklist-review',  icon: ClipboardCheck,  label: 'Checklist Review' },
  { to: '/documents',         icon: Folder,          label: 'Documents' },
  { to: '/appointments',      icon: Calendar,        label: 'Appointments' },
  { to: '/messages',          icon: MessageSquare,   label: 'Messages' },
  { to: '/payments',          icon: CreditCard,      label: 'Billing' },
  { to: '/legal-forms',       icon: Scale,           label: 'Legal Forms' },
  { to: '/reports',           icon: BarChart2,       label: 'Reports' },
  { to: '/settings',          icon: Settings,        label: 'Settings' },
];

const partnerNav = [
  { to: '/dashboard',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/matters',          icon: FileText,        label: 'Matters' },
  { to: '/clients',          icon: Users,           label: 'Clients' },
  { to: '/checklist-review', icon: ClipboardCheck,  label: 'Checklist Review' },
  { to: '/documents',        icon: Folder,          label: 'Documents' },
  { to: '/appointments',     icon: Calendar,        label: 'Appointments' },
  { to: '/messages',         icon: MessageSquare,   label: 'Messages' },
  { to: '/payments',         icon: CreditCard,      label: 'Billing' },
  { to: '/legal-forms',      icon: Scale,           label: 'Legal Forms' },
  { to: '/reports',          icon: BarChart2,       label: 'Reports' },
  { to: '/settings',         icon: Settings,        label: 'Settings' },
];

const itsupportNav = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users,           label: 'Users' },
  { to: '/settings',    icon: Settings,        label: 'Settings' },
];

const navByRole = { client: clientNav, attorney: attorneyNav, partner: partnerNav, itsupport: itsupportNav };

export default function Sidebar({ unreadMessages = 0, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = navByRole[user?.role] || clientNav;

  const [caseTypePhrase, setCaseTypePhrase] = useState('legal');
  useEffect(() => {
    if (user?.role !== 'client') return;
    mattersApi.list()
      .then(r => {
        const list = r.data?.matters || r.data || [];
        const phrase = CASE_TYPE_PHRASE[list[0]?.matter_type];
        if (phrase) setCaseTypePhrase(phrase);
      })
      .catch(() => {});
  }, [user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0f2057] to-[#0d1b4e] text-white w-64">
      <div className="p-5 border-b border-white/10">
        <Logo dark size="sm" />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/dashboard'}
            onClick={onClose}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Icon size={18} />
            <span>{label}</span>
            {label === 'Messages' && unreadMessages > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unreadMessages}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        {user?.role === 'client' && (
          <div className="mb-3 p-3 bg-white/10 rounded-lg text-xs text-blue-100">
            <div className="font-semibold text-white mb-1">We're here to support your {caseTypePhrase} journey.</div>
            <div className="text-blue-200">You're not alone. We're with you every step.</div>
          </div>
        )}
        {(user?.role === 'attorney' || user?.role === 'partner') && (
          <div className="mb-3 p-3 bg-white/10 rounded-lg text-xs text-blue-100">
            <div className="font-semibold text-white mb-1">Your practice. Our platform.</div>
            <div className="text-blue-200">Powering better outcomes for your clients.</div>
          </div>
        )}
        {user?.role === 'itsupport' && (
          <div className="mb-3 p-3 bg-white/10 rounded-lg text-xs text-blue-100">
            <div className="font-semibold text-white mb-1">System Administration</div>
            <div className="text-blue-200">Monitor users, approvals, and platform health.</div>
          </div>
        )}
        <button onClick={handleLogout}
          className="sidebar-link w-full text-red-300 hover:text-red-200 hover:bg-red-500/20">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
