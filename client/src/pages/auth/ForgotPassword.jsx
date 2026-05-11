import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Shield } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <AuthLayout variant="login">
      {!sent ? (
        <>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
            <p className="text-gray-500 text-sm mt-1">Enter your email and we'll send you a reset link.</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); setSent(true); }} className="space-y-4">
            <div>
              <label className="form-label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@firm.com" className="form-input pl-10" />
              </div>
            </div>
            <button type="submit" className="btn-primary">Send reset link</button>
          </form>
          <div className="mt-5 text-center">
            <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700">
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
          <p className="text-gray-500 text-sm mb-6">We sent a password reset link to <strong>{email}</strong></p>
          <Link to="/login" className="btn-primary inline-flex w-auto px-8">Back to sign in</Link>
        </div>
      )}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} /><span>Protected with secure encryption</span>
      </div>
    </AuthLayout>
  );
}
