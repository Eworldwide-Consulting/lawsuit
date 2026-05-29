import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Shield, User, Scale, Briefcase } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const SSO_ERRORS = {
  google_cancelled:    'Google sign-in was cancelled.',
  google_failed:       'Google sign-in failed. Please try again or use email and password.',
  google_unverified:   'Your Google account email is not verified.',
  microsoft_cancelled: 'Microsoft sign-in was cancelled.',
  microsoft_failed:    'Microsoft sign-in failed. Please try again or use email and password.',
};

const ROLE_TABS = [
  {
    id:       'client',
    label:    'Client',
    icon:     User,
    heading:  'Client Portal',
    sub:      'Sign in to manage your legal matter.',
    showSSO:  true,
    active:   'border-blue-600 text-blue-600 bg-blue-50',
    inactive: 'border-transparent text-gray-500 hover:text-gray-700',
  },
  {
    id:       'attorney',
    label:    'Attorney',
    icon:     Scale,
    heading:  'Attorney Portal',
    sub:      'Sign in to manage client cases.',
    showSSO:  false,
    active:   'border-indigo-600 text-indigo-600 bg-indigo-50',
    inactive: 'border-transparent text-gray-500 hover:text-gray-700',
  },
  {
    id:       'partner',
    label:    'Partner',
    icon:     Briefcase,
    heading:  'Partner Portal',
    sub:      'Sign in to oversee firm operations.',
    showSSO:  false,
    active:   'border-purple-600 text-purple-600 bg-purple-50',
    inactive: 'border-transparent text-gray-500 hover:text-gray-700',
  },
];

export default function Login() {
  const [activeRole, setActiveRole]             = useState('client');
  const [form, setForm]                         = useState({ email: '', password: '' });
  const [showPwd, setShowPwd]                   = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState('');
  const [needsVerification, setNeedsVerification] = useState('');
  const [resentVerification, setResentVerification] = useState(false);
  const { login } = useAuth();
  const navigate   = useNavigate();

  const tab = ROLE_TABS.find(t => t.id === activeRole);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get('error');
    if (e) {
      setError(SSO_ERRORS[e] || 'Sign-in failed. Please try again.');
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function switchRole(id) {
    setActiveRole(id);
    setError('');
    setNeedsVerification('');
    setResentVerification(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(form);
      if (res.data.twoFaRequired) {
        sessionStorage.setItem('lp_temp_token', res.data.tempToken);
        navigate('/verify');
      } else {
        login(res.data.token, res.data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      const d = err.response?.data || {};
      setError(d.error || 'Login failed. Please try again.');
      if (d.requiresVerification && d.email) setNeedsVerification(d.email);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout variant="login">

      {/* ── Role tabs ── */}
      <div className="flex border-b border-gray-200 mb-6 -mx-1">
        {ROLE_TABS.map(t => {
          const Icon = t.icon;
          const isActive = t.id === activeRole;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchRole(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-semibold border-b-2 transition-all rounded-t-lg mx-0.5
                ${isActive ? t.active : t.inactive}`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Heading ── */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{tab.heading}</h1>
        <p className="text-gray-500 text-sm mt-1">{tab.sub}</p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          {needsVerification && (
            <div className="mt-2">
              {resentVerification ? (
                <span className="text-green-600 font-medium">Verification email sent!</span>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await authApi.resendVerification(needsVerification).catch(() => {});
                    setResentVerification(true);
                  }}
                  className="underline font-medium hover:text-red-900"
                >
                  Resend verification email
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              placeholder="you@firm.com"
              className="form-input pl-10"
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="form-label">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              required
              placeholder="Enter your password"
              className="form-input pl-10 pr-10"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-sm text-green-600 hover:text-green-700 font-medium">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="btn-primary mt-2">
          {loading ? <Spinner size={5} color="text-white" /> : <><Lock size={16} /> Sign In</>}
        </button>
      </form>

      {/* ── SSO buttons (Client only) ── */}
      {tab.showSSO && (
        <>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-400">or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { window.location.href = '/api/auth/google'; }}
            className="btn-secondary"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.3 30.1 0 24 0 14.7 0 6.6 5.5 2.8 13.5l7.8 6.1C12.5 13.1 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.9 24.5c0-1.7-.1-3.3-.4-4.9H24v9.3h12.9c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.3-10.1 7.3-17.4z"/>
              <path fill="#FBBC05" d="M10.6 28.6A14.7 14.7 0 019.5 24c0-1.6.3-3.2.9-4.6L2.6 13.3A23.8 23.8 0 000 24c0 3.8.9 7.4 2.6 10.6l8-6z"/>
              <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.4l-7.5-5.8c-2 1.4-4.6 2.2-7.5 2.2-6.2 0-11.5-3.6-13.5-9.4l-8 6.1C6.6 42.5 14.7 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => { window.location.href = '/api/auth/microsoft'; }}
            className="btn-secondary mt-3"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Continue with Microsoft
          </button>
        </>
      )}

      {/* ── Footer ── */}
      <p className="mt-6 text-center text-sm text-gray-500">
        {activeRole === 'client' ? (
          <>
            New to TriVanta?{' '}
            <Link to="/register" className="text-green-600 hover:text-green-700 font-medium">
              Request access
            </Link>
          </>
        ) : (
          <>
            Need access?{' '}
            <Link to="/register" className="text-green-600 hover:text-green-700 font-medium">
              Register as {tab.label}
            </Link>
          </>
        )}
      </p>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} />
        <span>Protected with secure encryption</span>
      </div>
    </AuthLayout>
  );
}
