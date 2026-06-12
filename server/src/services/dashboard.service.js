const MatterRepo      = require('../repositories/matter.repository');
const TaskRepo        = require('../repositories/task.repository');
const AppointmentRepo = require('../repositories/appointment.repository');
const DocumentRepo    = require('../repositories/document.repository');
const MessageRepo     = require('../repositories/message.repository');
const InvoiceRepo     = require('../repositories/invoice.repository');
const { computeReadinessScore, aggregateDocsByCategory, buildDeadlines } = require('../domain/matter');
const { getDb } = require('../database');
const { all: dbAll } = require('../db');
const { todayIso, nowIso, daysUntil } = require('../lib/dates');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DashboardService = {
  async clientDashboard(userId) {
    const today = todayIso();
    const now   = nowIso();

    const matter     = await MatterRepo.findLatestForClient(userId);
    const matterRows = await MatterRepo.idsByClientId(userId);

    if (!matterRows.length) {
      return {
        matter, openTasks: 0, overdueTasks: 0, tasks: [],
        upcomingAppts: [], requiredDocsPending: 0, uploadedDocs: [],
        messages: [], deadlines: [], readinessScore: 100,
        totalDocs: 0, completedDocs: 0, totalTasks: 0, completedTasks: 0,
      };
    }

    const ids = matterRows.map(r => r.id);

    const [taskStats, allActiveTasks, appts, allDocs, msgs] = await Promise.all([
      TaskRepo.aggregateByMatters(ids, today),
      TaskRepo.findActiveByMatters(ids, 10),
      AppointmentRepo.findByMattersAfter(ids, now, 3),
      DocumentRepo.findCategoryStatsByMatters(ids),
      MessageRepo.findRecentForUser(userId, 5),
    ]);

    // Checklist-based document readiness — use the checklist items for the
    // client's primary matter as the source of truth for "required docs".
    let checklistTotal    = 0;
    let checklistAccepted = 0;   // attorney-reviewed and accepted
    let checklistUploaded = 0;   // submitted or accepted by client (pending review or done)
    let checklistSections = [];
    if (matter) {
      try {
        const clItems = await dbAll(
          `SELECT status, default_status, section FROM matter_checklist_items WHERE matter_id = ?`,
          [matter.id]
        );
        const neededNow    = clItems.filter(i => i.default_status === 'needed_now');
        checklistTotal    = neededNow.length;
        checklistAccepted = neededNow.filter(i => i.status === 'accepted').length;
        checklistUploaded = neededNow.filter(i => ['submitted', 'accepted'].includes(i.status)).length;

        // Per-section progress for the upload center widget
        const secMap = {};
        for (const i of clItems) {
          const k = i.section || 'Other';
          if (!secMap[k]) secMap[k] = { category: k, uploaded: 0, total: 0 };
          secMap[k].total++;
          if (['submitted', 'accepted'].includes(i.status)) secMap[k].uploaded++;
        }
        checklistSections = Object.values(secMap).slice(0, 5);
      } catch (_) {}

      // Also count documents uploaded directly via the Documents page
      try {
        const docRow = await dbAll(
          `SELECT COUNT(*) AS cnt FROM documents WHERE matter_id = ?`,
          [matter.id]
        );
        const docsTableCount = Number(docRow[0]?.cnt ?? 0);
        // Use the higher of checklist-based uploads vs direct document uploads
        checklistUploaded = Math.max(checklistUploaded, docsTableCount);
      } catch (_) {}
    }

    const tasks        = allActiveTasks.slice(0, 6);
    const deadlineRows = allActiveTasks.filter(t => t.due_date && t.due_date > today).slice(0, 4);

    // Fall back to document-table counts if checklist isn't seeded yet
    const requiredDocs   = allDocs.filter(d => d.required);
    const totalDocs      = checklistTotal  || requiredDocs.length;
    // completedDocs uses the "uploaded" count (includes attorney-pending) so gauge advances on upload
    const completedDocs  = checklistUploaded || requiredDocs.filter(d => d.status === 'uploaded').length;
    const uploadedDocs   = checklistSections.length ? checklistSections : aggregateDocsByCategory(allDocs);
    const deadlines      = buildDeadlines(matter, deadlineRows);

    return {
      matter,
      openTasks:           taskStats.open,
      overdueTasks:        taskStats.overdue,
      tasks,
      upcomingAppts:       appts,
      requiredDocsPending: Math.max(0, totalDocs - completedDocs),
      uploadedDocs,
      messages:            msgs,
      deadlines,
      readinessScore:      computeReadinessScore({
        totalDocs, completedDocs,
        totalTasks:     taskStats.total,
        completedTasks: taskStats.completed,
        overdueTasks:   taskStats.overdue,
      }),
      totalDocs,
      completedDocs,
      checklistTotal,
      checklistAccepted,   // attorney-accepted only (shown as "X accepted")
      checklistUploaded,   // uploaded by client (shown in gauge)
      totalTasks:     taskStats.total,
      completedTasks: taskStats.completed,
    };
  },

  async attorneyDashboard(userId) {
    const today = todayIso();
    const now   = nowIso();

    const [statsRow, matters, appts, missingR, overdueR, msgs, revenueRow] = await Promise.all([
      MatterRepo.stats(),
      MatterRepo.findForAttorneyDashboard(),
      AppointmentRepo.findForAttorneyDashboard(now, 5),
      require('../db').one("SELECT COUNT(*) c FROM documents WHERE status = 'pending' AND required = 1"),
      require('../db').one("SELECT COUNT(*) c FROM tasks WHERE status != 'completed' AND due_date < ?", [today]),
      MessageRepo.findRecentForUser(userId, 5),
      InvoiceRepo.ytdRevenue(),
    ]);

    const ytdRevenue    = Number(revenueRow.ytd);
    const missingDocs   = Number(missingR.c);
    const overdueTasks  = Number(overdueR.c);

    const monthlyRows = await InvoiceRepo.monthlyRevenue(getDb().type);
    const monthMap = {};
    for (const r of monthlyRows) monthMap[parseInt(r.month_num, 10) - 1] = Number(r.revenue);

    const revenueData = MONTHS.map((month, i) => ({
      month,
      revenue:   Math.round((monthMap[i] || 0) / 100),
      collected: Math.round((monthMap[i] || 0) / 100),
    }));

    return {
      totalMatters:  statsRow.total,
      activeMatters: statsRow.active,
      atRiskMatters: statsRow.atRisk,
      matters,
      upcomingAppts:  appts,
      missingDocs,
      overdueTasks,
      recentMessages: msgs,
      ytdRevenue,
      revenueData,
      healthScore: Math.min(95, Math.max(40, 80 - statsRow.atRisk * 5 - Math.min(15, missingDocs))),
    };
  },

  async partnerDashboard() {
    const today    = todayIso();
    const now      = nowIso();
    const in40Days = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);

    const [statsRow, matters, appts, clientTasks, allReqDocs] = await Promise.all([
      require('../db').one(
        `SELECT
           SUM(CASE WHEN status != 'complete' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN stage   = 'court_review' THEN 1 ELSE 0 END) AS ready_review,
           SUM(CASE WHEN important_date IS NOT NULL AND important_date >= ? AND important_date <= ? THEN 1 ELSE 0 END) AS deadlines
         FROM matters`,
        [today, in40Days]
      ),
      MatterRepo.findForAttorneyDashboard(),
      AppointmentRepo.findForAttorneyDashboard(now, 6),
      TaskRepo.findAllActiveForPartner(20),
      require('../db').all("SELECT category, status FROM documents WHERE required = 1"),
    ]);

    const globalStats = await TaskRepo.globalStats(today);
    const missingDocsR = await require('../db').one("SELECT COUNT(*) c FROM documents WHERE status = 'pending' AND required = 1");

    const totalRequired = allReqDocs.length;
    const totalUploaded = allReqDocs.filter(d => d.status === 'uploaded').length;

    return {
      activeMatters:        Number(statsRow.active),
      missingDocs:          Number(missingDocsR.c),
      readyForReview:       Number(statsRow.ready_review),
      annualDeadlines:      Number(statsRow.deadlines),
      matters,
      upcomingAppts:        appts,
      clientTasks:          clientTasks.map(t => ({ ...t, days_left: t.due_date ? daysUntil(t.due_date) : null })),
      docStats:             aggregateDocsByCategory(allReqDocs),
      annualReturnProgress: totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0,
      readinessScore:       computeReadinessScore({
        totalDocs: totalRequired, completedDocs: totalUploaded,
        totalTasks: globalStats.total, completedTasks: globalStats.completed, overdueTasks: globalStats.overdue,
      }),
      totalRequired, totalUploaded,
      totalTasks:     globalStats.total,
      completedTasks: globalStats.completed,
      overdueTasks:   globalStats.overdue,
    };
  },
};

module.exports = DashboardService;