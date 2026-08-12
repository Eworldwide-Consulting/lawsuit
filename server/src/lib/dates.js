// Today's date as YYYY-MM-DD in UTC.
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Current datetime as YYYY-MM-DDTHH:MM:SS in UTC (no ms, no Z suffix).
// Matches the TEXT format stored in SQLite and accepted by MySQL/PG.
function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

// Current datetime as 'YYYY-MM-DD HH:MM:SS' — the form a MySQL DATETIME column
// accepts under strict mode (the default). A full toISOString() carries a 'T'
// separator and a 'Z' suffix and is rejected with "Incorrect datetime value",
// so anything written to a DATETIME column must go through this. SQLite and
// Postgres accept this form too, which is why the bug only shows on MySQL.
function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Days until a date string (positive = future, negative = past).
function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - Date.now()) / 86_400_000);
}

// ISO timestamp 24 hours from now — used for token expiry.
function in24Hours() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

module.exports = { todayIso, nowIso, nowSql, daysUntil, in24Hours };