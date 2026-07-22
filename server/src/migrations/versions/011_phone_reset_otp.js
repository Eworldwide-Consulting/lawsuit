// Adds users.phone_reset_otp — stores "sha256(code):expiryEpochMs" for the
// SMS-based password reset flow, same convention as the existing
// users.login_otp column (see AuthService.issueLoginOtp), kept in a separate
// column so an in-flight login OTP and a phone-reset OTP never collide.

async function addCol(run, dbType, table, col, def) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (/duplicate column/i.test(e.message)) return; // already exists — idempotent
    throw e;
  }
}

exports.up = async function ({ run, dbType }) {
  await addCol(run, dbType, 'users', 'phone_reset_otp', 'VARCHAR(255)');
};

exports.down = async function () {};
