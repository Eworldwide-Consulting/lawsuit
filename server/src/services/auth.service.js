const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const speakeasy = require('speakeasy');

const config = require('../config');
const { run, all }  = require('../db');
const UserRepo = require('../repositories/user.repository');
const EmailService = require('./email.service');
const { sanitizeUser }  = require('../domain/user');
const { buildCaseNumber } = require('../domain/matter');
const { in24Hours }     = require('../lib/dates');
const { ConflictError, UnauthorizedError, ValidationError, ForbiddenError } = require('../lib/errors');

const ONE_HOUR_MS = 60 * 60 * 1000;

// Seeded demo accounts exempt from email-verification enforcement.
// L4: all four demo accounts listed — itsupport was previously missing.
const DEMO_EMAILS = new Set([
  'partner@trivanta.com',
  'attorney@trivanta.com',
  'client@trivanta.com',
  'itsupport@gkasevault.io',
]);

// 2FA window: allow ±1 step (30 s each) for clock drift.
const TOTP_WINDOW = 1;

// "gangadhar@firm.com" → "g***@firm.com" — shown on the verify screen without
// leaking the full address to someone who only has the password.
function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  return `${local.slice(0, 1)}***@${domain || ''}`;
}

const AuthService = {
  signToken(userId) {
    return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  },

  async register(body, sendVerificationEmail) {
    const {
      firstName, lastName, email, password, phone, dob,
      street, city, state, zip, role,
      barNumber, stateBar, yearsExperience, specializations, firmRole, practiceGroups,
      matterType, existingMatter,
    } = body;

    const existing = await UserRepo.findByEmail(email);
    if (existing) throw new ConflictError('Email already registered');

    const hash         = await bcrypt.hash(password, 12);
    const initials     = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const userRole     = ['attorney', 'partner'].includes(role) ? role : 'client';
    const isPro        = ['attorney', 'partner'].includes(userRole);
    const verToken     = crypto.randomBytes(32).toString('hex');
    const verExp       = in24Hours();

    const result = await UserRepo.create({
      firstName, lastName, email, hash, role: userRole,
      phone, dob, street, city, state, zip, initials,
      verToken, verExp,
      approvalStatus: isPro ? 'pending' : null,
    });

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
      // Notify all partners that a new professional is awaiting approval
      const partners = await all("SELECT email FROM users WHERE role = 'partner' AND email_verified = 1");
      for (const p of partners) {
        EmailService.sendAttorneyPending(p.email, { firstName, lastName, email, role: userRole });
      }
    }

    if (userRole === 'client' && matterType) {
      const mr = await run(
        `INSERT INTO matters (client_id, matter_type, stage, status, worked_with_firm_before)
         VALUES (?,?,?,?,?)`,
        [result.insertId, matterType, 'intake', 'active', existingMatter === 'yes' ? 1 : 0]
      );
      await run('UPDATE matters SET case_number = ? WHERE id = ?', [buildCaseNumber(mr.insertId), mr.insertId]);
    }

    sendVerificationEmail(email.toLowerCase(), verToken);

    return { requiresVerification: true, requiresApproval: isPro, email: email.toLowerCase(), role: userRole };
  },

  async verifyEmail(token) {
    const user = await UserRepo.findByVerificationToken(token);
    if (!user) throw new ValidationError('Invalid or expired link');
    if (user.email_verified) return { alreadyVerified: true };
    if (new Date(user.verification_token_expires) < new Date())
      throw new ValidationError('Link expired. Please request a new one.');

    await UserRepo.markVerified(user.id);
    return {
      verified: true,
      token: AuthService.signToken(user.id),
      user: sanitizeUser({ ...user, email_verified: 1 }),
    };
  },

  async login({ email, password, portal }) {
    const user = await UserRepo.findByEmail(email);

    // Always run bcrypt to prevent timing attacks even when user not found.
    const validPassword = user
      ? await bcrypt.compare(password, user.password_hash || '')
      : await bcrypt.compare(password, '$2b$12$invalidhashfortimingprotection000');

    if (!user || !validPassword) {
      // Google-created accounts have no password until one is set via the
      // reset flow — tell the user how to proceed instead of a dead-end 401.
      if (user && !user.password_hash && user.google_id)
        throw new UnauthorizedError(
          "This account was created with Google Sign-In. Use \"Continue with Google\", " +
          "or set a password first via \"Forgot password?\" — then you can sign in with email too."
        );
      throw new UnauthorizedError('Invalid credentials');
    }

    if (portal && portal !== user.role)
      throw new ForbiddenError(`This email is registered as ${user.role}. Please sign in using the ${user.role} portal.`);

    if (!user.email_verified && user.password_hash && !DEMO_EMAILS.has(user.email))
      throw Object.assign(new ForbiddenError('Please verify your email.'), { requiresVerification: true, email: user.email });

    // Approval checks only apply to professional roles — itsupport and client accounts
    // are provisioned directly and must never be blocked by approval_status.
    if (['attorney', 'partner'].includes(user.role)) {
      if (user.approval_status === 'pending')
        throw Object.assign(new ForbiddenError('Account pending admin approval. Please check back later.'), { requiresApproval: true });
      if (user.approval_status === 'rejected')
        throw Object.assign(new ForbiddenError('Account not approved. Please contact support.'), { requiresApproval: true });
    }

    if (user.two_fa_enabled) {
      const tmp = jwt.sign({ userId: user.id, twoFaPending: true }, config.jwt.secret, { expiresIn: '10m' });
      return { twoFaRequired: true, tempToken: tmp };
    }

    // Every password login is gated behind an emailed one-time code before the
    // dashboard is issued. Demo accounts are exempt (no real inboxes), and
    // TOTP users above already have a stronger second factor.
    if (!DEMO_EMAILS.has(user.email)) {
      await AuthService.issueLoginOtp(user);
      const tmp = jwt.sign({ userId: user.id, otpPending: true }, config.jwt.secret, { expiresIn: '10m' });
      return { otpRequired: true, tempToken: tmp, maskedEmail: maskEmail(user.email), role: user.role };
    }

    return { token: AuthService.signToken(user.id), user: sanitizeUser(user) };
  },

  // Generate + store a 6-digit login code and email it. Stored as
  // "sha256(code):expiryEpochMs" so the plain code never touches the DB and
  // expiry needs no DATETIME timezone handling.
  async issueLoginOtp(user) {
    const code    = String(crypto.randomInt(100000, 1000000));
    const hash    = crypto.createHash('sha256').update(code).digest('hex');
    const expires = Date.now() + 10 * 60 * 1000;
    await UserRepo.update(user.id, { login_otp: `${hash}:${expires}` });
    await EmailService.sendLoginCode(user.email, { firstName: user.first_name, code });
  },

  async verifyLoginOtp({ tempToken, code }) {
    let payload;
    try { payload = jwt.verify(tempToken, config.jwt.secret); }
    catch { throw new UnauthorizedError('Session expired. Please sign in again.'); }
    if (!payload.otpPending) throw new ValidationError('Invalid token');

    const user = await UserRepo.findById(payload.userId);
    if (!user?.login_otp) throw new UnauthorizedError('No active code. Please sign in again.');

    const [hash, expires] = user.login_otp.split(':');
    if (Date.now() > Number(expires)) {
      await UserRepo.update(user.id, { login_otp: null });
      throw new UnauthorizedError('Code expired. Please request a new one.');
    }
    const given = crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
    if (given !== hash) throw new UnauthorizedError('Invalid code');

    await UserRepo.update(user.id, { login_otp: null });
    return { token: AuthService.signToken(user.id), user: sanitizeUser(user) };
  },

  async resendLoginOtp({ tempToken }) {
    let payload;
    try { payload = jwt.verify(tempToken, config.jwt.secret); }
    catch { throw new UnauthorizedError('Session expired. Please sign in again.'); }
    if (!payload.otpPending) throw new ValidationError('Invalid token');

    const user = await UserRepo.findById(payload.userId);
    if (!user) throw new UnauthorizedError('User not found');
    await AuthService.issueLoginOtp(user);
    return { success: true, maskedEmail: maskEmail(user.email) };
  },

  async verify2fa({ tempToken, code }) {
    const payload = jwt.verify(tempToken, config.jwt.secret);
    if (!payload.twoFaPending) throw new ValidationError('Invalid token');

    const user = await UserRepo.findById(payload.userId);
    if (!user) throw new UnauthorizedError('User not found');

    const valid = speakeasy.totp.verify({
      secret: user.two_fa_secret, encoding: 'base32', token: code, window: TOTP_WINDOW,
    });
    if (!valid) throw new UnauthorizedError('Invalid code');

    return { token: AuthService.signToken(user.id), user: sanitizeUser(user) };
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const row = await UserRepo.findPasswordHash(userId);
    if (!await bcrypt.compare(currentPassword, row?.password_hash || ''))
      throw new ValidationError('Current password incorrect');
    await UserRepo.setPasswordHash(userId, await bcrypt.hash(newPassword, 12));
  },

  setup2fa(userId, email) {
    const secret = speakeasy.generateSecret({ name: `TriVanta (${email})` });
    return UserRepo.set2faSecret(userId, secret.base32).then(() => ({
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
    }));
  },

  async enable2fa(user, code) {
    const valid = speakeasy.totp.verify({
      secret: user.two_fa_secret, encoding: 'base32', token: code, window: TOTP_WINDOW,
    });
    if (!valid) throw new ValidationError('Invalid code');
    await UserRepo.enable2fa(user.id);
  },

  // L5: password reset flow ──────────────────────────────────────────────────

  async forgotPassword(email) {
    const user = await UserRepo.findByEmail(email);
    // Always respond with the same message regardless of whether the email exists
    // to prevent user enumeration via timing or response differences.
    if (!user) return { sent: true };

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + ONE_HOUR_MS).toISOString();
    await UserRepo.setPasswordResetToken(user.id, token, expires);
    return { sent: true, _email: user.email, _token: token };
  },

  async resetPassword({ token, newPassword }) {
    if (!token)       throw new ValidationError('Token required');
    if (!newPassword) throw new ValidationError('New password required');
    if (newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters');

    const user = await UserRepo.findByPasswordResetToken(token);
    if (!user) throw new ValidationError('Invalid or expired reset link');
    if (new Date(user.password_reset_expires) < new Date())
      throw new ValidationError('Reset link has expired. Please request a new one.');

    await UserRepo.setPasswordHash(user.id, await bcrypt.hash(newPassword, 12));
    await UserRepo.clearPasswordResetToken(user.id);
    return { success: true };
  },

};

module.exports = AuthService;