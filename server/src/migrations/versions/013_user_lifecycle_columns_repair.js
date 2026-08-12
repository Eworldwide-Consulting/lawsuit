// Repairs the account-lifecycle columns from migration 012.
//
// Symptom this fixes: on production MySQL both PUT /admin/users/:id/suspend and
// DELETE /admin/users/:id returned 500, while the admin user list (which reads
// status/suspended_at/suspended_reason) worked. That pattern means some of the
// 012 columns are present and some are not — the ones no read path touches
// (suspended_by, deleted_at, deleted_by, original_email) were never proven.
//
// 012 could not add them again on its own: the runner keys applied migrations by
// filename, so once 012 is recorded it never re-runs regardless of the table's
// real shape. This migration re-checks the live schema and adds whatever is
// missing, so it converges no matter which subset already exists.

const LIFECYCLE_COLUMNS = [
  ['status',           "VARCHAR(20) DEFAULT 'active'"],
  ['suspended_at',     'DATETIME'],
  ['suspended_by',     'BIGINT'],
  ['suspended_reason', 'VARCHAR(500)'],
  ['deleted_at',       'DATETIME'],
  ['deleted_by',       'BIGINT'],
  ['original_email',   'VARCHAR(255)'],
];

// Reads the columns that actually exist rather than assuming 012 applied.
async function existingColumns({ all, dbType }) {
  if (dbType === 'mysql') {
    const rows = await all(
      `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    return new Set(rows.map(r => r.name || r.COLUMN_NAME));
  }
  if (dbType === 'postgres') {
    const rows = await all(
      `SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'users'`
    );
    return new Set(rows.map(r => r.name));
  }
  const rows = await all('PRAGMA table_info(users)');
  return new Set(rows.map(r => r.name));
}

exports.up = async function ({ run, all, dbType }) {
  let existing;
  try {
    existing = await existingColumns({ all, dbType });
  } catch {
    // If the schema cannot be introspected, fall through to blind ALTERs below;
    // each one tolerates "duplicate column" anyway.
    existing = new Set();
  }

  const added = [];
  for (const [col, def] of LIFECYCLE_COLUMNS) {
    if (existing.has(col)) continue;
    try {
      await run(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
      added.push(col);
    } catch (e) {
      // Already there (racing deploy, or introspection was unavailable above).
      if (/duplicate column|already exists/i.test(e.message)) continue;
      throw e;
    }
  }

  // Backfill: rows predating the column read as NULL, which every status check
  // treats as active, but make it explicit so admin filters stay simple.
  await run("UPDATE users SET status = 'active' WHERE status IS NULL");

  if (added.length) {
    console.log(`[013] added missing lifecycle columns: ${added.join(', ')}`);
  } else {
    console.log('[013] all lifecycle columns already present');
  }
};

exports.down = async function () {};