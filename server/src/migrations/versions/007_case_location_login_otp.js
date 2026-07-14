// Migration 007 — case location + email login verification
// matters.state: US state where the case was launched (county column already
// exists). users.login_otp: "sha256(code):expiryEpochMs" — one-time code
// emailed on every password login before the dashboard is unlocked. Expiry is
// encoded in the value to sidestep DATETIME timezone coercion across drivers.

async function addCol(run, table, col, def) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (/duplicate column|already exists/i.test(e.message)) return;
    throw e;
  }
}

exports.up = async function ({ run }) {
  await addCol(run, 'matters', 'state', 'VARCHAR(50)');
  await addCol(run, 'users', 'login_otp', 'VARCHAR(255)');
};

exports.down = async function () {};
