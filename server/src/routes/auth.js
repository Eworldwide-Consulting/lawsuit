const router  = require('express').Router();
const config  = require('../config');
const { requireAuth }             = require('../middleware/auth');
const { invalidateUserCache }     = require('../middleware/auth');
const { validate, schemas }       = require('../middleware/validate');
const AuthService                 = require('../services/auth.service');
const { sanitizeUser }            = require('../domain/user');

const EmailService = require('../services/email.service');
const AuditService = require('../services/audit.service');
const crypto = require('crypto');
const UserRepo = require('../repositories/user.repository');
const { in24Hours } = require('../lib/dates');

// ── Public routes ─────────────────────────────────────────────────────────────

// M2: /check-email removed — it allowed silent enumeration of registered users.
// Duplicate-email feedback now comes as a 409 from /register itself.

// M6: validate(schemas.register) enforces server-side email domain + field lengths.
router.post('/register', validate(schemas.register), async (req, res, next) => {
  try {
    const result = await AuthService.register(req.body, (email, token) =>
      EmailService.sendVerification(email, token)
    );
    AuditService.log({
      action: AuditService.ACTIONS.USER_REGISTERED,
      meta: { email: req.body.email?.toLowerCase(), role: result.role },
      ip: req.ip,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });
    const result = await AuthService.verifyEmail(token);
    if (result.verified) {
      AuditService.log({
        userId: result.user?.id, action: AuditService.ACTIONS.USER_EMAIL_VERIFIED, ip: req.ip,
      });
    }
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const user = await require('../db').one(
      'SELECT id, email, email_verified FROM users WHERE email = ?', [email.toLowerCase()]
    );
    if (!user || user.email_verified) return res.json({ sent: true });

    const token = crypto.randomBytes(32).toString('hex');
    await UserRepo.setVerificationToken(user.id, token, in24Hours());
    EmailService.sendVerification(user.email, token);
    res.json({ sent: true });
  } catch (err) { next(err); }
});

router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body);
    if (!result.twoFaRequired) {
      AuditService.log({
        userId: result.user?.id, action: AuditService.ACTIONS.USER_LOGIN, ip: req.ip,
      });
    }
    res.json(result);
  } catch (err) {
    if (err.status === 401) {
      AuditService.log({
        action: AuditService.ACTIONS.USER_LOGIN_FAILED,
        meta: { email: req.body.email?.toLowerCase() },
        ip: req.ip,
      });
    }
    // Attach any extra fields (requiresVerification, requiresApproval, role) to the response
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: err.message, ...err });
    }
    next(err);
  }
});

router.post('/verify-2fa', async (req, res, next) => {
  try {
    res.json(await AuthService.verify2fa(req.body));
  } catch (err) { next(err); }
});

// L5: password reset — two-step flow (request token → consume token + set new password)
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const result = await AuthService.forgotPassword(email.toLowerCase());
    // Fire-and-forget: only send if a real account was found (indicated by _email)
    if (result._email) {
      EmailService.sendPasswordReset(result._email, result._token);
    }
    // Always return the same response to prevent user enumeration
    res.json({ sent: true });
  } catch (err) { next(err); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const result = await AuthService.resetPassword({ token, newPassword });
    res.json(result);
  } catch (err) { next(err); }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

const googleCallbackUrl = () =>
  `${config.server.url || config.client.url}/api/auth/google/callback`;

router.get('/google', (req, res) => {
  if (!config.google.clientId)
    return res.redirect(`${config.client.url}/login?error=google_failed`);

  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id:     config.google.clientId,
      redirect_uri:  googleCallbackUrl(),
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'offline',
      prompt:        'select_account',
    })}`
  );
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code)
    return res.redirect(`${config.client.url}/login?error=google_cancelled`);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri:  googleCallbackUrl(),
        grant_type:    'authorization_code',
      }).toString(),
    }).then(r => r.json());

    if (tokenRes.error) throw new Error(tokenRes.error_description);

    const gUser = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.access_token}` },
    }).then(r => r.json());

    if (!gUser.email) throw new Error('No email from Google');
    if (!gUser.verified_email)
      return res.redirect(`${config.client.url}/login?error=google_unverified`);

    const { run, one } = require('../db');
    let user = await UserRepo.findByEmail(gUser.email);
    if (!user) {
      const fn = gUser.given_name  || gUser.name?.split(' ')[0]              || 'User';
      const ln = gUser.family_name || gUser.name?.split(' ').slice(1).join(' ') || '';
      const r  = await run(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, avatar_initials, email_verified) VALUES (?,?,?,?,?,?,1)',
        [fn, ln, gUser.email.toLowerCase(), '', 'client', `${fn[0]}${(ln[0] || fn[1] || 'U')}`.toUpperCase()]
      );
      user = await one('SELECT * FROM users WHERE id = ?', [r.insertId]);
    } else if (!user.email_verified) {
      await UserRepo.markVerified(user.id);
    }

    if (user.approval_status === 'pending')
      return res.redirect(`${config.client.url}/login?error=approval_pending`);
    if (user.approval_status === 'rejected')
      return res.redirect(`${config.client.url}/login?error=account_rejected`);

    res.redirect(`${config.client.url}/auth/callback?token=${encodeURIComponent(AuthService.signToken(user.id))}`);
  } catch (err) {
    require('../logger').error({ err }, 'Google OAuth error');
    res.redirect(`${config.client.url}/login?error=google_failed`);
  }
});

// ── Authenticated routes ───────────────────────────────────────────────────────

router.get('/me', requireAuth, (req, res) => {
  res.json(sanitizeUser(req.user));
});

router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;
    await UserRepo.update(req.user.id, {
      first_name: firstName, last_name: lastName, phone: phone || null,
    });
    await invalidateUserCache(req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'Min 8 characters' });
    await AuthService.changePassword(req.user.id, { currentPassword, newPassword });
    await invalidateUserCache(req.user.id);
    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.USER_PASSWORD_CHANGED, ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/setup-2fa', requireAuth, async (req, res, next) => {
  try {
    const result = await AuthService.setup2fa(req.user.id, req.user.email);
    await invalidateUserCache(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/enable-2fa', requireAuth, async (req, res, next) => {
  try {
    await AuthService.enable2fa(req.user, req.body.code);
    await invalidateUserCache(req.user.id);
    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.USER_2FA_ENABLED, ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/dismiss-2fa-prompt', requireAuth, async (req, res, next) => {
  try {
    await UserRepo.dismiss2faPrompt(req.user.id);
    await invalidateUserCache(req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;