import http from './http';

const paymentsApi = {
  list:           (params)    => http.get('/payments', { params }),
  createInvoice:  d           => http.post('/payments/invoice', d),
  updateInvoice:  (id, d)     => http.put(`/payments/invoice/${id}`, d),
  deleteInvoice:  id          => http.delete(`/payments/invoice/${id}`),
  checkout:       invoiceId   => http.post(`/payments/checkout/${invoiceId}`),
  confirm:        sessionId   => http.get(`/payments/confirm/${sessionId}`),
  primeCheckout:  ()          => http.post('/payments/prime-checkout'),
  planStatus:     ()          => http.get('/payments/plan-status'),
  refund:         (invoiceId, reason) => http.post('/payments/refund', { invoiceId, reason }),
  receipt:        invoiceId   => `/api/payments/receipt/${invoiceId}`,
  exportCsv:      (params)    => http.get('/payments/export', { params, responseType: 'blob' }),
  stats:          ()          => http.get('/payments/stats'),
};

export default paymentsApi;
