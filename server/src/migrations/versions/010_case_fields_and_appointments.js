// Adds:
//   matters.legal_case_number — the court's own docket number, entered by the
//     client/attorney. Separate from matters.case_number (the system-generated
//     "26-0007" style reference number) — the two are independent values.
//   appointments.status — 'scheduled' (default) | 'no_show' | 'rescheduled'
//     tracks attendance so a missed appointment can be rescheduled.

async function addCol(run, dbType, table, col, def) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (/duplicate column/i.test(e.message)) return; // already exists — idempotent
    throw e;
  }
}

exports.up = async function ({ run, dbType }) {
  await addCol(run, dbType, 'matters', 'legal_case_number', 'VARCHAR(100)');
  await addCol(run, dbType, 'appointments', 'status', "VARCHAR(20) DEFAULT 'scheduled'");
};

exports.down = async function () {};
