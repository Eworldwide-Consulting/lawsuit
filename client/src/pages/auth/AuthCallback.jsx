import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/ui/Spinner';

const PROVIDER_LABELS = {
  google:    'Google',
  microsoft: 'Microsoft',
  admin:     'Admin Portal',
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [provider, setProvider] = useState('');

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const token    = params.get('token');
    const error    = params.get('error');
    const prov     = params.get('provider') || 'google';
    const isNew    = params.get('isNew') === '1';
    setProvider(prov);

    // New attorney signup via Google — no JWT yet, the account still needs its
    // emailed code confirmed. Hand off to the same /verify screen the password
    // login OTP uses, just in "attorney_signup" mode.
    const attorneyVerify = params.get('attorneyVerify') === '1';
    const tempToken       = params.get('tempToken');
    if (attorneyVerify && tempToken) {
      window.history.replaceState({}, '', '/auth/callback');
      sessionStorage.setItem('lp_temp_token', tempToken);
      sessionStorage.setItem('lp_otp_mode', 'attorney_signup');
      sessionStorage.setItem('lp_otp_email', params.get('maskedEmail') || '');
      navigate('/verify', { replace: true });
      return;
    }

    if (error || !token) {
      navigate('/login?error=' + (error || 'unknown'), { replace: true });
      return;
    }

    window.history.replaceState({}, '', '/auth/callback');

    // Flag new Google users so DashboardLayout can show the profile-completion modal.
    if (isNew) sessionStorage.setItem('lp_needs_profile', '1');

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('auth failed');
        return r.json();
      })
      .then(user => {
        login(token, user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => navigate(`/login?error=${prov}_failed`, { replace: true }));
  }, []);

  const label = PROVIDER_LABELS[provider] || provider || 'your account';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <Spinner size={10} />
      <p className="mt-4 text-gray-500 text-sm">Signing you in with {label}…</p>
    </div>
  );
}
