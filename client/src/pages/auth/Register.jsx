import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, Calendar, MapPin, ChevronRight, Shield, CheckCircle, Eye, EyeOff } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import StepIndicator from '../../components/ui/StepIndicator';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';

const STEPS = ['Your Information', 'Matter Details', 'Contact Preferences', 'Review & Submit'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-500">{msg}</p>;
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const len    = password.length >= 8;
  const upper  = /[A-Z]/.test(password);
  const number = /\d/.test(password);
  const score  = [len, upper, number].filter(Boolean).length;
  const colors = ['bg-red-400', 'bg-yellow-400', 'bg-green-400'];
  const labels = ['Weak', 'Fair', 'Strong'];
  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score - 1] : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-400">
        {score > 0 && <span className={score === 3 ? 'text-green-600' : score === 2 ? 'text-yellow-600' : 'text-red-500'}>{labels[score - 1]}</span>}
        {' · '}8+ chars{len ? ' ✓' : ''}, uppercase{upper ? ' ✓' : ''}, number{number ? ' ✓' : ''}
      </p>
    </div>
  );
}

export default function Register() {
  const [step, setStep]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [fieldErrors, setFErrors] = useState({});
  const [showPass, setShowPass]   = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [verified, setVerified]   = useState(null); // { email } after registration

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '', dob: '',
    street: '', city: '', state: '', zip: '',
    matterType: '', caseNumber: '', contactEmail: true, contactPhone: false, preferredMethod: 'email',
  });

  const set     = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setFErrors(fe => ({ ...fe, [k]: '' })); };
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  // Validate step 0 fields inline
  const validateStep0 = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required';
    if (!form.email.trim())          errs.email    = 'Email is required';
    else if (!EMAIL_REGEX.test(form.email)) errs.email = 'Enter a valid email address';
    if (!form.password)              errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    setFErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Check email availability on blur
  const checkEmail = useCallback(async () => {
    if (!form.email || !EMAIL_REGEX.test(form.email)) return;
    setEmailChecking(true);
    try {
      const res = await authApi.checkEmail(form.email);
      if (res.data.exists) {
        setFErrors(fe => ({ ...fe, email: 'This email is already registered. Try signing in instead.' }));
      }
    } catch {
      // ignore network errors on blur
    } finally {
      setEmailChecking(false);
    }
  }, [form.email]);

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    setStep(s => s + 1);
  };

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.register(form);
      if (res.data.requiresVerification) {
        setVerified({ email: res.data.email });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!verified?.email) return;
    try {
      await authApi.resendVerification(verified.email);
      setError('');
    } catch {
      // silent
    }
  }

  const fieldClass = (hasIcon = true) => `form-input ${hasIcon ? 'pl-10' : ''}`;

  // ── Email verified — show confirmation screen ────────────────────────────────
  if (verified) {
    return (
      <AuthLayout variant="register">
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm mb-4">
            We've sent a verification link to<br />
            <span className="font-semibold text-gray-800">{verified.email}</span>
          </p>
          <p className="text-gray-400 text-xs mb-6">
            Click the link in the email to activate your account.<br />
            The link expires in 24 hours.
          </p>
          <button onClick={handleResend} className="btn-secondary w-full mb-3 text-sm">
            Resend verification email
          </button>
          <Link to="/login" className="text-green-600 hover:text-green-700 text-sm font-medium">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────────
  return (
    <AuthLayout variant="register">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome! Let's set up your account.</h1>
        <p className="text-gray-500 text-sm mt-1">Complete the form below to get started.</p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Step 0 – Your Information */}
      {step === 0 && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => { window.location.href = '/api/auth/google'; }}
            className="btn-secondary w-full"
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.3 30.1 0 24 0 14.7 0 6.6 5.5 2.8 13.5l7.8 6.1C12.5 13.1 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.9 24.5c0-1.7-.1-3.3-.4-4.9H24v9.3h12.9c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.3-10.1 7.3-17.4z"/><path fill="#FBBC05" d="M10.6 28.6A14.7 14.7 0 019.5 24c0-1.6.3-3.2.9-4.6L2.6 13.3A23.8 23.8 0 000 24c0 3.8.9 7.4 2.6 10.6l8-6z"/><path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.4l-7.5-5.8c-2 1.4-4.6 2.2-7.5 2.2-6.2 0-11.5-3.6-13.5-9.4l-8 6.1C6.6 42.5 14.7 48 24 48z"/></svg>
            Sign up with Google
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-white text-gray-400">or sign up with email</span></div>
          </div>

          <h2 className="font-semibold text-gray-800">Your Information</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">First name <span className="text-red-400">*</span></label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.firstName} onChange={set('firstName')} placeholder="First name"
                  className={`${fieldClass()} ${fieldErrors.firstName ? 'border-red-300 focus:ring-red-200' : ''}`} />
              </div>
              <FieldError msg={fieldErrors.firstName} />
            </div>
            <div>
              <label className="form-label">Last name <span className="text-red-400">*</span></label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.lastName} onChange={set('lastName')} placeholder="Last name"
                  className={`${fieldClass()} ${fieldErrors.lastName ? 'border-red-300 focus:ring-red-200' : ''}`} />
              </div>
              <FieldError msg={fieldErrors.lastName} />
            </div>
          </div>

          <div>
            <label className="form-label">Email address <span className="text-red-400">*</span></label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" value={form.email} onChange={set('email')} onBlur={checkEmail}
                placeholder="you@example.com"
                className={`${fieldClass()} ${fieldErrors.email ? 'border-red-300 focus:ring-red-200' : ''}`} />
              {emailChecking && <Spinner size={4} className="absolute right-3 top-1/2 -translate-y-1/2" />}
            </div>
            <FieldError msg={fieldErrors.email} />
          </div>

          <div>
            <label className="form-label">Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                placeholder="Min. 8 characters"
                className={`${fieldClass()} pr-10 ${fieldErrors.password ? 'border-red-300 focus:ring-red-200' : ''}`} />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <FieldError msg={fieldErrors.password} />
            <PasswordStrength password={form.password} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Phone number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" className={fieldClass()} />
              </div>
            </div>
            <div>
              <label className="form-label">Date of birth</label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="date" value={form.dob} onChange={set('dob')} className={fieldClass()} />
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">Street address</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={form.street} onChange={set('street')} placeholder="123 Main Street" className={fieldClass()} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="form-label">City</label>
              <input value={form.city} onChange={set('city')} placeholder="City" className="form-input" />
            </div>
            <div>
              <label className="form-label">State</label>
              <select value={form.state} onChange={set('state')} className="form-input">
                <option value="">State</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">ZIP code</label>
              <input value={form.zip} onChange={set('zip')} placeholder="ZIP" className="form-input" />
            </div>
          </div>

          <button onClick={handleNext} className="btn-primary mt-2">
            Continue <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Step 1 – Matter Details */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">Matter Details</h2>
          <p className="text-sm text-gray-500">Tell us about your legal matter so we can connect you properly.</p>
          <div>
            <label className="form-label">Matter type</label>
            <select value={form.matterType} onChange={set('matterType')} className="form-input">
              <option value="">Select matter type</option>
              <option value="guardianship">Guardianship</option>
              <option value="conservatorship">Conservatorship</option>
              <option value="estate_administration">Estate Administration</option>
              <option value="probate">Probate</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="form-label">Existing case number <span className="text-gray-400 font-normal">(if you have one)</span></label>
            <input value={form.caseNumber} onChange={set('caseNumber')} placeholder="e.g. 24PR-12345" className="form-input" />
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex gap-2">
            <span>ℹ️</span>
            <span>Don't worry if you don't have all the details yet — you can continue and fill in more later.</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="btn-secondary flex-shrink-0 w-auto px-6">Back</button>
            <button onClick={() => setStep(2)} className="btn-primary">Continue <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 2 – Contact Preferences */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">Contact Preferences</h2>
          <p className="text-sm text-gray-500">How would you like your legal team to reach you?</p>
          <div>
            <label className="form-label">Contact methods</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form.contactEmail} onChange={setCheck('contactEmail')} className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">Email — {form.email || 'your email'}</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form.contactPhone} onChange={setCheck('contactPhone')} className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">Phone (SMS) — {form.phone || 'your phone'}</span>
              </label>
            </div>
          </div>
          <div>
            <label className="form-label">Preferred contact method</label>
            <select value={form.preferredMethod} onChange={set('preferredMethod')} className="form-input">
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-shrink-0 w-auto px-6">Back</button>
            <button onClick={() => setStep(3)} className="btn-primary">Continue <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 3 – Review & Submit */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">Review & Submit</h2>
          <p className="text-sm text-gray-500">Please review your information before submitting.</p>

          {[
            { label: 'Your Information', icon: '👤', fields: `${form.firstName} ${form.lastName}\n${form.email} · ${form.phone || 'No phone'}` },
            { label: 'Matter Details',   icon: '📁', fields: `${form.matterType ? form.matterType.replace(/_/g,' ') : 'Not specified'}${form.caseNumber ? ` · Case #${form.caseNumber}` : ''}` },
            { label: 'Contact Preferences', icon: '💬', fields: `Email: ${form.email}\n${form.contactPhone ? `Phone: ${form.phone}` : ''} · Preferred: ${form.preferredMethod}` },
          ].map(({ label, icon, fields }, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <div className="font-semibold text-sm text-gray-800">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{fields}</div>
                </div>
              </div>
              <button onClick={() => setStep(i)} className="text-green-600 text-xs font-medium hover:text-green-700">Edit</button>
            </div>
          ))}

          <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-2 text-xs text-blue-700">
            <Shield size={14} className="flex-shrink-0 mt-0.5" />
            <span>After submitting, we'll send a verification link to <strong>{form.email}</strong>. Click it to activate your account.</span>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-shrink-0 w-auto px-6">Back</button>
            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? <Spinner size={5} color="text-white" /> : <><Shield size={16} /> Submit & Create Account</>}
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-green-600 hover:text-green-700 font-medium">Sign in</Link>
      </p>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} /><span>Protected with secure encryption</span>
      </div>
    </AuthLayout>
  );
}
