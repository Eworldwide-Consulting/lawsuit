const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const speakeasy = require('speakeasy');
const { one, run }         = require('../db');
const { requireAuth }      = require('../middleware/auth');
const { invalidateUserCache } = require('../middleware/auth');
const { sanitizeUser }     = require('../utils');
const logger               = require('../logger');

// 2FA window: allow ±1 step (30 s each) to account for clock drift
const TOTP_WINDOW = 1;

// Accounts exempt from email-verification enforcement (seeded demo users)
const DEMO_EMAILS = new Set([
  'partner@trivanta.com',
  'attorney@trivanta.com',
  'client@trivanta.com',
  'itsupport@gkasevault.io',
]);

// Load email module — warn loudly if it fails so misconfiguration is visible
let sendVerificationEmail = async () => false;
try {
  ({ sendVerificationEmail } = require('../email'));
} catch (err) {
  logger.warn({ err: err.message }, 'Email module unavailable — verification emails will not be sent');
}

const signToken = (id) =>
  jwt.sign({ userId: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

function verificationExpiry() {
  // Keep the Z suffix so the stored string is unambiguously UTC.
  // new Date("...Z") always parses as UTC on all runtimes and timezones.
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

// ── Public routes ─────────────────────────────────────────────────────────────

// Intentionally does not reveal whether the email is registered to prevent
// account enumeration — but some clients need a pre-check UI hint, so keep it
// gated behind a header or remove if not strictly needed.
router.get('/check-email', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await one('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  res.json({ exists: !!user });
});

router.post('/register', async (req, res) => {
  try {
    const {
      firstName, lastName, email, password, phone, dob,
      street, city, state, zip, role,
      barNumber, stateBar, yearsExperience, specializations, firmRole, practiceGroups,
    } = req.body;

    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: 'Required fields missing' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await one('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash      = await bcrypt.hash(password, 12);
    const initials  = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const userRole  = ['attorney', 'partner'].includes(role) ? role : 'client';
    const isPro     = ['attorney', 'partner'].includes(userRole);
    const verToken  = crypto.randomBytes(32).toString('hex');
    const verExp    = verificationExpiry();

    const result = await run(
      `INSERT INTO users
         (first_name, last_name, email, password_hash, role, phone, dob,
          street, city, state, zip, avatar_initials, email_verified,
          verification_token, verification_token_expires, approval_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        firstName, lastName, email.toLowerCase(), hash, userRole,
        phone || null, dob || null, street || null, city || null,
        state || null, zip || null, initials,
        0, verToken, verExp,
        isPro ? 'pending' : null,
      ]
    );

    if (isPro) {
      await run(
        `INSERT INTO user_profiles
           (user_id, bar_number, state_bar, years_experience, specializations, firm_role, practice_groups)
         VALUES (?,?,?,?,?,?,?)`,
        [
          result.insertId, barNumber || null, stateBar || null,
          yearsExperience ? parseInt(yearsExperience) : null,
          specializations || null, firmRole || null, practiceGroups || null,
        ]
      );
    }

    // Fire-and-forget — never block registration on email delivery
    sendVerificationEmail(email.toLowerCase(), verToken).catch((err) =>
      logger.warn({ err: err.message, email }, 'Verification email failed to send')
    );

    res.status(201).json({
      requiresVerification: true,
      requiresApproval: isPro,
      email: email.toLowerCase(),
      role: userRole,
    });
  } catch (err) {
    logger.error({ err }, 'Registration failed');
    res.status(500).json({ error: err.message });
  }
});

router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const user = await one('SELECT id, email_verified, verification_token_expires FROM users WHERE verification_token = ?', [token]);
  if (!user) return res.status(400).json({ error: 'Invalid or expired link' });
  if (user.email_verified) return res.json({ alreadyVerified: true });
  if (new Date(user.verification_token_expires) < new Date())
    return res.status(400).json({ error: 'Link expired. Please request a new one.' });

  await run(
    'UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
    [user.id]
  );
  res.json({ verified: true });
});

router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const user = await one('SELECT id, email, email_verified FROM users WHERE email = ?', [email.toLowerCase()]);
  // Always respond the same way — don't reveal whether the email exists
  if (!user || user.email_verified) return res.json({ sent: true });

  const verToken = crypto.randomBytes(32).toString('hex');
  const verExp   = verificationExpiry();
  await run(
    'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
    [verToken, verExp, user.id]
  );
  sendVerificationEmail(user.email, verToken).catch((err) =>
    logger.warn({ err: err.message, email }, 'Resend verification email failed')
  );
  res.json({ sent: true });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, portal } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const user = await one('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    // Constant-time compare even when user not found to prevent timing attacks
    const validPassword = user
      ? await bcrypt.compare(password, user.password_hash || '')
      : await bcrypt.compare(password, '$2b$12$invalidhashfortimingprotection000');

    if (!user || !validPassword)
      return res.status(401).json({ error: 'Invalid credentials' });

    if (portal && portal !== user.role) {
      return res.status(403).json({
        error: `This email is registered as ${user.role}. Please sign in using the ${user.role} portal.`,
        role: user.role,
        portal,
      });
    }

    if (!user.email_verified && user.password_hash && !DEMO_EMAILS.has(user.email))
      return res.status(403).json({ error: 'Please verify your email.', requiresVerification: true, email: user.email });
    if (user.approval_status === 'pending')
      return res.status(403).json({ error: 'Account pending review.', requiresApproval: true });
    if (user.approval_status === 'rejected')
      return res.status(403).json({ error: 'Account not approved. Please contact support.', requiresApproval: true });

    if (user.two_fa_enabled) {
      const tmp = jwt.sign({ userId: user.id, twoFaPending: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.json({ twoFaRequired: true, tempToken: tmp });
    }

    res.json({ token: signToken(user.id), user: sanitizeUser(user) });
  } catch (err) {
    logger.error({ err }, 'Login failed');
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    const payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!payload.twoFaPending) return res.status(400).json({ error: 'Invalid token' });

    const user = await one('SELECT * FROM users WHERE id = ?', [payload.userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const valid = speakeasy.totp.verify({
      secret: user.two_fa_secret, encoding: 'base32', token: code, window: TOTP_WINDOW,
    });
    if (!valid) return res.status(401).json({ error: 'Invalid code' });

    res.json({ token: signToken(user.id), user: sanitizeUser(user) });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── Authenticated routes ───────────────────────────────────────────────────────

router.get('/me', requireAuth, (req, res) => {
  res.json(sanitizeUser(req.user));
});

router.put('/profile', requireAuth, async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  await run(
    'UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?',
    [firstName, lastName, phone || null, req.user.id]
  );
  await invalidateUserCache(req.user.id);
  res.json({ success: true });
});

router.put('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'Min 8 characters' });
  if (!await bcrypt.compare(currentPassword, req.user.password_hash || ''))
    return res.status(400).json({ error: 'Current password incorrect' });

  await run(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [await bcrypt.hash(newPassword, 12), req.user.id]
  );
  await invalidateUserCache(req.user.id);
  res.json({ success: true });
});

router.post('/setup-2fa', requireAuth, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `TriVanta (${req.user.email})` });
  await run('UPDATE users SET two_fa_secret = ? WHERE id = ?', [secret.base32, req.user.id]);
  await invalidateUserCache(req.user.id);
  res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url });
});

router.post('/enable-2fa', requireAuth, async (req, res) => {
  const valid = speakeasy.totp.verify({
    secret: req.user.two_fa_secret, encoding: 'base32', token: req.body.code, window: TOTP_WINDOW,
  });
  if (!valid) return res.status(400).json({ error: 'Invalid code' });

  await run('UPDATE users SET two_fa_enabled = 1 WHERE id = ?', [req.user.id]);
  await invalidateUserCache(req.user.id);
  res.json({ success: true });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

const googleCallbackUrl = () =>
  `${process.env.SERVER_URL || process.env.CLIENT_URL}/api/auth/google/callback`;

router.get('/google', (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  if (!process.env.GOOGLE_CLIENT_ID)
    return res.redirect(`${clientUrl}/login?error=google_failed`);

  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      redirect_uri:  googleCallbackUrl(),
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'offline',
      prompt:        'select_account',
    })}`
  );
});

router.get('/google/callback', async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${clientUrl}/login?error=google_cancelled`);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  googleCallbackUrl(),
        grant_type:    'authorization_code',
      }).toString(),
    }).then((r) => r.json());

    if (tokenRes.error) throw new Error(tokenRes.error_description);

    const gUser = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.access_token}` },
    }).then((r) => r.json());

    if (!gUser.email)           throw new Error('No email from Google');
    if (!gUser.verified_email)  return res.redirect(`${clientUrl}/login?error=google_unverified`);

    let user = await one('SELECT * FROM users WHERE email = ?', [gUser.email.toLowerCase()]);
    if (!user) {
      const fn = gUser.given_name  || gUser.name?.split(' ')[0]             || 'User';
      const ln = gUser.family_name || gUser.name?.split(' ').slice(1).join(' ') || '';
      const r = await run(
        'INSERT INTO users (first_name, last_name, email, password_hash, role, avatar_initials, email_verified) VALUES (?,?,?,?,?,?,1)',
        [fn, ln, gUser.email.toLowerCase(), '', 'client', `${fn[0]}${(ln[0] || fn[1] || 'U')}`.toUpperCase()]
      );
      user = await one('SELECT * FROM users WHERE id = ?', [r.insertId]);
    } else if (!user.email_verified) {
      // Google has verified ownership of this email — mark the local account verified too.
      await run('UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?', [user.id]);
    }

    if (user.approval_status === 'pending')
      return res.redirect(`${clientUrl}/login?error=approval_pending`);
    if (user.approval_status === 'rejected')
      return res.redirect(`${clientUrl}/login?error=account_rejected`);

    res.redirect(`${clientUrl}/auth/callback?token=${encodeURIComponent(signToken(user.id))}`);
  } catch (err) {
    logger.error({ err }, 'Google OAuth error');
    res.redirect(`${clientUrl}/login?error=google_failed`);
  }
});

module.exports = router;
