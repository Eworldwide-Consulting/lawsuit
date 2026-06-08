import http from './http';

const messagesApi = {
  inbox:       ()  => http.get('/messages'),
  sent:        ()  => http.get('/messages/sent'),
  send:        d   => http.post('/messages', d),
  markRead:    id  => http.put(`/messages/${id}/read`),
  unreadCount: ()  => http.get('/messages/unread-count'),
};

export default messagesApi;