import http from './http';

const documentsApi = {
  list:          params      => http.get('/documents', { params }),
  upload:        formData    => http.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:        (id, data)  => http.patch(`/documents/${id}`, data),
  updateStatus:  (id, status)=> http.put(`/documents/${id}/status`, { status }),
  delete:        id          => http.delete(`/documents/${id}`),
  submitForReview: id        => http.post(`/documents/${id}/submit-review`),
  pendingReview: ()          => http.get('/documents/pending-review'),
  viewUrl:       id          => `/api/documents/view/${id}`,
  downloadUrl:   id          => `/api/documents/download/${id}`,
};

export default documentsApi;