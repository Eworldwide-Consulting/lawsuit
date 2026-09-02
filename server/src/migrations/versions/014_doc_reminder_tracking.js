// Adds:
//   matters.last_doc_reminder_sent_at — when the "documents still needed"
//     readiness reminder email was last sent for this matter, so the daily
//     sweep (server/src/jobs/documentReminders.js) never re-sends the same
//     reminder more than once every few days.

async function addCol(run, dbType, table, col, def) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (/duplicate column/i.test(e.message)) return; // already exists — idempotent
    throw e;
  }
}

exports.up = async function ({ run, dbType }) {
  await addCol(run, dbType, 'matters', 'last_doc_reminder_sent_at', 'DATETIME NULL');
};

exports.down = async function () {};
