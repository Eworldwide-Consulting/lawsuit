import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Calendar, MapPin, ChevronRight, Shield } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import StepIndicator from '../../components/ui/StepIndicator';
import Spinner from '../../components/ui/Spinner';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const STEPS = ['Your Information', 'Matter Details', 'Contact Preferences', 'Review & Submit'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function Register() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '', dob: '',
    street: '', city: '', state: '', zip: '',
    matterType: '', caseNumber: '', contactEmail: true, contactPhone: false, preferredMethod: 'email',
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.register(form);
      login(res.data.token, res.data.user);
      navigate('/intake');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = (hasIcon = true) => `form-input ${hasIcon ? 'pl-10' : ''}`;

  const step0Valid = form.firstName && form.lastName && form.email && form.password;

  return (
    <AuthLayout variant="register">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome! Let's set up your account.</h1>
        <p className="text-gray-500 text-sm mt-1">Complete the form below to get started.</p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      {/* Step 0 – Your Information */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800">Your Information</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">First name</label>
              <div className="relative"><User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.firstName} onChange={set('firstName')} placeholder="Enter your first name" className={fieldClass()} required />
              </div>
            </div>
            <div>
              <label className="form-label">Last name</label>
              <div className="relative"><User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.lastName} onChange={set('lastName')} placeholder="Enter your last name" className={fieldClass()} required />
              </div>
            </div>
          </div>
          <div>
            <label className="form-label">Email address</label>
            <div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" className={fieldClass()} required />
            </div>
          </div>
          <div>
            <label className="form-label">Password</label>
            <div className="relative"><Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" value={form.password} onChange={set('password')} placeholder="Create a password" className={fieldClass()} required minLength={8} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Phone number</label>
              <div className="relative"><Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" className={fieldClass()} />
              </div>
            </div>
            <div>
              <label className="form-label">Date of birth</label>
              <div className="relative"><Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="date" value={form.dob} onChange={set('dob')} className={fieldClass()} />
              </div>
            </div>
          </div>
          <div>
            <label className="form-label">Street address</label>
            <div className="relative"><MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
          <button onClick={() => setStep(1)} disabled={!step0Valid} className="btn-primary mt-2">
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
            { label: 'Matter Details', icon: '📁', fields: `${form.matterType ? form.matterType.replace(/_/g,' ') : 'Not specified'}${form.caseNumber ? ` · Case #${form.caseNumber}` : ''}` },
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
            <span>Your information is secure and will only be shared with your legal team. You can update your preferences anytime in your account settings.</span>
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
