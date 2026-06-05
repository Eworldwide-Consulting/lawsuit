const router = require('express').Router();
const { all, one }   = require('../db');
const { getDb }      = require('../database');
const { requireAuth } = require('../middleware/auth');
const {
  inList,
  todayIso,
  nowIso,
  daysUntil,
  computeReadinessScore,
  aggregateDocsByCategory,
  MATTER_STAGES,
  parsePagination,
} = require('../utils');

// ── Client dashboard ──────────────────────────────────────────────────────────

router.get('/client', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const today = todayIso();
    const now   = nowIso();

    const matter = await one(
      `SELECT m.*,
              a.first_name || ' ' || a.last_name AS attorney_name,
              a.email AS attorney_email
       FROM matters m
       LEFT JOIN users a ON m.attorney_id = a.id
       WHERE m.client_id = ?
       ORDER BY m.updated_at DESC
       LIMIT 1`,
      [uid]
    );

    const matterRows = await all('SELECT id FROM matters WHERE client_id = ?', [uid]);
    if (!matterRows.length) {
      return res.json({
        matter, openTasks: 0, overdueTasks: 0, tasks: [],
        upcomingAppts: [], requiredDocsPending: 0, uploadedDocs: [],
        messages: [], deadlines: [], readinessScore: 100,
        totalDocs: 0, completedDocs: 0, totalTasks: 0, completedTasks: 0,
      });
    }

    const ids = matterRows.map((r) => r.id);
    const il  = inList(ids);

    const [
      openR, overdueR, totalR, completedR,
      tasks, appts, allDocs, msgs, deadlineRows,
    ] = await Promise.all([
      one(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${il}) AND status != 'completed'`,                   ids),
      one(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${il}) AND status != 'completed' AND due_date < ?`, [...ids, today]),
      one(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${il})`,                                             ids),
      one(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${il}) AND status = 'completed'`,                   ids),
      all(`SELECT * FROM tasks        WHERE matter_id IN (${il}) AND status != 'completed' ORDER BY due_date ASC LIMIT 6`,   ids),
      all(`SELECT * FROM appointments WHERE matter_id IN (${il}) AND start_time >= ? ORDER BY start_time ASC LIMIT 3`,      [...ids, now]),
      all(`SELECT category, status, required FROM documents WHERE matter_id IN (${il})`,                                     ids),
      all(`SELECT m.*, u.first_name || ' ' || u.last_name AS from_name, u.avatar_initials AS from_initials
           FROM messages m LEFT JOIN users u ON m.from_user_id = u.id
           WHERE m.to_user_id = ? ORDER BY m.created_at DESC LIMIT 5`,                                                       [uid]),
      all(`SELECT title, description, due_date FROM tasks
           WHERE matter_id IN (${il}) AND status != 'completed' AND due_date > ?
           ORDER BY due_date ASC LIMIT 4`,                                                                                   [...ids, today]),
    ]);

    const requiredDocs  = allDocs.filter((d) => d.required);
    const totalDocs     = requiredDocs.length;
    const completedDocs = requiredDocs.filter((d) => d.status === 'uploaded').length;
    const uploadedDocs  = aggregateDocsByCategory(allDocs);

    const totalTasks     = Number(totalR.c);
    const completedTasks = Number(completedR.c);
    const openTasks      = Number(openR.c);
    const overdueTasks   = Number(overdueR.c);

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
    for (const td of deadlineRows) {
      const dl = daysUntil(td.due_date);
      deadlines.push({ ...td, date: td.due_date, days_left: dl, urgent: dl <= 7 });
    }
    deadlines.sort((a, b) => a.days_left - b.days_left);

    res.json({
      matter,
      openTasks,
      overdueTasks,
      tasks,
      upcomingAppts:       appts,
      requiredDocsPending: totalDocs - completedDocs,
      uploadedDocs,
      messages:            msgs,
      deadlines,
      readinessScore:      computeReadinessScore({ totalDocs, completedDocs, totalTasks, completedTasks, overdueTasks }),
      totalDocs,
      completedDocs,
      totalTasks,
      completedTasks,
    });
  } catch (err) {
    req.log?.error({ err }, 'Client dashboard error');
    res.status(500).json({ error: err.message });
  }
});

