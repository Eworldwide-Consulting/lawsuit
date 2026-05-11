import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import { User, Lock, Bell, Shield, Check } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ firstName: user?.first_name || '', lastName: user?.last_name || '', phone: user?.phone || '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true); setError(''); setSaved('');
    try {
      await authApi.updateProfile(profile);
      updateUser({ first_name: profile.firstName, last_name: profile.lastName, phone: profile.phone });
      setSaved('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally { setSaving(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwd.newPassword !== pwd.confirm) return setError('Passwords do not match');
    if (pwd.newPassword.length < 8) return setError('Password must be at least 8 characters');
    setSaving(true); setError(''); setSaved('');
    try {
      await authApi.changePassword({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      setSaved('Password changed successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally { setSaving(false); }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setError(''); setSaved(''); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${tab === id ? 'text-navy-900 border-b-2 border-navy-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {saved && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2"><Check size={16} />{saved}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Personal Information</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-navy-900 text-white rounded-full flex items-center justify-center text-xl font-bold">
              {user?.avatar_initials}
            </div>
            <div>
              <div className="font-semibold text-gray-800">{user?.first_name} {user?.last_name}</div>
              <div className="text-sm text-gray-500 capitalize">{user?.role}</div>
              <div className="text-sm text-gray-400">{user?.email}</div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">First name</label>
              <input value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} className="form-input" />
            </div>
            <div>
              <label className="form-label">Last name</label>
              <input value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} className="form-input" />
            </div>
          </div>
          <div>
            <label className="form-label">Phone number</label>
            <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className="form-input" />
          </div>
          <div>
            <label className="form-label">Email address</label>
            <input type="email" value={user?.email} disabled className="form-input bg-gray-50 text-gray-500" />
            <p className="text-xs text-gray-400 mt-1">Contact support to change your email address.</p>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-auto px-8 ml-auto flex">
            {saving ? <Spinner size={4} color="text-white" /> : 'Save Changes'}
          </button>
        </form>
      )}

      {tab === 'security' && (
        <div className="space-y-4">
          <form onSubmit={changePassword} className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Change Password</h2>
            <div>
              <label className="form-label">Current password</label>
              <input type="password" value={pwd.currentPassword} onChange={e => setPwd(p => ({ ...p, currentPassword: e.target.value }))} required className="form-input" />
            </div>
            <div>
              <label className="form-label">New password</label>
              <input type="password" value={pwd.newPassword} onChange={e => setPwd(p => ({ ...p, newPassword: e.target.value }))} required minLength={8} className="form-input" />
            </div>
            <div>
              <label className="form-label">Confirm new password</label>
              <input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} required className="form-input" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-auto px-8 flex ml-auto">
              {saving ? <Spinner size={4} color="text-white" /> : <><Lock size={14} /> Update Password</>}
            </button>
          </form>

          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Shield size={16} className="text-green-500" /> Two-Factor Authentication</h2>
                <p className="text-sm text-gray-500 mt-1">Add an extra layer of security to your account.</p>
              </div>
              <span className="badge badge-gray">Not enabled</span>
            </div>
            <button className="mt-4 btn-outline w-auto px-6 flex">Enable 2FA</button>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Notification Preferences</h2>
          {[
            { label: 'Upcoming appointment reminders', desc: 'Get notified before your scheduled appointments' },
            { label: 'Deadline alerts', desc: 'Reminders for upcoming document and filing deadlines' },
            { label: 'New messages', desc: 'Notifications when you receive a new message' },
            { label: 'Task updates', desc: 'Updates when tasks are assigned or completed' },
            { label: 'Document status changes', desc: 'When documents are reviewed or approved' },
          ].map(({ label, desc }) => (
            <label key={label} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 mt-0.5 text-green-500 rounded" />
              <div>
                <div className="text-sm font-medium text-gray-700">{label}</div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
            </label>
          ))}
          <button className="btn-primary w-auto px-8 flex ml-auto mt-2">Save Preferences</button>
        </div>
      )}
    </div>
  );
}
