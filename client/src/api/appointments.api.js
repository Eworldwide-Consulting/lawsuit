import http from './http';

const appointmentsApi = {
  list:     () => http.get('/appointments'),
  upcoming: () => http.get('/appointments/upcoming'),
  create:   d  => http.post('/appointments', d),
  delete:   id => http.delete(`/appointments/${id}`),
  markNoShow: id => http.put(`/appointments/${id}/status`, { status: 'no_show' }),
  reschedule: (id, d) => http.post(`/appointments/${id}/reschedule`, d),
};

export default appointmentsApi;