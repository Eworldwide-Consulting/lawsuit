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
  checkEmail: email => api.get('/auth/check-email', { params: { email } }),
  verifyEmail: token => api.get('/auth/verify-email', { params: { token } }),
  resendVerification: email => api.post('/auth/resend-verification', { email }),
  setup2fa: () => api.post('/auth/setup-2fa'),
  enable2fa: code => api.post('/auth/enable-2fa', { code }),
  dismiss2faPrompt: () => api.post('/auth/dismiss-2fa-prompt'),
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

export const paymentsApi = {
  list: () => api.get('/payments'),
  createInvoice: d => api.post('/payments/invoice', d),
  checkout: invoiceId => api.post(`/payments/checkout/${invoiceId}`),
  confirm: sessionId => api.get(`/payments/confirm/${sessionId}`),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  users: () => api.get('/admin/users'),
  pending: () => api.get('/admin/pending'),
  approve: id => api.post(`/admin/users/${id}/approve`),
  reject: (id, notes) => api.post(`/admin/users/${id}/reject`, { notes }),
  changeRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
  forceVerify: id => api.post(`/admin/users/${id}/verify-email`),
  resendInvite: id => api.post(`/admin/users/${id}/resend-invite`),
  activity: () => api.get('/admin/activity'),
  health: () => api.get('/admin/health'),
  dbStats: () => api.get('/admin/db-stats'),
};

export default api;
