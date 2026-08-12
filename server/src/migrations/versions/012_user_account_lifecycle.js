// Adds account-lifecycle columns to users:
//   status            'active' | 'suspended' | 'deleted'
//   suspended_at/by/reason   who froze the account, when, and why
//   deleted_at/by            soft-delete tombstone
//   original_email           the address held before deletion released it
//
// Deletion is deliberately a SOFT delete. matters, documents, messages,
// invoices and tasks all reference users(id) without ON DELETE CASCADE, so a
// hard DELETE would either fail on the foreign key or destroy case history a
// legal platform has to retain. Instead the row stays, login credentials are
// scrubbed, and the email is rewritten to a tombstone address — which is what
// frees the original address so the person can register again with it.

async function addCol(run, table, col, def) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (/duplicate column/i.test(e.message)) return; // already exists — idempotent
    throw e;
  }
}

exports.up = async function ({ run }) {
  await addCol(run, 'users', 'status',           "VARCHAR(20) DEFAULT 'active'");
  await addCol(run, 'users', 'suspended_at',     'DATETIME');
  await addCol(run, 'users', 'suspended_by',     'BIGINT');
  await addCol(run, 'users', 'suspended_reason', 'VARCHAR(500)');
  await addCol(run, 'users', 'deleted_at',       'DATETIME');
  await addCol(run, 'users', 'deleted_by',       'BIGINT');
  await addCol(run, 'users', 'original_email',   'VARCHAR(255)');

  // Rows created before the column existed have no default applied.
  await run("UPDATE users SET status = 'active' WHERE status IS NULL");
};

exports.down = async function () {};