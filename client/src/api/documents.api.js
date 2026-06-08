import http from './http';

const documentsApi = {
  list:         params    => http.get('/documents', { params }),
  upload:       formData  => http.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id, status) => http.put(`/documents/${id}/status`, { status }),
  delete:       id        => http.delete(`/documents/${id}`),
  downloadUrl:  id        => `/api/documents/download/${id}`,
};

export default documentsApi;