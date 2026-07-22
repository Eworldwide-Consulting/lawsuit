import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, ArrowLeft, Shield, Check } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';

function EmailReset() {
  const [email,        setEmail]       = useState('');
  const [loading,      setLoading]     = useState(false);
  const [sent,         setSent]        = useState(false);
  const [error,        setError]       = useState('');
  const [devResetLink, setDevResetLink] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDevResetLink('');
    try {
      const res = await authApi.forgotPassword(email.trim().toLowerCase());
      // Backend always returns { sent: true } regardless of whether the email
      // exists — this prevents user-enumeration attacks.
      // In development the backend also returns _devResetLink so devs can test
      // without a working SMTP server.
      if (res.data?._devResetLink) setDevResetLink(res.data._devResetLink);
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Something went wrong. Please try again or contact support.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Mail className="text-green-600" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-500 text-sm mb-1">
          If <strong>{email}</strong> is registered with TriVanta, you'll
          receive a password reset link within a few minutes.
        </p>
        <p className="text-gray-400 text-xs mb-6">
          Don't see it? Check your spam or junk folder. The link expires in 1 hour.
        </p>

        {/* Dev-only: show the reset link directly when SMTP is not configured */}
        {devResetLink && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
            <p className="text-yellow-800 text-xs font-semibold mb-1">
              DEV MODE — SMTP not needed
            </p>
            <a
              href={devResetLink}
              className="text-blue-600 text-xs break-all hover:underline"
            >
              {devResetLink}
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => { setSent(false); setError(''); setDevResetLink(''); }}
          className="text-sm text-green-600 hover:text-green-700 font-medium underline mb-4 block mx-auto"
        >
          Try a different email
        </button>

        <Link to="/login" className="btn-primary inline-flex w-auto px-8">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-gray-500 text-sm mt-1 mb-6 text-center">
        Enter your registered email and we'll send you a secure reset link.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label" htmlFor="fp-email">Email address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="fp-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@firm.com"
              className="form-input pl-10"
              autoComplete="email"
              disabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading
            ? <Spinner size={5} color="text-white" />
            : 'Send reset link'}
        </button>
      </form>
    </>
  );
}

function PhoneReset() {
  const navigate = useNavigate();
  const [phone,           setPhone]           = useState('');
  const [code,            setCode]            = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSent,        setCodeSent]        = useState(false);
  const [devCode,         setDevCode]         = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [done,            setDone]            = useState(false);

  async function sendCode(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.forgotPasswordByPhone(phone.trim());
      if (res.data?._devCode) setDevCode(res.data._devCode);
      setCodeSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resetWithCode(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPasswordByPhone({ phone: phone.trim(), code: code.trim(), newPassword });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Check className="text-green-600" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Password updated</h1>
        <p className="text-gray-500 text-sm mb-6">You can now sign in with your new password.</p>
        <button onClick={() => navigate('/login')} className="btn-primary inline-flex w-auto px-8">
          Back to sign in
        </button>
      </div>
    );
  }

  if (!codeSent) {
    return (
      <>
        <p className="text-gray-500 text-sm mt-1 mb-6 text-center">
          Enter your registered phone number and we'll text you a verification code.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <label className="form-label" htmlFor="fp-phone">Phone number</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="fp-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                placeholder="(555) 123-4567"
                className="form-input pl-10"
                autoComplete="tel"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner size={5} color="text-white" /> : 'Send code'}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <p className="text-gray-500 text-sm mt-1 mb-6 text-center">
        Enter the code we texted to <strong>{phone}</strong> and choose a new password.
      </p>

      {devCode && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
          <p className="text-yellow-800 text-xs font-semibold mb-1">DEV MODE — SMS not configured</p>
          <p className="text-yellow-800 text-sm font-mono">{devCode}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={resetWithCode} className="space-y-4">
        <div>
          <label className="form-label" htmlFor="fp-code">Verification code</label>
          <input
            id="fp-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            required
            placeholder="6-digit code"
            className="form-input"
            disabled={loading}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="fp-new-pw">New password</label>
          <input
            id="fp-new-pw"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            placeholder="At least 8 characters"
            className="form-input"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="fp-confirm-pw">Confirm new password</label>
          <input
            id="fp-confirm-pw"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            placeholder="Re-enter new password"
            className="form-input"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !code.trim() || !newPassword || !confirmPassword}
          className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Spinner size={5} color="text-white" /> : 'Reset password'}
        </button>

        <button
          type="button"
          onClick={() => { setCodeSent(false); setCode(''); setError(''); setDevCode(''); }}
          className="text-sm text-gray-500 hover:text-gray-700 block mx-auto"
        >
          Use a different phone number
        </button>
      </form>
    </>
  );
}

export default function ForgotPassword() {
  const [tab, setTab] = useState('email');
  const [smsAvailable, setSmsAvailable] = useState(false);

  useEffect(() => {
    authApi.smsStatus().then(r => setSmsAvailable(Boolean(r.data?.configured))).catch(() => {});
  }, []);

  return (
    <AuthLayout variant="login">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
      </div>

      {smsAvailable && (
        <div className="flex border border-gray-200 rounded-xl p-1 mb-4 max-w-xs mx-auto">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'email' ? 'bg-navy-900 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail size={14} /> Email
          </button>
          <button
            onClick={() => setTab('phone')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'phone' ? 'bg-navy-900 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone size={14} /> Phone
          </button>
        </div>
      )}

      {tab === 'email' ? <EmailReset /> : <PhoneReset />}

      <div className="mt-5 text-center">
        <Link
          to="/login"
          className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} />
        <span>Protected with secure encryption</span>
      </div>
    </AuthLayout>
  );
}
