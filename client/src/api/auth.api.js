import http from './http';

const authApi = {
  login:              d     => http.post('/auth/login', d),
  register:           d     => http.post('/auth/register', d),
  verify2fa:          d     => http.post('/auth/verify-2fa', d),
  me:                 ()    => http.get('/auth/me'),
  updateProfile:      d     => http.put('/auth/profile', d),
  changePassword:     d     => http.put('/auth/change-password', d),
  checkEmail:         email => http.get('/auth/check-email', { params: { email } }),
  verifyEmail:        token => http.get('/auth/verify-email', { params: { token } }),
  resendVerification: email => http.post('/auth/resend-verification', { email }),
  setup2fa:           ()    => http.post('/auth/setup-2fa'),
  enable2fa:          code  => http.post('/auth/enable-2fa', { code }),
  dismiss2faPrompt:   ()    => http.post('/auth/dismiss-2fa-prompt'),
};

export default authApi;