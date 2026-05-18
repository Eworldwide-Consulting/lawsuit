import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/ui/Spinner';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const error  = params.get('error');

    if (error || !token) {
      navigate('/login?error=' + (error || 'unknown'), { replace: true });
      return;
    }

    // Remove token from URL bar immediately
    window.history.replaceState({}, '', '/auth/callback');

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('auth failed');
        return r.json();
      })
      .then(user => {
        login(token, user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => navigate('/login?error=google_failed', { replace: true }));
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <Spinner size={10} />
      <p className="mt-4 text-gray-500 text-sm">Signing you in with Google…</p>
    </div>
  );
}
