const { daysUntil } = require('../lib/dates');

const MATTER_STAGES = Object.freeze([
  'intake',
  'hearing_prep',
  'initial_inventory',
  'monthly_records',
  'annual_return_prep',
  'court_review',
  'complete',
]);

const MATTER_STATUSES = Object.freeze(['active', 'at_risk', 'complete']);

// Readiness score: 60 pts docs, 30 pts tasks, 10 pts no overdue — when both
// docs and tasks apply to the matter. If one side has nothing required yet
// (e.g. no tasks have been created), its weight is redistributed onto the
// side that does, rather than handed out for free — a matter with 0/17 docs
// uploaded must never show as "40% ready" just because no tasks exist yet.
// If truly nothing is required on either side, the matter is 100% ready.
// Shared between client dashboard and partner dashboard.
function computeReadinessScore({ totalDocs, completedDocs, totalTasks, completedTasks, overdueTasks }) {
  const hasDocs  = totalDocs  > 0;
  const hasTasks = totalTasks > 0;

  if (!hasDocs && !hasTasks) return 100;

  let docWeight = 0, taskWeight = 0, overdueWeight = 0;
  if (hasDocs && hasTasks)  { docWeight = 60;  taskWeight = 30; overdueWeight = 10; }
  else if (hasDocs)         { docWeight = 100; }
  else                      { taskWeight = 75; overdueWeight = 25; }

  const docScore     = hasDocs  ? (completedDocs  / totalDocs)  * docWeight     : 0;
  const taskScore    = hasTasks ? (completedTasks / totalTasks) * taskWeight    : 0;
  const overdueScore = hasTasks ? Math.max(0, (1 - overdueTasks / totalTasks)) * overdueWeight : 0;

  return Math.round(docScore + taskScore + overdueScore);
}

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

// Build a deadline list from a matter's important_date plus active task due dates.
function buildDeadlines(matter, taskRows) {
  const deadlines = [];

  if (matter?.important_date) {
    const dl = daysUntil(matter.important_date);
    if (dl >= 0) {
      deadlines.push({
        title:       `Court Hearing – ${matter.description}`,
        description: `${matter.court} · ${matter.county}`,
        date:        matter.important_date,
        days_left:   dl,
        urgent:      dl <= 14,
      });
    }
  }

  for (const td of taskRows) {
    const dl = daysUntil(td.due_date);
    deadlines.push({ ...td, date: td.due_date, days_left: dl, urgent: dl <= 7 });
  }

  return deadlines.sort((a, b) => a.days_left - b.days_left);
}

// Generate a case number from the client's initials and their account
// creation date (YYMMDD), plus the matter's auto-increment id. The id suffix
// is what keeps this unique (case_number has a UNIQUE constraint) — initials
// + a same-day account-creation date alone would collide the moment one
// client opens a second matter, or two same-initialed clients sign up the
// same day.
function buildCaseNumber({ id, firstName, lastName, createdAt }) {
  const initials = `${(firstName || '?').charAt(0)}${(lastName || '?').charAt(0)}`.toUpperCase();
  const d   = createdAt ? new Date(createdAt) : new Date();
  const yy  = String(d.getFullYear()).slice(2);
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const dd  = String(d.getDate()).padStart(2, '0');
  return `${initials}${yy}${mm}${dd}-${String(id).padStart(4, '0')}`;
}

module.exports = {
  MATTER_STAGES,
  MATTER_STATUSES,
  computeReadinessScore,
  aggregateDocsByCategory,
  buildDeadlines,
  buildCaseNumber,
};