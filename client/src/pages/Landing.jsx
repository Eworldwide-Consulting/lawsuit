import { useNavigate } from 'react-router-dom';
import Logo from '../components/ui/Logo';
import { Shield, Calendar, Bell, FileCheck, ArrowRight, Check } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Logo dark={false} size="md" />
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="text-navy-900 font-medium text-sm hover:text-green-600 transition-colors">Sign In</button>
          <button onClick={() => navigate('/register')} className="bg-green-500 hover:bg-green-600 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors">Request Access</button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0f2057] to-[#1a3476] text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6">
            <Shield size={14} className="text-green-400" />
            <span className="text-blue-100">Built for modern law firms</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Secure legal compliance,<br /><span className="text-green-400">all in one place.</span>
          </h1>
          <p className="text-blue-100 text-lg mb-10 max-w-2xl mx-auto">
            Manage matters, track deadlines, organize documents, file annual returns, and keep every client engagement on track.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/register')} className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors">
              Get Started <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('/login')} className="flex items-center justify-center gap-2 border border-white/30 hover:bg-white/10 text-white font-medium px-8 py-4 rounded-xl transition-colors">
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything your firm needs</h2>
          <p className="text-gray-500">Comprehensive tools for attorneys, staff, and clients</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Calendar, title: 'Matter & Deadline Tracking', desc: 'Stay ahead of critical dates and case milestones with automated reminders and calendar integration.', color: 'text-blue-600 bg-blue-50' },
            { icon: Bell, title: 'Client Reminders & Appointments', desc: 'Automate client reminders, manage appointments, and keep every party informed at every stage.', color: 'text-green-600 bg-green-50' },
            { icon: FileCheck, title: 'Document Readiness & Annual Returns', desc: "Keep documents organized, track what's missing, and file annual returns on time with guided workflows.", color: 'text-purple-600 bg-purple-50' },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="card p-6 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon size={24} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Built for every role</h2>
            <p className="text-gray-500">Tailored dashboards for attorneys, partners, and clients</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { role: 'Firm Partners', desc: "Get a bird's-eye view of all matters, financial performance, compliance scores, and annual return progress across the entire practice.", features: ['Practice-wide analytics', 'Financial dashboards', 'Compliance scoring', 'Matter lifecycle tracking'] },
              { role: 'Attorneys', desc: 'Manage your caseload efficiently with matter overviews, deadline tracking, document management, and client communications in one place.', features: ['Client matter management', 'Deadline tracking', 'Document center', 'Billing overview'] },
              { role: 'Clients', desc: 'Stay informed and empowered with a clear view of your case status, upcoming tasks, required documents, and easy communication with your legal team.', features: ['Case status tracking', 'Task management', 'Document uploads', 'Legal team messaging'] },
            ].map(({ role, desc, features }) => (
              <div key={role} className="card p-6">
                <div className="font-bold text-navy-900 text-lg mb-2">{role}</div>
                <p className="text-gray-500 text-sm mb-4">{desc}</p>
                <ul className="space-y-2">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-green-500 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#0f2057] to-[#1a3476] text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-blue-200 mb-8 max-w-xl mx-auto">Join law firms already using TriVanta to manage their legal compliance with confidence.</p>
        <button onClick={() => navigate('/register')} className="bg-green-500 hover:bg-green-600 text-white font-semibold px-10 py-4 rounded-xl transition-colors inline-flex items-center gap-2">
          Request Access <ArrowRight size={18} />
        </button>
      </section>

      <footer className="py-8 px-6 text-center text-gray-400 text-sm border-t border-gray-100">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield size={14} />
          <span>Protected with secure encryption</span>
        </div>
        © {new Date().getFullYear()} TriVanta Legal Compliance. All rights reserved.
      </footer>
    </div>
  );
}