// ── Attorney dashboard ────────────────────────────────────────────────────────

router.get('/attorney', requireAuth, async (req, res) => {
  try {
    const today = todayIso();
    const now   = nowIso();

    const [statsRow, matters, appts, missingR, overdueR, msgs, revenueRow] = await Promise.all([
      // Single aggregation instead of 3 separate COUNT queries
      one(`SELECT
             COUNT(*)                                              AS total,
             SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN status = 'at_risk'  THEN 1 ELSE 0 END) AS at_risk
           FROM matters`),
      all(`SELECT m.*,
                  c.first_name || ' ' || c.last_name AS client_name,
                  c.avatar_initials AS client_initials,
                  a.first_name || ' ' || a.last_name AS attorney_name
           FROM matters m
           LEFT JOIN users c ON m.client_id   = c.id
           LEFT JOIN users a ON m.attorney_id = a.id
           ORDER BY m.updated_at DESC
           LIMIT 10`),
      all(`SELECT a.*, m.description AS matter_description, m.case_number
           FROM appointments a
           LEFT JOIN matters m ON a.matter_id = m.id
           WHERE a.start_time >= ?
           ORDER BY a.start_time ASC LIMIT 5`, [now]),
      one("SELECT COUNT(*) c FROM documents WHERE status = 'pending' AND required = 1"),
      one("SELECT COUNT(*) c FROM tasks WHERE status != 'completed' AND due_date < ?", [today]),
      all(`SELECT m.*, u.first_name || ' ' || u.last_name AS from_name, u.avatar_initials AS from_initials
           FROM messages m LEFT JOIN users u ON m.from_user_id = u.id
           WHERE m.to_user_id = ? ORDER BY m.created_at DESC LIMIT 5`, [req.user.id]),
      // Real collected revenue from invoices — not fabricated
      one("SELECT COALESCE(SUM(amount), 0) AS ytd FROM invoices WHERE status = 'paid'"),
    ]);

    const totalMatters  = Number(statsRow.total);
    const activeMatters = Number(statsRow.active);
    const atRiskMatters = Number(statsRow.at_risk);
    const missingDocs   = Number(missingR.c);
    const overdueTasks  = Number(overdueR.c);
    const ytdRevenue    = Number(revenueRow.ytd); // in cents

    // Per-month revenue from real invoice data
    const dbType = getDb().type;
    const monthlyRows = await all(
      dbType === 'postgres'
        ? `SELECT EXTRACT(MONTH FROM paid_at)::int AS month_num, SUM(amount) AS revenue
           FROM invoices WHERE status = 'paid' GROUP BY month_num`
        : dbType === 'mysql'
        ? `SELECT MONTH(paid_at) AS month_num, SUM(amount) AS revenue
           FROM invoices WHERE status = 'paid' GROUP BY month_num`
        : `SELECT CAST(strftime('%m', paid_at) AS INTEGER) AS month_num, SUM(amount) AS revenue
           FROM invoices WHERE status = 'paid' GROUP BY month_num`
    );
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthMap = {};
    for (const r of monthlyRows) monthMap[parseInt(r.month_num, 10) - 1] = Number(r.revenue);

    const revenueData = MONTHS.map((month, i) => ({
      month,
      revenue:   Math.round((monthMap[i] || 0) / 100), // dollars
      collected: Math.round((monthMap[i] || 0) / 100),
    }));

    res.json({
      totalMatters,
      activeMatters,
      atRiskMatters,
      matters,
      upcomingAppts:  appts,
      missingDocs,
      overdueTasks,
      recentMessages: msgs,
      ytdRevenue,
      revenueData,
      healthScore: Math.min(95, Math.max(40, 80 - atRiskMatters * 5 - Math.min(15, missingDocs))),
    });
  } catch (err) {
    req.log?.error({ err }, 'Attorney dashboard error');
    res.status(500).json({ error: err.message });
  }
});

