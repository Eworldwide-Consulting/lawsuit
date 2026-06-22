import http from './http';

const paymentsApi = {
  list:           ()          => http.get('/payments'),
  createInvoice:  d           => http.post('/payments/invoice', d),
  checkout:       invoiceId   => http.post(`/payments/checkout/${invoiceId}`),
  confirm:        sessionId   => http.get(`/payments/confirm/${sessionId}`),
  primeCheckout:  ()          => http.post('/payments/prime-checkout'),
  planStatus:     ()          => http.get('/payments/plan-status'),
};

export default paymentsApi;
