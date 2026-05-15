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
  const valid = await bcrypt.compare(currentPassword, req.user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 12);
  const db = getDb();
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

module.exports = router;
