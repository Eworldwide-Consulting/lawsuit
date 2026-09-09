import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye, EyeOff, CheckCircle, Loader2, ArrowLeft, ArrowRight,
  User, Scale, Briefcase, Shield, Mail, Check,
} from 'lucide-react';
import { authApi } from '../../api';
import Logo from '../../components/ui/Logo';
import PasswordRequirements from '../../components/ui/PasswordRequirements';
import { passwordMeetsRules } from '../../lib/passwordPolicy';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PUBLIC_EMAIL_DOMAINS = new Set(['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','icloud.com','aol.com','msn.com','protonmail.com','proton.me','ymail.com']);
const emailRe = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
function isPublicEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? PUBLIC_EMAIL_DOMAINS.has(domain) : false;
}

const MAX_DOB = new Date().toISOString().slice(0, 10); // today — DOB cannot be in the future
const MIN_DOB = '1900-01-01';

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

function Field({ label, error, children }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      {children}
      <FieldError msg={error} />
    </div>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${className}`}
      {...props}
    />
  );
}

function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────────

const STEP_LABELS = {
  client:   ['Personal Info', 'Contact Details', 'Matter Type'],
  attorney: ['Personal Info', 'Credentials'],
  partner:  ['Personal Info', 'Firm Details'],
};

function StepBar({ role, currentStep }) {
  const steps = STEP_LABELS[role] || [];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${active ? 'text-blue-600 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-12 sm:w-16 h-0.5 mx-1 mb-4 ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Role selection ────────────────────────────────────────────────────────────

const ROLES = [
  {
    id: 'client',
    icon: User,
    label: 'Client',
    desc: 'I am a client with on or more conservatorship, guardianship or estate administration legal matter',
    ring: 'ring-blue-500', bg: 'bg-blue-50', iconColor: 'text-blue-600', checkBg: 'bg-blue-600',
  },
  {
    id: 'attorney',
    icon: Scale,
    label: 'Attorney',
    desc: 'I am a licensed attorney representing clients on probate court matters.',
    ring: 'ring-indigo-500', bg: 'bg-indigo-50', iconColor: 'text-indigo-600', checkBg: 'bg-indigo-600',
  },
  {
    id: 'partner',
    icon: Briefcase,
    label: 'Partner',
    desc: 'I am a firm partner overseeing attorneys, clients, and practice operations.',
    ring: 'ring-purple-500', bg: 'bg-purple-50', iconColor: 'text-purple-600', checkBg: 'bg-purple-600',
  },
];

function RoleCard({ role, selected, onSelect }) {
  const Icon = role.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(role.id)}
      className={`relative w-full text-left p-5 rounded-2xl border-2 transition-all
        ${selected ? `border-transparent ring-2 ${role.ring} ${role.bg}` : 'border-gray-200 hover:border-gray-300 bg-white'}`}
    >
      {selected && (
        <div className={`absolute top-3 right-3 w-6 h-6 rounded-full ${role.checkBg} flex items-center justify-center`}>
          <Check size={13} className="text-white" />
        </div>
      )}
      <div className={`w-10 h-10 rounded-xl ${selected ? role.bg : 'bg-gray-100'} flex items-center justify-center mb-3`}>
        <Icon size={20} className={selected ? role.iconColor : 'text-gray-500'} />
      </div>
      <div className="font-semibold text-gray-900 mb-1">{role.label}</div>
      <div className="text-xs text-gray-500 leading-relaxed">{role.desc}</div>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const INITIAL = {
  firstName: '', lastName: '', email: '', password: '',
  phone: '', dob: '', street: '', city: '', state: '', zip: '',
  matterType: '', existingMatter: '',
  barNumber: '', stateBar: '', yearsExperience: '', specializations: '',
  firmRole: '', practiceGroups: '',
};

export default function Register() {
  const [role, setRole] = useState('');
  const [step, setStep] = useState(-1); // -1 = role selection
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [submitState, setSubmitState] = useState('idle');
  const [submitResult, setSubmitResult] = useState(null);
  const [serverError, setServerError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const e = k => errors[k];
  const totalSteps = STEP_LABELS[role]?.length ?? 0;

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (s) => {
    const errs = {};
    if (s === 0) {
      if (!form.firstName.trim()) errs.firstName = 'First name is required';
      if (!form.lastName.trim())  errs.lastName  = 'Last name is required';
      if (!form.email.trim())          errs.email = 'Email is required';
      else if (!emailRe.test(form.email.trim())) errs.email = 'Please enter a valid email address';
      else if ((role === 'attorney' || role === 'partner') && isPublicEmail(form.email.trim()))
        errs.email = 'Attorneys and partners must register with a professional firm email address';
      if (!form.password)         errs.password  = 'Password is required';
      else if (!passwordMeetsRules(form.password))
        errs.password = 'Password must be at least 8 characters and include one uppercase letter, one number, and one special character (e.g. $ or %)';
    }
    if (s === 1 && role === 'client') {
      if (form.dob) {
        const dob   = new Date(form.dob);
        const today = new Date(); today.setHours(0,0,0,0);
        if (isNaN(dob.getTime()) || dob.getFullYear() < 1900) {
          errs.dob = 'Please enter a valid date of birth';
        } else if (dob > today) {
          errs.dob = 'Date of birth cannot be in the future';
        } else {
          const ageYrs = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (ageYrs < 13)  errs.dob = 'You must be at least 13 years old to register';
          if (ageYrs > 120) errs.dob = 'Please enter a valid date of birth';
        }
      }
    }
    if (s === 1 && (role === 'attorney' || role === 'partner')) {
      if (!form.barNumber.trim()) errs.barNumber = 'Bar number is required';
      if (!form.stateBar.trim())  errs.stateBar  = 'State bar is required';
      if (!form.yearsExperience)  errs.yearsExperience = 'Years of experience is required';
      if (role === 'attorney' && !form.specializations.trim()) errs.specializations = 'At least one specialization is required';
      if (role === 'partner'  && !form.firmRole.trim()) errs.firmRole = 'Firm role is required';
    }
    if (s === 2 && role === 'client') {
      if (!form.matterType) errs.matterType = 'Please select a matter type';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Email availability check ────────────────────────────────────────────────

  const checkEmail = async () => {
    if (!emailRe.test(form.email)) return;
    setEmailChecking(true);
    try {
      const { data } = await authApi.checkEmail(form.email);
      if (data.exists) setErrors(ex => ({ ...ex, email: 'This email is already registered' }));
    } catch { /* ignore */ }
    finally { setEmailChecking(false); }
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (!validate(step)) return;
    if (step < totalSteps - 1) { setStep(s => s + 1); setErrors({}); }
    else handleSubmit();
  };

  const handleBack = () => {
    if (step === 0) { setStep(-1); setErrors({}); }
    else { setStep(s => s - 1); setErrors({}); }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitState('submitting');
    setServerError('');
    try {
      const { data } = await authApi.register({ ...form, role });
      setSubmitResult(data);
      setSubmitState('success');
    } catch (err) {
      const d = err.response?.data || {};
      // Map server field errors back to inline form errors when possible
      if (d.fields && typeof d.fields === 'object') {
        const mapped = {};
        for (const [k, v] of Object.entries(d.fields)) {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        }
        setErrors(mapped);
      }
      setServerError(d.error || 'Registration failed. Please try again.');
      setSubmitState('error');
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────

  if (submitState === 'success') {
    const isProfessional = role === 'attorney' || role === 'partner';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-gray-600 mb-1">We've sent a verification link to:</p>
          <p className="font-semibold text-blue-600 mb-5">{submitResult?.email}</p>

          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 text-left mb-4">
            Click the link in your email to verify and access your dashboard. The link expires in 24 hours.
          </div>

          {isProfessional && (
            <div className="bg-indigo-50 rounded-xl p-4 text-left text-sm text-indigo-800 space-y-1 mb-4">
              <p className="font-semibold">After email verification:</p>
              <p>Our team will review your credentials within 1–2 business days. You'll receive an email once your account is fully approved.</p>
            </div>
          )}

          <button
            className="mt-2 text-sm text-gray-500 hover:text-gray-700 underline"
            onClick={async () => {
              await authApi.resendVerification(submitResult?.email).catch(() => {});
              alert('Verification email resent!');
            }}
          >
            Didn't receive it? Resend
          </button>
          <div className="mt-2">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">Back to Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Page shell ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4"><Logo size="md" /></div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === -1 ? 'Create your account' : STEP_LABELS[role]?.[step] ?? 'Register'}
          </h1>
          {step === -1 && (
            <p className="text-gray-500 mt-1 text-sm">Select your account type to get started</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">

          {/* ── Role selection screen ── */}
          {step === -1 && (
            <div className="space-y-4">
              <div className="grid gap-3">
                {ROLES.map(r => (
                  <RoleCard key={r.id} role={r} selected={role === r.id} onSelect={setRole} />
                ))}
              </div>
              <button
                type="button"
                disabled={!role}
                onClick={() => { setStep(0); setErrors({}); }}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={18} />
              </button>

              {/* Google sign-up shortcut — only shown for client role (Google users become clients) */}
              {(role === 'client' || !role) && (
                <>
                  <div className="relative flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">or</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <button
                    type="button"
                    onClick={() => { window.location.href = '/api/auth/google'; }}
                    className="w-full flex items-center justify-center gap-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.3 30.1 0 24 0 14.7 0 6.6 5.5 2.8 13.5l7.8 6.1C12.5 13.1 17.8 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.9 24.5c0-1.7-.1-3.3-.4-4.9H24v9.3h12.9c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.3-10.1 7.3-17.4z"/>
                      <path fill="#FBBC05" d="M10.6 28.6A14.7 14.7 0 019.5 24c0-1.6.3-3.2.9-4.6L2.6 13.3A23.8 23.8 0 000 24c0 3.8.9 7.4 2.6 10.6l8-6z"/>
                      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.4l-7.5-5.8c-2 1.4-4.6 2.2-7.5 2.2-6.2 0-11.5-3.6-13.5-9.4l-8 6.1C6.6 42.5 14.7 48 24 48z"/>
                    </svg>
                    Continue with Google
                  </button>
                </>
              )}

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
              </p>
            </div>
          )}

          {/* ── Steps ── */}
          {step >= 0 && (
            <div>
              <StepBar role={role} currentStep={step} />

              {/* Step 0 — Personal Info (all roles) */}
              {step === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" error={e('firstName')}>
                      <Input value={form.firstName} onChange={ev => set('firstName', ev.target.value)} placeholder="Jane" />
                    </Field>
                    <Field label="Last Name" error={e('lastName')}>
                      <Input value={form.lastName} onChange={ev => set('lastName', ev.target.value)} placeholder="Smith" />
                    </Field>
                  </div>
                  <Field label="Email Address" error={e('email')}>
                    <div className="relative">
                      <Input
                        type="text"
                        value={form.email}
                        onChange={ev => {
                          const val = ev.target.value;
                          set('email', val);
                          if (val && !emailRe.test(val.trim())) {
                            setErrors(ex => ({ ...ex, email: 'Please enter a valid email address' }));
                          } else if (val && (role === 'attorney' || role === 'partner') && isPublicEmail(val.trim())) {
                            setErrors(ex => ({ ...ex, email: 'Attorneys and partners must register with a professional firm email address' }));
                          } else {
                            setErrors(ex => ({ ...ex, email: '' }));
                          }
                        }}
                        onBlur={checkEmail}
                        placeholder="jane@example.com"
                        autoComplete="email"
                        className={e('email') ? 'border-red-400' : ''}
                      />
                      {emailChecking && (
                        <Loader2 size={15} className="absolute right-3 top-3 animate-spin text-gray-400" />
                      )}
                    </div>
                    {form.email && emailRe.test(form.email.trim()) && (
                      <p className={`text-xs mt-1 font-medium ${isPublicEmail(form.email.trim()) ? 'text-amber-600' : 'text-green-600'}`}>
                        {isPublicEmail(form.email.trim()) ? 'Personal email address' : 'Professional email address'}
                      </p>
                    )}
                  </Field>
                  <Field label="Password" error={e('password')}>
                    <div className="relative">
                      <Input
                        type={showPw ? 'text' : 'password'}
                        value={form.password}
                        onChange={ev => set('password', ev.target.value)}
                        placeholder="8+ characters, incl. uppercase, number & symbol"
                        className={`pr-10 ${e('password') ? 'border-red-400' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    <PasswordRequirements password={form.password} />
                  </Field>
                </div>
              )}

              {/* Step 1 — Client: Contact Details */}
              {step === 1 && role === 'client' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Phone (optional)">
                      <Input value={form.phone} onChange={ev => set('phone', ev.target.value)} placeholder="(555) 000-0000" />
                    </Field>
                    <Field label="Date of Birth (optional)" error={e('dob')}>
                      <Input
                        type="date"
                        value={form.dob}
                        min={MIN_DOB}
                        max={MAX_DOB}
                        onChange={ev => {
                          set('dob', ev.target.value);
                          setErrors(ex => ({ ...ex, dob: '' }));
                        }}
                        className={e('dob') ? 'border-red-400' : ''}
                      />
                    </Field>
                  </div>
                  <Field label="Street Address (optional)">
                    <Input value={form.street} onChange={ev => set('street', ev.target.value)} placeholder="123 Main St" />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <Field label="City">
                        <Input value={form.city} onChange={ev => set('city', ev.target.value)} placeholder="Atlanta" />
                      </Field>
                    </div>
                    <Field label="State">
                      <Input value={form.state} onChange={ev => set('state', ev.target.value)} placeholder="GA" maxLength={2} />
                    </Field>
                    <Field label="ZIP">
                      <Input value={form.zip} onChange={ev => set('zip', ev.target.value)} placeholder="30301" maxLength={5} />
                    </Field>
                  </div>
                </div>
              )}

              {/* Step 2 — Client: Matter Type */}
              {step === 2 && role === 'client' && (
                <div className="space-y-5">
                  <Field label="What type of legal matter do you need help with?" error={e('matterType')}>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {[
                        { id: 'guardianship', label: 'Guardianship', desc: 'Care for a person who cannot care for themselves' },
                        { id: 'conservatorship', label: 'Conservatorship', desc: 'Manage finances for someone who cannot do so' },
                        { id: 'guardianship_conservatorship', label: 'Guardianship & Conservatorship', desc: 'Combined care and financial management for a person' },
                        { id: 'estate_administration', label: 'Estate Administration', desc: "Manage and distribute a deceased person's estate" },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => set('matterType', t.id)}
                          className={`p-4 rounded-xl border-2 text-left transition-all
                            ${form.matterType === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                        >
                          <div className="font-semibold text-sm text-gray-900">{t.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Did a law firm direct you to this website?">
                    <div className="flex gap-3 mt-1">
                      {['Yes', 'No'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => set('existingMatter', opt.toLowerCase())}
                          className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all
                            ${form.existingMatter === opt.toLowerCase()
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              {/* Step 1 — Attorney: Credentials */}
              {step === 1 && role === 'attorney' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bar Number" error={e('barNumber')}>
                      <Input value={form.barNumber} onChange={ev => set('barNumber', ev.target.value)} placeholder="GA-12345" />
                    </Field>
                    <Field label="State Bar" error={e('stateBar')}>
                      <Input value={form.stateBar} onChange={ev => set('stateBar', ev.target.value)} placeholder="Georgia" />
                    </Field>
                  </div>
                  <Field label="Years of Experience" error={e('yearsExperience')}>
                    <Select value={form.yearsExperience} onChange={ev => set('yearsExperience', ev.target.value)}>
                      <option value="">Select…</option>
                      <option value="1">0–2 years</option>
                      <option value="4">3–5 years</option>
                      <option value="8">6–10 years</option>
                      <option value="13">11–15 years</option>
                      <option value="18">16–20 years</option>
                      <option value="25">20+ years</option>
                    </Select>
                  </Field>
                  <Field label="Primary Specializations" error={e('specializations')}>
                    <Input
                      value={form.specializations}
                      onChange={ev => set('specializations', ev.target.value)}
                      placeholder="e.g. Guardianship, Elder Law, Estate Planning"
                    />
                    <p className="text-xs text-gray-400 mt-1">Separate multiple specializations with commas</p>
                  </Field>
                  <Field label="Phone (optional)">
                    <Input value={form.phone} onChange={ev => set('phone', ev.target.value)} placeholder="(555) 000-0000" />
                  </Field>
                </div>
              )}

              {/* Step 1 — Partner: Firm Details */}
              {step === 1 && role === 'partner' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bar Number" error={e('barNumber')}>
                      <Input value={form.barNumber} onChange={ev => set('barNumber', ev.target.value)} placeholder="GA-12345" />
                    </Field>
                    <Field label="State Bar" error={e('stateBar')}>
                      <Input value={form.stateBar} onChange={ev => set('stateBar', ev.target.value)} placeholder="Georgia" />
                    </Field>
                  </div>
                  <Field label="Firm Role" error={e('firmRole')}>
                    <Select value={form.firmRole} onChange={ev => set('firmRole', ev.target.value)}>
                      <option value="">Select your role…</option>
                      <option value="Managing Partner">Managing Partner</option>
                      <option value="Senior Partner">Senior Partner</option>
                      <option value="Associate Partner">Associate Partner</option>
                      <option value="Equity Partner">Equity Partner</option>
                    </Select>
                  </Field>
                  <Field label="Years of Experience" error={e('yearsExperience')}>
                    <Select value={form.yearsExperience} onChange={ev => set('yearsExperience', ev.target.value)}>
                      <option value="">Select…</option>
                      <option value="1">0–2 years</option>
                      <option value="4">3–5 years</option>
                      <option value="8">6–10 years</option>
                      <option value="13">11–15 years</option>
                      <option value="18">16–20 years</option>
                      <option value="25">20+ years</option>
                    </Select>
                  </Field>
                  <Field label="Practice Groups">
                    <Input
                      value={form.practiceGroups}
                      onChange={ev => set('practiceGroups', ev.target.value)}
                      placeholder="e.g. Probate, Elder Law, Trust Administration"
                    />
                    <p className="text-xs text-gray-400 mt-1">Separate multiple groups with commas</p>
                  </Field>
                  <Field label="Phone (optional)">
                    <Input value={form.phone} onChange={ev => set('phone', ev.target.value)} placeholder="(555) 000-0000" />
                  </Field>
                </div>
              )}

              {/* Server error */}
              {submitState === 'error' && serverError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {serverError}
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 mt-7">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitState === 'submitting'}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitState === 'submitting' ? (
                    <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                  ) : step < totalSteps - 1 ? (
                    <>Continue <ArrowRight size={16} /></>
                  ) : (
                    <><CheckCircle size={16} /> {role === 'client' ? 'Create Account' : 'Submit Application'}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {step === -1 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            By creating an account you agree to our{' '}
            <Link to="/terms" className="underline hover:text-gray-600">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>
          </p>
        )}
      </div>
    </div>
  );
}
