import http from './http';

const mattersApi = {
  list:            ()              => http.get('/matters'),
  get:             id              => http.get(`/matters/${id}`),
  create:          d               => http.post('/matters', d),
  update:          (id, d)         => http.put(`/matters/${id}`, d),
  timeline:        id              => http.get(`/matters/${id}/timeline`),
  stats:           ()              => http.get('/matters/stats/overview'),
  assignAttorney:  (id, attyId)   => http.post(`/matters/${id}/assign-attorney`, { attorney_id: attyId }),
  pendingRequests: ()              => http.get('/matters/pending-requests'),
  accept:          id              => http.post(`/matters/${id}/accept`),
  decline:         (id, reason)   => http.post(`/matters/${id}/decline`, { reason }),
  updateStage:     (id, stage)    => http.put(`/matters/${id}`, { stage }),
  updateType:      (id, matterType) => http.put(`/matters/${id}`, { matter_type: matterType }),
  byCaseNumber:    caseNumber       => http.get(`/matters/by-case-number/${caseNumber}`),
};

export default mattersApi;