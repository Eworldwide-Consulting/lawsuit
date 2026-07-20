import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Shield, Info, Clock } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function TwoFactor() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [trust, setTrust] = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const refs = useRef([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  // 'email' — one-time code emailed at every password login; 'totp' — authenticator app.
  // Admin logins arrive cross-origin with mode/email in the URL (sessionStorage
  // does not cross the admin subdomain), so URL params win; lazy initializers
  // keep the values stable after the URL is cleaned below.
  const [otpMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('adminTempToken')) return params.get('mode') === 'email' ? 'email' : 'totp';
    return sessionStorage.getItem('lp_otp_mode') || 'totp';
  });
  const [maskedEmail] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || sessionStorage.getItem('lp_otp_email') || '';
  });

  useEffect(() => {
    // Admin login passes tempToken as a URL param from admin.gkasevault.io
    const params = new URLSearchParams(window.location.search);
    const adminTempToken = params.get('adminTempToken');
    if (adminTempToken) {
      sessionStorage.setItem('lp_temp_token', adminTempToken);
      sessionStorage.setItem('lp_otp_mode', otpMode);
      if (maskedEmail) sessionStorage.setItem('lp_otp_email', maskedEmail);
      window.history.replaceState({}, '', '/verify');
    }
    refs.current[0]?.focus();
    const t = setInterval(() => setTimeLeft(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function handleChange(i, e) {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) setCode(pasted.split(''));
  }

  async function verify() {
    const full = code.join('');
    if (full.length !== 6) return setError('Enter all 6 digits');
    const tempToken = sessionStorage.getItem('lp_temp_token');
    if (!tempToken) return navigate('/login');
    setLoading(true);
    setError('');
    try {
      const res = otpMode === 'email'
        ? await authApi.verifyLoginCode({ tempToken, code: full })
        : await authApi.verify2fa({ tempToken, code: full });
      const fromPath = sessionStorage.getItem('lp_from_path');
      ['lp_temp_token', 'lp_otp_mode', 'lp_otp_email', 'lp_from_path']
        .forEach(k => sessionStorage.removeItem(k));
      login(res.data.token, res.data.user);
      // Route to the dashboard for the verified account's role
      if (fromPath) {
        navigate(fromPath, { replace: true });
      } else if (res.data.user.role === 'itsupport') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
      setCode(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (otpMode !== 'email' || resending) return;
    const tempToken = sessionStorage.getItem('lp_temp_token');
    if (!tempToken) return navigate('/login');
    setResending(true);
    setError('');
    setInfo('');
    try {
      await authApi.resendLoginCode({ tempToken });
      setTimeLeft(600);
      setCode(['', '', '', '', '', '']);
      setInfo('A new code has been sent to your email.');
      refs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend the code. Please sign in again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout variant="twofa">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-navy-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="text-green-400" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {otpMode === 'email' ? 'Verify Your Sign-In' : 'Two-Factor Authentication'}
        </h1>
        <p className="text-gray-500 text-sm mt-2">Enter the 6-digit verification code to access your dashboard.</p>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 py-2 px-4 rounded-lg">
          <Info size={14} />
          {otpMode === 'email'
            ? <span>We sent a code to <strong>{maskedEmail || 'your email'}</strong></span>
            : <span>Enter the code from your authenticator app</span>}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">{error}</div>}
      {info && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">{info}</div>}

      <div className="flex gap-3 justify-center mb-4" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input key={i} ref={el => refs.current[i] = el}
            type="text" inputMode="numeric" maxLength={1} value={digit}
            onChange={e => handleChange(i, e)} onKeyDown={e => handleKeyDown(i, e)}
            className={`otp-input ${digit ? 'border-green-500 bg-green-50' : ''}`} />
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <Clock size={14} />
          Code expires in <span className={`font-mono font-bold ${timeLeft < 30 ? 'text-red-500' : 'text-gray-700'}`}>{fmt(timeLeft)}</span>
        </span>
        {otpMode === 'email' && (
          <button className="text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
            onClick={resend} disabled={resending}>
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 mb-5 cursor-pointer">
        <input type="checkbox" checked={trust} onChange={e => setTrust(e.target.checked)} className="w-4 h-4 text-green-500 rounded" />
        <span className="text-sm text-gray-600">Trust this device for 30 days</span>
      </label>

      <button onClick={verify} disabled={loading || code.some(c => !c)} className="btn-primary mb-3">
        {loading ? <Spinner size={5} color="text-white" /> : <><ShieldCheck size={16} /> Verify & Continue</>}
      </button>

      {otpMode !== 'email' && <button className="btn-secondary">Use backup code</button>}

      <div className="flex items-center justify-between mt-5 text-sm">
        <button onClick={() => navigate('/login')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Back to sign in
        </button>
        <button className="text-green-600 hover:text-green-700 font-medium">Need help? Contact support</button>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} /><span>Protected with secure encryption</span>
      </div>
    </AuthLayout>
  );
}
