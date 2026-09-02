import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mattersApi, checklistApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { GEORGIA_COUNTIES } from '../constants/counties';
import { useToast } from '../context/ToastContext';
import {
  Briefcase, Check, MapPin, Calendar, User, AlertCircle,
  ClipboardList, ChevronRight, X, ArrowRight, Save, RefreshCw,
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import AttorneyStatusBadge from '../components/attorney/AttorneyStatusBadge';
import AttorneyPickerModal from '../components/attorney/AttorneyPickerModal';
import InviteAttorneyModal from '../components/attorney/InviteAttorneyModal';
import { STAGE_KEYS, getStageLabels, getStageStory } from '../constants/caseStages';

const MATTER_TYPES = [
  { value: 'guardianship',                  label: 'Guardianship',                          desc: 'Appointment of a person to care for an individual who cannot make personal decisions.' },
  { value: 'conservatorship',               label: 'Conservatorship',                       desc: 'Appointment of a person to manage the finances or estate of another individual.' },
  { value: 'guardianship_conservatorship',  label: 'Joint Guardianship & Conservatorship',  desc: 'Combined guardianship of the person and conservatorship of the estate.' },
  { value: 'estate_administration',         label: 'Estate Administration',                  desc: 'Probate and administration of a deceased person\'s estate.' },
];

function SetupModal({ onComplete, onClose }) {
  const [step, setStep]               = useState(1);
  const [matterType, setMatterType]   = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  async function submit() {
    if (!matterType) { setError('Please select a matter type.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await mattersApi.create({ matterType, description: description.trim() || null });
      onComplete(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not create matter. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f2057] to-[#1a3476] px-6 py-5 text-white relative">
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close — you can finish this later"
              className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1 transition-colors"
            >
              <X size={18} />
            </button>
          )}
          <div className="flex items-center gap-3 mb-1">
            <Briefcase size={20} />
            <span className="font-bold text-lg">Welcome to TriVanta Legal</span>
          </div>
          <p className="text-blue-200 text-sm">Let's set up your case so your legal team can get started.</p>
          <div className="flex gap-1.5 mt-4">
            {[1, 2].map(n => (
              <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${step >= n ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <>
              <h2 className="font-bold text-gray-900 dark:text-white mb-1">What type of legal matter do you need help with?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select the option that best describes your situation.</p>
              <div className="space-y-2.5">
                {MATTER_TYPES.map(mt => (
                  <button key={mt.value} onClick={() => setMatterType(mt.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      matterType === mt.value
                        ? 'border-[#0f2057] dark:border-blue-400 bg-[#0f2057]/5 dark:bg-blue-400/10'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                        matterType === mt.value ? 'border-[#0f2057] dark:border-blue-400 bg-[#0f2057] dark:bg-blue-400' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {matterType === mt.value && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{mt.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{mt.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {error && <p className="text-red-600 dark:text-red-400 text-xs mt-3">{error}</p>}
              <button
                onClick={() => { if (!matterType) { setError('Please select a matter type.'); return; } setError(''); setStep(2); }}
                className="mt-5 w-full bg-[#0f2057] hover:bg-[#1a3476] text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
              >
                Continue <ArrowRight size={16} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 mb-4">
                ← Back
              </button>
              <h2 className="font-bold text-gray-900 dark:text-white mb-1">Tell us about your situation</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Briefly describe your case in your own words. Your legal team will review this and reach out to help.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4 text-xs text-blue-800 dark:text-blue-300">
                <strong>Selected:</strong> {MATTER_TYPES.find(m => m.value === matterType)?.label}
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe your situation... (e.g. 'My mother has dementia and can no longer manage her finances. We need help establishing conservatorship.')"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-[#0f2057]/30 dark:focus:ring-blue-400/40 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Optional — you can update this later.</p>
              {error && <p className="text-red-600 dark:text-red-400 text-xs mt-2">{error}</p>}
              <button
                onClick={submit}
                disabled={saving}
                className="mt-4 w-full bg-[#0f2057] hover:bg-[#1a3476] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? <><Spinner size={4} /> Saving...</> : <>Open My Case <ArrowRight size={16} /></>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyCase() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const toast     = useToast();
  const [matter,   setMatter]   = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [legalCaseNumber, setLegalCaseNumber] = useState('');
  const [county, setCounty]         = useState('');
  const [savingCaseInfo, setSavingCaseInfo] = useState(false);
  const [showAttyPicker, setShowAttyPicker] = useState(false);
  const [showInvite, setShowInvite]         = useState(false);

  function loadMatter() {
    return mattersApi.list()
      .then(r => {
        const list = r.data?.matters || r.data || [];
        if (list.length === 0) {
          setShowSetup(true);
          setLoading(false);
        } else {
          const m = list[0];
          setMatter(m);
          setLegalCaseNumber(m.legal_case_number || '');
          setCounty(m.county || '');
          return checklistApi.getByMatter(m.id).then(cr => setChecklist(cr.data)).catch(() => {});
        }
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMatter(); }, []);

  function handleAssigned(msg, isError) {
    toast[isError ? 'error' : 'success'](msg);
    if (!isError) loadMatter();
  }

  async function saveCaseInfo() {
    if (!matter) return;
    setSavingCaseInfo(true);
    try {
      const res = await mattersApi.updateCaseInfo(matter.id, { legalCaseNumber, county });
      setMatter(m => ({ ...m, ...res.data }));
      toast.success('Case details saved');
    } catch {
      toast.error('Could not save case details. Please try again.');
    } finally {
      setSavingCaseInfo(false);
    }
  }

  function handleSetupComplete(newMatter) {
    setMatter(newMatter);
    setShowSetup(false);
    checklistApi.getByMatter(newMatter.id).then(cr => setChecklist(cr.data)).catch(() => {});
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={8} /></div>;

  const STAGES      = getStageLabels(matter?.matter_type);
  const stageIdx    = matter ? STAGE_KEYS.indexOf(matter.stage) : -1;
  const stageStory  = matter ? getStageStory(matter.matter_type, matter.stage) : '';
  const matterLabel = MATTER_TYPES.find(m => m.value === matter?.matter_type)?.label || matter?.matter_type || '';

  const neededNowItems   = checklist?.sections?.flatMap(s => s.items).filter(i => i.default_status === 'needed_now') || [];
  const acceptedItems    = neededNowItems.filter(i => i.status === 'accepted');
  const pendingItems     = neededNowItems.filter(i => !['submitted', 'accepted', 'not_applicable'].includes(i.status));
  const checklistProgress = neededNowItems.length > 0
    ? Math.round((acceptedItems.length / neededNowItems.length) * 100)
    : 0;

  return (
    <>
      {showSetup && <SetupModal onComplete={handleSetupComplete} onClose={() => setShowSetup(false)} />}

      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Briefcase size={20} className="text-[#0f2057] dark:text-blue-400" />
              My Case
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Your legal journey with TriVanta Legal.</p>
          </div>
          {!matter && (
            <button
              onClick={() => setShowSetup(true)}
              className="text-sm bg-[#0f2057] text-white px-4 py-2 rounded-lg hover:bg-[#1a3476] font-medium"
            >
              Set Up My Case
            </button>
          )}
        </div>

        {!matter && !showSetup && (
          <div className="card p-10 text-center">
            <Briefcase size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <div className="text-gray-600 dark:text-gray-300 font-semibold mb-1">No active case yet</div>
            <div className="text-gray-400 dark:text-gray-500 text-sm mb-4">Set up your case to get started with your legal team.</div>
            <button
              onClick={() => setShowSetup(true)}
              className="bg-[#0f2057] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#1a3476]"
            >
              Set Up My Case
            </button>
          </div>
        )}

        {matter && (
          <>
            {/* Case Overview Card */}
            <div className="card p-5">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide mb-0.5">Reference Number</div>
                  <div className="font-mono font-semibold text-[#0f2057] dark:text-blue-400">#{matter.case_number || matter.id}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <span className="badge badge-blue capitalize">{matter.stage?.replace(/_/g, ' ')}</span>
                  <span className={`badge ${matter.status === 'active' ? 'badge-green' : matter.status === 'at_risk' ? 'badge-red' : 'badge-gray'}`}>
                    {matter.status === 'at_risk' ? 'At Risk' : matter.status === 'active' ? 'Active' : matter.status}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2.5">
                  <Briefcase size={15} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Matter Type</div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">{matterLabel}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <User size={15} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Attorney</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {matter.attorney_name && <div className="font-medium text-gray-800 dark:text-gray-100">{matter.attorney_name}</div>}
                      <AttorneyStatusBadge hasAttorney={Boolean(matter.attorney_id)} caseAccepted={matter.case_accepted === 1 || matter.case_accepted === true} />
                    </div>
                    <button onClick={() => setShowAttyPicker(true)}
                      className="mt-1 text-xs font-medium text-[#0f2057] dark:text-blue-400 hover:text-[#1a3476] dark:hover:text-blue-300 flex items-center gap-1">
                      {matter.attorney_id ? <><RefreshCw size={11} /> Change Attorney</> : 'Select an attorney →'}
                    </button>
                  </div>
                </div>
                {(matter.court || matter.county || matter.state) && (
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        {matter.court ? 'Court' : 'Case Location'}
                      </div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {[matter.court, matter.county, matter.state].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                )}
                {matter.important_date && (
                  <div className="flex items-start gap-2.5">
                    <Calendar size={15} className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">Next Court Date</div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {new Date(matter.important_date).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <label className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Legal Case Number</label>
                  <input
                    value={legalCaseNumber}
                    onChange={e => setLegalCaseNumber(e.target.value)}
                    placeholder="Court docket number, once assigned"
                    className="form-input mt-1 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">County</label>
                  <select value={county} onChange={e => setCounty(e.target.value)} className="form-input mt-1 text-sm">
                    <option value="">— Select county —</option>
                    {GEORGIA_COUNTIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={saveCaseInfo}
                    disabled={savingCaseInfo}
                    className="flex items-center gap-2 text-sm font-medium text-white bg-[#0f2057] hover:bg-[#1a3476] disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
                  >
                    {savingCaseInfo ? <Spinner size={4} color="text-white" /> : <Save size={14} />}
                    Save Case Details
                  </button>
                </div>
              </div>
            </div>

            {/* Case Story */}
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1">Your Case Story</h2>
              {matter.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 italic">"{matter.description}"</p>
              )}
              <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-[#0f2057] dark:border-blue-400 rounded-r-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                {stageStory}
              </div>
            </div>

            {/* Stage Timeline */}
            <div className="card p-5">
              <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-4">Case Progress</h2>
              <div className="overflow-x-auto">
                <ol className="flex items-start min-w-max pb-2">
                  {STAGES.map((stage, i) => {
                    const done = stageIdx >= 0 && i <= stageIdx;
                    const curr = i === stageIdx;
                    const last = i === STAGES.length - 1;
                    return (
                      <li key={stage} className="flex items-start">
                        <div className="flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                            curr ? 'bg-[#0f2057] dark:bg-blue-500 border-[#0f2057] dark:border-blue-500 text-white ring-2 ring-[#0f2057]/20 dark:ring-blue-400/30 shadow-md' :
                            done ? 'bg-green-500 border-green-500 text-white shadow-sm' :
                                   'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                          }`}>
                            {done && !curr ? <Check size={12} strokeWidth={3} /> : i + 1}
                          </div>
                          <div className={`text-[9px] mt-1 text-center w-14 leading-tight font-medium ${
                            curr ? 'text-[#0f2057] dark:text-blue-400 font-semibold' : done ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                          }`}>{stage}</div>
                        </div>
                        {!last && (
                          <div className={`w-8 h-0.5 mt-3.5 mx-0.5 flex-shrink-0 rounded-full transition-colors ${
                            stageIdx >= 0 && i < stageIdx ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
                          }`} />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            {/* Checklist Summary */}
            {checklist && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-2">
                    <ClipboardList size={15} className="text-[#0f2057] dark:text-blue-400" />
                    Document Checklist Summary
                  </h2>
                  <button onClick={() => navigate('/checklist')} className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1 hover:text-green-700 dark:hover:text-green-300">
                    View checklist <ChevronRight size={13} />
                  </button>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{acceptedItems.length} of {neededNowItems.length} required documents accepted</span>
                    <span className="font-medium">{checklistProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${checklistProgress >= 75 ? 'bg-green-500' : checklistProgress >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${checklistProgress}%` }}
                    />
                  </div>
                </div>

                {pendingItems.length > 0 && (
                  <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm">
                    <AlertCircle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-800 dark:text-amber-400">{pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} still needed.</span>
                      <span className="text-amber-700 dark:text-amber-500"> Head to the Checklist page to upload them.</span>
                    </div>
                  </div>
                )}

                {pendingItems.length === 0 && neededNowItems.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                    <Check size={15} className="text-green-500" />
                    All required documents have been submitted. Your attorney is reviewing them.
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Upload Documents', sub: 'Add to your checklist', path: '/checklist', color: 'bg-[#0f2057]' },
                { label: 'View Open Tasks', sub: 'See what needs action', path: '/open-tasks', color: 'bg-blue-600' },
                { label: 'Message Attorney', sub: 'Ask a question', path: '/messages', color: 'bg-green-600' },
              ].map(({ label, sub, path, color }) => (
                <button key={path} onClick={() => navigate(path)}
                  className={`${color} text-white rounded-xl p-4 text-left hover:opacity-90 transition-opacity`}>
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs text-white/70 mt-0.5">{sub}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <AttorneyPickerModal
        open={showAttyPicker}
        onClose={() => setShowAttyPicker(false)}
        matterId={matter?.id}
        currentAttorneyId={matter?.attorney_id}
        onAssigned={handleAssigned}
        onInviteInstead={() => setShowInvite(true)}
      />

      {showInvite && <InviteAttorneyModal onClose={() => setShowInvite(false)} />}
    </>
  );
}