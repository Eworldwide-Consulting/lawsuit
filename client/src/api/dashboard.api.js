import http from './http';

const dashboardApi = {
  client:          () => http.get('/dashboard/client'),
  attorney:        () => http.get('/dashboard/attorney'),
  partner:         () => http.get('/dashboard/partner'),
  attorneyClients: () => http.get('/dashboard/attorney/clients'),
};

export default dashboardApi;