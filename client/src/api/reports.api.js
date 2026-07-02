import http from './http';

const reportsApi = {
  overview:    (params) => http.get('/reports/overview',    { params }),
  revenue:     (params) => http.get('/reports/revenue',     { params }),
  cases:       (params) => http.get('/reports/cases',       { params }),
  clients:     (params) => http.get('/reports/clients',     { params }),
  documents:   (params) => http.get('/reports/documents',   { params }),
  performance: (params) => http.get('/reports/performance', { params }),
};

export default reportsApi;
