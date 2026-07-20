import { useState, useRef, useEffect } from 'react';
import { Shield, ShieldCheck, X, Copy, Check, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function TwoFASetupModal({ onClose, mandatory = false }) {
  const { updateUser } = useAuth();
  const [step, setStep] = useState('intro'); // intro | setup | done
  const [secret, setSecret] = useState('');
  const [otpUrl, setOtpUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const refs = useRef([]);

  async function handleEnable() {
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.setup2fa();
      setSecret(data.secret);
      setOtpUrl(data.otpauth_url);
      try {
        const qrUrl = await QRCode.toDataURL(data.otpauth_url, {
          width: 200,
          margin: 2,
          color: { dark: '#0f2057', light: '#ffffff' },
        });
        setQrDataUrl(qrUrl);
      } catch {
        // QR generation is non-critical — fall back to text secret only
      }
      setStep('setup');
    } catch {
      setError('Failed to initialise 2FA. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    try { await authApi.dismiss2faPrompt(); } catch {}
    updateUser({ two_fa_prompt_shown: 1 });
    onClose();
  }

  async function handleVerify() {
    const full = code.join('');
    if (full.length !== 6) { setError('Enter all 6 digits'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.enable2fa(full);
      updateUser({ two_fa_enabled: 1, two_fa_prompt_shown: 1 });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code — check your authenticator and try again.');
      setCode(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  // onChange: handle digit input and auto-advance to next box
  function handleChange(i, e) {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  }

  // onKeyDown: handle Backspace navigation to previous box only
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) setCode(pasted.split(''));
  }

  function copySecret() {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    if (step === 'setup') refs.current[0]?.focus();
  }, [step]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[#0f2057]" />
            <span className="font-semibold text-gray-900 text-sm">Two-Factor Authentication</span>
          </div>
          {step !== 'done' && !mandatory && (
            <button onClick={handleSkip} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          )}
          {mandatory && step !== 'done' && (
            <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Required</span>
          )}
        </div>

        <div className="p-6">

          {/* ── Step: intro ── */}
          {step === 'intro' && (
            <>
              <div className="text-center mb-5">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck size={32} className="text-[#0f2057]" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">
                  {mandatory ? 'Two-Factor Authentication Required' : 'Secure your account'}
                </h2>
                <p className="text-sm text-gray-500">
                  {mandatory
                    ? 'Your role requires 2FA to protect sensitive client data. Set it up now to continue accessing your dashboard.'
                    : 'Add a second layer of security. Each login will require a 6-digit code from your authenticator app.'}
                </p>
              </div>

              <ul className="space-y-2 mb-6">
                {[
                  'Works with Google Authenticator, Authy, or any TOTP app',
                  'Once enabled, required for all future logins',
                  'Protects your account even if your password is compromised',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className="w-full py-2.5 bg-[#0f2057] text-white rounded-xl font-semibold hover:bg-[#1a3476] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <><ShieldCheck size={16} /> Enable 2FA</>}
                </button>
                {!mandatory && (
                  <button
                    onClick={handleSkip}
                    className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                  >
                    Skip for now
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Step: setup ── */}
          {step === 'setup' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Open <strong>Google Authenticator</strong> or <strong>Authy</strong>, tap <em>Add account</em>, then scan the QR code below.
              </p>

              {/* QR code */}
              {qrDataUrl ? (
                <div className="flex flex-col items-center mb-4">
                  <div className="p-3 bg-white border-2 border-gray-200 rounded-xl inline-block">
                    <img src={qrDataUrl} alt="Scan with Google Authenticator" width={180} height={180} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Scan this QR code with your authenticator app</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 mb-4 text-sm text-gray-400">
                  No camera? Use the secret key below.
                </div>
              )}

              {/* Manual entry fallback */}
              <details className="mb-4">
                <summary className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer select-none">
                  Can't scan? Enter key manually
                </summary>
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="text-xs text-gray-500 font-medium mb-1">Secret key — type into your authenticator app</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-gray-800 break-all leading-relaxed">{secret}</code>
                    <button
                      onClick={copySecret}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      {copied
                        ? <Check size={14} className="text-green-500" />
                        : <Copy size={14} className="text-gray-500" />}
                    </button>
                  </div>
                </div>
              </details>

              <a
                href={otpUrl}
                className="block text-center text-xs text-blue-600 hover:underline mb-4"
              >
                On mobile? Tap here to open directly in your authenticator app
              </a>

              <div className="text-sm font-medium text-gray-700 mb-2 text-center">
                Enter the 6-digit code your app shows
              </div>

              <div className="flex gap-2 justify-center mb-3" onPaste={handlePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => refs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(i, e)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className={`w-10 h-12 text-center text-lg font-bold border-2 rounded-xl bg-white text-gray-900 focus:outline-none transition-colors
                      ${digit ? 'border-[#0f2057] bg-blue-50' : 'border-gray-300 focus:border-[#0f2057]'}`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-xs text-red-600 text-center mb-3">{error}</p>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || code.some(c => !c)}
                className="w-full py-2.5 bg-[#0f2057] text-white rounded-xl font-semibold hover:bg-[#1a3476] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading
                  ? <Loader2 size={16} className="animate-spin" />
                  : 'Verify & Enable 2FA'}
              </button>
            </>
          )}

          {/* ── Step: done ── */}
          {step === 'done' && (
            <div className="text-center py-2">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={32} className="text-green-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">2FA Enabled!</h2>
              <p className="text-sm text-gray-500 mb-5">
                Your account is now protected. You'll need your authenticator app every time you sign in.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                Continue to Dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}