// ── Partner dashboard ─────────────────────────────────────────────────────────

router.get('/partner', requireAuth, async (req, res) => {
  try {
    const today   = todayIso();
    const now     = nowIso();
    const in40Days = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);

    const [statsRow, matters, appts, clientTasks, allReqDocs] = await Promise.all([
      // Five counts in one pass
      one(`SELECT
             SUM(CASE WHEN status != 'complete'                                                        THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN stage   = 'court_review'                                                    THEN 1 ELSE 0 END) AS ready_review,
             SUM(CASE WHEN important_date IS NOT NULL AND important_date >= ? AND important_date <= ?   THEN 1 ELSE 0 END) AS deadlines
           FROM matters`,
        [today, in40Days]),
      all(`SELECT m.*,
                  c.first_name || ' ' || c.last_name AS client_name,
                  c.avatar_initials AS client_initials,
                  a.first_name || ' ' || a.last_name AS attorney_name
           FROM matters m
           LEFT JOIN users c ON m.client_id   = c.id
           LEFT JOIN users a ON m.attorney_id = a.id
           ORDER BY m.updated_at DESC LIMIT 10`),
      all(`SELECT a.*, m.description AS matter_description, m.case_number
           FROM appointments a
           LEFT JOIN matters m ON a.matter_id = m.id
           WHERE a.start_time >= ? ORDER BY a.start_time ASC LIMIT 6`, [now]),
      all(`SELECT tk.*,
                  m.description AS matter_description,
                  u.first_name || ' ' || u.last_name AS client_name
           FROM tasks tk
           LEFT JOIN matters m ON tk.matter_id  = m.id
           LEFT JOIN users   u ON tk.assigned_to = u.id
           WHERE tk.status != 'completed'
           ORDER BY tk.due_date ASC LIMIT 20`),
      all("SELECT category, status FROM documents WHERE required = 1"),
    ]);

    // Separate task aggregate (needs its own query for accuracy)
    const [totalR, completedR, overdueR, missingDocsR] = await Promise.all([
      one('SELECT COUNT(*) c FROM tasks'),
      one("SELECT COUNT(*) c FROM tasks WHERE status = 'completed'"),
      one("SELECT COUNT(*) c FROM tasks WHERE status != 'completed' AND due_date < ?", [today]),
      one("SELECT COUNT(*) c FROM documents WHERE status = 'pending' AND required = 1"),
    ]);

    const totalTasks     = Number(totalR.c);
    const completedTasks = Number(completedR.c);
    const overdueTasks   = Number(overdueR.c);

    const totalRequired = allReqDocs.length;
    const totalUploaded = allReqDocs.filter((d) => d.status === 'uploaded').length;
    const docStats      = aggregateDocsByCategory(allReqDocs);

    const tasks_ct = clientTasks.map((t) => ({
      ...t,
      days_left: t.due_date ? daysUntil(t.due_date) : null,
    }));

    const stageCounts = {};
    for (const m of matters.filter((m) => m.status !== 'complete')) {
      stageCounts[m.stage] = (stageCounts[m.stage] || 0) + 1;
    }
    const topStage = Object.entries(stageCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

    res.json({
      activeMatters:        Number(statsRow.active),
      missingDocs:          Number(missingDocsR.c),
      readyForReview:       Number(statsRow.ready_review),
      annualDeadlines:      Number(statsRow.deadlines),
      matters,
      upcomingAppts:        appts,
      clientTasks:          tasks_ct,
      docStats,
      annualReturnProgress: totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0,
      readinessScore:       computeReadinessScore({ totalDocs: totalRequired, completedDocs: totalUploaded, totalTasks, completedTasks, overdueTasks }),
      lifecycleStageIdx:    topStage ? Math.max(0, MATTER_STAGES.indexOf(topStage)) : 0,
      totalRequired,
      totalUploaded,
      totalTasks,
      completedTasks,
      overdueTasks,
    });
  } catch (err) {
    req.log?.error({ err }, 'Partner dashboard error');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
