import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('lp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lp_token');
      localStorage.removeItem('lp_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: d => api.post('/auth/login', d),
  register: d => api.post('/auth/register', d),
  verify2fa: d => api.post('/auth/verify-2fa', d),
  me: () => api.get('/auth/me'),
  updateProfile: d => api.put('/auth/profile', d),
  changePassword: d => api.put('/auth/change-password', d),
};

export const mattersApi = {
  list: () => api.get('/matters'),
  get: id => api.get(`/matters/${id}`),
  create: d => api.post('/matters', d),
  update: (id, d) => api.put(`/matters/${id}`, d),
  timeline: id => api.get(`/matters/${id}/timeline`),
  stats: () => api.get('/matters/stats/overview'),
};

export const documentsApi = {
  list: params => api.get('/documents', { params }),
  upload: (formData) => api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id, status) => api.put(`/documents/${id}/status`, { status }),
  delete: id => api.delete(`/documents/${id}`),
  downloadUrl: id => `/api/documents/download/${id}`,
};

export const messagesApi = {
  inbox: () => api.get('/messages'),
  sent: () => api.get('/messages/sent'),
  send: d => api.post('/messages', d),
  markRead: id => api.put(`/messages/${id}/read`),
  unreadCount: () => api.get('/messages/unread-count'),
};

export const appointmentsApi = {
  list: () => api.get('/appointments'),
  upcoming: () => api.get('/appointments/upcoming'),
  create: d => api.post('/appointments', d),
  delete: id => api.delete(`/appointments/${id}`),
};

export const tasksApi = {
  list: () => api.get('/tasks'),
  create: d => api.post('/tasks', d),
  update: (id, d) => api.put(`/tasks/${id}`, d),
};

export const dashboardApi = {
  client: () => api.get('/dashboard/client'),
  attorney: () => api.get('/dashboard/attorney'),
  partner: () => api.get('/dashboard/partner'),
};

export const usersApi = {
  list: () => api.get('/users'),
  attorneys: () => api.get('/users/attorneys'),
  clients: () => api.get('/users/clients'),
};

export default api;
