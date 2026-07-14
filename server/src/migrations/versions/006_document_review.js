// Migration 006 — document review workflow
// Adds nullable review metadata so attorneys can approve/reject with a note
// and clients can see why a document was rejected before re-uploading.

async function addCol(run, table, col, def) {
  try {
    await run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e) {
    if (/duplicate column|already exists/i.test(e.message)) return;
    throw e;
  }
}

exports.up = async function ({ run }) {
  await addCol(run, 'documents', 'review_note', 'TEXT');
  await addCol(run, 'documents', 'reviewed_by', 'BIGINT');
  await addCol(run, 'documents', 'reviewed_at', 'DATETIME');
};

exports.down = async function () {};
