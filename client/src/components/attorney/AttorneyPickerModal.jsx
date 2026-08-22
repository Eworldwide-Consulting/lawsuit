import { useState, useEffect } from 'react';
import usersApi from '../../api/users.api';
import mattersApi from '../../api/matters.api';
import { X, Mail, Check } from 'lucide-react';
import Spinner from '../ui/Spinner';

function AttorneyCard({ attorney, isCurrent, onAssign, assigning }) {
  const specs = attorney.specializations?.split(',').slice(0, 2).join(', ') || null;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
      isCurrent
        ? 'border-green-200 dark:border-green-700 bg-green-50/40 dark:bg-green-900/10'
        : 'border-gray-100 dark:border-gray-700 hover:border-[#0f2057]/30 hover:bg-blue-50/30 dark:hover:bg-blue-900/10'
    }`}>
      <div className="w-10 h-10 rounded-full bg-[#0f2057] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {attorney.avatar_initials || `${attorney.first_name[0]}${attorney.last_name[0]}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {attorney.first_name} {attorney.last_name}
          <span className="ml-1.5 text-xs text-gray-400 font-normal capitalize">{attorney.role}</span>
        </div>
        {specs && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{specs}</div>}
        {attorney.years_experience && <div className="text-xs text-gray-400">{attorney.years_experience} yrs experience</div>}
      </div>
      {isCurrent ? (
        <span className="flex-shrink-0 text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1 px-3 py-1.5">
          <Check size={12} strokeWidth={3} /> Current
        </span>
      ) : (
        <button onClick={() => onAssign(attorney.id)} disabled={assigning}
          className="flex-shrink-0 text-xs font-semibold bg-[#0f2057] text-white px-3 py-1.5 rounded-lg hover:bg-[#1a3476] disabled:opacity-50 transition-colors">
          {assigning ? '...' : 'Select'}
        </button>
      )}
    </div>
  );
}

// Shared attorney selection / change-attorney modal, used by every client-facing
// dashboard (ClientDashboard, MyCase, ...) so the flow behaves identically everywhere.
export default function AttorneyPickerModal({
  open, onClose, matterId, currentAttorneyId, onAssigned, onInviteInstead,
}) {
  const [attorneys, setAttorneys] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open || attorneys.length) return;
    setLoading(true);
    usersApi.availableAttorneys()
      .then(r => setAttorneys(r.data || []))
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  async function handleAssign(attorneyId) {
    if (!matterId) return;
    setAssigning(true);
    try {
      await mattersApi.assignAttorney(matterId, attorneyId);
      onAssigned?.('Attorney request sent! They will review and accept your case.');
      onClose();
    } catch (err) {
      onAssigned?.(err.response?.data?.error || 'Failed to assign attorney', true);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <div className="font-bold text-gray-900 dark:text-white">
              {currentAttorneyId ? 'Change Your Attorney' : 'Choose Your Attorney'}
            </div>
            <div className="text-xs text-gray-500">
              {currentAttorneyId ? 'Select a different attorney to handle your case' : 'Select an attorney to handle your case'}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : attorneys.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <div className="text-gray-400 text-sm">No attorneys available at this time</div>
              <button onClick={() => { onClose(); onInviteInstead?.(); }}
                className="text-xs bg-[#0f2057] text-white px-4 py-2 rounded-lg hover:bg-[#1a3476]">
                Invite Your Attorney by Email
              </button>
            </div>
          ) : attorneys.map(a => (
            <AttorneyCard key={a.id} attorney={a} isCurrent={a.id === currentAttorneyId} onAssign={handleAssign} assigning={assigning} />
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
          <button onClick={() => { onClose(); onInviteInstead?.(); }}
            className="w-full text-xs text-[#0f2057] dark:text-blue-400 font-medium flex items-center justify-center gap-1 hover:underline">
            <Mail size={12} /> My attorney isn't listed — invite them
          </button>
        </div>
      </div>
    </div>
  );
}
