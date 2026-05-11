import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Upload, ArrowLeft, ChevronRight, Phone, MessageSquare } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import StepIndicator from '../../components/ui/StepIndicator';

const STEPS = ['Start Here', 'Your Information', 'Matter Details', 'Required Documents', 'Review & Submit'];

const GUARDIANSHIP_DOCS = [
  {
    section: '1. Court & Legal Documents', icon: '📜',
    items: [
      { label: 'Petition or court filing', required: true },
      { label: 'Letters of guardianship / court order', required: true },
      { label: 'Prior court notices', required: false },
    ],
  },
  {
    section: '2. Medical & Care Information', icon: '🏥',
    items: [
      { label: 'Physician evaluation or incapacity documentation', required: true },
      { label: 'Medication list', required: false },
      { label: 'Care plan or provider information', required: false },
    ],
  },
  {
    section: '3. Assets & Property Information', icon: '🏠',
    items: [
      { label: 'List of assets and estimated values', required: true },
      { label: 'Real estate / house ownership documents', required: false },
      { label: 'Property tax assessment or home value assessment', required: false },
      { label: 'Vehicle title and car value information', required: false },
      { label: 'Stocks and brokerage account statements', required: false },
      { label: 'Retirement account statements', required: false },
      { label: 'Business interests or other property of value', required: false },
      { label: 'Other valuables or personal property with value', required: false },
    ],
  },
  {
    section: '4. Personal Information', icon: '👤',
    items: [
      { label: 'Government ID', required: true },
      { label: 'Birth certificate or identifying record', required: true },
      { label: 'Social Security information', required: false },
    ],
  },
  {
    section: '5. Bank, Financial & Benefits Documents', icon: '🏦',
    items: [
      { label: 'Bank statements', required: true },
      { label: 'Checkbook or account records', required: false },
      { label: 'Benefit statements', required: false },
      { label: 'Insurance cards', required: false },
      { label: 'Income records', required: false },
    ],
  },
  {
    section: '6. Additional Supporting Documents', icon: '📎',
    items: [
      { label: 'Emergency contacts', required: false },
      { label: 'Living arrangement details', required: false },
      { label: 'Other supporting files', required: false },
      { label: 'Anything else of value or financially relevant', required: false },
    ],
  },
];

const CONSERVATORSHIP_DOCS = [
  {
    section: '1. Court & Legal Documents', icon: '📜',
    items: [
      { label: 'Petition or court filing', required: true },
      { label: 'Letters of conservatorship / court order', required: true },
      { label: 'Prior court notices', required: false },
    ],
  },
  {
    section: '2. Personal Information', icon: '👤',
    items: [
      { label: 'Government ID', required: true },
      { label: 'Birth certificate or identifying record', required: true },
      { label: 'Social Security information', required: false },
    ],
  },
  {
    section: '3. Medical & Capacity Information', icon: '🏥',
    items: [
      { label: 'Physician evaluation or incapacity documentation', required: true },
      { label: 'Medication list', required: false },
      { label: 'Care plan or provider information', required: false },
    ],
  },
  {
    section: '4. Bank, Financial & Benefits Documents', icon: '🏦',
    items: [
      { label: 'Bank statements', required: true },
      { label: 'Checkbook or account records', required: false },
      { label: 'Benefit statements', required: false },
      { label: 'Insurance cards', required: false },
      { label: 'Income records', required: false },
    ],
  },
  {
    section: '5. Assets, Property & Value Information', icon: '🏠',
    items: [
      { label: 'List of assets and estimated values', required: true },
      { label: 'Real estate / house ownership documents', required: true },
      { label: 'Property tax assessment or home value assessment', required: false },
      { label: 'Vehicle title and car value information', required: false },
      { label: 'Stocks and brokerage account statements', required: false },
      { label: 'Retirement account statements', required: false },
      { label: 'Business interests or other property of value', required: false },
      { label: 'Other valuables or personal property with value', required: false },
    ],
  },
  {
    section: '6. Debts & Liabilities', icon: '💳',
    items: [
      { label: 'Mortgage statements', required: false },
      { label: 'Credit card statements', required: false },
      { label: 'Loan documents', required: false },
      { label: 'Medical bills or other outstanding obligations', required: false },
    ],
  },
  {
    section: '7. Additional Supporting Documents', icon: '📎',
    items: [
      { label: 'Emergency contacts', required: false },
      { label: 'Living arrangement details', required: false },
      { label: 'Other supporting files', required: false },
      { label: 'Anything else of value or financially relevant', required: false },
    ],
  },
];

