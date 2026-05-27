import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { authApi } from '../../api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | already | expired | error
  const [resent, setResent] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    authApi.verifyEmail(token)
      .then(({ data }) => {
        if (data.alreadyVerified) setStatus('already');
        else setStatus('success');
      })
      .catch(err => {
        const msg = err.response?.data?.error || '';
        if (msg.toLowerCase().includes('expired')) setStatus('expired');
        else setStatus('error');
      });
  }, [token]);

  const handleResend = async () => {
    if (!email) return;
    try {
      await authApi.resendVerification(email);
      setResent(true);
    } catch {
      // silent
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Verifying your email…</p>
        </div>
      </div>
    );
  }

  if (status === 'success' || status === 'already') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'already' ? 'Already Verified' : 'Email Verified!'}
          </h1>
          <p className="text-gray-600 mb-6">
            {status === 'already'
              ? 'Your email has already been verified. You can sign in to your account.'
              : 'Your email address has been confirmed. Your account is now active.'}
          </p>
          <Link to="/login"
            className="block w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            Sign In to Your Account
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600 mb-6">
            This verification link has expired. Enter your email below to receive a new one.
          </p>
          {resent ? (
            <div className="flex items-center gap-2 justify-center text-green-600 bg-green-50 rounded-xl p-3">
              <Mail size={18} />
              <span className="font-medium">New verification email sent!</span>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={handleResend}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                Resend Verification Email
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
        <p className="text-gray-600 mb-6">
          This verification link is invalid or has already been used.
        </p>
        <Link to="/register"
          className="block w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          Back to Registration
        </Link>
      </div>
    </div>
  );
}
