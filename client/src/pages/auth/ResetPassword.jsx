import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';

export default function ResetPassword() {
  const [searchParams]              = useSearchParams();
  const navigate                    = useNavigate();
  const token                       = searchParams.get('token');

  const [form, setForm]             = useState({ newPassword: '', confirm: '' });
  const [showPwd, setShowPwd]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Password strength: at least 8 chars, 1 number or symbol
  const isStrong = form.newPassword.length >= 8;
  const matches  = form.newPassword === form.confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!matches)   return setError('Passwords do not match.');
    if (!isStrong)  return setError('Password must be at least 8 characters.');
    if (!token)     return setError('Invalid or missing reset token.');

    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword({ token, newPassword: form.newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Reset link is invalid or has expired. Please request a new one.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout variant="login">
      {success ? (
        <div className="text-center">
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password updated</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your password has been reset successfully. Redirecting you to sign in…
          </p>
          <Link to="/login" className="btn-primary inline-flex w-auto px-8">
            Sign in now
          </Link>
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
            <p className="text-gray-500 text-sm mt-1">
              Choose a strong password for your TriVanta account.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                {error}
                {(error.includes('expired') || error.includes('invalid') || error.includes('Invalid')) && (
                  <div className="mt-1.5">
                    <Link
                      to="/forgot-password"
                      className="font-semibold underline hover:text-red-900"
                    >
                      Request a new reset link →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label" htmlFor="rp-new">New password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="rp-new"
                  type={showPwd ? 'text' : 'password'}
                  value={form.newPassword}
                  onChange={set('newPassword')}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="form-input pl-10 pr-10"
                  autoComplete="new-password"
                  disabled={loading || !token}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.newPassword && (
                <div className={`mt-1.5 text-xs flex items-center gap-1 ${isStrong ? 'text-green-600' : 'text-amber-600'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isStrong ? 'bg-green-500' : 'bg-amber-400'}`} />
                  {isStrong ? 'Strong password' : 'At least 8 characters required'}
                </div>
              )}
            </div>

            <div>
              <label className="form-label" htmlFor="rp-confirm">Confirm new password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="rp-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={set('confirm')}
                  required
                  placeholder="Repeat your new password"
                  className="form-input pl-10 pr-10"
                  autoComplete="new-password"
                  disabled={loading || !token}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.confirm && (
                <div className={`mt-1.5 text-xs flex items-center gap-1 ${matches ? 'text-green-600' : 'text-red-500'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${matches ? 'bg-green-500' : 'bg-red-500'}`} />
                  {matches ? 'Passwords match' : 'Passwords do not match'}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !token || !form.newPassword || !form.confirm}
              className="btn-primary mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <Spinner size={5} color="text-white" />
                : <><Lock size={16} /> Reset password</>}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </Link>
          </div>
        </>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} />
        <span>Protected with secure encryption</span>
      </div>
    </AuthLayout>
  );
}