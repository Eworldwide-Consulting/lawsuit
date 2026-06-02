const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const speakeasy = require('speakeasy');
const { one, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

let sendVerificationEmail = async () => false;
try { ({ sendVerificationEmail } = require('../email')); } catch {}

const signToken = id =>
  jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

router.get('/check-email', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await one('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  res.json({ exists: !!user });
});

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, dob, street, city, state, zip, role,
            barNumber, stateBar, yearsExperience, specializations, firmRole, practiceGroups } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ error: 'Required fields missing' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await one('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash     = await bcrypt.hash(password, 12);
    const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const userRole = ['attorney', 'partner'].includes(role) ? role : 'client';
    const isPro    = ['attorney', 'partner'].includes(userRole);
    const verToken = crypto.randomBytes(32).toString('hex');
    const verExp   = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19);

    const result = await run(
      `INSERT INTO users (first_name,last_name,email,password_hash,role,phone,dob,
       street,city,state,zip,avatar_initials,email_verified,
       verification_token,verification_token_expires,approval_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [firstName, lastName, email.toLowerCase(), hash, userRole,
       phone||null, dob||null, street||null, city||null, state||null, zip||null,
       initials, 0, verToken, verExp, isPro ? 'pending' : null]
    );

    if (isPro) {
      await run(
        `INSERT INTO user_profiles (user_id,bar_number,state_bar,years_experience,specializations,firm_role,practice_groups)
         VALUES (?,?,?,?,?,?,?)`,
        [result.insertId, barNumber||null, stateBar||null,
         yearsExperience ? parseInt(yearsExperience) : null,
         specializations||null, firmRole||null, practiceGroups||null]
      );
    }

    sendVerificationEmail(email.toLowerCase(), verToken).catch(() => {});
    res.status(201).json({ requiresVerification: true, requiresApproval: isPro, email: email.toLowerCase(), role: userRole });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });
  const user = await one('SELECT * FROM users WHERE verification_token = ?', [token]);
  if (!user) return res.status(400).json({ error: 'Invalid or expired link' });
  if (user.email_verified) return res.json({ alreadyVerified: true });
  if (new Date(user.verification_token_expires) < new Date())
    return res.status(400).json({ error: 'Link expired. Please request a new one.' });
  await run('UPDATE users SET email_verified=1, verification_token=NULL, verification_token_expires=NULL WHERE id=?', [user.id]);
  res.json({ verified: true });
});

router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await one('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user || user.email_verified) return res.json({ sent: true });
  const verToken = crypto.randomBytes(32).toString('hex');
  const verExp   = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
  await run('UPDATE users SET verification_token=?, verification_token_expires=? WHERE id=?', [verToken, verExp, user.id]);
  sendVerificationEmail(user.email, verToken).catch(() => {});
  res.json({ sent: true });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await one('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.password_hash || ''))
      return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.email_verified && user.password_hash)
      return res.status(403).json({ error: 'Please verify your email.', requiresVerification: true, email: user.email });
    if (user.approval_status === 'pending')
      return res.status(403).json({ error: 'Account pending review.', requiresApproval: true });
    if (user.approval_status === 'rejected')
      return res.status(403).json({ error: 'Account not approved. Please contact support.', requiresApproval: true });
    if (user.two_fa_enabled) {
      const tmp = jwt.sign({ userId: user.id, twoFaPending: true }, process.env.JWT_SECRET, { expiresIn: '10m' });
      return res.json({ twoFaRequired: true, tempToken: tmp });
    }
    const safeUser = { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, avatar_initials: user.avatar_initials };
    res.json({ token: signToken(user.id), user: safeUser });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    const payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!payload.twoFaPending) return res.status(400).json({ error: 'Invalid token' });
    const user = await one('SELECT * FROM users WHERE id = ?', [payload.userId]);
    if (!speakeasy.totp.verify({ secret: user.two_fa_secret, encoding: 'base32', token: code, window: 2 }))
      return res.status(401).json({ error: 'Invalid code' });
    const safeUser = { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role, avatar_initials: user.avatar_initials };
    res.json({ token: signToken(user.id), user: safeUser });
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
});

router.post('/setup-2fa', requireAuth, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `TriVanta (${req.user.email})` });
  await run('UPDATE users SET two_fa_secret=? WHERE id=?', [secret.base32, req.user.id]);
  res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url });
});

router.post('/enable-2fa', requireAuth, async (req, res) => {
  if (!speakeasy.totp.verify({ secret: req.user.two_fa_secret, encoding: 'base32', token: req.body.code, window: 2 }))
    return res.status(400).json({ error: 'Invalid code' });
  await run('UPDATE users SET two_fa_enabled=1 WHERE id=?', [req.user.id]);
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  const { id, first_name, last_name, email, role, phone, avatar_initials } = req.user;
  res.json({ id, first_name, last_name, email, role, phone, avatar_initials });
});

router.put('/profile', requireAuth, async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  await run('UPDATE users SET first_name=?, last_name=?, phone=? WHERE id=?', [firstName, lastName, phone||null, req.user.id]);
  res.json({ success: true });
});

router.put('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Min 8 characters' });
  if (!await bcrypt.compare(currentPassword, req.user.password_hash || ''))
    return res.status(400).json({ error: 'Current password incorrect' });
  await run('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(newPassword, 12), req.user.id]);
  res.json({ success: true });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
const googleCB = () => `${process.env.SERVER_URL || process.env.CLIENT_URL}/api/auth/google/callback`;

router.get('/google', (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  // If Google OAuth isn't configured, redirect back to the client with a friendly error
  if (!process.env.GOOGLE_CLIENT_ID) return res.redirect(`${clientUrl}/login?error=google_failed`);
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: googleCB(),
    response_type: 'code', scope: 'openid email profile', access_type: 'offline', prompt: 'select_account',
  })}`);
});

router.get('/google/callback', async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${clientUrl}/login?error=google_cancelled`);
  try {
    const tokens = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: googleCB(), grant_type: 'authorization_code' }).toString(),
    }).then(r => r.json());
    if (tokens.error) throw new Error(tokens.error_description);
    const gUser = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then(r => r.json());
    if (!gUser.email) throw new Error('No email from Google');
    if (!gUser.verified_email) return res.redirect(`${clientUrl}/login?error=google_unverified`);
    let user = await one('SELECT * FROM users WHERE email = ?', [gUser.email.toLowerCase()]);
    if (!user) {
      const fn = gUser.given_name || gUser.name?.split(' ')[0] || 'User';
      const ln = gUser.family_name || gUser.name?.split(' ').slice(1).join(' ') || '';
      const r = await run(
        'INSERT INTO users (first_name,last_name,email,password_hash,role,avatar_initials,email_verified) VALUES (?,?,?,?,?,?,1)',
        [fn, ln, gUser.email.toLowerCase(), '', 'client', `${fn[0]}${(ln[0]||fn[1]||'U')}`.toUpperCase()]
      );
      user = await one('SELECT * FROM users WHERE id = ?', [r.insertId]);
    }
    res.redirect(`${clientUrl}/auth/callback?token=${encodeURIComponent(signToken(user.id))}`);
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect(`${clientUrl}/login?error=google_failed`);
  }
});

module.exports = router;