export default function RequiredDocuments() {
  const navigate = useNavigate();
  const location = useLocation();
  const { matterId, matterType } = location.state || {};
  const [checked, setChecked] = useState({});
  const [notes, setNotes] = useState('');

  const isConservatorship = matterType === 'conservatorship';
  const docSections = isConservatorship ? CONSERVATORSHIP_DOCS : GUARDIANSHIP_DOCS;
  const title = isConservatorship ? 'Required Conservatorship Documents' : 'Required Guardianship Documents';

  const toggle = key => setChecked(c => ({ ...c, [key]: !c[key] }));

  return (
    <AuthLayout variant="documents">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500 text-sm mt-1">Here's what you'll likely need to provide for your {isConservatorship ? 'conservatorship' : 'guardianship'} matter.</p>
      </div>

      <StepIndicator steps={STEPS} current={3} />

      <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 mb-4 flex gap-2">
        <span>ℹ️</span>
        <span>You can upload what you have now and provide the rest later. Your legal team can help you identify any missing items.</span>
      </div>

      <div className="space-y-4 mb-4 max-h-[50vh] overflow-y-auto pr-1">
        <div className="grid md:grid-cols-2 gap-4">
          {docSections.map((section, si) => (
            <div key={si} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span>{section.icon}</span>
                <span className="text-xs font-bold text-gray-800">{section.section}</span>
              </div>
              <div className="space-y-1.5">
                {section.items.map((item, ii) => {
                  const key = `${si}-${ii}`;
                  return (
                    <label key={key} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)}
                        className="w-3.5 h-3.5 rounded text-green-500 flex-shrink-0" />
                      <span className={`text-xs flex-1 ${checked[key] ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.label}</span>
                      <span className={`text-[10px] font-medium flex-shrink-0 ${item.required ? 'text-red-500' : 'text-gray-400'}`}>
                        {item.required ? 'Required' : 'If available'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center mb-4 hover:border-green-400 transition-colors cursor-pointer">
        <Upload size={20} className="mx-auto text-gray-400 mb-1" />
        <div className="text-sm text-gray-600">Drag & drop files here or click to browse</div>
        <div className="text-xs text-gray-400 mt-1">Accepted file types: PDF, JPG, PNG, DOC, DOCX</div>
      </div>

      <div className="mb-4">
        <label className="form-label">Notes about missing documents or questions <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={500}
          placeholder="Let your legal team know if you're missing anything or have questions about any of the required documents."
          className="form-input resize-none" />
        <div className="text-right text-xs text-gray-400 mt-1">{notes.length}/500</div>
      </div>

      {/* Help sidebar-style */}
      <div className="border border-gray-200 rounded-xl p-4 mb-4 bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🎧</span>
          <div>
            <div className="text-sm font-semibold text-gray-800">Need help?</div>
            <div className="text-xs text-gray-500">We're here to support you through every step.</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center gap-2 border border-gray-300 rounded-lg p-2 text-xs font-medium hover:bg-white transition-colors">
            <Phone size={14} className="text-navy-900" /> Schedule a Call
          </button>
          <button className="flex items-center gap-2 border border-gray-300 rounded-lg p-2 text-xs font-medium hover:bg-white transition-colors">
            <MessageSquare size={14} className="text-navy-900" /> Contact Support
          </button>
        </div>
        <div className="mt-3 flex items-start gap-2 text-xs text-gray-500">
          <Shield size={12} className="flex-shrink-0 mt-0.5" />
          <span>Your privacy matters. Your documents are securely encrypted and only shared with your legal team.</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/intake/matter-details')} className="btn-secondary flex-shrink-0 w-auto px-5">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Continue <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield size={12} /><span>Protected with secure encryption</span>
      </div>
    </AuthLayout>
  );
}
