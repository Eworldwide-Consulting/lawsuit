import http from './http';

const formsApi = {
  templates: ()           => http.get('/forms/templates'),
  getGuardianship:  matterId => http.get('/forms/guardianship', { params: { matterId } }),
  saveGuardianship: data     => http.put('/forms/guardianship', data),
  sent:      (params)     => http.get('/forms/sent',      { params }),
  send:      (data)       => http.post('/forms/send',     data),
  download:  (id)         => http.get(`/forms/download/${id}`, { responseType: 'blob' }),
  revoke:    (id)         => http.delete(`/forms/sent/${id}`),
};

export default formsApi;
