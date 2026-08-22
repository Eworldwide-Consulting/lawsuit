import { useState } from 'react';
import usersApi from '../../api/users.api';
import { X, Send, AlertCircle, CheckCircle } from 'lucide-react';
import Spinner from '../ui/Spinner';

// Shared across client dashboards — invites an attorney not yet on the platform.
export default function InviteAttorneyModal({ onClose }) {
  const [email, setEmail]     = useState('');
  const [name, setName]       = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try   { setResult((await usersApi.inviteAttorney(email.trim(), name.trim())).data); }
    catch (err) { setResult({ error: err.response?.data?.error || 'Failed to send invite' }); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slideUp">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Invite Your Attorney</h2>
            <p className="text-xs text-gray-500 mt-0.5">Send a registration invite to an attorney not yet on the platform</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Attorney's Name <span className="text-xs text-gray-400">(optional)</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className="form-input" />
            </div>
            <div>
              <label className="form-label">Attorney's Email <span className="text-red-500">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="attorney@lawfirm.com" required className="form-input" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="submit" disabled={sending || !email.trim()}
                className="flex-1 py-2.5 bg-[#0f2057] hover:bg-[#1a3476] text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? <><Spinner size={4} /> Sending…</> : <><Send size={14} /> Send Invite</>}
              </button>
            </div>
          </form>
        ) : result.error ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
              <AlertCircle size={16} /> {result.error}
            </div>
            <button onClick={onClose} className="w-full py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">Close</button>
          </div>
        ) : result.alreadyRegistered ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-400">Already on TriVanta!</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {result.attorney.first_name} {result.attorney.last_name} is already registered. Select them from the attorney list.
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-[#0f2057] text-white rounded-lg text-sm font-semibold hover:bg-[#1a3476]">
              Select from Attorney List
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-green-700 dark:text-green-400">Invite sent!</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  A registration invite was emailed to <strong>{result.email}</strong>. Once they register, select them as your attorney.
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-[#0f2057] text-white rounded-lg text-sm font-semibold hover:bg-[#1a3476]">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
