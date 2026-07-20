import http from './http';

const formsApi = {
  templates: ()           => http.get('/forms/templates'),
  getIntake:  matterId       => http.get(`/forms/intake/${matterId}`),
  saveIntake: (matterId, data) => http.put(`/forms/intake/${matterId}`, data),
  sent:      (params)     => http.get('/forms/sent',      { params }),
  send:      (data)       => http.post('/forms/send',     data),
  download:  (id)         => http.get(`/forms/download/${id}`, { responseType: 'blob' }),
  revoke:    (id)         => http.delete(`/forms/sent/${id}`),
};

export default formsApi;
