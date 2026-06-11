import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Shield } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function TwoFactor() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trust, setTrust] = useState(false);
  const [timeLeft, setTimeLeft] = useState(102);
  const refs = useRef([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Admin login passes tempToken as a URL param from admin.gkasevault.io
    const params = new URLSearchParams(window.location.search);
    const adminTempToken = params.get('adminTempToken');
    if (adminTempToken) {
      sessionStorage.setItem('lp_temp_token', adminTempToken);
      window.history.replaceState({}, '', '/verify');
    }
    refs.current[0]?.focus();
    const t = setInterval(() => setTimeLeft(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function handleKey(i, e) {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
    if (!val && e.key === 'Backspace' && i > 0) refs.current[i - 1]?.focus();
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
      const res = await authApi.verify2fa({ tempToken, code: full });
      sessionStorage.removeItem('lp_temp_token');
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
      setCode(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout variant="twofa">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-navy-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="text-green-400" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h1>
        <p className="text-gray-500 text-sm mt-2">Enter the 6-digit verification code to access your dashboard.</p>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 py-2 px-4 rounded-lg">
          <span>ℹ️</span>
          <span>We sent a code to <strong>m***@firm.com</strong></span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">{error}</div>}

      <div className="flex gap-3 justify-center mb-4" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input key={i} ref={el => refs.current[i] = el}
            type="text" inputMode="numeric" maxLength={1} value={digit}
            onChange={e => handleKey(i, e)} onKeyDown={e => handleKey(i, e)}
            className={`otp-input ${digit ? 'border-green-500 bg-green-50' : ''}`} />
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <span>⏱</span>
          Code expires in <span className={`font-mono font-bold ${timeLeft < 30 ? 'text-red-500' : 'text-gray-700'}`}>{fmt(timeLeft)}</span>
        </span>
        <button className="text-green-600 hover:text-green-700 font-medium" onClick={() => setTimeLeft(102)}>Resend code</button>
      </div>

      <label className="flex items-center gap-2 mb-5 cursor-pointer">
        <input type="checkbox" checked={trust} onChange={e => setTrust(e.target.checked)} className="w-4 h-4 text-green-500 rounded" />
        <span className="text-sm text-gray-600">Trust this device for 30 days</span>
      </label>

      <button onClick={verify} disabled={loading || code.some(c => !c)} className="btn-primary mb-3">
        {loading ? <Spinner size={5} color="text-white" /> : <><ShieldCheck size={16} /> Verify & Continue</>}
      </button>

      <button className="btn-secondary">Use backup code</button>

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
