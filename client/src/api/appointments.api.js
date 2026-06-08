import http from './http';

const appointmentsApi = {
  list:     () => http.get('/appointments'),
  upcoming: () => http.get('/appointments/upcoming'),
  create:   d  => http.post('/appointments', d),
  delete:   id => http.delete(`/appointments/${id}`),
};

export default appointmentsApi;