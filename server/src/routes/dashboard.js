const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

// ─── Client Dashboard ────────────────────────────────────────────────────────
router.get('/client', requireAuth, (req, res) => {
  const db  = getDb();
  const uid = req.user.id;

  const matter = db.prepare(`
    SELECT m.*, a.first_name || ' ' || a.last_name AS attorney_name, a.email AS attorney_email
    FROM matters m LEFT JOIN users a ON m.attorney_id = a.id
    WHERE m.client_id = ? ORDER BY m.updated_at DESC LIMIT 1
  `).get(uid);

  const openTasks = db.prepare(`
    SELECT COUNT(*) AS c FROM tasks t JOIN matters m ON t.matter_id = m.id
    WHERE m.client_id = ? AND t.status != 'completed'
  `).get(uid).c;

  const overdueTasks = db.prepare(`
    SELECT COUNT(*) AS c FROM tasks t JOIN matters m ON t.matter_id = m.id
    WHERE m.client_id = ? AND t.status != 'completed' AND t.due_date < date('now')
  `).get(uid).c;

  const totalTasks = db.prepare(`
    SELECT COUNT(*) AS c FROM tasks t JOIN matters m ON t.matter_id = m.id WHERE m.client_id = ?
  `).get(uid).c;

  const completedTasks = db.prepare(`
    SELECT COUNT(*) AS c FROM tasks t JOIN matters m ON t.matter_id = m.id
    WHERE m.client_id = ? AND t.status = 'completed'
  `).get(uid).c;

  const tasks = db.prepare(`
    SELECT t.* FROM tasks t JOIN matters m ON t.matter_id = m.id
    WHERE m.client_id = ? AND t.status != 'completed'
    ORDER BY t.due_date ASC LIMIT 6
  `).all(uid);

  const upcomingAppts = db.prepare(`
    SELECT a.* FROM appointments a JOIN matters m ON a.matter_id = m.id
    WHERE m.client_id = ? AND a.start_time >= datetime('now')
    ORDER BY a.start_time ASC LIMIT 3
  `).all(uid);

  const totalDocs = db.prepare(`
    SELECT COUNT(*) AS c FROM documents d JOIN matters m ON d.matter_id = m.id
    WHERE m.client_id = ? AND d.required = 1
  `).get(uid).c;

  const completedDocs = db.prepare(`
    SELECT COUNT(*) AS c FROM documents d JOIN matters m ON d.matter_id = m.id
    WHERE m.client_id = ? AND d.required = 1 AND d.status = 'uploaded'
  `).get(uid).c;

  const requiredDocsPending = totalDocs - completedDocs;

  // Per-category breakdown (all docs, not just required, for the upload center)
  const uploadedDocs = db.prepare(`
    SELECT d.category,
      SUM(CASE WHEN d.status = 'uploaded' THEN 1 ELSE 0 END) AS uploaded,
      COUNT(*) AS total
    FROM documents d JOIN matters m ON d.matter_id = m.id
    WHERE m.client_id = ?
    GROUP BY d.category ORDER BY d.category
  `).all(uid);

  const messages = db.prepare(`
    SELECT msg.*, u.first_name || ' ' || u.last_name AS from_name, u.avatar_initials AS from_initials
    FROM messages msg JOIN users u ON msg.from_user_id = u.id
    WHERE msg.to_user_id = ? ORDER BY msg.created_at DESC LIMIT 5
  `).all(uid);

  // Deadlines: court hearing from matter + nearest pending tasks with future due dates
  const deadlines = [];
  if (matter?.important_date) {
    const daysLeft = Math.round((new Date(matter.important_date) - new Date()) / 86400000);
    if (daysLeft >= 0) {
      deadlines.push({
        title: `Court Hearing – ${matter.description}`,
        description: `${matter.court} · ${matter.county}`,
        date: matter.important_date,
        days_left: daysLeft,
        urgent: daysLeft <= 14,
      });
    }
  }
  const taskDeadlines = db.prepare(`
    SELECT t.title, t.description, t.due_date AS date,
      CAST((julianday(t.due_date) - julianday('now')) AS INTEGER) AS days_left
    FROM tasks t JOIN matters m ON t.matter_id = m.id
    WHERE m.client_id = ? AND t.status != 'completed' AND t.due_date > date('now')
    ORDER BY t.due_date ASC LIMIT 4
  `).all(uid);
  for (const t of taskDeadlines) {
    deadlines.push({ ...t, urgent: t.days_left <= 7 });
  }
  deadlines.sort((a, b) => a.days_left - b.days_left);

  // Readiness: docs 60 pts, task completion 30 pts, overdue penalty 10 pts
  const docScore     = totalDocs > 0 ? (completedDocs / totalDocs) * 60 : 60;
  const taskScore    = totalTasks > 0 ? (completedTasks / totalTasks) * 30 : 30;
  const overdueScore = totalTasks > 0 ? Math.max(0, (1 - overdueTasks / totalTasks)) * 10 : 10;
  const readinessScore = Math.round(docScore + taskScore + overdueScore);

  res.json({
    matter, openTasks, overdueTasks, tasks, upcomingAppts,
    requiredDocsPending, uploadedDocs, messages, deadlines,
    readinessScore, totalDocs, completedDocs, totalTasks, completedTasks,
  });
});

