import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import ContactSalesModal from '../components/ui/ContactSalesModal';
import {
  Shield, Lock, FileText, Calendar, MessageSquare,
  CheckCircle, Star, ArrowRight, Upload, Search,
  Users, Bell, Menu, X, Globe, Award,
  Database, Eye, Fingerprint, Check, Phone,
  Mail, BarChart2, Key, ChevronDown, Zap,
  TrendingUp, Clock, Scale, MapPin,
} from 'lucide-react';

// All 50 states + DC — used by the nationwide-coverage marquee below the hero.
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia',
];

export default function Landing() {
  const navigate  = useNavigate();
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [faqOpen,       setFaqOpen]       = useState(null);
  const [salesModal,    setSalesModal]    = useState(false);
  const [salesPlan,     setSalesPlan]     = useState('Enterprise');
  const [statsVisible,  setStatsVisible]  = useState(false);
  const heroRef     = useRef(null);
  const servicesRef = useRef(null);
  const statsRef    = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('srv-in'); }),
      { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    );
    servicesRef.current?.querySelectorAll('.srv-card').forEach(c => io.observe(c));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); io.disconnect(); } },
      { threshold: 0.2 }
    );
    if (statsRef.current) io.observe(statsRef.current);
    return () => io.disconnect();
  }, []);

  // ── Nationwide coverage marquee ───────────────────────
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // ── Why TriVanta reveal (numbered list + reach panel) ─
  const impactRef = useRef(null);
  const [impactVisible, setImpactVisible] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setImpactVisible(true); io.disconnect(); } },
      { threshold: 0.25 }
    );
    if (impactRef.current) io.observe(impactRef.current);
    return () => io.disconnect();
  }, []);

  const onSrvMove = (e) => {
    const el = e.currentTarget;
    if (!el.classList.contains('srv-in')) return;
    const r  = el.getBoundingClientRect();
    const rx = ((e.clientX - r.left) / r.width  - .5) * 14;
    const ry = ((e.clientY - r.top)  / r.height - .5) * -14;
    el.style.transition = 'opacity .68s cubic-bezier(.22,1,.36,1), transform .13s ease, box-shadow .18s ease, border-color .18s ease';
    el.style.transform  = `perspective(920px) rotateX(${ry}deg) rotateY(${rx}deg) translateY(-6px)`;
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const onSrvLeave = (e) => {
    const el = e.currentTarget;
    el.style.transition = 'opacity .68s cubic-bezier(.22,1,.36,1), transform .52s cubic-bezier(.22,1,.36,1), box-shadow .32s ease, border-color .32s ease';
    el.style.transform  = '';
    setTimeout(() => { try { el.style.transition = ''; } catch (_) {} }, 520);
  };

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

  const faqs = [
    {
      q: 'Is my data truly private?',
      a: 'Yes. TriVanta uses AES-256 encryption at rest and TLS 1.3 in transit. We operate a zero-knowledge architecture — our staff cannot read your documents.',
    },
    {
      q: 'How quickly will an attorney review my documents?',
      a: 'Professional and Enterprise plans include a 24-hour SLA. Most reviews are completed within 12 hours during business days.',
    },
    {
      q: 'Can I cancel my subscription at any time?',
      a: 'Yes. There are no lock-in contracts. You can cancel or downgrade from your account settings at any time, effective at the end of your billing period.',
    },
    {
      q: 'What compliance certifications does TriVanta hold?',
      a: 'TriVanta is SOC 2 Type II certified, GDPR compliant, and follows NIST cybersecurity framework guidelines. Compliance documentation is available on request.',
    },
    {
      q: 'Do you support multi-user law firm accounts?',
      a: 'Absolutely. The Enterprise plan supports unlimited attorneys and staff, with role-based access control, audit logs, and custom integrations.',
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Lato:wght@300;400;700&display=swap');

        .font-display { font-family: 'EB Garamond', Georgia, serif; }
        .font-body    { font-family: 'Lato', system-ui, sans-serif; }

        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-14px); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 20px rgba(212,175,55,.25); }
          50%     { box-shadow: 0 0 40px rgba(212,175,55,.55); }
        }
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes spinSlow   { to { transform: rotate(360deg);  } }
        @keyframes counterSpin{ to { transform: rotate(-360deg); } }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes slideIn {
          from { opacity:0; transform:translateX(32px); }
          to   { opacity:1; transform:translateX(0);    }
        }
        @keyframes countUp {
          from { opacity:0; transform:scale(.8); }
          to   { opacity:1; transform:scale(1);  }
        }

        .gold-shimmer {
          background: linear-gradient(90deg,#d4af37,#f5cc5a,#d4af37,#c9a227);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 3.5s linear infinite;
        }
        .hero-grid {
          background-image:
            linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
            linear-gradient(90deg,rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 64px 64px;
        }
        .animate-float      { animation: float 6s ease-in-out infinite; }
        .animate-pulse-glow { animation: pulseGlow 2.5s ease-in-out infinite; }
        .animate-spin-slow  { animation: spinSlow 22s linear infinite; }
        .animate-cspin      { animation: counterSpin 16s linear infinite; }
        .animate-fade-up    { animation: fadeUp .7s ease both; }
        .animate-slide-in   { animation: slideIn .8s ease both; }
        .animate-count-up   { animation: countUp .6s ease both; }

        .card-lift { transition: transform .28s ease, box-shadow .28s ease; }
        .card-lift:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(0,0,0,.16); }

        .gold-border-hover { transition: border-color .25s; }
        .gold-border-hover:hover { border-color: rgba(212,175,55,.5); }

        .glass-card {
          background: rgba(255,255,255,.06);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,.1);
        }
        .glass-card-light {
          background: rgba(255,255,255,.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(0,0,0,.06);
        }

        .gradient-text {
          background: linear-gradient(135deg,#fff 0%,rgba(255,255,255,.75) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stat-card { transition: transform .25s ease, box-shadow .25s ease; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(212,175,55,.15); }

        .faq-item { transition: background .2s; }
        .faq-item:hover { background: rgba(15,32,87,.04); }

        .section-label {
          font-family: 'Lato', sans-serif;
          font-size: .7rem;
          font-weight: 700;
          letter-spacing: .15em;
          text-transform: uppercase;
        }

        /* ── Services Section ── */
        @keyframes srvBeamSwipe {
          from { transform: translateX(-120%) skewX(-18deg); }
          to   { transform: translateX(220%)  skewX(-18deg); }
        }
        @keyframes srvDotPulse {
          0%,100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.6); opacity: 0.6; }
        }
        .srv-card {
          opacity: 0;
          transform: translateY(52px) scale(.97);
          transition:
            opacity  .68s cubic-bezier(.22,1,.36,1),
            transform .68s cubic-bezier(.22,1,.36,1),
            box-shadow .32s ease,
            border-color .32s ease;
        }
        .srv-card.srv-in {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .srv-card.srv-in:hover {
          border-color: rgba(212,175,55,.32);
          box-shadow:
            0 28px 80px rgba(0,0,0,.35),
            0 0 0 1px rgba(212,175,55,.14) inset,
            0 0 56px rgba(212,175,55,.09);
        }
        .srv-icon {
          transition: transform .42s cubic-bezier(.34,1.56,.64,1);
        }
        .srv-card.srv-in:hover .srv-icon {
          transform: scale(1.22) rotate(-8deg);
        }
        .srv-tag {
          transition: background .26s, border-color .26s;
        }
        .srv-card.srv-in:hover .srv-tag {
          background: rgba(255,255,255,.1);
          border-color: rgba(255,255,255,.2);
        }
        .srv-stat {
          transition: opacity .3s, transform .3s;
        }
        .srv-card.srv-in:hover .srv-stat {
          opacity: 1 !important;
          transform: translateY(-1px);
        }
        .srv-spotlight {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          z-index: 0;
          background: radial-gradient(360px at var(--mx,-9999px) var(--my,-9999px), rgba(255,255,255,.075), transparent 80%);
          opacity: 0;
          transition: opacity .38s;
        }
        .srv-card.srv-in:hover .srv-spotlight { opacity: 1; }
        .srv-beam {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,.055) 50%, transparent 75%);
          transform: translateX(-120%) skewX(-18deg);
        }
        .srv-card.srv-in:hover .srv-beam {
          animation: srvBeamSwipe .85s ease forwards;
        }
        .srv-content { position: relative; z-index: 1; }
        .srv-dot { animation: srvDotPulse 1.8s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .animate-float, .animate-pulse-glow, .animate-spin-slow,
          .animate-cspin, .animate-fade-up, .animate-slide-in,
          .animate-count-up, .gold-shimmer { animation: none; }
          .srv-card {
            opacity: 1;
            transform: none;
            transition: box-shadow .3s, border-color .3s;
          }
          .srv-card.srv-in { opacity: 1; transform: none; }
          .srv-icon, .srv-tag, .srv-stat { transition: none; }
          .srv-dot { animation: none; }
        }

        /* ── Nationwide Coverage marquee ── */
        @keyframes statesMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }

        .us-states-wrap {
          opacity: 0;
          transition: opacity .8s ease;
        }
        .us-states-in { opacity: 1; }

        .us-states-viewport {
          position: relative;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 8%, #000 92%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 8%, #000 92%, transparent 100%);
        }
        .us-states-track {
          display: flex;
          width: max-content;
          gap: 14px;
          padding: 6px 0;
          animation: statesMarquee 55s linear infinite;
        }
        .us-states-viewport:hover .us-states-track {
          animation-play-state: paused;
        }

        .us-state-pill {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 9999px;
          background: linear-gradient(135deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.015) 100%);
          border: 1px solid rgba(255,255,255,.1);
          color: rgba(219,234,254,.85);
          font-size: .82rem;
          font-weight: 500;
          white-space: nowrap;
          transition: border-color .25s ease, background .25s ease;
        }
        .us-state-pill:hover {
          border-color: rgba(212,175,55,.4);
          background: linear-gradient(135deg,rgba(212,175,55,.1) 0%,rgba(255,255,255,.02) 100%);
        }

        .us-states-static {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          max-width: 900px;
          margin: 0 auto;
        }

        @media (prefers-reduced-motion: reduce) {
          .us-states-track { animation: none; }
        }

        /* ── Why TriVanta — numbered dossier list ── */
        @keyframes whyRowIn {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .why-row {
          opacity: 0;
          transform: translateY(22px);
        }
        .why-in .why-row {
          animation: whyRowIn .6s cubic-bezier(.22,1,.36,1) both;
        }
        .why-num {
          transition: color .3s ease;
        }
        .why-row:hover .why-num {
          color: rgba(212,175,55,.85);
        }
        .why-row-bar {
          transition: background-color .3s ease;
        }
        .why-row:hover .why-row-bar {
          background-color: #d4af37;
        }

        /* ── Why TriVanta — nationwide reach panel ── */
        .reach-panel {
          opacity: 0;
          transform: translateY(28px);
        }
        .why-in .reach-panel {
          animation: fadeUp .75s cubic-bezier(.22,1,.36,1) both;
          animation-delay: .15s;
        }
        .reach-mosaic {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(3, 34px);
          gap: 3px;
          grid-template-areas:
            "w  w  .  ne"
            "w  w  mw mw"
            "s  s  s  s";
        }
        .reach-block {
          border-radius: 6px;
          background: linear-gradient(135deg,#d4af37,#f5cc5a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: .68rem;
          font-weight: 800;
          letter-spacing: .03em;
          color: #060e2d;
          overflow: hidden;
          white-space: nowrap;
        }
        .reach-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          padding: 3px 6px;
          border-radius: 6px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.08);
          color: #cfe0ff;
          font-size: .68rem;
          font-weight: 700;
          letter-spacing: .02em;
          font-variant-numeric: tabular-nums;
        }

        @media (prefers-reduced-motion: reduce) {
          .why-row { opacity: 1 !important; transform: none !important; animation: none !important; }
          .reach-panel { opacity: 1 !important; transform: none !important; animation: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-[#04091e] font-body">

        {/* ════════════════════════
            NAVBAR
        ════════════════════════ */}
        <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#04091e]/95 backdrop-blur-md shadow-xl shadow-black/30 border-b border-white/5'
            : 'bg-transparent'
        }`}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Logo dark size="md" />

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map(([label, id]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="text-blue-200 hover:text-gold-400 text-sm font-medium transition-colors duration-200 cursor-pointer"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="text-blue-200 hover:text-white font-medium text-sm transition-colors duration-200 cursor-pointer px-4 py-2 rounded-lg hover:bg-white/5"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold text-sm px-5 py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-gold-500/20 hover:shadow-gold-500/40 hover:scale-105 cursor-pointer"
              >
                Get Started
              </button>
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-white cursor-pointer p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {menuOpen && (
            <div className="md:hidden bg-[#04091e]/98 backdrop-blur border-b border-white/10 px-6 pb-6 animate-fade-up">
              {navLinks.map(([label, id]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="block w-full text-left py-3 text-blue-200 hover:text-gold-400 font-medium border-b border-white/5 transition-colors cursor-pointer"
                >
                  {label}
                </button>
              ))}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 border border-white/20 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="flex-1 bg-gold-500 text-navy-950 py-2.5 rounded-lg text-sm font-bold hover:bg-gold-600 transition-colors cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* ════════════════════════
            HERO
        ════════════════════════ */}
        <section
          ref={heroRef}
          className="min-h-screen hero-grid bg-[#04091e] relative overflow-hidden flex items-center pt-24 pb-16"
        >
          {/* Background orbs */}
          <div className="absolute top-1/3 -left-64 w-[600px] h-[600px] bg-navy-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-gold-500/6 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-64 bg-gradient-to-b from-gold-500/0 via-gold-500/40 to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            {/* Copy */}
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 bg-gold-500/10 border border-gold-500/25 rounded-full px-4 py-1.5 text-sm mb-8 cursor-default">
                <Shield size={13} className="text-gold-400" />
                <span className="text-gold-400 font-medium section-label" style={{fontSize:'.68rem',letterSpacing:'.1em'}}>
                  Military-Grade Document Security
                </span>
              </div>

              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] mb-6 tracking-tight">
                Secure Your Legal<br />
                <span className="gold-shimmer">Documents.</span>{' '}
                Connect with<br />
                Trusted Attorneys.
              </h1>

              <p className="text-blue-200/90 text-lg leading-relaxed mb-10 max-w-lg">
                All-in-one legal platform for encrypted storage, AI-assisted document review,
                and seamless attorney consultation  built for privacy-first legal compliance.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button
                  onClick={() => navigate('/register')}
                  className="group inline-flex items-center justify-center gap-2.5 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-2xl shadow-gold-500/25 hover:shadow-gold-500/45 hover:scale-105 cursor-pointer"
                >
                  Get Started Free
                  <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform duration-200" />
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="group inline-flex items-center justify-center gap-2.5 border border-white/15 hover:border-gold-500/40 text-white hover:text-gold-300 font-medium px-8 py-4 rounded-xl transition-all duration-200 hover:bg-gold-500/5 cursor-pointer"
                >
                  <Calendar size={17} />
                  Book a Consultation
                </button>
              </div>

              {/* Trust strip */}
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-blue-300/80">
                {[
                  { icon: Lock,        label: '256-bit SSL'          },
                  { icon: Shield,      label: 'End-to-End Encrypted' },
                  { icon: Award,       label: 'GDPR Compliant'       },
                  { icon: CheckCircle, label: 'SOC 2 Type II'        },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon size={13} className="text-gold-500 flex-shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero visual — floating mini-dashboard */}
            <div className="hidden lg:flex justify-center animate-slide-in">
              <div className="relative w-full max-w-sm animate-float">
                {/* Glow ring */}
                <div className="absolute -inset-4 bg-gradient-to-br from-gold-500/10 via-transparent to-navy-500/10 rounded-3xl blur-2xl" />

                <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
                  {/* Chrome bar */}
                  <div className="bg-[#0d1930] px-4 py-2.5 flex items-center gap-2.5 border-b border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                    </div>
                    <div className="flex-1 bg-white/5 rounded px-2.5 py-1 text-[10px] text-blue-300/60 flex items-center gap-1.5">
                      <Lock size={8} className="text-green-400" />
                      app.trivanta.com/dashboard
                    </div>
                  </div>

                  {/* App body */}
                  <div className="bg-[#060d1f] p-5">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="text-white font-semibold text-sm">Good morning, Sarah</div>
                        <div className="text-blue-400 text-xs mt-0.5">Case 74% ready · 3 tasks pending</div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 text-xs font-bold flex-shrink-0">
                        SC
                      </div>
                    </div>

                    {/* KPI row */}
                    <div className="grid grid-cols-3 gap-2.5 mb-4">
                      {[
                        { label: 'Readiness', value: '74%',   color: 'text-green-400'  },
                        { label: 'Docs',       value: '12/16', color: 'text-gold-400'   },
                        { label: 'Appt.',      value: 'May 22',color: 'text-blue-400'   },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                          <div className="text-blue-300/70 text-[9px] mb-1">{label}</div>
                          <div className={`font-bold text-sm ${color}`}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4 bg-white/5 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-xs font-medium">Case Readiness</span>
                        <span className="text-gold-400 text-xs font-bold">74%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-[74%] bg-gradient-to-r from-gold-500 to-gold-400 rounded-full" />
                      </div>
                    </div>

                    {/* Doc list */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <div className="text-white/80 text-[10px] font-semibold mb-2.5 uppercase tracking-wider">Recent Documents</div>
                      {[
                        { name: 'Incorporation_Agreement_v2.pdf', badge: 'Under Review', bc: 'text-yellow-400 bg-yellow-400/10' },
                        { name: 'Articles_of_Association.pdf',    badge: 'Approved',     bc: 'text-green-400 bg-green-400/10'  },
                        { name: 'Shareholder_Register.xlsx',      badge: 'Pending',      bc: 'text-blue-400 bg-blue-400/10'    },
                      ].map(({ name, badge, bc }) => (
                        <div key={name} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
                          <div className="w-6 h-6 bg-gold-500/10 rounded flex items-center justify-center flex-shrink-0">
                            <FileText size={10} className="text-gold-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white/80 text-[9px] truncate">{name}</div>
                          </div>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${bc}`}>{badge}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -top-4 -right-8 glass-card rounded-xl px-3 py-2 flex items-center gap-2 shadow-xl">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle size={12} className="text-green-400" />
                  </div>
                  <div>
                    <div className="text-white text-[10px] font-semibold">Document Approved</div>
                    <div className="text-blue-300/70 text-[9px]">2 minutes ago</div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-8 glass-card rounded-xl px-3 py-2 flex items-center gap-2 shadow-xl">
                  <div className="w-6 h-6 bg-gold-500/20 rounded-full flex items-center justify-center">
                    <Calendar size={12} className="text-gold-400" />
                  </div>
                  <div>
                    <div className="text-white text-[10px] font-semibold">Consultation Booked</div>
                    <div className="text-blue-300/70 text-[9px]">Tomorrow 10:00 AM</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-blue-400/50 text-xs pointer-events-none select-none">
            <span>Scroll to explore</span>
            <ChevronDown size={16} className="animate-bounce" />
          </div>
        </section>

        {/* ════════════════════════
            STATS BAR
        ════════════════════════ */}
        <section
          ref={statsRef}
          className="relative py-24 overflow-hidden"
          style={{ background: 'linear-gradient(180deg,#030816 0%,#050c1f 55%,#030816 100%)' }}
        >
          {/* Subtle grid */}
          <div className="absolute inset-0 hero-grid opacity-20 pointer-events-none" />
          {/* Top / bottom hairlines */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-500/45 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
          {/* Ambient orbs */}
          <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-blue-700/7 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 right-1/4 w-[520px] h-[520px] bg-gold-500/6 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-6xl mx-auto px-6">

            {/* Section header */}
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 border border-gold-500/22 bg-gold-500/8 rounded-full px-4 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 inline-block srv-dot" />
                <span className="text-gold-400/90 section-label">Nationwide Coverage</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight">
                The Platform That <span className="gold-shimmer">Supports Your In-House Team</span> Every Single Day
              </h2>
              <p className="text-blue-300/70 text-sm mt-4 max-w-xl mx-auto">
                Your Licensed attorneys and compliant workflows across all 50 states and Washington, D.C.
              </p>
            </div>

            {/* USA states — flowing right-to-left coverage marquee */}
            <div className={`us-states-wrap${statsVisible ? ' us-states-in' : ''}`}>
              {reducedMotion ? (
                <div className="us-states-static">
                  {US_STATES.map(state => (
                    <span key={state} className="us-state-pill">
                      <MapPin size={11} className="text-gold-400/80" />
                      {state}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="us-states-viewport">
                  <div className="us-states-track">
                    {[...US_STATES, ...US_STATES].map((state, i) => (
                      <span key={i} className="us-state-pill">
                        <MapPin size={11} className="text-gold-400/80" />
                        {state}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            HOW IT WORKS
        ════════════════════════ */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="section-label text-navy-500 bg-navy-50 rounded-full px-4 py-2 inline-block mb-4">
                How It Works
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-950 mb-4 tracking-tight">
                From Document to Resolution
              </h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                Four simple steps to secure, review, and resolve your legal matters.
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8 relative">
              <div className="hidden md:block absolute top-[2.6rem] left-[calc(12.5%+2rem)] right-[calc(12.5%+2rem)] h-px bg-gradient-to-r from-gold-500/0 via-gold-500 to-gold-500/0" />

              {[
                { step: '01', icon: Upload,      title: 'Upload',  desc: 'Securely upload your legal documents with end-to-end AES-256 encryption.',       iconCls: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
                { step: '02', icon: Search,      title: 'Review',  desc: 'Our attorneys and AI review your documents for completeness and risk flags.',      iconCls: 'text-gold-600',   bg: 'bg-gold-50',   border: 'border-gold-100'   },
                { step: '03', icon: Users,       title: 'Connect', desc: 'Book a consultation with your matched attorney — video, audio, or in-person.',    iconCls: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100'  },
                { step: '04', icon: CheckCircle, title: 'Resolve', desc: 'Track progress, close your matter, and retain a complete documented record.',     iconCls: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
              ].map(({ step, icon: Icon, title, desc, iconCls, bg, border }, i) => (
                <div key={step} className="text-center card-lift group animate-fade-up" style={{ animationDelay: `${i * .1}s` }}>
                  <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 border-2 ${bg} ${border} z-10 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon size={26} className={iconCls} />
                  </div>
                  <div className="text-xs font-bold text-gold-500 mb-2 tracking-widest">{step}</div>
                  <h3 className="font-display text-xl font-bold text-navy-950 mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            SERVICES
        ════════════════════════ */}
        <section id="services" className="py-28 bg-[#04091e] relative overflow-hidden" ref={servicesRef}>
          {/* Ambient background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                radial-gradient(ellipse 55% 45% at 18% 28%, rgba(59,130,246,.09) 0%, transparent 100%),
                radial-gradient(ellipse 55% 45% at 82% 72%, rgba(212,175,55,.07) 0%, transparent 100%),
                linear-gradient(rgba(255,255,255,.016) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,.016) 1px, transparent 1px)
              `,
              backgroundSize: '100% 100%, 100% 100%, 52px 52px, 52px 52px',
            }}
          />

          <div className="max-w-6xl mx-auto px-6 relative z-10">

            {/* ── Header ── */}
            <div className="text-center mb-16">
              <span className="section-label text-gold-400 bg-gold-500/10 border border-gold-500/25 rounded-full px-4 py-2 inline-block mb-4">
                Our Services
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                Everything Legal, In One Place
              </h2>
              <p className="text-blue-200 text-lg max-w-xl mx-auto">
                Comprehensive tools for every stage of your legal journey.
              </p>
            </div>

            {/* ── Bento Grid ── */}
            <div className="grid md:grid-cols-3 gap-5">

              {/* Card 1 — Secure Document Vault (featured: col-span-2) */}
              <div
                className="srv-card md:col-span-2 rounded-2xl border border-white/8 relative overflow-hidden cursor-default"
                style={{ background: 'linear-gradient(140deg,#0f2057 0%,#0a1540 100%)', transitionDelay: '0s' }}
                onMouseMove={onSrvMove}
                onMouseLeave={onSrvLeave}
              >
                <div className="srv-spotlight" />
                <div className="srv-beam" />
                <div className="srv-content flex flex-col md:flex-row">
                  {/* Left pane */}
                  <div className="flex-1 p-7 md:p-8">
                    <div className="flex flex-wrap items-center gap-3 mb-5">
                      <div className="srv-icon w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                        <Database size={24} className="text-blue-300" />
                      </div>
                      <div className="srv-stat flex items-center gap-2 bg-blue-500/12 border border-blue-500/22 rounded-full px-3 py-1.5" style={{ opacity: .75 }}>
                        <span className="srv-dot w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="text-blue-300 text-xs font-bold">50 M+ Docs Secured</span>
                      </div>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-white mb-3">Secure Document Vault</h3>
                    <p className="text-blue-200/80 text-sm leading-relaxed mb-6">
                      Store, organise, and access all your legal documents with military-grade AES-256 encryption.
                      Smart folders, version control, and instant search.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {['End-to-end encrypted', 'Unlimited storage', 'Version history', 'Smart organisation'].map(f => (
                        <div key={f} className="srv-tag flex items-center gap-2 bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-xs text-blue-100">
                          <Check size={9} className="text-blue-400 flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Right pane — mini vault visual */}
                  <div className="hidden md:flex flex-col justify-center w-52 flex-shrink-0 bg-white/3 border-l border-white/6 p-6">
                    <div className="text-blue-300/45 text-[9px] font-bold uppercase tracking-widest mb-3">Vault Status</div>
                    <div className="space-y-2 mb-4">
                      {[
                        { name: 'Contract_v3.pdf',   badge: 'Secure',  bc: 'text-green-400 bg-green-400/10' },
                        { name: 'NDA_Final.pdf',     badge: 'Secure',  bc: 'text-green-400 bg-green-400/10' },
                        { name: 'Agreement.docx',    badge: 'Pending', bc: 'text-gold-400 bg-gold-400/10'   },
                      ].map(({ name, badge, bc }) => (
                        <div key={name} className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-2 border border-white/6">
                          <div className="w-6 h-6 bg-blue-500/15 rounded flex items-center justify-center flex-shrink-0">
                            <FileText size={9} className="text-blue-300" />
                          </div>
                          <span className="text-[9px] text-blue-200/65 truncate flex-1">{name}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${bc}`}>{badge}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/6">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[9px] text-blue-300/50">Storage Used</span>
                        <span className="text-[9px] text-blue-300 font-bold">62%</span>
                      </div>
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full w-[62%] bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2 — AI Document Review */}
              <div
                className="srv-card rounded-2xl border border-white/8 p-7 relative overflow-hidden cursor-default"
                style={{ background: 'linear-gradient(140deg,#2a1800 0%,#1a1000 100%)', transitionDelay: '0.12s' }}
                onMouseMove={onSrvMove}
                onMouseLeave={onSrvLeave}
              >
                <div className="srv-spotlight" />
                <div className="srv-beam" />
                <div className="srv-content">
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <div className="srv-icon w-12 h-12 rounded-xl bg-gold-500/15 border border-gold-500/20 flex items-center justify-center">
                      <FileText size={24} className="text-gold-300" />
                    </div>
                    <div className="srv-stat flex items-center gap-2 bg-gold-500/12 border border-gold-500/22 rounded-full px-3 py-1.5" style={{ opacity: .75 }}>
                      <span className="srv-dot w-1.5 h-1.5 rounded-full bg-gold-400 flex-shrink-0" />
                      <span className="text-gold-300 text-xs font-bold">24 hr Turnaround</span>
                    </div>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mb-3">AI Document Review</h3>
                  <p className="text-blue-200/80 text-sm leading-relaxed mb-5">
                    Machine-learning combined with qualified attorney review. Actionable feedback within 24 hours.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {['AI insights', 'Attorney review', 'Risk flagging', '24 hr SLA'].map(f => (
                      <div key={f} className="srv-tag flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-2.5 py-2 text-[11px] text-blue-100">
                        <Check size={8} className="text-gold-400 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 3 — Attorney Booking */}
              <div
                className="srv-card rounded-2xl border border-white/8 p-7 relative overflow-hidden cursor-default"
                style={{ background: 'linear-gradient(140deg,#0b2018 0%,#071510 100%)', transitionDelay: '0.24s' }}
                onMouseMove={onSrvMove}
                onMouseLeave={onSrvLeave}
              >
                <div className="srv-spotlight" />
                <div className="srv-beam" />
                <div className="srv-content">
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <div className="srv-icon w-12 h-12 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center">
                      <Calendar size={24} className="text-green-300" />
                    </div>
                    <div className="srv-stat flex items-center gap-2 bg-green-500/12 border border-green-500/22 rounded-full px-3 py-1.5" style={{ opacity: .75 }}>
                      <span className="srv-dot w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                      <span className="text-green-300 text-xs font-bold">640+ Attorneys</span>
                    </div>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mb-3">Attorney Booking</h3>
                  <p className="text-blue-200/80 text-sm leading-relaxed mb-5">
                    Find and book consultations with certified attorneys. Real-time availability and video conferencing.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {['Live availability', 'Video calls', 'Auto reminders', 'Instant confirm'].map(f => (
                      <div key={f} className="srv-tag flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-lg px-2.5 py-2 text-[11px] text-blue-100">
                        <Check size={8} className="text-green-400 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 4 — Encrypted Messaging (featured: col-span-2) */}
              <div
                className="srv-card md:col-span-2 rounded-2xl border border-white/8 relative overflow-hidden cursor-default"
                style={{ background: 'linear-gradient(140deg,#1a0b2a 0%,#10071a 100%)', transitionDelay: '0.36s' }}
                onMouseMove={onSrvMove}
                onMouseLeave={onSrvLeave}
              >
                <div className="srv-spotlight" />
                <div className="srv-beam" />
                <div className="srv-content flex flex-col md:flex-row-reverse">
                  {/* Right pane — mini chat visual */}
                  <div className="hidden md:flex flex-col justify-center w-52 flex-shrink-0 bg-white/3 border-l border-white/6 p-6">
                    <div className="text-purple-300/45 text-[9px] font-bold uppercase tracking-widest mb-3">Secure Chat</div>
                    <div className="space-y-2.5 mb-3">
                      {[
                        { msg: "I've reviewed your contract.",    from: 'AT', align: 'left'  },
                        { msg: 'When can we schedule a call?',    from: 'SC', align: 'right' },
                        { msg: 'Tomorrow 10 AM works for me.',    from: 'AT', align: 'left'  },
                      ].map(({ msg, from, align }, i) => (
                        <div key={i} className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`rounded-xl px-3 py-2 max-w-[88%] ${align === 'right' ? 'bg-white/8' : 'bg-purple-500/20'}`}>
                            <div className="text-[8px] text-purple-300/45 font-bold mb-0.5">{from}</div>
                            <div className="text-[10px] text-white/80 leading-tight">{msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-2 border border-white/8">
                      <Lock size={8} className="text-purple-400 flex-shrink-0" />
                      <span className="text-[9px] text-purple-300/55">End-to-end encrypted</span>
                    </div>
                  </div>
                  {/* Left pane */}
                  <div className="flex-1 p-7 md:p-8">
                    <div className="flex flex-wrap items-center gap-3 mb-5">
                      <div className="srv-icon w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                        <MessageSquare size={24} className="text-purple-300" />
                      </div>
                      <div className="srv-stat flex items-center gap-2 bg-purple-500/12 border border-purple-500/22 rounded-full px-3 py-1.5" style={{ opacity: .75 }}>
                        <span className="srv-dot w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                        <span className="text-purple-300 text-xs font-bold">100% Encrypted</span>
                      </div>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-white mb-3">Encrypted Messaging</h3>
                    <p className="text-blue-200/80 text-sm leading-relaxed mb-6">
                      Secure messaging between clients and attorneys — encrypted chat, file sharing, follow-up
                      tracking, and case status notifications.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Encrypted messaging', 'File sharing', 'Follow-up tracking', 'Case notifications'].map(f => (
                        <div key={f} className="srv-tag flex items-center gap-2 bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-xs text-blue-100">
                          <Check size={9} className="text-purple-400 flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ════════════════════════
            IMPACT / WHY TRIVANTA
        ════════════════════════ */}
        <section className="py-24 bg-white relative overflow-hidden">
          {/* Ambient watermark + dot field */}
          <Scale
            size={560}
            strokeWidth={0.6}
            aria-hidden="true"
            className="hidden md:block absolute -right-28 top-1/2 -translate-y-1/2 text-navy-950 pointer-events-none select-none"
            style={{ opacity: .035 }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(rgba(15,32,87,.09) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
              maskImage: 'radial-gradient(ellipse 65% 55% at 50% 40%, black, transparent)',
              WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 40%, black, transparent)',
            }}
          />

          <div className="max-w-6xl mx-auto px-6 relative z-10">

            {/* Header — centered */}
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="section-label text-navy-500 bg-navy-50 rounded-full px-4 py-2 inline-block mb-6">
                Why TriVanta
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-950 mb-6 leading-tight tracking-tight">
                Built for Modern Legal Compliance
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                Legacy legal platforms are slow, insecure, and fragmented. TriVanta brings together
                every tool you need  encrypted vault, expert review, and attorney booking  in a
                single, privacy-first environment.
              </p>
            </div>

            <div
              ref={impactRef}
              className={`grid lg:grid-cols-12 gap-10 lg:gap-14 items-start${impactVisible ? ' why-in' : ''}`}
            >

              {/* Numbered dossier list */}
              <div className="lg:col-span-7">
                {[
                  { icon: Zap,        title: 'Instant Setup',           desc: 'Live in under 5 minutes. No IT team required.'            },
                  { icon: Lock,       title: 'Zero-Knowledge Security', desc: 'Your data is unreadable even to our engineers.'           },
                  { icon: TrendingUp, title: 'Real-time Case Tracking', desc: 'Always know exactly where your matter stands.'            },
                  { icon: Clock,      title: '24-Hour Document Review', desc: 'Qualified attorneys review your filings within 24 hours.' },
                  { icon: Scale,      title: 'Fully GDPR Compliant',    desc: 'Built from the ground up for global privacy law.'         },
                ].map(({ icon: Icon, title, desc }, i) => (
                  <div
                    key={title}
                    className="why-row group flex items-center gap-5 md:gap-6 py-5 border-b border-navy-50 last:border-0 cursor-default"
                    style={{ animationDelay: `${i * .1}s` }}
                  >
                    <span className="why-num font-display text-4xl md:text-5xl font-semibold text-navy-100 flex-shrink-0 w-12 md:w-14 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="why-row-bar w-0.5 self-stretch bg-navy-100 flex-shrink-0" />
                    <div className="w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center flex-shrink-0 transition-colors duration-300 group-hover:bg-gold-500/12">
                      <Icon size={18} className="text-navy-600 transition-colors duration-300 group-hover:text-gold-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-navy-950">{title}</div>
                      <div className="text-gray-500 text-sm">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Nationwide Reach — regional breakdown + full state list */}
              <div className="lg:col-span-5">
                <div className="reach-panel rounded-2xl bg-navy-950 border border-white/5 overflow-hidden">
                  <div className="p-7 md:p-8">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-blue-300/60 text-xs font-bold uppercase tracking-widest">Nationwide Reach</span>
                      <Globe size={16} className="text-gold-400/70" />
                    </div>
                    <div className="font-display text-2xl md:text-3xl font-bold text-white mb-6">
                      Clients Support in All 50 States
                    </div>

                    {/* Regional mosaic */}
                    <div className="reach-mosaic mb-7" aria-hidden="true">
                      <div className="reach-block" style={{ gridArea: 'w' }}><span>West</span></div>
                      <div className="reach-block" style={{ gridArea: 'mw', opacity: .82 }}><span>Midwest</span></div>
                      <div className="reach-block" style={{ gridArea: 'ne', opacity: .68 }}><span>NE</span></div>
                      <div className="reach-block" style={{ gridArea: 's' }}><span>South</span></div>
                    </div>

                    {/* Region breakdown bars */}
                    <div className="space-y-4 mb-7">
                      {[
                        { name: 'South',     count: 17 },
                        { name: 'West',      count: 13 },
                        { name: 'Midwest',   count: 12 },
                        { name: 'Northeast', count: 9  },
                      ].map(r => (
                        <div key={r.name}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-white text-sm font-medium">{r.name}</span>
                            <span className="text-gold-400 text-xs font-bold tabular-nums">{r.count} states</span>
                          </div>
                          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400"
                              style={{ width: `${(r.count / 17) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Full state list, grouped by region */}
                    <div className="border-t border-white/8 pt-6 space-y-4">
                      {[
                        { name: 'South',     states: ['AL','AR','DC','DE','FL','GA','KY','LA','MD','MS','NC','OK','SC','TN','TX','VA','WV'] },
                        { name: 'West',      states: ['AK','AZ','CA','CO','HI','ID','MT','NM','NV','OR','UT','WA','WY'] },
                        { name: 'Midwest',   states: ['IA','IL','IN','KS','MI','MN','MO','ND','NE','OH','SD','WI'] },
                        { name: 'Northeast', states: ['CT','MA','ME','NH','NJ','NY','PA','RI','VT'] },
                      ].map(r => (
                        <div key={r.name}>
                          <div className="text-blue-300/45 text-[10px] font-bold uppercase tracking-widest mb-2">{r.name}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {r.states.map(s => (
                              <span key={s} className="reach-chip">{s}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            SECURITY
        ════════════════════════ */}
        <section id="security" className="py-24 bg-[#04091e] text-white overflow-hidden">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <span className="section-label text-gold-400 bg-gold-500/10 border border-gold-500/25 rounded-full px-4 py-2 inline-block mb-6">
                  Security First
                </span>
                <h2 className="font-display text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tight">
                  Your Legal Data Protected<br />
                  <span className="gold-shimmer">At Every Layer</span>
                </h2>
                <p className="text-blue-200 text-lg leading-relaxed mb-8">
                  We employ federal-grade security protocols to ensure your most sensitive legal
                  documents remain private  accessible only to you and authorised parties.
                </p>

                <div className="space-y-3">
                  {[
                    { icon: Lock,        title: 'AES-256 Encryption',          desc: 'All documents encrypted at rest and in transit'      },
                    { icon: Fingerprint, title: 'Zero-Knowledge Architecture', desc: 'We never access your unencrypted data'               },
                    { icon: Eye,         title: 'Full Audit Trail',            desc: 'Complete log of every document access and change'    },
                    { icon: Shield,      title: 'Multi-Factor Authentication', desc: 'TOTP-based 2FA protecting every account'             },
                    { icon: Globe,       title: 'GDPR & Compliance Ready',     desc: 'Built to meet global privacy regulations'            },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div
                      key={title}
                      className="flex items-start gap-4 p-4 rounded-xl border border-white/5 hover:border-gold-500/25 hover:bg-white/4 transition-all duration-200 cursor-default"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={17} className="text-gold-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-white">{title}</div>
                        <div className="text-blue-300 text-sm">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Orbital visualisation */}
              <div className="flex flex-col items-center gap-10">
                <div className="relative w-72 h-72">
                  <div className="absolute inset-0 rounded-full border border-dashed border-gold-500/20 animate-spin-slow" />
                  <div className="absolute inset-8 rounded-full border border-dashed border-blue-500/25 animate-cspin" />

                  <div className="absolute inset-[4.5rem] rounded-full bg-gradient-to-br from-navy-600 to-[#04091e] border border-gold-500/40 flex items-center justify-center animate-pulse-glow">
                    <Lock size={40} className="text-gold-400" />
                  </div>

                  {[
                    { Icon: Shield,      top: '4%',  left: '50%', label: 'Shield'  },
                    { Icon: Key,         top: '50%', left: '96%', label: 'Key'     },
                    { Icon: Eye,         top: '96%', left: '50%', label: 'Audit'   },
                    { Icon: Users,       top: '50%', left: '4%',  label: 'Access'  },
                  ].map(({ Icon, top, left, label }) => (
                    <div
                      key={label}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-navy-800 border border-gold-500/30 flex items-center justify-center shadow-lg"
                      style={{ top, left }}
                    >
                      <Icon size={20} className="text-gold-300" />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {['AES-256', 'GDPR', 'SOC 2 Type II', '2FA / TOTP', 'TLS 1.3', 'NIST CSF'].map(b => (
                    <span key={b} className="bg-gold-500/10 border border-gold-500/25 text-gold-400 text-xs font-bold px-3 py-1.5 rounded-full">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════
            DASHBOARD PREVIEW
        ════════════════════════ */}
        <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <span className="section-label text-navy-500 bg-navy-50 rounded-full px-4 py-2 inline-block mb-4">
                Client Portal
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-950 mb-4 tracking-tight">
                Your Legal Command Center
              </h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">
                A unified dashboard to manage cases, documents, appointments, and communications.
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-navy-950/15 border border-gray-200">
              <div className="bg-gray-100 px-4 py-3 flex items-center gap-3 border-b border-gray-200">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 flex items-center gap-2 max-w-xs">
                  <Lock size={9} className="text-green-500" />
                  app.trivanta.com/dashboard
                </div>
              </div>

              <div className="bg-[#060d1f] flex" style={{ minHeight: 500 }}>
                {/* Sidebar */}
                <div className="w-52 bg-[#0d1930] border-r border-white/5 p-4 hidden sm:flex flex-col gap-1 flex-shrink-0">
                  <div className="mb-6">
                    <Logo dark size="sm" />
                  </div>
                  {[
                    { icon: BarChart2,     label: 'Dashboard',    active: true,  badge: null },
                    { icon: FileText,      label: 'Documents',    active: false, badge: null },
                    { icon: Calendar,      label: 'Appointments', active: false, badge: null },
                    { icon: MessageSquare, label: 'Messages',     active: false, badge: '3'  },
                    { icon: Bell,          label: 'Reminders',    active: false, badge: null },
                    { icon: Users,         label: 'My Attorney',  active: false, badge: null },
                  ].map(({ icon: Icon, label, active, badge }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                        active ? 'bg-gold-500/10 text-gold-400 font-medium' : 'text-blue-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon size={15} />
                      <span>{label}</span>
                      {badge && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                          {badge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Main area */}
                <div className="flex-1 p-6 overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="text-white font-bold text-lg">Good morning, Sarah</div>
                      <div className="text-blue-300 text-sm mt-0.5">Your case is 74% ready · 3 tasks pending</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center">
                        <Bell size={14} className="text-gold-400" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 text-xs font-bold">
                        SC
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-5">
                    {[
                      { label: 'Case Readiness', value: '74%',    color: 'text-green-400' },
                      { label: 'Documents',       value: '12/16',  color: 'text-gold-400'  },
                      { label: 'Next Appt.',      value: 'May 22', color: 'text-blue-400'  },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="text-blue-300/70 text-xs mb-1">{label}</div>
                        <div className={`font-bold text-lg ${color}`}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-white text-sm font-medium">Case Readiness</span>
                      <span className="text-gold-400 text-sm font-bold">74%</span>
                    </div>
                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full w-[74%] bg-gradient-to-r from-gold-500 to-gold-400 rounded-full" />
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="text-white font-semibold text-sm mb-3 flex items-center justify-between">
                      Recent Documents
                      <span className="text-gold-400 text-xs cursor-pointer hover:text-gold-300">View all →</span>
                    </div>
                    {[
                      { name: 'Incorporation_Agreement_v2.pdf', status: 'Under Review', sc: 'text-yellow-400 bg-yellow-400/10', size: '2.4 MB' },
                      { name: 'Articles_of_Association.pdf',    status: 'Approved',     sc: 'text-green-400 bg-green-400/10',   size: '1.1 MB' },
                      { name: 'Shareholder_Register.xlsx',      status: 'Pending',      sc: 'text-blue-400 bg-blue-400/10',     size: '890 KB' },
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

        {/* ════════════════════════
            PRICING
        ════════════════════════ */}
        <section id="pricing" className="py-24 bg-[#04091e] text-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="section-label text-gold-400 bg-gold-500/10 border border-gold-500/25 rounded-full px-4 py-2 inline-block mb-4">
                Pricing
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">Transparent, Fair Pricing</h2>
              <p className="text-blue-200 text-lg max-w-xl mx-auto">Start free and scale as your needs grow. No hidden fees, no surprises.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 items-start">
              {[
                {
                  name: 'Starter',
                  price: '$149',
                  period: '/month',
                  desc: 'Perfect for individuals with simple legal needs.',
                  features: ['3 consultations/month', '2 GB document storage', 'Basic document review', 'Email support', 'Secure messaging', 'Case tracking dashboard'],
                  cta: 'Get Started',
                  hot: false,
                },
                {
                  name: 'Professional',
                  price: '$249',
                  period: '/month',
                  desc: 'For individuals and small businesses with ongoing legal matters.',
                  features: ['Unlimited consultations', '10 GB encrypted storage', 'AI + attorney review', '24 hr response SLA', 'Priority support', 'Case tracking dashboard', 'Multi-factor auth'],
                  cta: 'Get Started',
                  hot: true,
                },
                {
                  name: 'Enterprise',
                  price: 'Custom',
                  period: 'pricing',
                  desc: 'For law firms and large organisations with complex needs.',
                  features: ['Unlimited everything', 'Custom integrations', 'Dedicated attorney team', 'White-label options', 'SLA guarantees', 'Compliance reporting', 'API access'],
                  cta: 'Contact Sales',
                  hot: false,
                },
              ].map(({ name, price, period, desc, features, cta, hot }) => (
                <div
                  key={name}
                  className={`rounded-2xl p-8 border card-lift relative ${
                    hot
                      ? 'bg-gradient-to-b from-navy-600 to-navy-900 border-gold-500/60 shadow-2xl shadow-gold-500/10 md:-mt-4'
                      : 'bg-white/3 border-white/8'
                  }`}
                >
                  {hot && (
                    <div className="text-center mb-5">
                      <span className="bg-gold-500 text-navy-950 text-xs font-bold px-4 py-1.5 rounded-full">Most Popular</span>
                    </div>
                  )}
                  <div className="mb-6">
                    <div className="text-blue-300 text-sm font-semibold mb-1">{name}</div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={`font-display text-4xl font-bold ${hot ? 'text-gold-400' : 'text-white'}`}>{price}</span>
                      <span className="text-blue-300 text-sm">{period}</span>
                    </div>
                    <p className="text-blue-300 text-sm">{desc}</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm text-blue-100">
                        <CheckCircle size={15} className={hot ? 'text-gold-400' : 'text-green-400'} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => {
                      if (cta === 'Contact Sales') {
                        setSalesPlan(name);
                        setSalesModal(true);
                      } else {
                        navigate('/register');
                      }
                    }}
                    className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 cursor-pointer ${
                      hot
                        ? 'bg-gold-500 text-navy-950 hover:bg-gold-600 hover:shadow-lg hover:shadow-gold-500/25'
                        : 'border border-white/15 text-white hover:bg-white/5 hover:border-white/30'
                    }`}
                  >
                    {cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            TESTIMONIALS
        ════════════════════════ */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="section-label text-navy-500 bg-navy-50 rounded-full px-4 py-2 inline-block mb-4">
                Testimonials
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-950 mb-4 tracking-tight">
                Trusted by Legal Professionals
              </h2>
              <p className="text-gray-500 text-lg">What clients and attorneys say about TriVanta.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  quote: 'TriVanta has completely transformed how I manage client documents. The encryption features give both me and my clients complete peace of mind.',
                  name: 'Sarah Okonkwo',
                  role: 'Corporate Attorney, Lagos',
                  initials: 'SO',
                },
                {
                  quote: "Booking consultations and tracking my case progress is effortless. I always know exactly where things stand and what's needed next.",
                  name: 'Michael Adeyemi',
                  role: 'Business Client',
                  initials: 'MA',
                },
                {
                  quote: "The AI document review saved us hours of prep work. Combined with secure messaging, it's the most complete legal platform I've used in 15 years.",
                  name: 'Amaka Nwosu',
                  role: 'Senior Partner, Nwosu & Associates',
                  initials: 'AN',
                },
              ].map(({ quote, name, role, initials }) => (
                <div key={name} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 card-lift flex flex-col">
                  <div className="flex gap-1 mb-5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={15} className="text-gold-500 fill-gold-500" />
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-6 italic flex-1">"{quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-600 to-navy-950 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {initials}
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

        {/* ════════════════════════
            FAQ
        ════════════════════════ */}
        <section className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-14">
              <span className="section-label text-navy-500 bg-navy-50 rounded-full px-4 py-2 inline-block mb-4">
                FAQ
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-950 mb-4 tracking-tight">
                Common Questions
              </h2>
              <p className="text-gray-500 text-lg">Everything you need to know before getting started.</p>
            </div>

            <div className="space-y-2">
              {faqs.map(({ q, a }, i) => (
                <div
                  key={i}
                  className="faq-item rounded-xl border border-gray-100 overflow-hidden"
                >
                  <button
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded-xl"
                    aria-expanded={faqOpen === i}
                  >
                    <span className="font-semibold text-navy-950 text-sm">{q}</span>
                    <ChevronDown
                      size={18}
                      className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${faqOpen === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {faqOpen === i && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-500 text-sm leading-relaxed">{a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════
            FINAL CTA
        ════════════════════════ */}
        <section className="py-24 bg-gradient-to-br from-[#04091e] via-navy-900 to-[#0a1540] text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 hero-grid opacity-25 pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-32 bg-gradient-to-b from-gold-500/60 to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto px-6">
            <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
              <Shield size={30} className="text-gold-400" />
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tight">
              Start Securing Your<br />
              <span className="gold-shimmer">Legal Documents Today</span>
            </h2>
            <p className="text-blue-200 text-lg mb-10 max-w-xl mx-auto">
              Join thousands of clients and attorneys who trust TriVanta for secure, efficient legal services.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/register')}
                className="group inline-flex items-center justify-center gap-2.5 bg-gold-500 hover:bg-gold-600 text-navy-950 font-bold px-10 py-4 rounded-xl transition-all duration-200 shadow-2xl shadow-gold-500/25 hover:shadow-gold-500/45 hover:scale-105 cursor-pointer"
              >
                Get Started Free
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-200" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center gap-2.5 border border-white/15 hover:border-gold-500/40 text-white hover:text-gold-300 font-medium px-10 py-4 rounded-xl transition-all duration-200 cursor-pointer"
              >
                Sign In to Dashboard
              </button>
            </div>

            <p className="text-blue-400/70 text-sm mt-6 flex items-center justify-center gap-2">
              <Lock size={12} />
              No credit card required · Free consultation included · Cancel anytime
            </p>
          </div>
        </section>

        {/* ════════════════════════
            FOOTER
        ════════════════════════ */}
        <footer className="bg-[#020712] text-gray-400 pt-16 pb-8 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-10 mb-12">
              <div className="md:col-span-2">
                <Logo dark size="md" />
                <p className="text-sm leading-relaxed mt-4 max-w-xs text-gray-500">
                  TriVanta Legal Compliance Platform — secure document storage, expert attorney consultation,
                  and AI-powered legal review in one place.
                </p>
                <div className="flex items-center gap-2 mt-4 text-xs">
                  <Lock size={11} className="text-gold-500" />
                  <span className="text-gold-400/80">End-to-End Encrypted Platform</span>
                </div>
              </div>

              <div>
                <div className="text-white font-semibold text-sm mb-4">Services</div>
                <ul className="space-y-2.5 text-sm">
                  {['Document Vault', 'Legal Review', 'Attorney Booking', 'Client Dashboard', 'Secure Messaging'].map(item => (
                    <li key={item}>
                      <button
                        onClick={() => navigate('/register')}
                        className="hover:text-gold-400 transition-colors duration-200 text-left cursor-pointer"
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-white font-semibold text-sm mb-4">Company</div>
                <ul className="space-y-2.5 text-sm mb-6">
                  {['About Us', 'Privacy Policy', 'Terms of Service', 'Security'].map(item => (
                    <li key={item}>
                      <button className="hover:text-gold-400 transition-colors duration-200 text-left cursor-pointer">
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 text-xs text-gray-500">
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

            <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
              <div>© {new Date().getFullYear()} TriVanta Legal Compliance. All rights reserved.</div>
              <div className="flex items-center gap-5 text-gray-500">
                <span className="flex items-center gap-1.5"><Shield size={10} className="text-gold-500" /> SOC 2 Type II</span>
                <span className="flex items-center gap-1.5"><Lock size={10} className="text-gold-500" /> AES-256</span>
                <span className="flex items-center gap-1.5"><Award size={10} className="text-gold-500" /> GDPR Ready</span>
              </div>
              <div className="text-gray-700 text-xs text-center md:text-right max-w-xs">
                Legal disclaimer: TriVanta provides a technology platform. Content is not legal advice.
              </div>
            </div>
          </div>
        </footer>

      </div>

      {salesModal && (
        <ContactSalesModal
          defaultPlan={salesPlan}
          onClose={() => setSalesModal(false)}
        />
      )}
    </>
  );
}