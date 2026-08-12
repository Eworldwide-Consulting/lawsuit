const { one, run } = require('../db');
const { USER_COLUMNS, LOGIN_COLUMNS, USER_STATUS } = require('../domain/user');
const { nowSql } = require('../lib/dates');

const SAFE_COLUMNS =
  'id, first_name, last_name, email, role, phone, avatar_initials, email_verified, approval_status, created_at, ' +
  'status, suspended_at, suspended_reason';

// Soft-deleted rows are kept so matters/documents/invoices keep their foreign
// keys, but they are hidden from every normal lookup.
const NOT_DELETED = `COALESCE(status, '${USER_STATUS.ACTIVE}') <> '${USER_STATUS.DELETED}'`;

const UserRepository = {
  findById(id) {
    return one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
  },

  // login_otp is deliberately excluded from USER_COLUMNS (it's cached across every
  // authenticated request by the auth middleware) — fetched separately here, only
  // where it's actually needed to verify the emailed one-time code.
  findByIdWithLoginOtp(id) {
    return one(`SELECT ${USER_COLUMNS}, login_otp FROM users WHERE id = ?`, [id]);
  },

  findByEmail(email) {
    // LOGIN_COLUMNS includes password_hash — only needed at login for bcrypt.compare
    // Deleted rows are excluded so their released email reads as unregistered:
    // login finds nothing, and register() sees the address as free to reuse.
    return one(`SELECT ${LOGIN_COLUMNS} FROM users WHERE email = ? AND ${NOT_DELETED}`, [email.toLowerCase()]);
  },

  findByVerificationToken(token) {
    return one('SELECT * FROM users WHERE verification_token = ?', [token]);
  },

  // phone_reset_otp is deliberately excluded from USER_COLUMNS (same reasoning
  // as login_otp) — fetched here only where the SMS password-reset flow needs it.
  // A deleted account keeps its phone number (only the email is released), so
  // this must filter explicitly or the SMS reset flow would still reach it.
  findByPhone(phone) {
    return one(`SELECT ${USER_COLUMNS}, phone_reset_otp FROM users WHERE phone = ? AND ${NOT_DELETED}`, [phone]);
  },

  findAll({ limit = 50, offset = 0 } = {}) {
    return require('../db').all(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE ${NOT_DELETED} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  },

  findByEmailSafe(email) {
    return one(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE email = ? AND ${NOT_DELETED}`,
      [email.toLowerCase()]
    );
  },

  async create({ firstName, lastName, email, hash, role, phone, dob, street, city, state, zip,
                 initials, verToken, verExp, approvalStatus }) {
    return run(
      `INSERT INTO users
         (first_name, last_name, email, password_hash, role, phone, dob,
          street, city, state, zip, avatar_initials, email_verified,
          verification_token, verification_token_expires, approval_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        firstName, lastName, email.toLowerCase(), hash, role,
        phone || null, dob || null, street || null, city || null,
        state || null, zip || null, initials,
        0, verToken, verExp,
        approvalStatus || null,
      ]
    );
  },

  update(id, fields) {
    const sets = Object.keys(fields).map(k => `${k} = ?`);
    const vals = Object.values(fields);
    if (!sets.length) return Promise.resolve();
    return run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  },

  markVerified(id) {
    return run(
      'UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
      [id]
    );
  },

  setVerificationToken(id, token, expires) {
    return run(
      'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [token, expires, id]
    );
  },

  setApprovalStatus(id, status) {
    return run("UPDATE users SET approval_status = ? WHERE id = ?", [status, id]);
  },

  // ── Account lifecycle ───────────────────────────────────────────────────────

  // Freezes the account. The row, its email and all case data stay intact —
  // requireAuth and login both refuse the account until it is reactivated.
  suspend(id, { byUserId, reason }) {
    return run(
      `UPDATE users
          SET status = ?, suspended_at = ?, suspended_by = ?, suspended_reason = ?
        WHERE id = ?`,
      [USER_STATUS.SUSPENDED, nowSql(), byUserId || null, reason || null, id]
    );
  },

  reactivate(id) {
    return run(
      `UPDATE users
          SET status = ?, suspended_at = NULL, suspended_by = NULL, suspended_reason = NULL
        WHERE id = ?`,
      [USER_STATUS.ACTIVE, id]
    );
  },

  // Soft delete. The email is rewritten to a per-id tombstone address so the
  // UNIQUE index no longer holds the real address — that is what lets the
  // person register again with the same email. Credentials and pending tokens
  // are scrubbed so the tombstoned row can never be authenticated against.
  softDelete(id, { byUserId, email }) {
    return run(
      `UPDATE users
          SET status = ?, deleted_at = ?, deleted_by = ?, original_email = ?,
              email = ?, password_hash = '', google_id = NULL,
              verification_token = NULL, verification_token_expires = NULL,
              password_reset_token = NULL, password_reset_expires = NULL,
              login_otp = NULL, phone_reset_otp = NULL,
              two_fa_enabled = 0, two_fa_secret = NULL
        WHERE id = ?`,
      [
        USER_STATUS.DELETED, nowSql(), byUserId || null, email,
        `deleted+${id}@deleted.invalid`,
        id,
      ]
    );
  },

  // Counts admins that can still sign in — used to refuse suspending or
  // deleting the last one and locking everybody out of the admin portal.
  countActiveAdmins(excludeId) {
    return one(
      `SELECT COUNT(*) AS cnt FROM users
        WHERE role IN ('itsupport', 'partner')
          AND ${NOT_DELETED}
          AND COALESCE(status, '${USER_STATUS.ACTIVE}') <> '${USER_STATUS.SUSPENDED}'
          AND id <> ?`,
      [excludeId]
    );
  },

  setPasswordHash(id, hash) {
    return run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  },

  findPasswordHash(id) {
    return one('SELECT password_hash FROM users WHERE id = ?', [id]);
  },

  set2faSecret(id, secret) {
    return run('UPDATE users SET two_fa_secret = ? WHERE id = ?', [secret, id]);
  },

  enable2fa(id) {
    return run('UPDATE users SET two_fa_enabled = 1, two_fa_prompt_shown = 1 WHERE id = ?', [id]);
  },

  dismiss2faPrompt(id) {
    return run('UPDATE users SET two_fa_prompt_shown = 1 WHERE id = ?', [id]);
  },

  disable2fa(id) {
    return run('UPDATE users SET two_fa_enabled = 0, two_fa_secret = NULL, two_fa_prompt_shown = 0 WHERE id = ?', [id]);
  },

  // L5: password reset
  setPasswordResetToken(id, token, expires) {
    return run(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [token, expires, id]
    );
  },

  clearPasswordResetToken(id) {
    return run(
      'UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [id]
    );
  },

  findByPasswordResetToken(token) {
    return one(
      'SELECT id, email, password_reset_expires FROM users WHERE password_reset_token = ?',
      [token]
    );
  },
};

module.exports = UserRepository;