import Logo from '../ui/Logo';

const panels = {
  login: {
    title: 'Secure legal compliance, all in one place.',
    body: 'Manage matters, track deadlines, organize documents, file annual returns, and keep every client engagement on track.',
    features: [
      { icon: '📅', title: 'Matter & deadline tracking', desc: 'Stay ahead of critical dates and case milestones.' },
      { icon: '🔔', title: 'Client reminders & appointments', desc: 'Automate reminders and manage your schedule.' },
      { icon: '📄', title: 'Document readiness & annual returns', desc: 'Keep documents organized and filings on time.' },
    ],
    footer: 'Built for modern law firms. Trusted by professionals.',
  },
  register: {
    title: "Let's get started. We're here to help.",
    body: 'Please provide a few details so we can set up your account and connect you to your legal team.',
    features: [
      { icon: '👤', title: 'Personalized experience', desc: "We'll tailor your dashboard to your matter." },
      { icon: '🔒', title: 'Secure & confidential', desc: 'Your information is encrypted and protected.' },
      { icon: '📁', title: 'Easy document uploads', desc: 'Upload and track documents in one place.' },
      { icon: '📅', title: 'Stay on track', desc: 'Get reminders and updates for what matters most.' },
    ],
    footer: 'Trusted by law firms. Built for compliance.',
  },
  twofa: {
    title: 'Secure access, every step of the way.',
    body: 'Protect client data with an added layer of authentication before entering your dashboard.',
    features: [
      { icon: '🛡️', title: 'Protected client information', desc: 'Keep legal and financial records secure.' },
      { icon: '⚡', title: 'Fast identity verification', desc: 'Approve access in seconds with your one-time code.' },
      { icon: '🔐', title: 'Trusted security controls', desc: 'Designed for attorneys, staff, and clients.' },
    ],
    footer: 'Built for modern law firms. Trusted by professionals.',
  },
  intake: {
    title: 'Every matter starts somewhere.',
    body: 'Answer a few quick questions so we can guide you to the right intake path and personalize your experience.',
    features: [
      { icon: '⚖️', title: 'Guided legal intake', desc: "We'll ask only what matters for your situation." },
      { icon: '🔄', title: 'Flexible for new or existing matters', desc: 'Start fresh or connect to an existing case.' },
      { icon: '🔒', title: 'Secure document sharing', desc: 'Bank-grade encryption keeps your information protected.' },
      { icon: '👥', title: 'Built for families and firms', desc: 'Designed to support clients and legal teams together.' },
    ],
    footer: 'Trusted by law firms. Built for compliance.',
  },
  notsure: {
    title: 'Not sure where to start?',
    body: "That's okay — we'll guide you through the next steps and help you share only what you know right now.",
    features: [
      { icon: '🧭', title: 'Guided intake', desc: "We'll walk you through step by step." },
      { icon: '❓', title: 'Simple questions', desc: "Answer only what you know — nothing more." },
      { icon: '⚙️', title: 'Flexible details', desc: 'You can add more information later as needed.' },
      { icon: '🏛️', title: 'Built for law firms', desc: 'Designed to protect your time and your clients.' },
    ],
    footer: 'Trusted by law firms. Built for compliance.',
  },
  documents: {
    title: "We'll help you gather the right documents.",
    body: "Use this checklist to understand what documents are commonly required. You can upload what you have now and add more later.",
    features: [
      { icon: '✅', title: 'Court-ready checklist', desc: "We've organized common documents so you know what's typically needed." },
      { icon: '🔒', title: 'Secure uploads', desc: 'Your documents are encrypted and protected every step of the way.' },
      { icon: '🔄', title: 'Guided process', desc: 'We make it simple to upload what you have and fill in the gaps together.' },
      { icon: '👥', title: 'Built for guardians', desc: 'Designed with caregivers in mind—clear, supportive, and easy to follow.' },
    ],
    footer: 'Trusted by law firms. Built for compliance.',
  },
};

export default function AuthLayout({ children, variant = 'login' }) {
  const panel = panels[variant] || panels.login;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left marketing panel */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 flex-col bg-gradient-to-br from-[#0f2057] via-[#1a3476] to-[#0d1b4e] p-10 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-8 right-8 w-40 h-40 rounded-full border border-white/30" />
          <div className="absolute top-16 right-16 w-24 h-24 rounded-full border border-white/20" />
          <div className="absolute bottom-32 left-8 grid grid-cols-8 gap-2">
            {Array.from({ length: 64 }).map((_, i) => <div key={i} className="w-1 h-1 bg-white/20 rounded-full" />)}
          </div>
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <Logo dark size="md" />

          <div className="mt-12 flex-1">
            <h1 className="text-3xl font-bold text-white leading-tight mb-4">{panel.title}</h1>
            <p className="text-blue-200 text-sm leading-relaxed mb-8">{panel.body}</p>

            <ul className="space-y-5">
              {panel.features.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{f.icon}</span>
                  <div>
                    <div className="text-white font-semibold text-sm">{f.title}</div>
                    <div className="text-blue-200 text-xs mt-0.5">{f.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 mt-8 pt-6 border-t border-white/20 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="text-blue-200 text-xs">{panel.footer}</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white min-h-screen lg:min-h-0 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 mt-4">
          <Logo dark={false} size="md" />
        </div>
        <div className="w-full max-w-md page-transition">
          {children}
        </div>
        <div className="mt-8 text-center text-xs text-gray-400">For attorneys, staff, and clients.</div>
      </div>
    </div>
  );
}
