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

// Admin-portal signup (admin.gkasevault.io) — deliberately separate from
// /register above so the public client/attorney/partner form can never be
// used to create an itsupport account. See AuthService.registerAdmin for the
// security note on why this is an open (no-approval) signup.
router.post('/register/admin', async (req, res, next) => {
  try {
    const result = await AuthService.registerAdmin(req.body);
    AuditService.log({
      action: AuditService.ACTIONS.USER_REGISTERED,
      meta: { email: req.body.email?.toLowerCase(), role: 'itsupport' },
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
    // Only a completed login is audited — 2FA/OTP-gated logins are logged
    // when the code is verified.
    if (!result.twoFaRequired && !result.otpRequired) {
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

// Email one-time code sent on every password login — verify to get the real JWT.
router.post('/verify-login-code', async (req, res, next) => {
  try {
    const result = await AuthService.verifyLoginOtp(req.body);
    AuditService.log({
      userId: result.user?.id, action: AuditService.ACTIONS.USER_LOGIN, ip: req.ip,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/resend-login-code', async (req, res, next) => {
  try {
    res.json(await AuthService.resendLoginOtp(req.body));
  } catch (err) { next(err); }
});

// L5: password reset — two-step flow (request token → consume token + set new password)
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const logger = require('../logger');
    const result = await AuthService.forgotPassword(email.toLowerCase());

    if (result._email) {
      if (!config.isProduction) {
        // In development: skip SMTP and return the link directly for easy testing
        const resetLink = `${config.client.url}/reset-password?token=${result._token}`;
        logger.info({ resetLink }, '[DEV] password reset link (no SMTP needed)');
        return res.json({ sent: true, _devResetLink: resetLink });
      }

      // Production: send directly via SMTP (not the in-memory queue) so the email
      // is never lost if the process restarts before the queued job is processed.
      const delivery = await EmailService.sendPasswordResetDirect(result._email, result._token);
      if (delivery?.delivered) {
        logger.info({ email: result._email }, 'Password reset email sent');
      } else {
        logger.error({ email: result._email, reason: delivery?.reason }, 'Password reset email delivery failed');
      }
    } else {
      // No account found — log it (helps diagnose support requests) but never tell the client
      logger.warn({ email: email.toLowerCase() }, 'Password reset requested for unregistered email');
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

// ── SMS password reset (alternative to the email-link flow above) ───────────

const SmsService = require('../services/sms.service');

router.get('/sms/status', (req, res) => {
  res.json({ configured: SmsService.isConfigured() });
});

router.post('/forgot-password/phone', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });

    const logger = require('../logger');
    const result = await AuthService.forgotPasswordByPhone(phone.trim());

    if (result._phone) {
      const delivery = await SmsService.sendResetCode(result._phone, result._code);
      if (!delivery.delivered) {
        if (!config.isProduction) {
          // Dev fallback: no Twilio configured — return the code directly,
          // same escape hatch /forgot-password uses via _devResetLink.
          return res.json({ sent: true, _devCode: result._code });
        }
        logger.error({ phone: result._phone, reason: delivery.reason }, 'SMS reset code delivery failed');
      }
    } else {
      logger.warn({ phone: phone.trim() }, 'Phone password reset requested for unregistered number');
    }

    // Always the same response to prevent phone-number enumeration.
    res.json({ sent: true });
  } catch (err) { next(err); }
});

router.post('/reset-password/phone', async (req, res, next) => {
  try {
    const { phone, code, newPassword } = req.body;
    const result = await AuthService.resetPasswordByPhone({ phone, code, newPassword });
    res.json(result);
  } catch (err) { next(err); }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

// Non-secret health check — lets the login page show a proper message when
// credentials are not configured instead of silently failing after redirect.
router.get('/google/status', (req, res) => {
  res.json({ configured: Boolean(config.google.clientId && config.google.clientSecret) });
});

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
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let isNew = false;
    let user = await UserRepo.findByEmail(gUser.email);
    if (!user) {
      isNew = true;
      const fn = gUser.given_name  || gUser.name?.split(' ')[0]              || 'User';
      const ln = gUser.family_name || gUser.name?.split(' ').slice(1).join(' ') || '';
      // approval_status is explicitly NULL for Google-created clients — identical to
      // regular client registration where isPro=false sets approvalStatus to null.
      // Without this the MySQL column default ('pending') blocks every new Google user.
      const r  = await run(
        `INSERT INTO users
           (first_name, last_name, email, password_hash, role, avatar_initials,
            email_verified, approval_status, google_id, avatar_url, login_provider, last_login)
         VALUES (?,?,?,?,?,?,1,NULL,?,?,?,?)`,
        [fn, ln, gUser.email.toLowerCase(), '', 'client',
         `${fn[0]}${(ln[0] || fn[1] || 'U')}`.toUpperCase(),
         gUser.id, gUser.picture || null, 'google', now]
      );
      user = await one('SELECT * FROM users WHERE id = ?', [r.insertId]);
    } else {
      // Update Google profile data and last login on every sign-in
      await UserRepo.update(user.id, {
        google_id:      gUser.id,
        avatar_url:     gUser.picture || user.avatar_url || null,
        login_provider: user.login_provider === 'email' && !user.google_id ? 'email' : 'google',
        last_login:     now,
        ...(user.email_verified ? {} : { email_verified: 1 }),
      });
      user = await one('SELECT * FROM users WHERE id = ?', [user.id]);
    }

    // Same freeze as the password login path — Google sign-in must not be a
    // way around a suspension. (Deleted accounts never get here: findByEmail
    // skips them, so this flow treats the released email as a brand new user.)
    if (require('../domain/user').isSuspended(user))
      return res.redirect(`${config.client.url}/login?error=account_suspended`);

    // Approval checks apply only to professional roles — consistent with the
    // regular login flow in auth.service.js which also gates on attorney/partner.
    if (['attorney', 'partner'].includes(user.role)) {
      if (user.approval_status === 'pending')
        return res.redirect(`${config.client.url}/login?error=approval_pending`);
      if (user.approval_status === 'rejected')
        return res.redirect(`${config.client.url}/login?error=account_rejected`);
    }

    AuditService.log({
      userId: user.id, action: AuditService.ACTIONS.USER_LOGIN,
      meta: { provider: 'google', isNew },
      ip: req.ip,
    });

    const callbackParams = new URLSearchParams({
      token:    AuthService.signToken(user.id),
      provider: 'google',
      ...(isNew ? { isNew: '1' } : {}),
    });
    res.redirect(`${config.client.url}/auth/callback?${callbackParams}`);
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

router.post('/disable-2fa', requireAuth, async (req, res, next) => {
  try {
    await UserRepo.disable2fa(req.user.id);
    await invalidateUserCache(req.user.id);
    AuditService.log({
      userId: req.user.id,
      action: 'user.2fa_disabled',
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Disconnect Google account — requires a password to be set first so the user
// doesn't lock themselves out. Sets login_provider back to 'email'.
router.post('/google/disconnect', requireAuth, async (req, res, next) => {
  try {
    const user = await require('../db').one(
      'SELECT password_hash, google_id FROM users WHERE id = ?', [req.user.id]
    );
    if (!user?.google_id)
      return res.status(400).json({ error: 'No Google account linked.' });
    if (!user.password_hash)
      return res.status(400).json({ error: 'Set a password before disconnecting Google.' });

    await UserRepo.update(req.user.id, {
      google_id: null, avatar_url: null, login_provider: 'email',
    });
    await invalidateUserCache(req.user.id);
    AuditService.log({ userId: req.user.id, action: 'user.google_disconnected', ip: req.ip });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Called once after Google OAuth registration to fill in profile fields that
// Google doesn't supply: phone, DOB, address, and initial matter type.
router.put('/complete-profile', requireAuth, async (req, res, next) => {
  try {
    const { phone, dob, street, city, state, zip, matterType, workedBefore,
            caseState, caseCounty, caseDescription } = req.body;

    await UserRepo.update(req.user.id, {
      ...(phone  ? { phone }  : {}),
      ...(dob    ? { dob }    : {}),
      ...(street ? { street } : {}),
      ...(city   ? { city }   : {}),
      ...(state  ? { state }  : {}),
      ...(zip    ? { zip }    : {}),
    });

    if (matterType && matterType !== 'not_sure') {
      const { run: dbRun, one: dbOne } = require('../db');
      const { buildCaseNumber } = require('../domain/matter');
      const existing = await dbOne('SELECT id FROM matters WHERE client_id = ? LIMIT 1', [req.user.id]);
      if (!existing) {
        const mr = await dbRun(
          `INSERT INTO matters
             (client_id, matter_type, stage, status, worked_with_firm_before, state, county, description)
           VALUES (?,?,?,?,?,?,?,?)`,
          [req.user.id, matterType, 'intake', 'active', workedBefore === 'yes' ? 1 : 0,
           caseState || null, caseCounty || null, caseDescription?.trim() || null]
        );
        await dbRun('UPDATE matters SET case_number = ? WHERE id = ?', [buildCaseNumber(mr.insertId), mr.insertId]);
      } else if (caseState || caseCounty) {
        // Popup re-submitted (or matter created earlier without location) —
        // fill in the case location without overwriting values already set.
        await dbRun(
          'UPDATE matters SET state = COALESCE(state, ?), county = COALESCE(county, ?) WHERE id = ?',
          [caseState || null, caseCounty || null, existing.id]
        );
      }
    }

    await invalidateUserCache(req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;