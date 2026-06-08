import http from './http';

const tasksApi = {
  list:   ()       => http.get('/tasks'),
  create: d        => http.post('/tasks', d),
  update: (id, d)  => http.put(`/tasks/${id}`, d),
};

export default tasksApi;