import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Shield, User, Scale, Briefcase } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const SSO_ERRORS = {
  google_cancelled:  'Google sign-in was cancelled.',
  google_failed:     'Google sign-in failed. Please try again or use email and password.',
  google_unverified: 'Your Google account email is not verified.',
  approval_pending:  'Your account is pending admin approval. Please check back later.',
  account_rejected:  'Your account was not approved. Please contact support.',
  account_suspended: 'Your account has been suspended. Please contact support to restore access.',
  account_deleted:   'This account has been closed. You can register again with the same email address.',
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
  const [error, setError]                           = useState('');
  const [needsVerification, setNeedsVerification]   = useState('');
  const [resentVerification, setResentVerification] = useState(false);
  const [notRegistered, setNotRegistered]           = useState(false);
  const { login } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const fromPath   = location.state?.from || null;

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
    setNotRegistered(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotRegistered(false);
    setNeedsVerification('');
    setResentVerification(false);
    try {
      const res = await authApi.login({ ...form, portal: activeRole });
      if (res.data.twoFaRequired) {
        sessionStorage.setItem('lp_temp_token', res.data.tempToken);
        sessionStorage.setItem('lp_otp_mode', 'totp');
        navigate('/verify');
      } else if (res.data.otpRequired) {
        // Email verification code sent — finish sign-in on the verify screen.
        sessionStorage.setItem('lp_temp_token', res.data.tempToken);
        sessionStorage.setItem('lp_otp_mode', 'email');
        sessionStorage.setItem('lp_otp_email', res.data.maskedEmail || '');
        if (fromPath) sessionStorage.setItem('lp_from_path', fromPath);
        navigate('/verify');
      } else {
        if (res.data.user.role !== activeRole) {
          setError(`This email is registered as ${res.data.user.role}. Please sign in using the ${res.data.user.role} portal or register a new ${activeRole} account.`);
          setLoading(false);
          return;
        }
        login(res.data.token, res.data.user);
        // Redirect back to the page they were trying to reach, or role-appropriate default
        if (fromPath) {
          navigate(fromPath, { replace: true });
        } else if (res.data.user.role === 'itsupport') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      const d = err.response?.data || {};
      if (d.requiresVerification && d.email) {
        setError(d.error || 'Please verify your email.');
        setNeedsVerification(d.email);
      } else if (err.response?.status === 401) {
        setError(d.error || 'Invalid email or password. Please check your credentials and try again.');
      } else {
        setError(d.error || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout variant="login">

      {/* â”€â”€ Role tabs â”€â”€ */}
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

      {/* â”€â”€ Heading â”€â”€ */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{tab.heading}</h1>
        <p className="text-gray-500 text-sm mt-1">{tab.sub}</p>
      </div>

      {/* â”€â”€ Not registered banner â”€â”€ */}
      {notRegistered && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <div className="font-semibold text-amber-800 mb-1">No account found for this email</div>
          <p className="text-amber-700 text-xs mb-2">
            <strong>{form.email}</strong> is not registered on TriVanta.
            You need to create an account before signing in.
          </p>
          <Link
            to="/register"
            className="inline-block mt-1 px-3 py-1.5 bg-amber-700 text-white text-xs font-semibold rounded-lg hover:bg-amber-800 transition-colors"
          >
            Register now â†’
          </Link>
        </div>
      )}

      {/* â”€â”€ Error banner â”€â”€ */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          {needsVerification && (
            <div className="mt-2 space-y-1">
              {resentVerification ? (
                <div>
                  <span className="text-green-600 font-medium">Verification email sent!</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Check your spam/junk folder if it doesn't arrive within 2 minutes.
                    Contact support if the issue persists.
                  </p>
                </div>
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

      {/* â”€â”€ Form â”€â”€ */}
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

      {/* â”€â”€ SSO buttons (Client only) â”€â”€ */}
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

          <a
            href="/api/auth/google"
            className="btn-secondary"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.3 30.1 0 24 0 14.7 0 6.6 5.5 2.8 13.5l7.8 6.1C12.5 13.1 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.9 24.5c0-1.7-.1-3.3-.4-4.9H24v9.3h12.9c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.3-10.1 7.3-17.4z"/>
              <path fill="#FBBC05" d="M10.6 28.6A14.7 14.7 0 019.5 24c0-1.6.3-3.2.9-4.6L2.6 13.3A23.8 23.8 0 000 24c0 3.8.9 7.4 2.6 10.6l8-6z"/>
              <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.4l-7.5-5.8c-2 1.4-4.6 2.2-7.5 2.2-6.2 0-11.5-3.6-13.5-9.4l-8 6.1C6.6 42.5 14.7 48 24 48z"/>
            </svg>
            Continue with Google
          </a>

          <button
            type="button"
            disabled
            title="Microsoft sign-in coming soon"
            className="btn-secondary mt-3 opacity-40 cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Continue with Microsoft
            <span className="ml-1 text-xs text-gray-400">(coming soon)</span>
          </button>
        </>
      )}

      {/* â”€â”€ Footer â”€â”€ */}
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
