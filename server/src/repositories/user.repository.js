const { one, run } = require('../db');
const { USER_COLUMNS, LOGIN_COLUMNS } = require('../domain/user');

const SAFE_COLUMNS =
  'id, first_name, last_name, email, role, phone, avatar_initials, email_verified, approval_status, created_at';

const UserRepository = {
  findById(id) {
    return one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
  },

  findByEmail(email) {
    // LOGIN_COLUMNS includes password_hash — only needed at login for bcrypt.compare
    return one(`SELECT ${LOGIN_COLUMNS} FROM users WHERE email = ?`, [email.toLowerCase()]);
  },

  findByVerificationToken(token) {
    return one('SELECT * FROM users WHERE verification_token = ?', [token]);
  },

  findAll({ limit = 50, offset = 0 } = {}) {
    return require('../db').all(
      `SELECT ${SAFE_COLUMNS} FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  },

  findByEmailSafe(email) {
    return one(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE email = ?`,
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