// ─── Attorney Dashboard ───────────────────────────────────────────────────────
router.get('/attorney', requireAuth, (req, res) => {
  const db = getDb();

  const totalMatters  = db.prepare('SELECT COUNT(*) AS c FROM matters').get().c;
  const activeMatters = db.prepare("SELECT COUNT(*) AS c FROM matters WHERE status = 'active'").get().c;
  const atRiskMatters = db.prepare("SELECT COUNT(*) AS c FROM matters WHERE status = 'at_risk'").get().c;

  const matters = db.prepare(`
    SELECT m.*,
      c.first_name || ' ' || c.last_name AS client_name, c.avatar_initials AS client_initials,
      a.first_name || ' ' || a.last_name AS attorney_name
    FROM matters m
    LEFT JOIN users c ON m.client_id  = c.id
    LEFT JOIN users a ON m.attorney_id = a.id
    ORDER BY m.updated_at DESC LIMIT 10
  `).all();

  const upcomingAppts = db.prepare(`
    SELECT ap.*, m.description AS matter_description, m.case_number
    FROM appointments ap JOIN matters m ON ap.matter_id = m.id
    WHERE ap.start_time >= datetime('now')
    ORDER BY ap.start_time ASC LIMIT 5
  `).all();

  const missingDocs  = db.prepare("SELECT COUNT(*) AS c FROM documents WHERE status = 'pending' AND required = 1").get().c;
  const overdueTasks = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status != 'completed' AND due_date < date('now')").get().c;

  const recentMessages = db.prepare(`
    SELECT msg.*, u.first_name || ' ' || u.last_name AS from_name, u.avatar_initials AS from_initials
    FROM messages msg JOIN users u ON msg.from_user_id = u.id
    WHERE msg.to_user_id = ? ORDER BY msg.created_at DESC LIMIT 5
  `).all(req.user.id);

  // Monthly revenue simulation derived from matter count (no billing table exists)
  const basePerMatter = 12000;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentMonth = new Date().getMonth();
  const revenueData = months.map((month, i) => {
    if (i > currentMonth) return { month, revenue: 0, collected: 0 };
    const revenue   = Math.round((totalMatters * basePerMatter + i * 1800) / 1000);
    const collected = Math.round(revenue * (0.78 + (i % 4) * 0.03));
    return { month, revenue, collected };
  });

  const ytdRevenue     = revenueData.reduce((s, d) => s + d.revenue * 1000, 0);
  const collectedMonth = revenueData[currentMonth].collected * 1000;
  const outstandingAR  = Math.round(ytdRevenue * 0.17);
  const profitability  = Math.max(20, 35 - atRiskMatters * 3);
  const partnerDraws   = Math.round(ytdRevenue * 0.05);

  // Financial health score 0-100
  const healthScore = Math.min(95, Math.max(40, 80 - atRiskMatters * 5 - Math.min(15, missingDocs)));

  res.json({
    totalMatters, activeMatters, atRiskMatters,
    matters, upcomingAppts, missingDocs, overdueTasks, recentMessages,
    ytdRevenue, collectedMonth, outstandingAR, profitability, partnerDraws,
    revenueData, healthScore,
  });
});

