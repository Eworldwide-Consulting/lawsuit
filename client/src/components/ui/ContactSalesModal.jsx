import { useState } from 'react';
import { X, Send, CheckCircle, User, Mail, Building2, Phone, MessageSquare, ChevronDown } from 'lucide-react';
import Spinner from './Spinner';

const PLANS = ['Starter', 'Professional', 'Enterprise', 'Not sure yet'];

export default function ContactSalesModal({ onClose, defaultPlan = 'Enterprise' }) {
  const [form, setForm] = useState({
    name: '', email: '', company: '', phone: '',
    plan: defaultPlan, message: '',
  });
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contact Sales"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-modal-in">
        {/* Header */}
        <div className="bg-[#0f2057] px-6 py-5 rounded-t-2xl flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">Talk to Sales</h2>
            <p className="text-blue-200 text-sm mt-0.5">
              Tell us about your firm — we'll get back within 24 hours.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-blue-200 hover:text-white transition-colors cursor-pointer ml-4 mt-0.5 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6">
          {sent ? (
            /* ── Success state ── */
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={36} className="text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Enquiry Received</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Thank you, <strong>{form.name.split(' ')[0]}</strong>. A member of our team
                will reach out to <strong>{form.email}</strong> within one business day.
              </p>
              <button
                onClick={onClose}
                className="bg-[#0f2057] text-white font-semibold px-8 py-2.5 rounded-xl hover:bg-[#1a3476] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="cs-name">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="cs-name"
                      type="text"
                      required
                      value={form.name}
                      onChange={set('name')}
                      placeholder="Jane Smith"
                      maxLength={120}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2057] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="cs-email">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="cs-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={set('email')}
                      placeholder="jane@firm.com"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2057] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="cs-company">
                    Firm / Company
                  </label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="cs-company"
                      type="text"
                      value={form.company}
                      onChange={set('company')}
                      placeholder="Acme Law LLP"
                      maxLength={200}
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2057] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="cs-phone">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="cs-phone"
                      type="tel"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="+1 555 000 0000"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2057] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="cs-plan">
                  Plan of Interest
                </label>
                <div className="relative">
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select
                    id="cs-plan"
                    value={form.plan}
                    onChange={set('plan')}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2057] focus:border-transparent appearance-none bg-white"
                  >
                    {PLANS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="cs-message">
                  Message <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MessageSquare size={14} className="absolute left-3 top-3.5 text-gray-400" />
                  <textarea
                    id="cs-message"
                    required
                    value={form.message}
                    onChange={set('message')}
                    placeholder="Tell us about your firm size, use case, and any specific requirements…"
                    rows={4}
                    maxLength={2000}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2057] focus:border-transparent resize-none"
                  />
                  <div className="text-right text-xs text-gray-400 mt-1">
                    {form.message.length}/2000
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#0f2057] hover:bg-[#1a3476] text-white font-semibold py-3 rounded-xl transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading
                  ? <Spinner size={4} color="text-white" />
                  : <><Send size={15} /> Send Enquiry</>}
              </button>

              <p className="text-center text-xs text-gray-400">
                By submitting you agree to our Privacy Policy. We never share your data.
              </p>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(20px) scale(.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        .animate-modal-in { animation: modalIn .22s ease both; }
      `}</style>
    </div>
  );
}