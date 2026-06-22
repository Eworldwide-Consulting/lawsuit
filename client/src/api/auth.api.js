import http from './http';

const authApi = {
  login:              d     => http.post('/auth/login', d),
  register:           d     => http.post('/auth/register', d),
  verify2fa:          d     => http.post('/auth/verify-2fa', d),
  me:                 ()    => http.get('/auth/me'),
  updateProfile:      d     => http.put('/auth/profile', d),
  completeProfile:    d     => http.put('/auth/complete-profile', d),
  changePassword:     d     => http.put('/auth/change-password', d),
  checkEmail:         email => http.get('/auth/check-email', { params: { email } }),
  verifyEmail:        token => http.get('/auth/verify-email', { params: { token } }),
  resendVerification: email => http.post('/auth/resend-verification', { email }),
  setup2fa:           ()    => http.post('/auth/setup-2fa'),
  enable2fa:          code  => http.post('/auth/enable-2fa', { code }),
  disable2fa:         ()    => http.post('/auth/disable-2fa'),
  dismiss2faPrompt:   ()    => http.post('/auth/dismiss-2fa-prompt'),
  forgotPassword:     email => http.post('/auth/forgot-password', { email }),
  resetPassword:      d     => http.post('/auth/reset-password', d),
  googleStatus:       ()    => http.get('/auth/google/status'),
};

export default authApi;
