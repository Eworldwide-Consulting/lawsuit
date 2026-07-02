import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import { User, Lock, Bell, Shield, Check, ShieldCheck, ShieldOff, Link2, Unlink } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import TwoFASetupModal from '../components/ui/TwoFASetupModal';

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ firstName: user?.first_name || '', lastName: user?.last_name || '', phone: user?.phone || '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  async function disable2fa() {
    if (!window.confirm('Are you sure you want to disable two-factor authentication? Your account will be less secure.')) return;
    setDisabling2FA(true);
    try {
      await authApi.disable2fa();
      updateUser({ two_fa_enabled: 0, two_fa_prompt_shown: 0 });
      setSaved('Two-factor authentication has been disabled.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable 2FA. Please try again.');
    } finally {
      setDisabling2FA(false);
    }
  }

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

  async function disconnectGoogle() {
    if (!window.confirm('Disconnect your Google account? You will need your password to log in.')) return;
    setDisconnectingGoogle(true);
    setError(''); setSaved('');
    try {
      await authApi.googleDisconnect();
      updateUser({ has_google: false, login_provider: 'email' });
      setSaved('Google account disconnected. You can now log in with email and password.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disconnect Google. Please try again.');
    } finally {
      setDisconnectingGoogle(false);
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'connected', label: 'Connected Accounts', icon: Link2 },
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  {user?.two_fa_enabled
                    ? <ShieldCheck size={16} className="text-green-500" />
                    : <Shield size={16} className="text-gray-400" />}
                  Two-Factor Authentication
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {user?.two_fa_enabled
                    ? 'Your account is protected with an authenticator app. A 6-digit code is required at every login.'
                    : 'Add an extra layer of security. Each login will require a 6-digit code from your authenticator app.'}
                </p>
              </div>
              {user?.two_fa_enabled
                ? <span className="badge badge-green flex-shrink-0">Enabled</span>
                : <span className="badge badge-gray flex-shrink-0">Not enabled</span>}
            </div>

            <div className="mt-4 flex items-center gap-3">
              {user?.two_fa_enabled ? (
                <button
                  onClick={disable2fa}
                  disabled={disabling2FA}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {disabling2FA
                    ? <Spinner size={4} color="text-red-500" />
                    : <><ShieldOff size={14} /> Disable 2FA</>}
                </button>
              ) : (
                <button
                  onClick={() => { setError(''); setSaved(''); setShow2FA(true); }}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-[#0f2057] text-white rounded-lg hover:bg-[#1a3476] transition-colors"
                >
                  <ShieldCheck size={14} /> Enable 2FA
                </button>
              )}
            </div>

            {!user?.two_fa_enabled && (
              <p className="mt-3 text-xs text-gray-400">
                Works with Google Authenticator, Authy, or any TOTP-compatible app.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === 'connected' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Link2 size={16} /> Connected Accounts
            </h2>

            {/* Google */}
            <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.5 2.3 30.1 0 24 0 14.7 0 6.6 5.5 2.8 13.5l7.8 6.1C12.5 13.1 17.8 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.9 24.5c0-1.7-.1-3.3-.4-4.9H24v9.3h12.9c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.3-10.1 7.3-17.4z"/>
                    <path fill="#FBBC05" d="M10.6 28.6A14.7 14.7 0 019.5 24c0-1.6.3-3.2.9-4.6L2.6 13.3A23.8 23.8 0 000 24c0 3.8.9 7.4 2.6 10.6l8-6z"/>
                    <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.4l-7.5-5.8c-2 1.4-4.6 2.2-7.5 2.2-6.2 0-11.5-3.6-13.5-9.4l-8 6.1C6.6 42.5 14.7 48 24 48z"/>
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">Google</div>
                  <div className="text-xs text-gray-500">
                    {user?.has_google
                      ? 'Your Google account is connected. You can sign in with Google.'
                      : 'Connect your Google account for faster sign-in.'}
                  </div>
                </div>
              </div>

              {user?.has_google ? (
                <div className="flex items-center gap-3">
                  <span className="badge badge-green flex-shrink-0">Connected</span>
                  <button
                    onClick={disconnectGoogle}
                    disabled={disconnectingGoogle}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {disconnectingGoogle
                      ? <Spinner size={4} color="text-red-500" />
                      : <><Unlink size={13} /> Disconnect</>}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { window.location.href = '/api/auth/google'; }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Link2 size={13} /> Connect
                </button>
              )}
            </div>

            {user?.has_google && !user?.login_provider?.includes('email') && (
              <p className="mt-3 text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
                You signed up with Google. To disconnect, first set a password via the Security tab so you don't lose access to your account.
              </p>
            )}
          </div>
        </div>
      )}

      {show2FA && (
        <TwoFASetupModal
          onClose={() => {
            setShow2FA(false);
            if (user?.two_fa_enabled) setSaved('Two-factor authentication has been enabled successfully.');
          }}
          mandatory={false}
        />
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
