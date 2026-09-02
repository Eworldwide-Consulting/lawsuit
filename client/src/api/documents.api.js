import http from './http';

const documentsApi = {
  list:          params      => http.get('/documents', { params }),
  upload:        formData    => http.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:        (id, data)  => http.patch(`/documents/${id}`, data),
  updateStatus:  (id, status, note) => http.put(`/documents/${id}/status`, { status, note }),
  reupload:      (id, formData) => http.post(`/documents/${id}/reupload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete:        id          => http.delete(`/documents/${id}`),
  submitForReview: id        => http.post(`/documents/${id}/submit-review`),
  pendingReview: ()          => http.get('/documents/pending-review'),
  viewUrl:       id          => `/api/documents/view/${id}`,
  downloadUrl:   id          => `/api/documents/download/${id}`,
  // Plain <a href> navigation never carries the Bearer token (it's attached
  // by an axios interceptor, not a cookie), so viewUrl/downloadUrl above hit
  // a 401 instead of the real file. These fetch the file through the
  // authenticated axios instance instead.
  viewBlob:      id          => http.get(`/documents/view/${id}`, { responseType: 'blob' }),
  downloadBlob:  id          => http.get(`/documents/download/${id}`, { responseType: 'blob' }),
};

export default documentsApi;