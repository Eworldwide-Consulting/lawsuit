import http from './http';

const notificationsApi = {
  list:        (params) => http.get('/notifications', { params }),
  markRead:    (id)     => http.put(`/notifications/${id}/read`),
  markAllRead: ()       => http.put('/notifications/read-all'),
};

export default notificationsApi;