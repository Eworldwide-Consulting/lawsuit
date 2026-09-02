const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const speakeasy = require('speakeasy');

const config = require('../config');
const { run, all }  = require('../db');
const UserRepo = require('../repositories/user.repository');
const EmailService = require('./email.service');
const { sanitizeUser, isSuspended }  = require('../domain/user');
const { buildCaseNumber } = require('../domain/matter');
const { in24Hours }     = require('../lib/dates');
const { AppError, ConflictError, UnauthorizedError, ValidationError, ForbiddenError } = require('../lib/errors');

const ONE_HOUR_MS = 60 * 60 * 1000;

// Seeded demo accounts exempt from email-verification enforcement.
// L6: itsupport@gkasevault.io removed — it's a real admin login now and must
// go through mail OTP like any other account; the other three remain seeded
// demo accounts with no real inbox behind them.
const DEMO_EMAILS = new Set([
  'partner@trivanta.com',
  'attorney@trivanta.com',
  'client@trivanta.com',
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
      await run('UPDATE matters SET case_number = ? WHERE id = ?', [
        buildCaseNumber({ id: mr.insertId, firstName, lastName, createdAt: new Date() }), mr.insertId,
      ]);
    }

    sendVerificationEmail(email.toLowerCase(), verToken);

    return { requiresVerification: true, requiresApproval: isPro, email: email.toLowerCase(), role: userRole };
  },

  // Admin-portal signup (admin.gkasevault.io). Deliberately separate from
  // register() above — kept on its own endpoint/method so the public
  // client/attorney/partner signup form can never be tricked into producing
  // an itsupport account.
  //
  // SECURITY NOTE: this is an intentionally open signup with no approval
  // gate — a confirmed product decision, not an oversight. Anyone who
  // submits this form gets a working itsupport (admin) account once they
  // click the emailed verification link (the same UserRepo.create() used
  // here still forces email_verified=0 until then, same as every other
  // registration path). If this becomes a problem, the cheapest mitigation
  // is a shared invite-code check here, without reintroducing a human
  // approval step.
  async registerAdmin({ firstName, lastName, email, password }) {
    if (!firstName || !lastName) throw new ValidationError('First and last name are required');
    if (!email) throw new ValidationError('Email is required');
    if (!password || password.length < 8) throw new ValidationError('Password must be at least 8 characters');

    const existing = await UserRepo.findByEmail(email);
    if (existing) throw new ConflictError('Email already registered');

    const hash     = await bcrypt.hash(password, 12);
    const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
    const verToken = crypto.randomBytes(32).toString('hex');
    const verExp   = in24Hours();

    const result = await UserRepo.create({
      firstName, lastName, email, hash, role: 'itsupport',
      initials, verToken, verExp, approvalStatus: null,
    });

    EmailService.sendVerification(email.toLowerCase(), verToken);

    return { requiresVerification: true, email: email.toLowerCase(), role: 'itsupport', id: result.insertId };
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
      // requiresPasswordSetup lets the login screen render a direct "Set a
      // Password" action instead of the user having to spot the separate
      // Forgot Password link on their own.
      if (user && !user.password_hash && user.google_id)
        throw Object.assign(
          new UnauthorizedError(
            "This account was created with Google Sign-In. Use \"Continue with Google\", " +
            "or set a password below — then you can sign in with email too."
          ),
          { requiresPasswordSetup: true, email: user.email }
        );
      throw new UnauthorizedError('Invalid credentials');
    }

    // Checked before every other gate (and before any OTP is emailed) so a
    // frozen account cannot even start a login it will never be allowed to
    // finish. Deleted accounts never reach here — findByEmail skips them.
    if (isSuspended(user))
      throw Object.assign(
        new ForbiddenError('Your account has been suspended. Please contact support to restore access.'),
        { suspended: true }
      );

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
    const delivery = await EmailService.sendLoginCode(user.email, { firstName: user.first_name, code });
    // If the email cannot be delivered, the verify screen is a dead end —
    // fail the login honestly instead of leaving the user waiting for a
    // code that will never arrive (e.g. revoked Gmail app password).
    if (delivery && delivery.delivered === false) {
      await UserRepo.update(user.id, { login_otp: null });
      throw new AppError(
        'We could not send your verification code right now. Please try again shortly, or sign in with Google.',
        503, 'EMAIL_DELIVERY_FAILED'
      );
    }
  },

  async verifyLoginOtp({ tempToken, code }) {
    let payload;
    try { payload = jwt.verify(tempToken, config.jwt.secret); }
    catch { throw new UnauthorizedError('Session expired. Please sign in again.'); }
    if (!payload.otpPending) throw new ValidationError('Invalid token');

    const user = await UserRepo.findByIdWithLoginOtp(payload.userId);
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

  // ── Attorney Google-signup verification ─────────────────────────────────────
  // A brand-new attorney account created via /google/callback lands here instead
  // of getting an immediate JWT: Google having verified the email address is not
  // the same as this platform verifying the *applicant*, so a short-lived code
  // (same hash:expiry convention as issueLoginOtp) gates account creation. The
  // account row already exists (role=attorney, email_verified=0) by the time
  // this runs — verifying the code only flips email_verified, it does not
  // touch approval_status, so the partner-approval gate still applies afterward
  // exactly as it does for a manually-registered attorney.
  async issueAttorneySignupOtp(user) {
    const code    = String(crypto.randomInt(100000, 1000000));
    const hash    = crypto.createHash('sha256').update(code).digest('hex');
    const expires = Date.now() + 10 * 60 * 1000;
    await UserRepo.update(user.id, { login_otp: `${hash}:${expires}` });
    const delivery = await EmailService.sendAttorneySignupCode(user.email, { firstName: user.first_name, code });
    if (delivery && delivery.delivered === false) {
      await UserRepo.update(user.id, { login_otp: null });
      throw new AppError(
        'We could not send your verification code right now. Please try again shortly.',
        503, 'EMAIL_DELIVERY_FAILED'
      );
    }
    return jwt.sign({ userId: user.id, attorneySignupPending: true }, config.jwt.secret, { expiresIn: '10m' });
  },

  async verifyAttorneySignupOtp({ tempToken, code }) {
    let payload;
    try { payload = jwt.verify(tempToken, config.jwt.secret); }
    catch { throw new UnauthorizedError('Session expired. Please sign in with Google again.'); }
    if (!payload.attorneySignupPending) throw new ValidationError('Invalid token');

    const user = await UserRepo.findByIdWithLoginOtp(payload.userId);
    if (!user?.login_otp) throw new UnauthorizedError('No active code. Please sign in with Google again.');

    const [hash, expires] = user.login_otp.split(':');
    if (Date.now() > Number(expires)) {
      await UserRepo.update(user.id, { login_otp: null });
      throw new UnauthorizedError('Code expired. Please request a new one.');
    }
    const given = crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
    if (given !== hash) throw new UnauthorizedError('Invalid code');

    await UserRepo.update(user.id, { login_otp: null, email_verified: 1 });
    const verified = await UserRepo.findById(user.id);
    // Same shape as verifyEmail(): a JWT is issued immediately even if
    // approval_status is still 'pending' — the dashboard shows the pending-
    // approval banner rather than gating the token itself, matching how a
    // manually-registered attorney's email-link verification already behaves.
    return { token: AuthService.signToken(verified.id), user: sanitizeUser(verified) };
  },

  async resendAttorneySignupOtp({ tempToken }) {
    let payload;
    try { payload = jwt.verify(tempToken, config.jwt.secret); }
    catch { throw new UnauthorizedError('Session expired. Please sign in with Google again.'); }
    if (!payload.attorneySignupPending) throw new ValidationError('Invalid token');

    const user = await UserRepo.findById(payload.userId);
    if (!user) throw new UnauthorizedError('User not found');
    const newTempToken = await AuthService.issueAttorneySignupOtp(user);
    return { success: true, maskedEmail: maskEmail(user.email), tempToken: newTempToken };
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

  // SMS password reset — a full alternative to the email-link flow above
  // (not layered on top of it): phone number in, 6-digit SMS code out, new
  // password set directly from that code. Same hash:expiry OTP convention as
  // issueLoginOtp/verifyLoginOtp, just stored in its own column so an
  // in-flight login OTP and a phone-reset OTP never collide.
  async forgotPasswordByPhone(phone) {
    const user = await UserRepo.findByPhone(phone);
    // Same anti-enumeration shape as forgotPassword: always looks like success.
    if (!user) return { sent: true };

    const code    = String(crypto.randomInt(100000, 1000000));
    const hash    = crypto.createHash('sha256').update(code).digest('hex');
    const expires = Date.now() + 10 * 60 * 1000;
    await UserRepo.update(user.id, { phone_reset_otp: `${hash}:${expires}` });
    return { sent: true, _phone: user.phone, _code: code };
  },

  async resetPasswordByPhone({ phone, code, newPassword }) {
    if (!phone)  throw new ValidationError('Phone number required');
    if (!code)   throw new ValidationError('Code required');
    if (!newPassword || newPassword.length < 8) throw new ValidationError('Password must be at least 8 characters');

    const user = await UserRepo.findByPhone(phone);
    if (!user?.phone_reset_otp) throw new UnauthorizedError('Invalid or expired code');

    const [hash, expires] = user.phone_reset_otp.split(':');
    if (Date.now() > Number(expires)) {
      await UserRepo.update(user.id, { phone_reset_otp: null });
      throw new UnauthorizedError('Code expired. Please request a new one.');
    }
    const given = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
    if (given !== hash) throw new UnauthorizedError('Invalid code');

    await UserRepo.setPasswordHash(user.id, await bcrypt.hash(newPassword, 12));
    await UserRepo.update(user.id, { phone_reset_otp: null });
    return { success: true };
  },

};

module.exports = AuthService;