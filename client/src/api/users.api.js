import http from './http';

const usersApi = {
  list:      () => http.get('/users'),
  attorneys: () => http.get('/users/attorneys'),
  clients:   () => http.get('/users/clients'),
  myClients: () => http.get('/users/my-clients'),
};

export default usersApi;