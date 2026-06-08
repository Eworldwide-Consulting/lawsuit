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
    return Promise.reject(err);
  }
);

export default http;