// ─── Partner Dashboard ────────────────────────────────────────────────────────
router.get('/partner', requireAuth, (req, res) => {
  const db = getDb();

  const activeMatters  = db.prepare("SELECT COUNT(*) AS c FROM matters WHERE status != 'complete'").get().c;
  const missingDocs    = db.prepare("SELECT COUNT(*) AS c FROM documents WHERE status = 'pending' AND required = 1").get().c;
  const readyForReview = db.prepare("SELECT COUNT(*) AS c FROM matters WHERE stage = 'court_review'").get().c;
  const annualDeadlines = db.prepare(`
    SELECT COUNT(*) AS c FROM matters
    WHERE important_date IS NOT NULL
      AND important_date BETWEEN date('now') AND date('now', '+40 days')
  `).get().c;

  // Matters with per-row readiness computed in SQL
  const matters = db.prepare(`
    SELECT m.*,
      c.first_name || ' ' || c.last_name AS client_name, c.avatar_initials AS client_initials,
      a.first_name || ' ' || a.last_name AS attorney_name,
      (SELECT COUNT(*) FROM documents d WHERE d.matter_id = m.id AND d.required = 1 AND d.status = 'pending')  AS missing_docs_count,
      (SELECT COUNT(*) FROM documents d WHERE d.matter_id = m.id AND d.required = 1 AND d.status = 'uploaded') AS uploaded_docs_count,
      (SELECT COUNT(*) FROM documents d WHERE d.matter_id = m.id AND d.required = 1)                           AS total_docs_count
    FROM matters m
    LEFT JOIN users c ON m.client_id  = c.id
    LEFT JOIN users a ON m.attorney_id = a.id
    ORDER BY m.updated_at DESC LIMIT 10
  `).all().map(m => ({
    ...m,
    readiness_pct: m.total_docs_count > 0
      ? Math.round((m.uploaded_docs_count / m.total_docs_count) * 100)
      : 100,
  }));

  const upcomingAppts = db.prepare(`
    SELECT ap.*, m.description AS matter_description, m.case_number
    FROM appointments ap JOIN matters m ON ap.matter_id = m.id
    WHERE ap.start_time >= datetime('now')
    ORDER BY ap.start_time ASC LIMIT 6
  `).all();

  // All pending/overdue client tasks across every matter
  const clientTasks = db.prepare(`
    SELECT t.*,
      u.first_name || ' ' || u.last_name AS client_name,
      m.description AS matter_description,
      CAST((julianday(t.due_date) - julianday('now')) AS INTEGER) AS days_left
    FROM tasks t
    JOIN matters m ON t.matter_id = m.id
    JOIN users  u ON t.assigned_to = u.id
    WHERE t.status != 'completed'
    ORDER BY t.due_date ASC LIMIT 20
  `).all();

  // Doc compliance by category (required docs only)
  const docStats = db.prepare(`
    SELECT category,
      SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) AS uploaded,
      COUNT(*) AS total
    FROM documents WHERE required = 1
    GROUP BY category ORDER BY category
  `).all();

  const totalRequired  = db.prepare("SELECT COUNT(*) AS c FROM documents WHERE required = 1").get().c;
  const totalUploaded  = db.prepare("SELECT COUNT(*) AS c FROM documents WHERE required = 1 AND status = 'uploaded'").get().c;
  const totalTasks     = db.prepare('SELECT COUNT(*) AS c FROM tasks').get().c;
  const completedTasks = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status = 'completed'").get().c;
  const overdueTasks   = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status != 'completed' AND due_date < date('now')").get().c;

  const docScore     = totalRequired > 0 ? (totalUploaded / totalRequired) * 60 : 60;
  const taskScore    = totalTasks > 0 ? (completedTasks / totalTasks) * 30 : 30;
  const overdueScore = totalTasks > 0 ? Math.max(0, (1 - overdueTasks / totalTasks)) * 10 : 10;
  const readinessScore       = Math.round(docScore + taskScore + overdueScore);
  const annualReturnProgress = totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0;

  // Most common active stage → drives the lifecycle visualisation
  const LIFECYCLE_KEYS = ['intake','hearing_prep','initial_inventory','monthly_records','annual_return_prep','court_review','complete'];
  const topStage = db.prepare(`
    SELECT stage FROM matters WHERE status != 'complete'
    GROUP BY stage ORDER BY COUNT(*) DESC LIMIT 1
  `).get();
  const lifecycleStageIdx = topStage ? Math.max(0, LIFECYCLE_KEYS.indexOf(topStage.stage)) : 0;

  res.json({
    activeMatters, missingDocs, readyForReview, annualDeadlines,
    matters, upcomingAppts, clientTasks, docStats,
    annualReturnProgress, readinessScore, lifecycleStageIdx,
    totalRequired, totalUploaded, totalTasks, completedTasks, overdueTasks,
  });
});

module.exports = router;
