// Shared utilities — single source of truth for cross-route logic.

// ── Matter lifecycle ──────────────────────────────────────────────────────────

const MATTER_STAGES = [
  'intake',
  'hearing_prep',
  'initial_inventory',
  'monthly_records',
  'annual_return_prep',
  'court_review',
  'complete',
];

// ── User serialization ────────────────────────────────────────────────────────

// Returns only the fields safe to expose in API responses.
// Never let password_hash, two_fa_secret, or verification tokens leave the server.
function sanitizeUser(user) {
  return {
    id:                   user.id,
    first_name:           user.first_name,
    last_name:            user.last_name,
    email:                user.email,
    role:                 user.role,
    phone:                user.phone ?? null,
    avatar_initials:      user.avatar_initials ?? null,
    email_verified:       user.email_verified ?? 0,
    approval_status:      user.approval_status ?? null,
    two_fa_enabled:       user.two_fa_enabled ?? 0,
    two_fa_prompt_shown:  user.two_fa_prompt_shown ?? 0,
  };
}

// ── SQL helpers ───────────────────────────────────────────────────────────────

// Builds the ?-placeholders for an SQL IN (...) clause.
// Works with db.js's ? → $N conversion for PostgreSQL.
function inList(ids) {
  if (!ids.length) throw new Error('inList called with empty array');
  return ids.map(() => '?').join(',');
}

// SQL-compatible "now" that works in both SQLite and PostgreSQL.
// Use this in queries instead of NOW() (MySQL/PG only) or datetime('now') (SQLite only).
const NOW_SQL = 'CURRENT_TIMESTAMP';

// ── Business logic ────────────────────────────────────────────────────────────

// Readiness score: 60 pts docs, 30 pts tasks, 10 pts no overdue.
// Shared between client dashboard and partner dashboard.
function computeReadinessScore({ totalDocs, completedDocs, totalTasks, completedTasks, overdueTasks }) {
  const docScore     = totalDocs  > 0 ? (completedDocs  / totalDocs)  * 60 : 60;
  const taskScore    = totalTasks > 0 ? (completedTasks / totalTasks) * 30 : 30;
  const overdueScore = totalTasks > 0 ? Math.max(0, (1 - overdueTasks / totalTasks)) * 10 : 10;
  return Math.round(docScore + taskScore + overdueScore);
}

// Days until a date string (positive = future, negative = past).
function daysUntil(dateStr) {
  return Math.round((new Date(dateStr) - Date.now()) / 86_400_000);
}

// Today's date as YYYY-MM-DD (UTC).
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Current datetime as YYYY-MM-DDTHH:MM:SS (UTC, no ms, no Z).
function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

// ── Pagination ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE     = 200;

function parsePagination(query) {
  const limit  = Math.min(parseInt(query.limit)  || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  return { limit, offset };
}

// ── Doc category aggregation ──────────────────────────────────────────────────

// Collapses a flat list of { category, status, required } doc rows
// into per-category { category, uploaded, total } buckets.
function aggregateDocsByCategory(docs) {
  const map = {};
  for (const d of docs) {
    const k = d.category || 'Uncategorized';
    if (!map[k]) map[k] = { category: k, uploaded: 0, total: 0 };
    map[k].total++;
    if (d.status === 'uploaded') map[k].uploaded++;
  }
  return Object.values(map).sort((a, b) => a.category.localeCompare(b.category));
}

module.exports = {
  MATTER_STAGES,
  sanitizeUser,
  inList,
  NOW_SQL,
  computeReadinessScore,
  daysUntil,
  todayIso,
  nowIso,
  parsePagination,
  aggregateDocsByCategory,
};
