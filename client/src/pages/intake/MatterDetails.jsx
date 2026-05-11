import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Upload, ChevronRight, ArrowLeft } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import StepIndicator from '../../components/ui/StepIndicator';
import Spinner from '../../components/ui/Spinner';
import { mattersApi } from '../../api';

const STEPS = ['Start Here', 'Your Information', 'Matter Details', 'Required Documents', 'Review & Submit'];

const MATTER_TYPES = [
  { value: 'guardianship', label: 'Guardianship' },
  { value: 'conservatorship', label: 'Conservatorship' },
  { value: 'estate_administration', label: 'Estate Administration' },
  { value: 'probate', label: 'Probate' },
  { value: 'other', label: 'Other' },
];

export default function MatterDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const preState = location.state || {};

  const [matterStatus, setMatterStatus] = useState(preState.matterStatus || 'new');
  const [form, setForm] = useState({
    matterType: preState.matterType || '',
    description: '',
    workedWithFirmBefore: '',
    urgent: '',
    importantDate: '',
    hasDocuments: '',
    county: '',
    additionalNotes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleContinue() {
    setLoading(true);
    setError('');
    try {
      const payload = {
        matterType: form.matterType || preState.matterType,
        matterStatus,
        description: form.description,
        county: form.county,
        urgent: form.urgent === 'yes',
        importantDate: form.importantDate || null,
        hasDocuments: form.hasDocuments === 'yes',
        workedWithFirmBefore: form.workedWithFirmBefore === 'yes',
        additionalNotes: form.additionalNotes,
      };
      const res = await mattersApi.create(payload);
      const matterId = res.data.id;
      navigate('/intake/documents', { state: { matterId, matterType: payload.matterType } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save matter details.');
    } finally {
      setLoading(false);
    }
  }

  const variant = matterStatus === 'not_sure' ? 'notsure' : 'intake';

  return (
    <AuthLayout variant={variant}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tell us about your matter.</h1>
        <p className="text-gray-500 text-sm mt-1">Share what you know and we'll help route your request.</p>
      </div>

      <StepIndicator steps={STEPS} current={2} />

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      {/* Matter status selector */}
      <div className="mb-5">
        <label className="form-label">Matter status</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'existing', icon: '📁', label: 'Existing Case' },
            { id: 'new', icon: '✨', label: 'New Matter' },
            { id: 'not_sure', icon: '❓', label: "I'm Not Sure" },
          ].map(opt => (
            <button key={opt.id} onClick={() => setMatterStatus(opt.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all relative ${
                matterStatus === opt.id ? 'border-navy-900 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              {matterStatus === opt.id && <div className="absolute top-1 right-1 w-4 h-4 bg-navy-900 rounded-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
              <span className="text-xl">{opt.icon}</span>
              <span className="text-xs font-semibold text-gray-700 text-center">{opt.label}</span>
            </button>
          ))}
        </div>
        {matterStatus === 'not_sure' && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
            ℹ️ No problem — you can provide a few basic details and your legal team can help fill in the rest.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="form-label">Matter type</label>
          <select value={form.matterType} onChange={set('matterType')} className="form-input">
            <option value="">Select matter type</option>
            {MATTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">What do you need help with?</label>
          <input value={form.description} onChange={set('description')} placeholder="Briefly describe your situation" className="form-input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="form-label">Have you worked with this firm before?</label>
          <div className="flex gap-2">
            {['yes', 'no'].map(v => (
              <button key={v} onClick={() => setForm(f => ({ ...f, workedWithFirmBefore: v }))}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all capitalize ${form.workedWithFirmBefore === v ? 'border-navy-900 bg-blue-50 text-navy-900' : 'border-gray-200 text-gray-600'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Is there an urgent deadline?</label>
          <div className="flex gap-2">
            {['yes', 'no'].map(v => (
              <button key={v} onClick={() => setForm(f => ({ ...f, urgent: v }))}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all capitalize ${form.urgent === v ? 'border-navy-900 bg-blue-50 text-navy-900' : 'border-gray-200 text-gray-600'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="form-label">Important date <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="date" value={form.importantDate} onChange={set('importantDate')} className="form-input" />
        </div>
        <div>
          <label className="form-label">Do you have any legal documents?</label>
          <div className="flex gap-2">
            {['yes', 'no'].map(v => (
              <button key={v} onClick={() => setForm(f => ({ ...f, hasDocuments: v }))}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all capitalize ${form.hasDocuments === v ? 'border-navy-900 bg-blue-50 text-navy-900' : 'border-gray-200 text-gray-600'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="form-label">Upload documents <span className="text-gray-400 font-normal">(optional)</span></label>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-green-400 transition-colors cursor-pointer">
          <Upload size={20} className="mx-auto text-gray-400 mb-1" />
          <div className="text-sm text-gray-500">Drag & drop files here or click to browse</div>
          <div className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, JPG, PNG (Max 20MB each)</div>
        </div>
      </div>

      <div className="mb-4">
        <label className="form-label">Preferred county or location <span className="text-gray-400 font-normal">(optional)</span></label>
        <input value={form.county} onChange={set('county')} placeholder="Enter county or location" className="form-input" />
      </div>

      <div className="mb-5">
        <label className="form-label">Additional notes <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea value={form.additionalNotes} onChange={set('additionalNotes')} rows={3}
          placeholder="Share any additional details that may help us understand your situation"
          className="form-input resize-none" />
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/intake')} className="btn-secondary flex-shrink-0 w-auto px-5">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={handleContinue} disabled={loading} className="btn-primary">
          {loading ? <Spinner size={5} color="text-white" /> : <>Continue <ChevronRight size={16} /></>}
        </button>
      </div>

      <div className="mt-4 text-center flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} /><span>Protected with secure encryption</span>
      </div>
      <div className="text-center text-xs mt-1">
        <button className="text-green-600">Need help? Contact support ↗</button>
      </div>
    </AuthLayout>
  );
}
