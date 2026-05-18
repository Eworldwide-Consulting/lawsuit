const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, dob, street, city, state, zip, role } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const userRole = ['attorney', 'partner'].includes(role) ? role : 'client';

    const result = db.prepare(`
      INSERT INTO users (first_name, last_name, email, password_hash, phone, dob, street, city, state, zip, role, avatar_initials)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(firstName, lastName, email, hash, phone || null, dob || null, street || null, city || null, state || null, zip || null, userRole, initials);

    const token = signToken(result.lastInsertRowid);
    const user = db.prepare('SELECT id, first_name, last_name, email, role, avatar_initials FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.two_fa_enabled) {
      const tempToken = jwt.sign({ userId: user.id, twoFaPending: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.json({ twoFaRequired: true, tempToken });
    }

    const token = signToken(user.id);
    const safeUser = { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, avatar_initials: user.avatar_initials };
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-2fa', (req, res) => {
  try {
    const { tempToken, code } = req.body;
    const payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!payload.twoFaPending) return res.status(400).json({ error: 'Invalid token' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);

    const valid = speakeasy.totp.verify({
      secret: user.two_fa_secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!valid) return res.status(401).json({ error: 'Invalid verification code' });

    const token = signToken(user.id);
    const safeUser = { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, avatar_initials: user.avatar_initials };
    res.json({ token, user: safeUser });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

router.post('/setup-2fa', requireAuth, (req, res) => {
  const secret = speakeasy.generateSecret({ name: `Trivanta (${req.user.email})` });
  const db = getDb();
  db.prepare('UPDATE users SET two_fa_secret = ? WHERE id = ?').run(secret.base32, req.user.id);
  res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url });
});

router.post('/enable-2fa', requireAuth, (req, res) => {
  const { code } = req.body;
  const valid = speakeasy.totp.verify({
    secret: req.user.two_fa_secret,
    encoding: 'base32',
    token: code,
    window: 2,
  });
  if (!valid) return res.status(400).json({ error: 'Invalid code' });
  const db = getDb();
  db.prepare('UPDATE users SET two_fa_enabled = 1 WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  const { id, first_name, last_name, email, role, phone, avatar_initials } = req.user;
  res.json({ id, first_name, last_name, email, role, phone, avatar_initials });
});

router.put('/profile', requireAuth, async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  const db = getDb();
  db.prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?')
    .run(firstName, lastName, phone, req.user.id);
  res.json({ success: true });
});

router.put('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  const valid = await bcrypt.compare(currentPassword, req.user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 12);
  const db = getDb();
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
const googleCallbackURL = () =>
  `${process.env.SERVER_URL || process.env.CLIENT_URL}/api/auth/google/callback`;

router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).send(
      'Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables.'
    );
  }
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  googleCallbackURL(),
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
    prompt:        'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect(`${clientUrl}/login?error=google_cancelled`);
  }

  try {
    // Exchange authorization code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  googleCallbackURL(),
        grant_type:    'authorization_code',
      }).toString(),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Fetch Google user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await profileRes.json();

    if (!gUser.email) throw new Error('No email returned from Google');
    if (!gUser.verified_email) {
      return res.redirect(`${clientUrl}/login?error=google_unverified`);
    }

    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(gUser.email);

    if (!user) {
      const firstName = gUser.given_name  || gUser.name?.split(' ')[0] || 'User';
      const lastName  = gUser.family_name || gUser.name?.split(' ').slice(1).join(' ') || '';
      const initials  = `${firstName[0]}${(lastName[0] || firstName[1] || 'U')}`.toUpperCase();
      const result = db.prepare(`
        INSERT INTO users (first_name, last_name, email, password_hash, role, avatar_initials)
        VALUES (?, ?, ?, '', 'client', ?)
      `).run(firstName, lastName, gUser.email, initials);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    }

    const token = signToken(user.id);
    res.redirect(`${clientUrl}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect(`${clientUrl}/login?error=google_failed`);
  }
});

module.exports = router;
