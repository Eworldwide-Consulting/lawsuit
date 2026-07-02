// Adds case workflow columns to matters:
//   case_accepted  — 1 = accepted by attorney, 0 = pending acceptance
//   case_accepted_at — timestamp of acceptance
//   decline_reason — optional reason when attorney declines
// Existing matters default to accepted=1 so no disruption for current data.

async function addCol(run, dbType, table, col, def) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (/duplicate column/i.test(e.message)) return; // already exists — idempotent
    throw e;
  }
}

exports.up = async function ({ run, dbType }) {
  await addCol(run, dbType, 'matters', 'case_accepted',    'INTEGER DEFAULT 1');
  await addCol(run, dbType, 'matters', 'case_accepted_at', 'DATETIME');
  await addCol(run, dbType, 'matters', 'decline_reason',   'TEXT');
  await addCol(run, dbType, 'matters', 'request_note',     'TEXT');
};

exports.down = async function () {};
