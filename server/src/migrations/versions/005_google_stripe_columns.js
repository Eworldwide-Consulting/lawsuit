// Migration 005 — Google OAuth profile + Stripe customer columns
// Adds non-breaking nullable columns so existing rows are unaffected.

async function addCol(run, table, col, def) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (/duplicate column|already exists/i.test(e.message)) return;
    throw e;
  }
}

exports.up = async function ({ run, dbType }) {
  // ── users ─────────────────────────────────────────────────────────────────
  await addCol(run, 'users', 'google_id',      'VARCHAR(255)');
  await addCol(run, 'users', 'avatar_url',     'TEXT');
  await addCol(run, 'users', 'login_provider', "VARCHAR(20) DEFAULT 'email'");
  await addCol(run, 'users', 'last_login',     'DATETIME');
  await addCol(run, 'users', 'stripe_customer_id', 'VARCHAR(255)');

  // ── invoices ──────────────────────────────────────────────────────────────
  await addCol(run, 'invoices', 'receipt_url',    'TEXT');
  await addCol(run, 'invoices', 'refund_amount',  'INTEGER DEFAULT 0');
  await addCol(run, 'invoices', 'refund_reason',  'TEXT');
  await addCol(run, 'invoices', 'refunded_at',    'DATETIME');
  await addCol(run, 'invoices', 'failure_reason', 'TEXT');
  await addCol(run, 'invoices', 'failed_at',      'DATETIME');
};

exports.down = async function () {};
