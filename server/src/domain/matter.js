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

// Readiness score: 60 pts docs, 30 pts tasks, 10 pts no overdue.
// Shared between client dashboard and partner dashboard.
function computeReadinessScore({ totalDocs, completedDocs, totalTasks, completedTasks, overdueTasks }) {
  const docScore     = totalDocs  > 0 ? (completedDocs  / totalDocs)  * 60 : 60;
  const taskScore    = totalTasks > 0 ? (completedTasks / totalTasks) * 30 : 30;
  const overdueScore = totalTasks > 0 ? Math.max(0, (1 - overdueTasks / totalTasks)) * 10 : 10;
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

// Generate a case number from the year and the auto-increment id.
function buildCaseNumber(id) {
  return `${new Date().getFullYear().toString().slice(2)}-${String(id).padStart(4, '0')}`;
}

module.exports = {
  MATTER_STAGES,
  MATTER_STATUSES,
  computeReadinessScore,
  aggregateDocsByCategory,
  buildDeadlines,
  buildCaseNumber,
};