// Today's date as YYYY-MM-DD in UTC.
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Current datetime as YYYY-MM-DDTHH:MM:SS in UTC (no ms, no Z suffix).
// Matches the TEXT format stored in SQLite and accepted by MySQL/PG.
function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

// Days until a date string (positive = future, negative = past).
function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - Date.now()) / 86_400_000);
}

// ISO timestamp 24 hours from now — used for token expiry.
function in24Hours() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

module.exports = { todayIso, nowIso, daysUntil, in24Hours };