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

  async partnerDashboard(userId) {
    const today    = todayIso();
    const now      = nowIso();
    const in40Days = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    const db       = require('../db');

    const [
      statsRow, appts, clientTasks, allReqDocs,
      ytdRow, arRow, pendingInvoices, monthlyRows,
      matters, topClients, recentMessages,
    ] = await Promise.all([
      db.one(
        `SELECT
           SUM(CASE WHEN status != 'complete' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN stage   = 'court_review' THEN 1 ELSE 0 END) AS ready_review,
           SUM(CASE WHEN important_date IS NOT NULL AND important_date >= ? AND important_date <= ? THEN 1 ELSE 0 END) AS deadlines
         FROM matters`,
        [today, in40Days]
      ),
      AppointmentRepo.findForAttorneyDashboard(now, 5),
      TaskRepo.findAllActiveForPartner(20),
      db.all("SELECT category, status FROM documents WHERE required = 1"),
      InvoiceRepo.ytdRevenue(),
      db.one("SELECT COALESCE(SUM(amount), 0) AS ar FROM invoices WHERE status = 'pending'"),
      db.all("SELECT amount, due_date FROM invoices WHERE status = 'pending'"),
      InvoiceRepo.monthlyRevenue(getDb().type),
      db.all(
        `SELECT m.id, m.case_number, m.stage, m.status, m.description, m.matter_type,
                m.important_date,
                c.first_name || ' ' || c.last_name AS client_name,
                c.avatar_initials AS client_initials,
                a.first_name || ' ' || a.last_name AS attorney_name,
                COALESCE(SUM(i.amount), 0) AS billed_cents,
                COALESCE(SUM(CASE WHEN i.status = 'paid'    THEN i.amount ELSE 0 END), 0) AS collected_cents,
                COALESCE(SUM(CASE WHEN i.status = 'pending' THEN i.amount ELSE 0 END), 0) AS ar_cents
         FROM matters m
         LEFT JOIN users c    ON m.client_id   = c.id
         LEFT JOIN users a    ON m.attorney_id = a.id
         LEFT JOIN invoices i ON i.matter_id   = m.id
         WHERE m.status != 'complete'
         GROUP BY m.id
         ORDER BY m.updated_at DESC
         LIMIT 8`
      ),
      db.all(
        `SELECT u.id,
                u.first_name || ' ' || u.last_name AS name,
                u.avatar_initials AS initials,
                COALESCE(SUM(i.amount), 0) AS billed_cents,
                COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) AS collected_cents,
                COUNT(DISTINCT m.id) AS matter_count
         FROM users u
         JOIN matters m   ON m.client_id  = u.id
         LEFT JOIN invoices i ON i.client_id = u.id
         WHERE u.role = 'client'
         GROUP BY u.id
         ORDER BY billed_cents DESC
         LIMIT 5`
      ),
      userId ? MessageRepo.findRecentForUser(userId, 5).catch(() => []) : Promise.resolve([]),
    ]);

    const [globalStats, missingDocsR] = await Promise.all([
      TaskRepo.globalStats(today),
      db.one("SELECT COUNT(*) c FROM documents WHERE status = 'pending' AND required = 1"),
    ]);

    const totalRequired = allReqDocs.length;
    const totalUploaded = allReqDocs.filter(d => d.status === 'uploaded').length;

    // Financial computations
    const ytdRevenue         = Math.round(Number(ytdRow.ytd) / 100);    // cents -> dollars
    const outstandingAR      = Math.round(Number(arRow.ar)  / 100);
    const todayDate          = new Date();
    const currentMonthNum    = todayDate.getMonth() + 1;

    // Monthly chart data (12 months)
    const monthMap = {};
    for (const r of monthlyRows) monthMap[parseInt(r.month_num, 10)] = Number(r.revenue);
    const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyRevenueData = MONTH_LABELS.map((month, i) => ({
      month,
      revenue:   Math.round((monthMap[i + 1] || 0) / 100),
      collected: Math.round((monthMap[i + 1] || 0) * 0.87 / 100), // ~87% collection rate
    }));
    const thisMonthCollected = Math.round((monthMap[currentMonthNum] || 0) / 100);

    // A/R aging buckets (computed in JS for DB agnosticism)
    const arAging = { current: 0, days30: 0, days60: 0, days90Plus: 0 };
    for (const inv of pendingInvoices) {
      const amt = Number(inv.amount);
      if (!inv.due_date) { arAging.current += amt; continue; }
      const daysOverdue = Math.floor((todayDate - new Date(inv.due_date)) / 86400000);
      if      (daysOverdue <= 0)  arAging.current   += amt;
      else if (daysOverdue <= 30) arAging.days30     += amt;
      else if (daysOverdue <= 60) arAging.days60     += amt;
      else                        arAging.days90Plus += amt;
    }
    const arAgingDollars = {
      current:   Math.round(arAging.current   / 100),
      days30:    Math.round(arAging.days30    / 100),
      days60:    Math.round(arAging.days60    / 100),
      days90Plus:Math.round(arAging.days90Plus/ 100),
    };

    // Practice groups by matter_type
    const practiceGroupMap = {};
    for (const m of matters) {
      const key = m.matter_type || 'general';
      if (!practiceGroupMap[key]) practiceGroupMap[key] = { type: key, revenue: 0, billed: 0, count: 0 };
      practiceGroupMap[key].revenue += Number(m.collected_cents);
      practiceGroupMap[key].billed  += Number(m.billed_cents);
      practiceGroupMap[key].count   += 1;
    }
    const practiceGroups = Object.values(practiceGroupMap)
      .map(g => ({
        type:    g.type,
        revenue: Math.round(g.revenue / 100),
        margin:  g.billed > 0 ? Math.round((g.revenue / g.billed) * 30) : 28, // rough margin
        count:   g.count,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4);

    // Top clients for revenue table
    const topClientsList = topClients.map(c => ({
      id:        c.id,
      name:      c.name,
      initials:  c.initials || (c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      billed:    Math.round(Number(c.billed_cents) / 100),
      collected: Math.round(Number(c.collected_cents) / 100),
      pct:       Number(c.billed_cents) > 0
                   ? Math.round((Number(c.collected_cents) / Number(c.billed_cents)) * 100)
                   : 0,
    }));

    // Financial health score (0–100)
    const totalBilledCents    = matters.reduce((s, m) => s + Number(m.billed_cents), 0);
    const totalCollectedCents = matters.reduce((s, m) => s + Number(m.collected_cents), 0);
    const collectionEff  = totalBilledCents > 0 ? Math.round((totalCollectedCents / totalBilledCents) * 100) : 87;
    const matterMarginPct= totalBilledCents > 0 ? Math.round((totalCollectedCents / totalBilledCents) * 30) : 28;
    const docReadinessPct= totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 100;
    const deadlineCompPct= globalStats.total > 0 ? Math.max(0, Math.round((1 - globalStats.overdue / globalStats.total) * 100)) : 100;
    const financialScore = Math.round(collectionEff * 0.35 + docReadinessPct * 0.2 + deadlineCompPct * 0.3 + Math.min(100, matterMarginPct * 3) * 0.15);

    return {
      // Operational
      activeMatters:        Number(statsRow.active),
      missingDocs:          Number(missingDocsR.c),
      readyForReview:       Number(statsRow.ready_review),
      annualDeadlines:      Number(statsRow.deadlines),
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
      lifecycleStageIdx: 1,
      // Financial
      ytdRevenue,
      thisMonthCollected,
      outstandingAR,
      matterProfitability: matterMarginPct,
      collectionEfficiency: collectionEff,
      financialScore:       Math.min(100, Math.max(0, financialScore)),
      monthlyRevenueData,
      arAging:              arAgingDollars,
      practiceGroups,
      topClients:           topClientsList,
      recentMessages:       recentMessages || [],
      matters: matters.map(m => ({
        ...m,
        billed:    Math.round(Number(m.billed_cents)    / 100),
        collected: Math.round(Number(m.collected_cents) / 100),
        ar:        Math.round(Number(m.ar_cents)        / 100),
        wip:       Math.round((Number(m.billed_cents) - Number(m.collected_cents)) / 100),
        profitability_pct: Number(m.billed_cents) > 0
          ? Math.round((Number(m.collected_cents) / Number(m.billed_cents)) * 30)
          : 0,
        readiness_pct: { intake:10, hearing_prep:25, initial_inventory:40, monthly_records:55, annual_return_prep:70, court_review:85, complete:100 }[m.stage] || 20,
      })),
    };
  },
};

module.exports = DashboardService;