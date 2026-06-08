import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lp_user')); } catch { return null; }
  });
  // If we already have cached user data, start as not-loading so the UI renders
  // immediately from the cache. Token is validated in the background below.
  const [loading, setLoading] = useState(() => {
    try { return !localStorage.getItem('lp_user'); } catch { return true; }
  });

  useEffect(() => {
    const token = localStorage.getItem('lp_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me().then(res => {
      setUser(res.data);
      localStorage.setItem('lp_user', JSON.stringify(res.data));
    }).catch(() => {
      localStorage.removeItem('lp_token');
      localStorage.removeItem('lp_user');
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem('lp_token', token);
    localStorage.setItem('lp_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('lp_token');
    localStorage.removeItem('lp_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('lp_user', JSON.stringify(updated));
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};