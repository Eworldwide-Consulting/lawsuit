import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Shield } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';

export default function ForgotPassword() {
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

  return (
    <AuthLayout variant="login">
      {!sent ? (
        <>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
            <p className="text-gray-500 text-sm mt-1">
              Enter your registered email and we'll send you a secure reset link.
            </p>
          </div>

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

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        </>
      ) : (
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
      )}

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} />
        <span>Protected with secure encryption</span>
      </div>
    </AuthLayout>
  );
}