// Adds password_reset_token + password_reset_expires columns to the users table
// for the self-service password reset flow (L5).

exports.up = async function ({ run }) {
  // SQLite / MySQL both accept this syntax via the db.run() abstraction.
  // The addColumn helpers in database.js are not available here, but the
  // migration runner guarantees each file runs exactly once, so plain ALTER is safe.
  const alters = [
    `ALTER TABLE users ADD COLUMN password_reset_token TEXT`,
    `ALTER TABLE users ADD COLUMN password_reset_expires TEXT`,
  ];

  for (const sql of alters) {
    try {
      await run(sql);
    } catch (err) {
      // 1060 = MySQL duplicate column, 'duplicate column' = SQLite — both mean already applied
      const msg = err.message?.toLowerCase() ?? '';
      if (err.errno === 1060 || msg.includes('duplicate column') || msg.includes('already exists')) {
        continue;
      }
      throw err;
    }
  }

  // Index for fast token lookups — tokens are single-use and expire in 1 hour
  try {
    await run(`CREATE INDEX idx_users_pwd_reset ON users (password_reset_token)`);
  } catch {
    // Index already exists — safe to ignore
  }
};