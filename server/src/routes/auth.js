const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const speakeasy = require('speakeasy');
const supabase  = require('../supabase');
const { requireAuth } = require('../middleware/auth');
const { sendVerificationEmail } = require('../email');

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ── Check email availability (used by Register page on blur) ──────────────────
router.get('/check-email', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  res.json({ exists: !!data });
});

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, dob, street, city, state, zip, role } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check duplicate email
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash       = await bcrypt.hash(password, 12);
    const initials   = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const userRole   = ['attorney', 'partner'].includes(role) ? role : 'client';

    // Generate email verification token
    const verificationToken   = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        password_hash: hash,
        phone: phone || null,
        dob: dob || null,
        street: street || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        role: userRole,
        avatar_initials: initials,
        email_verified: false,
        verification_token: verificationToken,
        verification_token_expires: verificationExpires,
      })
      .select('id, first_name, last_name, email, role, avatar_initials')
      .single();

    if (error) throw error;

    // Send verification email (non-blocking — don't fail registration if SMTP is down)
    sendVerificationEmail(user.email, verificationToken).catch(err =>
      console.error('[email] Failed to send verification email:', err.message)
    );

    res.status(201).json({ requiresVerification: true, email: user.email });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Verify email ──────────────────────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Verification token required' });

  const { data: user } = await supabase
    .from('users')
    .select('id, email_verified, verification_token_expires')
    .eq('verification_token', token)
    .maybeSingle();

  if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });
  if (user.email_verified) return res.json({ alreadyVerified: true });

  if (new Date(user.verification_token_expires) < new Date()) {
    return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
  }

  await supabase
    .from('users')
    .update({ email_verified: true, verification_token: null, verification_token_expires: null })
    .eq('id', user.id);

  res.json({ verified: true });
});

// ── Resend verification email ─────────────────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const { data: user } = await supabase
    .from('users')
    .select('id, email, email_verified')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  // Always respond OK to avoid email enumeration
  if (!user || user.email_verified) {
    return res.json({ sent: true });
  }

  const verificationToken   = crypto.randomBytes(32).toString('hex');
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from('users')
    .update({ verification_token: verificationToken, verification_token_expires: verificationExpires })
    .eq('id', user.id);

  sendVerificationEmail(user.email, verificationToken).catch(err =>
    console.error('[email] Resend failed:', err.message)
  );

  res.json({ sent: true });
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Block unverified accounts (skip for Google-OAuth users who have no password_hash)
    if (!user.email_verified && user.password_hash) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email,
      });
    }

    if (user.two_fa_enabled) {
      const tempToken = jwt.sign(
        { userId: user.id, twoFaPending: true },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      return res.json({ twoFaRequired: true, tempToken });
    }

    const token   = signToken(user.id);
    const safeUser = {
      id: user.id, first_name: user.first_name, last_name: user.last_name,
      email: user.email, role: user.role, avatar_initials: user.avatar_initials,
    };
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Verify 2FA ────────────────────────────────────────────────────────────────
router.post('/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    const payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!payload.twoFaPending) return res.status(400).json({ error: 'Invalid token' });

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();

    const valid = speakeasy.totp.verify({
      secret: user.two_fa_secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
    if (!valid) return res.status(401).json({ error: 'Invalid verification code' });

    const token   = signToken(user.id);
    const safeUser = {
      id: user.id, first_name: user.first_name, last_name: user.last_name,
      email: user.email, role: user.role, avatar_initials: user.avatar_initials,
    };
    res.json({ token, user: safeUser });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── Setup 2FA ─────────────────────────────────────────────────────────────────
router.post('/setup-2fa', requireAuth, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `TriVanta (${req.user.email})` });
  await supabase
    .from('users')
    .update({ two_fa_secret: secret.base32 })
    .eq('id', req.user.id);
  res.json({ secret: secret.base32, otpauth_url: secret.otpauth_url });
});

// ── Enable 2FA ────────────────────────────────────────────────────────────────
router.post('/enable-2fa', requireAuth, async (req, res) => {
  const { code } = req.body;
  const valid = speakeasy.totp.verify({
    secret: req.user.two_fa_secret,
    encoding: 'base32',
    token: code,
    window: 2,
  });
  if (!valid) return res.status(400).json({ error: 'Invalid code' });
  await supabase.from('users').update({ two_fa_enabled: true }).eq('id', req.user.id);
  res.json({ success: true });
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const { id, first_name, last_name, email, role, phone, avatar_initials } = req.user;
  res.json({ id, first_name, last_name, email, role, phone, avatar_initials });
});

// ── Update profile ────────────────────────────────────────────────────────────
router.put('/profile', requireAuth, async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  await supabase
    .from('users')
    .update({ first_name: firstName, last_name: lastName, phone: phone || null })
    .eq('id', req.user.id);
  res.json({ success: true });
});

// ── Change password ───────────────────────────────────────────────────────────
router.put('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const valid = await bcrypt.compare(currentPassword, req.user.password_hash || '');
  if (!valid) return res.status(400).json({ error: 'Current password incorrect' });

  const hash = await bcrypt.hash(newPassword, 12);
  await supabase.from('users').update({ password_hash: hash }).eq('id', req.user.id);
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
    client_id:    process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleCallbackURL(),
    response_type: 'code',
    scope:        'openid email profile',
    access_type:  'offline',
    prompt:       'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
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
        redirect_uri:  googleCallbackURL(),
        grant_type:    'authorization_code',
      }).toString(),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await profileRes.json();

    if (!gUser.email) throw new Error('No email returned from Google');
    if (!gUser.verified_email) return res.redirect(`${clientUrl}/login?error=google_unverified`);

    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', gUser.email.toLowerCase())
      .maybeSingle();

    if (!user) {
      const firstName = gUser.given_name  || gUser.name?.split(' ')[0] || 'User';
      const lastName  = gUser.family_name || gUser.name?.split(' ').slice(1).join(' ') || '';
      const initials  = `${firstName[0]}${(lastName[0] || firstName[1] || 'U')}`.toUpperCase();

      const { data: created } = await supabase
        .from('users')
        .insert({
          first_name: firstName, last_name: lastName,
          email: gUser.email.toLowerCase(),
          password_hash: '', role: 'client',
          avatar_initials: initials,
          email_verified: true, // Google accounts are pre-verified
        })
        .select('*')
        .single();
      user = created;
    }

    const token = signToken(user.id);
    res.redirect(`${clientUrl}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect(`${clientUrl}/login?error=google_failed`);
  }
});

module.exports = router;
