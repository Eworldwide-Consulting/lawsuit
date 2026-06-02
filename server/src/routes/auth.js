const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const speakeasy = require('speakeasy');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

let sendVerificationEmail = async () => false;
try { ({ sendVerificationEmail } = require('../email')); } catch {}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ── Check email ───────────────────────────────────────────────────────────────
router.get('/check-email', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  res.json({ exists: !!user });
});

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const {
      firstName, lastName, email, password, phone, dob, street, city, state, zip, role,
      barNumber, stateBar, yearsExperience, specializations, firmRole, practiceGroups,
      matterType, existingMatter,
    } = req.body;

    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: 'Required fields missing' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const db = getDb();
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase()))
      return res.status(409).json({ error: 'Email already registered' });

    const hash      = await bcrypt.hash(password, 12);
    const initials  = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const userRole  = ['attorney', 'partner'].includes(role) ? role : 'client';
    const isPro     = ['attorney', 'partner'].includes(userRole);
    const verToken  = crypto.randomBytes(32).toString('hex');
    const verExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = db.prepare(`
      INSERT INTO users
        (first_name, last_name, email, password_hash, role, phone, dob,
         street, city, state, zip, avatar_initials,
         email_verified, verification_token, verification_token_expires, approval_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      firstName, lastName, email.toLowerCase(), hash, userRole,
      phone || null, dob || null, street || null, city || null,
      state || null, zip || null, initials,
      0, verToken, verExpiry,
      isPro ? 'pending' : null,
    );

    sendVerificationEmail(email.toLowerCase(), verToken).catch(() => {});

    res.status(201).json({
      requiresVerification: true,
      requiresApproval: isPro,
      email: email.toLowerCase(),
      role: userRole,
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Verify email ──────────────────────────────────────────────────────────────
router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Verification token required' });
  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE verification_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });
  if (user.email_verified) return res.json({ alreadyVerified: true });
  if (new Date(user.verification_token_expires) < new Date())
    return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
  db.prepare('UPDATE users SET email_verified=1, verification_token=NULL, verification_token_expires=NULL WHERE id=?').run(user.id);
  res.json({ verified: true });
});

// ── Resend verification ───────────────────────────────────────────────────────
router.post('/resend-verification', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || user.email_verified) return res.json({ sent: true });
  const verToken  = crypto.randomBytes(32).toString('hex');
  const verExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET verification_token=?, verification_token_expires=? WHERE id=?').run(verToken, verExpiry, user.id);
  sendVerificationEmail(user.email, verToken).catch(() => {});
  res.json({ sent: true });
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.email_verified && user.password_hash) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        requiresVerification: true, email: user.email,
      });
    }
    if (user.approval_status === 'pending')
      return res.status(403).json({ error: 'Your account is pending review. You will be notified once approved.', requiresApproval: true });
    if (user.approval_status === 'rejected')
      return res.status(403).json({ error: 'Your account application was not approved. Please contact support.', requiresApproval: true });

    if (user.two_fa_enabled) {
      const tempToken = jwt.sign({ userId: user.id, twoFaPending: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.json({ twoFaRequired: true, tempToken });
    }

    const token    = signToken(user.id);
    const safeUser = { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, avatar_initials: user.avatar_initials };
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Verify 2FA ────────────────────────────────────────────────────────────────
router.post('/verify-2fa', (req, res) => {
  try {
    const { tempToken, code } = req.body;
    const payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!payload.twoFaPending) return res.status(400).json({ error: 'Invalid token' });
    const user  = getDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
    const valid = speakeasy.totp.verify({ secret: user.two_fa_secret, encoding: 'base32', token: code, window: 2 });
    if (!valid) return res.status(401).json({ error: 'Invalid verification code' });
    const token    = signToken(user.id);
    const safeUser = { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, avatar_initials: user.avatar_initials };
    res.json({ token, user: safeUser });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── Setup 2FA ─────────────────────────────────────────────────────────────────
router.post('/setup-2fa', requireAuth, (req, res) => {
  const secret = speakeasy.generateSecret({ name: `TriVanta (${req.user.email})` });
  getDb().prepare('UPDATE users SET two_fa_secret=? WHERE id=?').run(secret.base32, req.user.id);
  res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url });
});

// ── Enable 2FA ────────────────────────────────────────────────────────────────
router.post('/enable-2fa', requireAuth, (req, res) => {
  const { code } = req.body;
  const valid = speakeasy.totp.verify({ secret: req.user.two_fa_secret, encoding: 'base32', token: code, window: 2 });
  if (!valid) return res.status(400).json({ error: 'Invalid code' });
  getDb().prepare('UPDATE users SET two_fa_enabled=1 WHERE id=?').run(req.user.id);
  res.json({ success: true });
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const { id, first_name, last_name, email, role, phone, avatar_initials } = req.user;
  res.json({ id, first_name, last_name, email, role, phone, avatar_initials });
});

// ── Update profile ────────────────────────────────────────────────────────────
router.put('/profile', requireAuth, (req, res) => {
  const { firstName, lastName, phone } = req.body;
  getDb().prepare('UPDATE users SET first_name=?, last_name=?, phone=?, updated_at=datetime(\'now\') WHERE id=?')
    .run(firstName, lastName, phone || null, req.user.id);
  res.json({ success: true });
});

// ── Change password ───────────────────────────────────────────────────────────
router.put('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const valid = await bcrypt.compare(currentPassword, req.user.password_hash || '');
  if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 12);
  getDb().prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.user.id);
  res.json({ success: true });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
const googleCallbackURL = () => `${process.env.SERVER_URL || process.env.CLIENT_URL}/api/auth/google/callback`;

router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(501).send('Google sign-in is not configured.');
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: googleCallbackURL(),
    response_type: 'code', scope: 'openid email profile', access_type: 'offline', prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${clientUrl}/login?error=google_cancelled`);
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: googleCallbackURL(), grant_type: 'authorization_code' }).toString(),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);
    const gUser = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then(r => r.json());
    if (!gUser.email) throw new Error('No email from Google');
    if (!gUser.verified_email) return res.redirect(`${clientUrl}/login?error=google_unverified`);
    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(gUser.email.toLowerCase());
    if (!user) {
      const fn = gUser.given_name || gUser.name?.split(' ')[0] || 'User';
      const ln = gUser.family_name || gUser.name?.split(' ').slice(1).join(' ') || '';
      const r  = db.prepare(`INSERT INTO users (first_name,last_name,email,password_hash,role,avatar_initials,email_verified)
                             VALUES (?,?,?,?,?,?,1)`)
        .run(fn, ln, gUser.email.toLowerCase(), '', 'client', `${fn[0]}${(ln[0] || fn[1] || 'U')}`.toUpperCase());
      user = db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
    }
    res.redirect(`${clientUrl}/auth/callback?token=${encodeURIComponent(signToken(user.id))}`);
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect(`${clientUrl}/login?error=google_failed`);
  }
});

module.exports = router;
