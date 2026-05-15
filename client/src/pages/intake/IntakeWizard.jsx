import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronRight, HelpCircle, Plus, FolderOpen } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import StepIndicator from '../../components/ui/StepIndicator';

const MATTER_TYPES = [
  { id: 'guardianship', icon: '👥', title: 'Guardianship', desc: 'Help with medical, personal, and care decisions for a loved one.' },
  { id: 'conservatorship', icon: '💰', title: 'Conservatorship', desc: 'Help managing finances, assets, or property.' },
  { id: 'estate_administration', icon: '📋', title: 'Estate Administration', desc: 'Handling an estate, probate, or settling affairs.' },
  { id: 'existing', icon: '🏛️', title: 'Existing Legal Matter', desc: 'I already have a case or matter with a legal team.' },
  { id: 'not_sure', icon: '❓', title: "I'm Not Sure", desc: 'I need help figuring out what I need.' },
];

const STEPS = ['Start Here', 'Your Information', 'Matter Details', 'Required Documents', 'Review & Submit'];

export default function IntakeWizard() {
  const [selectedType, setSelectedType] = useState('');
  const [matterMode, setMatterMode] = useState('');
  const navigate = useNavigate();

  function handleContinue() {
    if (!selectedType) return;
    if (selectedType === 'not_sure') {
      navigate('/intake/matter-details', { state: { matterStatus: 'not_sure' } });
    } else {
      navigate('/intake/matter-details', { state: { matterType: selectedType, matterMode } });
    }
  }

  return (
    <AuthLayout variant="intake">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-navy-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">⚖️</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Trivanta</h1>
        <p className="text-gray-500 text-sm mt-1">Let's get started. We'll guide you to the right support.</p>
      </div>

      <StepIndicator steps={STEPS} current={0} />

      <div className="mb-6">
        <h2 className="font-semibold text-gray-800 mb-3">Start Here</h2>
        <p className="text-sm text-gray-600 mb-4">What are you here for?</p>

        <div className="grid grid-cols-1 gap-2">
          {MATTER_TYPES.map(t => (
            <button key={t.id} onClick={() => setSelectedType(t.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                selectedType === t.id ? 'border-navy-900 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <span className="text-2xl flex-shrink-0">{t.icon}</span>
              <div>
                <div className={`font-semibold text-sm ${selectedType === t.id ? 'text-navy-900' : 'text-gray-800'}`}>{t.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
              </div>
              {selectedType === t.id && <div className="ml-auto w-5 h-5 rounded-full bg-navy-900 flex items-center justify-center flex-shrink-0"><div className="w-2 h-2 rounded-full bg-white" /></div>}
            </button>
          ))}
        </div>
      </div>

      {selectedType && selectedType !== 'not_sure' && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Are you starting something new or connecting to an existing matter?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'new', icon: <Plus size={18} />, title: 'New Matter', desc: "I'm starting something new and don't have a case number yet." },
              { id: 'existing', icon: <FolderOpen size={18} />, title: 'Existing Case', desc: 'I already have a case or matter in progress.' },
              { id: 'not_sure', icon: <HelpCircle size={18} />, title: 'Not Sure', desc: "I'm not sure which applies." },
            ].map(opt => (
              <button key={opt.id} onClick={() => setMatterMode(opt.id)}
                className={`flex flex-col items-center p-3 rounded-xl border-2 text-center gap-1 transition-all ${
                  matterMode === opt.id ? 'border-navy-900 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <div className={matterMode === opt.id ? 'text-navy-900' : 'text-gray-500'}>{opt.icon}</div>
                <div className="font-semibold text-xs text-gray-800">{opt.title}</div>
                <div className="text-[10px] text-gray-500 leading-tight">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 mb-5 flex gap-2">
        <span>ℹ️</span>
        <span>Don't worry if you don't have all the details yet — you can continue and fill in more later.</span>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/intake/matter-details', { state: { matterStatus: 'not_sure' } })}
          className="btn-secondary flex-shrink-0 w-auto px-4 text-sm">I'm not sure</button>
        <button onClick={handleContinue} disabled={!selectedType} className="btn-primary">
          Continue <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-5 text-center space-y-2 text-xs text-gray-400">
        <div className="flex items-center justify-center gap-2"><Shield size={12} /><span>Protected with secure encryption</span></div>
        <div>Need help? <button className="text-green-600 font-medium">Contact support ↗</button></div>
      </div>
    </AuthLayout>
  );
}
