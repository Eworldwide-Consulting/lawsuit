import http from './http';

const mattersApi = {
  list:           ()           => http.get('/matters'),
  get:            id           => http.get(`/matters/${id}`),
  create:         d            => http.post('/matters', d),
  update:         (id, d)      => http.put(`/matters/${id}`, d),
  timeline:       id           => http.get(`/matters/${id}/timeline`),
  stats:          ()           => http.get('/matters/stats/overview'),
  assignAttorney: (id, attyId) => http.post(`/matters/${id}/assign-attorney`, { attorney_id: attyId }),
};

export default mattersApi;