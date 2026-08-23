import http from './http';

const adminApi = {
  stats:       ()           => http.get('/admin/stats'),
  users:       ()           => http.get('/admin/users'),
  pending:     ()           => http.get('/admin/pending'),
  approve:     id           => http.put(`/admin/users/${id}/approve`),
  reject:      (id, notes)  => http.put(`/admin/users/${id}/reject`, { notes }),
  changeRole:  (id, role)   => http.put(`/admin/users/${id}/role`, { role }),
  resetPassword: (id, newPassword) => http.put(`/admin/users/${id}/reset-password`, { newPassword }),
  forceVerify: id           => http.post(`/admin/users/${id}/force-verify`),
  resendInvite: id          => http.post(`/admin/users/${id}/resend-verification`),
  userProfile: id           => http.get(`/admin/users/${id}/profile`),
  suspend:     (id, reason) => http.put(`/admin/users/${id}/suspend`, { reason }),
  reactivate:  id           => http.put(`/admin/users/${id}/reactivate`),
  // Soft delete: case history is kept, but the email is released so the same
  // address can be used to register a new account.
  deleteUser:  id           => http.delete(`/admin/users/${id}`),
  activity:    ()           => http.get('/admin/activity'),
  health:      ()           => http.get('/admin/health'),
  dbStats:     ()           => http.get('/admin/db-stats'),
};

export default adminApi;