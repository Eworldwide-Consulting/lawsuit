import { useState } from 'react';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Spinner from './Spinner';
import { User, MapPin, Scale, Landmark, ChevronRight, Check } from 'lucide-react';
import { US_STATES, COUNTIES_BY_STATE } from '../../data/usCounties';

const MATTER_TYPES = [
  { id: 'guardianship',        label: 'Guardianship' },
  { id: 'conservatorship',     label: 'Conservatorship' },
  { id: 'estate_administration', label: 'Estate Administration / Probate' },
  { id: 'personal_injury',     label: 'Personal Injury' },
  { id: 'family_law',          label: 'Family Law' },
  { id: 'immigration',         label: 'Immigration' },
  { id: 'business_law',        label: 'Business Law' },
  { id: 'criminal_defense',    label: 'Criminal Defense' },
  { id: 'real_estate',         label: 'Real Estate' },
  { id: 'employment_law',      label: 'Employment Law' },
  { id: 'not_sure',            label: "I'm Not Sure Yet" },
];

const STEPS = [
  { icon: User,     title: 'Contact Info',    sub: 'How can we reach you?' },
  { icon: MapPin,   title: 'Your Address',    sub: 'Where are you located?' },
  { icon: Scale,    title: 'Your Legal Need', sub: 'Tell us about your matter.' },
  { icon: Landmark, title: 'Case Details',    sub: 'Where was your case launched?' },
];

export default function ProfileCompletionModal({ onClose }) {
  const { user } = useAuth();
  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [form, setForm]     = useState({
    phone: '', dob: '',
    street: '', city: '', state: '', zip: '',
    matterType: '', workedBefore: 'no',
    caseState: '', caseCounty: '', caseDescription: '',
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  // Changing the case state invalidates the previously chosen county
  const setCaseState = e =>
    setForm(f => ({ ...f, caseState: e.target.value, caseCounty: '' }));

  async function save() {
    setSaving(true);
    setError('');
    try {
      await authApi.completeProfile(form);
      sessionStorage.removeItem('lp_needs_profile');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else save();
  }

  function skip() {
    sessionStorage.removeItem('lp_needs_profile');
    onClose();
  }

  const StepIcon = STEPS[step].icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Gradient header ── */}
        <div className="bg-gradient-to-r from-[#0f2057] to-[#1a3476] p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <StepIcon size={18} />
            </div>
            <div>
              <div className="font-bold text-base">{STEPS[step].title}</div>
              <div className="text-xs text-white/70">{STEPS[step].sub}</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-green-400' : 'bg-white/25'
                }`}
              />
            ))}
          </div>
          <div className="text-xs text-white/50 mt-1.5">Step {step + 1} of {STEPS.length}</div>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-4">
          {step === 0 && (
            <p className="text-sm text-gray-500 -mt-1 pb-1">
              Welcome, <strong className="text-gray-800">{user?.first_name}</strong>! Complete
              your profile so we can personalise your TriVanta experience.
            </p>
          )}

          {/* Step 1 — Contact */}
          {step === 0 && (
            <>
              <div>
                <label className="form-label">Phone Number</label>
                <input type="tel" value={form.phone} onChange={set('phone')}
                  placeholder="(555) 123-4567" className="form-input" />
              </div>
              <div>
                <label className="form-label">Date of Birth</label>
                <input type="date" value={form.dob} onChange={set('dob')}
                  max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}
                  className="form-input" />
              </div>
            </>
          )}

          {/* Step 2 — Address */}
          {step === 1 && (
            <>
              <div>
                <label className="form-label">Street Address</label>
                <input value={form.street} onChange={set('street')}
                  placeholder="123 Main St" className="form-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">City</label>
                  <input value={form.city} onChange={set('city')}
                    placeholder="New York" className="form-input" />
                </div>
                <div>
                  <label className="form-label">State</label>
                  <select value={form.state} onChange={set('state')} className="form-input">
                    <option value="">— select —</option>
                    {US_STATES.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">ZIP Code</label>
                <input value={form.zip} onChange={set('zip')}
                  placeholder="10001" maxLength={10} className="form-input" />
              </div>
            </>
          )}

          {/* Step 3 — Legal matter */}
          {step === 2 && (
            <>
              <div>
                <label className="form-label">What type of legal matter do you need help with?</label>
                <select value={form.matterType} onChange={set('matterType')} className="form-input">
                  <option value="">— select matter type —</option>
                  {MATTER_TYPES.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Have you worked with our firm before?</label>
                <div className="flex gap-3 mt-1">
                  {['yes', 'no'].map(v => (
                    <label
                      key={v}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all text-sm font-medium select-none ${
                        form.workedBefore === v
                          ? 'border-[#0f2057] bg-[#0f2057]/5 text-[#0f2057]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <input type="radio" name="workedBefore" value={v}
                        checked={form.workedBefore === v} onChange={set('workedBefore')}
                        className="sr-only" />
                      {form.workedBefore === v && <Check size={13} />}
                      {v === 'yes' ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 4 — Case details: where the case was launched */}
          {step === 3 && (
            <>
              <p className="text-sm text-gray-500 -mt-1 pb-1">
                Tell us where your case was launched so we can route it to the
                right team. This appears on your case dashboard.
              </p>
              <div>
                <label className="form-label">State where the case was launched</label>
                <select value={form.caseState} onChange={setCaseState} className="form-input">
                  <option value="">— select state —</option>
                  {US_STATES.map(s => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">County</label>
                <select value={form.caseCounty} onChange={set('caseCounty')}
                  disabled={!form.caseState} className="form-input disabled:opacity-50">
                  <option value="">{form.caseState ? '— select county —' : 'Select a state first'}</option>
                  {(COUNTIES_BY_STATE[form.caseState] || []).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Brief case description <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={form.caseDescription} onChange={set('caseDescription')}
                  rows={2} className="form-input resize-none"
                  placeholder="What is the case about?" />
              </div>
            </>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-6 flex gap-3">
          {step === 0 ? (
            <button onClick={skip}
              className="btn-secondary flex-shrink-0 w-auto px-5 text-sm">
              Skip for now
            </button>
          ) : (
            <button onClick={() => setStep(s => s - 1)}
              className="btn-secondary flex-shrink-0 w-auto px-5 text-sm">
              Back
            </button>
          )}
          <button onClick={next} disabled={saving} className="btn-primary">
            {saving
              ? <Spinner size={4} color="text-white" />
              : step === STEPS.length - 1
                ? <><Check size={14} /> Save Profile</>
                : <>Next <ChevronRight size={14} /></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
