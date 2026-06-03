import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import {
  Shield, Lock, FileText, Calendar, MessageSquare,
  CheckCircle, Star, ArrowRight, Upload, Search,
  Users, Bell, Menu, X, Globe, Award,
  Database, Eye, Fingerprint, Check, Phone,
  Mail, BarChart2, Key,
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    ['Features',  'features'],
    ['Security',  'security'],
    ['Services',  'services'],
    ['Pricing',   'pricing'],
  ];

  return (
    <>
      {/* ── Global styles for animations ── */}
      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-18px); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 20px rgba(212,175,55,.3); }
          50%     { box-shadow: 0 0 45px rgba(212,175,55,.7); }
        }
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes counterSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        .gold-shimmer {
          background: linear-gradient(90deg,#d4af37,#f0c040,#d4af37,#c9a227);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 3s linear infinite;
        }
        .hero-grid {
          background-image:
            linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .animate-float       { animation: float 6s ease-in-out infinite; }
        .animate-pulse-glow  { animation: pulseGlow 2s ease-in-out infinite; }
        .animate-spin-slow   { animation: spinSlow 22s linear infinite; }
        .animate-cspin       { animation: counterSpin 16s linear infinite; }
        .card-lift {
          transition: transform .3s ease, box-shadow .3s ease;
        }
        .card-lift:hover {
          transform: translateY(-8px);
          box-shadow: 0 24px 64px rgba(0,0,0,.18);
        }
        .gold-ring-hover { transition: border-color .3s; }
        .gold-ring-hover:hover { border-color: #d4af37; }
      `}</style>

      <div className="min-h-screen bg-navy-950 font-sans">

        {/* ════════════════════════════════════════
            NAVBAR
        ════════════════════════════════════════ */}
        <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-navy-950/95 backdrop-blur-md shadow-lg shadow-black/20 border-b border-white/5'
            : 'bg-transparent'
        }`}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Logo dark size="md" />

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map(([label, id]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="text-blue-200 hover:text-gold-500 text-sm font-medium transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="text-blue-200 hover:text-gold-500 font-medium text-sm transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold text-sm px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-gold-500/20"
              >
                Get Started
              </button>
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-white">
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile drawer */}
          {menuOpen && (
            <div className="md:hidden bg-navy-950/98 backdrop-blur border-b border-white/10 px-6 pb-6">
              {navLinks.map(([label, id]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="block w-full text-left py-3 text-blue-200 hover:text-gold-500 font-medium border-b border-white/5 transition-colors"
                >
                  {label}
                </button>
              ))}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 border border-white/20 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="flex-1 bg-gold-500 text-navy-950 py-2.5 rounded-lg text-sm font-bold hover:bg-gold-600 transition-colors"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* ════════════════════════════════════════
            HERO
        ════════════════════════════════════════ */}
        <section className="min-h-screen hero-grid bg-navy-950 relative overflow-hidden flex flex-col justify-center pt-20">
          {/* Background orbs */}
          <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-navy-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-gold-500/8 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 bg-gold-500/10 border border-gold-500/30 rounded-full px-4 py-1.5 text-sm mb-8">
              <Shield size={14} className="text-gold-500" />
              <span className="text-gold-400 font-medium">Military-Grade Document Security</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
              Secure Your Legal<br />
              <span className="gold-shimmer">Documents.</span>{' '}Connect<br />
              with Trusted Attorneys.
            </h1>

            <p className="text-blue-200 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              All-in-one legal platform for encrypted storage, AI-assisted review, and seamless attorney consultation — built for privacy-first legal compliance.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <button
                onClick={() => navigate('/register')}
                className="group flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold px-8 py-4 rounded-xl transition-all shadow-2xl shadow-gold-500/30 hover:shadow-gold-500/50 hover:scale-105"
              >
                Get Started Free
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/register')}
                className="group flex items-center justify-center gap-2 border border-white/20 hover:border-gold-500/50 text-white hover:text-gold-400 font-medium px-8 py-4 rounded-xl transition-all hover:bg-gold-500/5"
              >
                <Calendar size={18} />
                Book a Lawyer
              </button>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-blue-300">
              {[
                { icon: Lock,         label: '256-bit SSL' },
                { icon: Shield,       label: 'End-to-End Encrypted' },
                { icon: Award,        label: 'GDPR Compliant' },
                { icon: CheckCircle,  label: 'SOC 2 Type II' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={14} className="text-gold-500" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll cue */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-blue-400 text-xs animate-bounce pointer-events-none select-none">
            <span>Scroll to explore</span>
            <div className="w-px h-8 bg-gradient-to-b from-blue-400 to-transparent" />
          </div>
        </section>

        {/* ════════════════════════════════════════
            HOW IT WORKS
        ════════════════════════════════════════ */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-block bg-navy-50 text-navy-500 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
                How It Works
              </div>
              <h2 className="text-4xl font-bold text-navy-950 mb-4">From Document to Resolution</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                Four simple steps to secure, review, and resolve your legal matters.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-[2.75rem] left-[calc(12.5%+2rem)] right-[calc(12.5%+2rem)] h-px bg-gradient-to-r from-gold-500/20 via-gold-500 to-gold-500/20" />

              {[
                { step: '01', icon: Upload,       title: 'Upload',  desc: 'Securely upload your legal documents with end-to-end encryption.', iconCls: 'text-blue-600 bg-blue-50' },
                { step: '02', icon: Search,       title: 'Review',  desc: 'Our attorneys and AI review your documents for completeness.',     iconCls: 'text-gold-600 bg-gold-50'  },
                { step: '03', icon: Users,        title: 'Connect with your Trusted Attorney', desc: 'Book a consultation with you qualified, trusted attorney in your area.', iconCls: 'text-green-600 bg-green-50' },
                { step: '04', icon: CheckCircle,  title: 'Resolve', desc: 'Track progress and close your matter with full documentation.',    iconCls: 'text-purple-600 bg-purple-50' },
              ].map(({ step, icon: Icon, title, desc, iconCls }) => (
                <div key={step} className="text-center card-lift">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-gray-100 bg-white relative z-10 ${iconCls}`}>
                    <Icon size={26} />
                  </div>
                  <div className="text-xs font-bold text-gold-500 mb-2">{step}</div>
                  <h3 className="text-lg font-bold text-navy-950 mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            SERVICES
        ════════════════════════════════════════ */}
        <section id="services" className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-block bg-gold-500/10 text-gold-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
                Our Services
              </div>
              <h2 className="text-4xl font-bold text-navy-950 mb-4">Everything Legal, In One Place</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                Comprehensive tools for every stage of your legal journey.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: Database,
                  title: 'Secure Document Vault',
                  desc: 'Store, organise, and access all your legal documents with military-grade AES-256 encryption. Smart folders, version control, and instant search.',
                  features: ['End-to-end encrypted', 'Unlimited storage', 'Version history', 'Smart organisation'],
                  grad: 'from-navy-950 to-navy-500',
                  iconBg: 'bg-blue-500/20 text-blue-400',
                },
                {
                  icon: FileText,
                  title: 'Legal Document Review',
                  desc: 'AI-assisted analysis combined with qualified attorney review. Get actionable feedback on contracts, agreements, and filings within 24 hours.',
                  features: ['AI-powered insights', 'Attorney review', 'Risk flagging', '24 hr turnaround'],
                  grad: 'from-navy-500 to-navy-800',
                  iconBg: 'bg-gold-500/20 text-gold-400',
                },
                {
                  icon: Calendar,
                  title: 'Attorney Booking & Scheduling',
                  desc: 'Find and book consultations with certified attorneys. Real-time availability, video conferencing, and automated reminders included.',
                  features: ['Real-time availability', 'Video consultations', 'Auto reminders', 'Instant confirmation'],
                  grad: 'from-navy-900 to-navy-600',
                  iconBg: 'bg-green-500/20 text-green-400',
                },
                {
                  icon: MessageSquare,
                  title: 'Encrypted Client Communication',
                  desc: 'Secure messaging between clients and attorneys — encrypted chat, document sharing, follow-up tracking, and case status notifications.',
                  features: ['Encrypted messaging', 'File sharing', 'Follow-up tracking', 'Case notifications'],
                  grad: 'from-[#150e4a] to-navy-500',
                  iconBg: 'bg-purple-500/20 text-purple-400',
                },
              ].map(({ icon: Icon, title, desc, features, grad, iconBg }) => (
                <div
                  key={title}
                  className={`bg-gradient-to-br ${grad} rounded-2xl p-8 text-white card-lift gold-ring-hover border border-white/10`}
                >
                  <div className={`w-14 h-14 rounded-xl ${iconBg} flex items-center justify-center mb-6`}>
                    <Icon size={28} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{title}</h3>
                  <p className="text-blue-200 text-sm leading-relaxed mb-6">{desc}</p>
                  <ul className="grid grid-cols-2 gap-2">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-blue-100">
                        <span className="w-4 h-4 rounded-full bg-gold-500/20 flex items-center justify-center flex-shrink-0">
                          <Check size={10} className="text-gold-400" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            SECURITY
        ════════════════════════════════════════ */}
        <section id="security" className="py-24 bg-navy-950 text-white overflow-hidden">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Copy */}
              <div>
                <div className="inline-block bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  Security First
                </div>
                <h2 className="text-4xl font-bold mb-6 leading-tight">
                  Your Legal Data Protected<br />
                  <span className="gold-shimmer">At Every Layer</span>
                </h2>
                <p className="text-blue-200 text-lg leading-relaxed mb-8">
                  We employ bank-level security protocols to ensure your most sensitive legal documents remain private, accessible only to you and authorised parties.
                </p>

                <div className="space-y-3">
                  {[
                    { icon: Lock,        title: 'AES-256 Encryption',          desc: 'All documents encrypted at rest and in transit' },
                    { icon: Fingerprint, title: 'Zero-Knowledge Architecture', desc: 'We never access your unencrypted data' },
                    { icon: Eye,         title: 'Full Audit Trail',            desc: 'Complete log of every document access and change' },
                    { icon: Shield,      title: 'Multi-Factor Authentication', desc: 'TOTP-based 2FA protecting every account' },
                    { icon: Globe,       title: 'GDPR & Compliance Ready',     desc: 'Built to meet global privacy regulations' },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div
                      key={title}
                      className="flex items-start gap-4 p-4 rounded-xl border border-white/5 hover:border-gold-500/30 hover:bg-white/5 transition-all"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={20} className="text-gold-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{title}</div>
                        <div className="text-blue-300 text-sm">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Orbital visualisation */}
              <div className="flex flex-col items-center gap-12">
                <div className="relative w-72 h-72">
                  {/* Rings */}
                  <div className="absolute inset-0 rounded-full border border-dashed border-gold-500/20 animate-spin-slow" />
                  <div className="absolute inset-8 rounded-full border border-dashed border-blue-500/30 animate-cspin" />

                  {/* Centre */}
                  <div className="absolute inset-[4.5rem] rounded-full bg-gradient-to-br from-navy-500 to-navy-950 border border-gold-500/40 flex items-center justify-center animate-pulse-glow">
                    <Lock size={44} className="text-gold-500" />
                  </div>

                  {/* Orbiting nodes */}
                  {[
                    { Icon: Shield, top: '4%',  left: '50%',  label: 'Shield'  },
                    { Icon: Key,    top: '50%', left: '96%',  label: 'Key'     },
                    { Icon: Eye,    top: '96%', left: '50%',  label: 'Audit'   },
                    { Icon: Users,  top: '50%', left: '4%',   label: 'Access'  },
                  ].map(({ Icon, top, left, label }) => (
                    <div
                      key={label}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-navy-800 border border-gold-500/30 flex items-center justify-center"
                      style={{ top, left }}
                    >
                      <Icon size={20} className="text-gold-400" />
                    </div>
                  ))}
                </div>

                {/* Compliance badges */}
                <div className="flex flex-wrap justify-center gap-2">
                  {['AES-256', 'GDPR', 'SOC 2', '2FA', 'TLS 1.3'].map(b => (
                    <span key={b} className="bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold px-3 py-1 rounded-full">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            DASHBOARD PREVIEW
        ════════════════════════════════════════ */}
        <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-block bg-navy-50 text-navy-500 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
                Client Portal
              </div>
              <h2 className="text-4xl font-bold text-navy-950 mb-4">Your Legal Command Center</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                A unified dashboard to manage cases, documents, appointments, and communications.
              </p>
            </div>

            {/* Browser mockup */}
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-navy-950/20 border border-gray-200">
              {/* Chrome bar */}
              <div className="bg-gray-100 px-4 py-3 flex items-center gap-3 border-b border-gray-200">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 flex items-center gap-2">
                  <Lock size={10} className="text-green-500" />
                  app.trivanta.com/dashboard
                </div>
              </div>

              {/* App shell */}
              <div className="bg-navy-950 flex" style={{ minHeight: 480 }}>
                {/* Sidebar */}
                <div className="w-52 bg-navy-900 border-r border-white/5 p-4 hidden sm:flex flex-col gap-1 flex-shrink-0">
                  <div className="mb-6">
                    <Logo dark size="sm" />
                  </div>
                  {[
                    { icon: BarChart2,    label: 'Dashboard',    active: true,  badge: null },
                    { icon: FileText,     label: 'Documents',    active: false, badge: null },
                    { icon: Calendar,     label: 'Appointments', active: false, badge: null },
                    { icon: MessageSquare,label: 'Messages',     active: false, badge: '3'  },
                    { icon: Bell,         label: 'Reminders',    active: false, badge: null },
                    { icon: Users,        label: 'My Attorney',  active: false, badge: null },
                  ].map(({ icon: Icon, label, active, badge }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer ${
                        active ? 'bg-gold-500/10 text-gold-400' : 'text-blue-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon size={15} />
                      <span>{label}</span>
                      {badge && (
                        <span className="ml-auto bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                          {badge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Main area */}
                <div className="flex-1 p-6 overflow-hidden">
                  {/* Top bar */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-white font-bold text-lg">Good morning, Sarah</div>
                      <div className="text-blue-300 text-sm">Your case is 74% ready · 3 tasks pending</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                        <Bell size={14} className="text-gold-400" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                        S
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: 'Case Readiness',   value: '74%',   color: 'text-green-400'  },
                      { label: 'Documents',         value: '12/16', color: 'text-gold-400'   },
                      { label: 'Next Appointment',  value: 'May 22',color: 'text-blue-400'   },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="text-blue-300 text-xs mb-1">{label}</div>
                        <div className={`font-bold text-lg ${color}`}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Document list */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-white font-semibold text-sm mb-3 flex items-center justify-between">
                      Recent Documents
                      <span className="text-gold-400 text-xs cursor-pointer">View all →</span>
                    </div>
                    {[
                      { name: 'Incorporation_Agreement_v2.pdf', status: 'Under Review', sc: 'text-yellow-400 bg-yellow-400/10', size: '2.4 MB' },
                      { name: 'Articles_of_Association.pdf',    status: 'Approved',     sc: 'text-green-400  bg-green-400/10',  size: '1.1 MB' },
                      { name: 'Shareholder_Register.xlsx',      status: 'Pending',      sc: 'text-blue-400   bg-blue-400/10',   size: '890 KB' },
                    ].map(({ name, status, sc, size }) => (
                      <div key={name} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                        <div className="w-8 h-8 bg-gold-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText size={14} className="text-gold-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs font-medium truncate">{name}</div>
                          <div className="text-blue-400 text-xs">{size}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sc}`}>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            PRICING
        ════════════════════════════════════════ */}
        <section id="pricing" className="py-24 bg-navy-950 text-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-block bg-gold-500/10 border border-gold-500/30 text-gold-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
                Pricing
              </div>
              <h2 className="text-4xl font-bold mb-4">Transparent, Fair Pricing</h2>
              <p className="text-blue-200 text-lg max-w-xl mx-auto">Start with a free consultation and scale as your needs grow.</p>
            </div>


            <div className="grid md:grid-cols-3 gap-6 items-start">
              {[
                {
                  name: 'Starter',
                  price: '$149',
                  originalPrice: null,
                  period: '/month',
                  badge: null,
                  desc: 'Perfect for individuals with simple legal needs.',
                  features: ['3 consultations/month', '2 GB document storage', 'Basic document review', 'Email support', 'Secure messaging', 'Case tracking dashboard'],
                  cta: 'Get Started',
                  hot: false,
                  sale: false,
                },
                {
                  name: 'Professional',
                  price: '$249',
                  originalPrice: null,
                  period: '/month',
                  badge: null,
                  desc: 'For individuals and small businesses with ongoing legal matters.',
                  features: ['Unlimited consultations', '10 GB encrypted storage', 'AI + attorney review', '24 hr response SLA', 'Priority support', 'Case tracking dashboard', 'Multi-factor auth'],
                  cta: 'Get Started',
                  hot: true,
                  sale: false,
                },
                {
                  name: 'Enterprise',
                  price: 'Custom',
                  originalPrice: null,
                  period: 'pricing',
                  badge: null,
                  desc: 'For law firms and large organisations with complex needs.',
                  features: ['Unlimited everything', 'Custom integrations', 'Dedicated attorney team', 'White-label options', 'SLA guarantees', 'Compliance reporting', 'API access'],
                  cta: 'Contact Sales',
                  hot: false,
                  sale: false,
                },
              ].map(({ name, price, originalPrice, period, badge, desc, features, cta, hot, sale }) => (
                <div
                  key={name}
                  className={`rounded-2xl p-8 border card-lift relative ${
                    hot
                      ? 'bg-gradient-to-b from-navy-500 to-navy-900 border-gold-500 shadow-2xl shadow-gold-500/10 md:-mt-4'
                      : 'bg-navy-900 border-white/10'
                  }`}
                >
                  {hot && (
                    <div className="text-center mb-4">
                      <span className="bg-gold-500 text-navy-950 text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                    </div>
                  )}
                  {sale && (
                    <div className="absolute -top-3 right-5">
                      <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                        🔥 Seasonal Sale
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <div className="text-blue-300 text-sm font-semibold mb-1">{name}</div>
                    <div className="flex items-baseline gap-2">
                      {originalPrice && (
                        <span className="text-xl text-blue-400 line-through opacity-60">{originalPrice}</span>
                      )}
                      <span className={`text-4xl font-bold ${hot ? 'text-gold-400' : 'text-white'}`}>{price}</span>
                      <span className="text-blue-300 text-sm">{period}</span>
                    </div>
                    {badge && (
                      <div className="mt-2 inline-flex items-center gap-1 bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-semibold px-3 py-1 rounded-full">
                        {badge} · Use code <span className="text-white font-bold ml-1">SAVE20</span>
                      </div>
                    )}
                    <p className="text-blue-300 text-sm mt-2">{desc}</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm text-blue-100">
                        <CheckCircle size={16} className={hot ? 'text-gold-400' : 'text-green-400'} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => navigate('/register')}
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${
                      hot
                        ? 'bg-gold-500 text-navy-950 hover:bg-gold-600'
                        : 'border border-white/20 text-white hover:bg-white/5'
                    }`}
                  >
                    {cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            TESTIMONIALS
        ════════════════════════════════════════ */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-block bg-navy-50 text-navy-500 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
                Testimonials
              </div>
              <h2 className="text-4xl font-bold text-navy-950 mb-4">Trusted by Legal Professionals</h2>
              <p className="text-gray-500 text-lg">What clients and attorneys say about TriVanta.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  quote: 'TriVanta has completely transformed how I manage client documents. The encryption features give both me and my clients complete peace of mind.',
                  name: 'Sarah Okonkwo',
                  role: 'Corporate Attorney, Lagos',
                },
                {
                  quote: "Booking consultations and tracking my case progress is effortless. I always know exactly where things stand and what's needed next.",
                  name: 'Michael Adeyemi',
                  role: 'Business Client',
                },
                {
                  quote: "The AI document review saved us hours of prep work. Combined with secure messaging, it's the most complete legal platform I've used in 15 years.",
                  name: 'Amaka Nwosu',
                  role: 'Senior Partner, Nwosu & Associates',
                },
              ].map(({ quote, name, role }) => (
                <div key={name} className="bg-white rounded-2xl p-8 shadow-md border border-gray-100 card-lift">
                  <div className="flex gap-1 mb-4">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={15} className="text-gold-500 fill-gold-500" />
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6 italic">"{quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-500 to-navy-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-navy-950 text-sm">{name}</div>
                      <div className="text-gray-400 text-xs">{role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            FINAL CTA
        ════════════════════════════════════════ */}
        <section className="py-24 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-500 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 hero-grid opacity-30 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent" />

          <div className="relative z-10 max-w-3xl mx-auto px-6">
            <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
              <Shield size={32} className="text-gold-500" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Start Securing Your<br />
              <span className="gold-shimmer">Legal Documents Today</span>
            </h2>
            <p className="text-blue-200 text-lg mb-10 max-w-xl mx-auto">
              Join thousands of clients and attorneys who trust TriVanta for secure, efficient legal services.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/register')}
                className="group flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold px-10 py-4 rounded-xl transition-all shadow-2xl shadow-gold-500/30 hover:scale-105"
              >
                Get Started Free
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center justify-center gap-2 border border-white/20 hover:border-gold-500/50 text-white hover:text-gold-400 font-medium px-10 py-4 rounded-xl transition-all"
              >
                Sign In to Dashboard
              </button>
            </div>

            <p className="text-blue-400 text-sm mt-6 flex items-center justify-center gap-2">
              <Lock size={12} />
              No credit card required · Free consultation included · Cancel anytime
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════
            FOOTER
        ════════════════════════════════════════ */}
        <footer className="bg-[#04091e] text-gray-400 pt-16 pb-8 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-10 mb-12">
              {/* Brand */}
              <div className="md:col-span-2">
                <Logo dark size="md" />
                <p className="text-sm leading-relaxed mt-4 max-w-xs">
                  TriVanta Legal Compliance Platform — secure document storage, expert attorney consultation, and AI-powered legal review in one place.
                </p>
                <div className="flex items-center gap-2 mt-4 text-xs">
                  <Lock size={12} className="text-gold-500" />
                  <span className="text-gold-400">End-to-End Encrypted Platform</span>
                </div>
              </div>

              {/* Services */}
              <div>
                <div className="text-white font-semibold text-sm mb-4">Services</div>
                <ul className="space-y-2.5 text-sm">
                  {['Document Vault', 'Legal Review', 'Attorney Booking', 'Client Dashboard', 'Secure Messaging'].map(item => (
                    <li key={item}>
                      <button onClick={() => navigate('/register')} className="hover:text-gold-400 transition-colors text-left">
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company + Contact */}
              <div>
                <div className="text-white font-semibold text-sm mb-4">Company</div>
                <ul className="space-y-2.5 text-sm mb-6">
                  {['About Us', 'Privacy Policy', 'Terms of Service', 'Security'].map(item => (
                    <li key={item}>
                      <button className="hover:text-gold-400 transition-colors text-left">{item}</button>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Mail size={11} />
                    <span>legal@trivanta.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={11} />
                    <span>+234 800 TRIVANTA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
              <div>© {new Date().getFullYear()} TriVanta Legal Compliance. All rights reserved.</div>
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5"><Shield size={10} className="text-gold-500" /> SOC 2 Type II</span>
                <span className="flex items-center gap-1.5"><Lock size={10} className="text-gold-500" /> AES-256</span>
                <span className="flex items-center gap-1.5"><Award size={10} className="text-gold-500" /> GDPR Ready</span>
              </div>
              <div className="text-gray-600 text-xs text-center md:text-right max-w-xs">
                Legal disclaimer: TriVanta provides a technology platform. Content is not legal advice.
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
