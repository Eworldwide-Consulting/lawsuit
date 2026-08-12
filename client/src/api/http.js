import axios from 'axios';

const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use(config => {
  const token = localStorage.getItem('lp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  res => res,
  err => {
    // Only force-redirect when an *authenticated* session token was rejected.
    // The login endpoint itself returns 401 for wrong credentials — we must NOT
    // redirect there, otherwise the catch block in the login form never runs.
    if (err.response?.status === 401 && localStorage.getItem('lp_token')) {
      localStorage.removeItem('lp_token');
      localStorage.removeItem('lp_user');
      window.location.href = '/login';
    }

    // An account frozen or closed mid-session: the token is still valid but the
    // server refuses every authenticated route, so end the session here instead
    // of leaving the user on a dashboard where nothing loads.
    const code = err.response?.data?.code;
    if (err.response?.status === 403 &&
        (code === 'ACCOUNT_SUSPENDED' || code === 'ACCOUNT_DELETED') &&
        localStorage.getItem('lp_token')) {
      localStorage.removeItem('lp_token');
      localStorage.removeItem('lp_user');
      window.location.href = `/login?error=${code === 'ACCOUNT_SUSPENDED' ? 'account_suspended' : 'account_deleted'}`;
    }

    return Promise.reject(err);
  }
);

export default http;