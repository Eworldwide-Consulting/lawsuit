const router   = require('express').Router();
const supabase = require('../supabase');
const { requireAuth } = require('../middleware/auth');

const today  = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const daysLeft = date => Math.round((new Date(date) - new Date()) / 86400000);

// ─── Client Dashboard ─────────────────────────────────────────────────────────
router.get('/client', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;

    // All matter IDs for this client (used by sub-queries)
    const { data: clientMatters } = await supabase
      .from('matters').select('id').eq('client_id', uid);
    const matterIds = (clientMatters || []).map(m => m.id);

    // Latest matter with attorney info
    const { data: matterRaw } = await supabase
      .from('matters')
      .select('*, attorney:attorney_id(first_name, last_name, email)')
      .eq('client_id', uid)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const matter = matterRaw ? {
      ...matterRaw,
      attorney_name:  matterRaw.attorney ? `${matterRaw.attorney.first_name} ${matterRaw.attorney.last_name}` : null,
      attorney_email: matterRaw.attorney?.email,
      attorney: undefined,
    } : null;

    if (!matterIds.length) {
      return res.json({
        matter, openTasks: 0, overdueTasks: 0, tasks: [], upcomingAppts: [],
        requiredDocsPending: 0, uploadedDocs: [], messages: [], deadlines: [],
        readinessScore: 100, totalDocs: 0, completedDocs: 0, totalTasks: 0, completedTasks: 0,
      });
    }

    // Run all count/list queries in parallel
    const [
      { count: openTasks },
      { count: overdueTasks },
      { count: totalTasks },
      { count: completedTasks },
      { data: tasks },
      { data: upcomingAppts },
      { data: allDocs },
      { data: rawMessages },
      { data: taskDeadlines },
    ] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .in('matter_id', matterIds).neq('status', 'completed'),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .in('matter_id', matterIds).neq('status', 'completed').lt('due_date', today()),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .in('matter_id', matterIds),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .in('matter_id', matterIds).eq('status', 'completed'),
      supabase.from('tasks').select('*')
        .in('matter_id', matterIds).neq('status', 'completed')
        .order('due_date', { ascending: true }).limit(6),
      supabase.from('appointments').select('*')
        .in('matter_id', matterIds).gte('start_time', nowISO())
        .order('start_time', { ascending: true }).limit(3),
      supabase.from('documents').select('category, status, required')
        .in('matter_id', matterIds),
      supabase.from('messages')
        .select('*, sender:from_user_id(first_name, last_name, avatar_initials)')
        .eq('to_user_id', uid).order('created_at', { ascending: false }).limit(5),
      supabase.from('tasks').select('title, description, due_date')
        .in('matter_id', matterIds).neq('status', 'completed')
        .gt('due_date', today()).order('due_date', { ascending: true }).limit(4),
    ]);

    // Doc stats
    const requiredDocs  = (allDocs || []).filter(d => d.required);
    const totalDocs     = requiredDocs.length;
    const completedDocs = requiredDocs.filter(d => d.status === 'uploaded').length;
    const requiredDocsPending = totalDocs - completedDocs;

    const catMap = {};
    for (const d of (allDocs || [])) {
      const key = d.category || 'Uncategorized';
      if (!catMap[key]) catMap[key] = { category: key, uploaded: 0, total: 0 };
      catMap[key].total++;
      if (d.status === 'uploaded') catMap[key].uploaded++;
    }
    const uploadedDocs = Object.values(catMap).sort((a, b) => (a.category || '').localeCompare(b.category || ''));

    // Messages
    const messages = (rawMessages || []).map(m => ({
      ...m,
      from_name:     `${m.sender?.first_name || ''} ${m.sender?.last_name || ''}`.trim(),
      from_initials: m.sender?.avatar_initials,
      sender: undefined,
    }));

    // Deadlines
    const deadlines = [];
    if (matter?.important_date) {
      const dl = daysLeft(matter.important_date);
      if (dl >= 0) {
        deadlines.push({
          title: `Court Hearing – ${matter.description}`,
          description: `${matter.court} · ${matter.county}`,
          date: matter.important_date,
          days_left: dl,
          urgent: dl <= 14,
        });
      }
    }
    for (const t of (taskDeadlines || [])) {
      const dl = daysLeft(t.due_date);
      deadlines.push({ ...t, date: t.due_date, days_left: dl, urgent: dl <= 7 });
    }
    deadlines.sort((a, b) => a.days_left - b.days_left);

    // Readiness score
    const docScore     = totalDocs   > 0 ? (completedDocs / totalDocs) * 60   : 60;
    const taskScore    = totalTasks  > 0 ? ((completedTasks || 0) / totalTasks) * 30 : 30;
    const overdueScore = totalTasks  > 0 ? Math.max(0, (1 - (overdueTasks || 0) / totalTasks)) * 10 : 10;
    const readinessScore = Math.round(docScore + taskScore + overdueScore);

    res.json({
      matter, openTasks, overdueTasks, tasks, upcomingAppts,
      requiredDocsPending, uploadedDocs, messages, deadlines,
      readinessScore, totalDocs, completedDocs, totalTasks, completedTasks,
    });
  } catch (err) {
    console.error('Client dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Attorney Dashboard ───────────────────────────────────────────────────────
router.get('/attorney', requireAuth, async (req, res) => {
  try {
    const [
      { count: totalMatters },
      { count: activeMatters },
      { count: atRiskMatters },
      { data: mattersRaw },
      { data: upcomingAppts },
      { count: missingDocs },
      { count: overdueTasks },
      { data: rawMessages },
    ] = await Promise.all([
      supabase.from('matters').select('*', { count: 'exact', head: true }),
      supabase.from('matters').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('matters').select('*', { count: 'exact', head: true }).eq('status', 'at_risk'),
      supabase.from('matters')
        .select('*, client:client_id(first_name, last_name, avatar_initials), attorney:attorney_id(first_name, last_name)')
        .order('updated_at', { ascending: false }).limit(10),
      supabase.from('appointments')
        .select('*, matter:matter_id(description, case_number)')
        .gte('start_time', nowISO()).order('start_time', { ascending: true }).limit(5),
      supabase.from('documents').select('*', { count: 'exact', head: true })
        .eq('status', 'pending').eq('required', true),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .neq('status', 'completed').lt('due_date', today()),
      supabase.from('messages')
        .select('*, sender:from_user_id(first_name, last_name, avatar_initials)')
        .eq('to_user_id', req.user.id).order('created_at', { ascending: false }).limit(5),
    ]);

    const matters = (mattersRaw || []).map(m => ({
      ...m,
      client_name:    m.client   ? `${m.client.first_name} ${m.client.last_name}`   : null,
      client_initials: m.client?.avatar_initials,
      attorney_name:  m.attorney ? `${m.attorney.first_name} ${m.attorney.last_name}` : null,
      client: undefined, attorney: undefined,
    }));

    const appts = (upcomingAppts || []).map(a => ({
      ...a,
      matter_description: a.matter?.description,
      case_number:        a.matter?.case_number,
      matter: undefined,
    }));

    const recentMessages = (rawMessages || []).map(m => ({
      ...m,
      from_name:     `${m.sender?.first_name || ''} ${m.sender?.last_name || ''}`.trim(),
      from_initials: m.sender?.avatar_initials,
      sender: undefined,
    }));

    // Revenue simulation
    const basePerMatter = 12000;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const currentMonth = new Date().getMonth();
    const revenueData = months.map((month, i) => {
      if (i > currentMonth) return { month, revenue: 0, collected: 0 };
      const revenue   = Math.round(((totalMatters || 0) * basePerMatter + i * 1800) / 1000);
      const collected = Math.round(revenue * (0.78 + (i % 4) * 0.03));
      return { month, revenue, collected };
    });
    const ytdRevenue     = revenueData.reduce((s, d) => s + d.revenue * 1000, 0);
    const collectedMonth = revenueData[currentMonth].collected * 1000;
    const outstandingAR  = Math.round(ytdRevenue * 0.17);
    const profitability  = Math.max(20, 35 - (atRiskMatters || 0) * 3);
    const partnerDraws   = Math.round(ytdRevenue * 0.05);
    const healthScore    = Math.min(95, Math.max(40, 80 - (atRiskMatters || 0) * 5 - Math.min(15, missingDocs || 0)));

    res.json({
      totalMatters, activeMatters, atRiskMatters,
      matters, upcomingAppts: appts, missingDocs, overdueTasks, recentMessages,
      ytdRevenue, collectedMonth, outstandingAR, profitability, partnerDraws,
      revenueData, healthScore,
    });
  } catch (err) {
    console.error('Attorney dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Partner Dashboard ────────────────────────────────────────────────────────
router.get('/partner', requireAuth, async (req, res) => {
  try {
    const nowDate = today();
    const future40 = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);

    const [
      { count: activeMatters },
      { count: missingDocs },
      { count: readyForReview },
      { count: annualDeadlines },
      { data: mattersRaw },
      { data: apptRaw },
      { data: clientTasksRaw },
      { data: allRequiredDocs },
      { count: totalTasks },
      { count: completedTasks },
      { count: overdueTasks },
    ] = await Promise.all([
      supabase.from('matters').select('*', { count: 'exact', head: true }).neq('status', 'complete'),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('required', true),
      supabase.from('matters').select('*', { count: 'exact', head: true }).eq('stage', 'court_review'),
      supabase.from('matters').select('*', { count: 'exact', head: true })
        .not('important_date', 'is', null)
        .gte('important_date', nowDate).lte('important_date', future40),
      supabase.from('matters')
        .select(`*, client:client_id(first_name, last_name, avatar_initials), attorney:attorney_id(first_name, last_name), documents(id, required, status)`)
        .order('updated_at', { ascending: false }).limit(10),
      supabase.from('appointments')
        .select('*, matter:matter_id(description, case_number)')
        .gte('start_time', nowISO()).order('start_time', { ascending: true }).limit(6),
      supabase.from('tasks')
        .select('*, matter:matter_id(description), client:assigned_to(first_name, last_name)')
        .neq('status', 'completed').order('due_date', { ascending: true }).limit(20),
      supabase.from('documents').select('category, status').eq('required', true),
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'completed').lt('due_date', nowDate),
    ]);

    // Build matters with per-row readiness
    const matters = (mattersRaw || []).map(m => {
      const docs    = m.documents || [];
      const reqDocs = docs.filter(d => d.required);
      const missing = reqDocs.filter(d => d.status === 'pending').length;
      const uploaded = reqDocs.filter(d => d.status === 'uploaded').length;
      const total    = reqDocs.length;
      return {
        ...m,
        client_name:      m.client   ? `${m.client.first_name} ${m.client.last_name}`   : null,
        client_initials:  m.client?.avatar_initials,
        attorney_name:    m.attorney ? `${m.attorney.first_name} ${m.attorney.last_name}` : null,
        missing_docs_count:  missing,
        uploaded_docs_count: uploaded,
        total_docs_count:    total,
        readiness_pct: total > 0 ? Math.round((uploaded / total) * 100) : 100,
        documents: undefined, client: undefined, attorney: undefined,
      };
    });

    const upcomingAppts = (apptRaw || []).map(a => ({
      ...a,
      matter_description: a.matter?.description,
      case_number:        a.matter?.case_number,
      matter: undefined,
    }));

    const clientTasks = (clientTasksRaw || []).map(t => ({
      ...t,
      client_name:       t.client ? `${t.client.first_name} ${t.client.last_name}` : null,
      matter_description: t.matter?.description,
      days_left:         t.due_date ? daysLeft(t.due_date) : null,
      client: undefined, matter: undefined,
    }));

    // Doc compliance per category
    const catMap = {};
    for (const d of (allRequiredDocs || [])) {
      const key = d.category || 'Uncategorized';
      if (!catMap[key]) catMap[key] = { category: key, uploaded: 0, total: 0 };
      catMap[key].total++;
      if (d.status === 'uploaded') catMap[key].uploaded++;
    }
    const docStats = Object.values(catMap).sort((a, b) => (a.category || '').localeCompare(b.category || ''));

    const totalRequired  = (allRequiredDocs || []).length;
    const totalUploaded  = (allRequiredDocs || []).filter(d => d.status === 'uploaded').length;

    const docScore     = totalRequired > 0 ? (totalUploaded / totalRequired) * 60 : 60;
    const taskScore    = (totalTasks || 0) > 0 ? ((completedTasks || 0) / totalTasks) * 30 : 30;
    const overdueScore = (totalTasks || 0) > 0 ? Math.max(0, (1 - (overdueTasks || 0) / totalTasks)) * 10 : 10;
    const readinessScore       = Math.round(docScore + taskScore + overdueScore);
    const annualReturnProgress = totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0;

    // Lifecycle stage from most-common active stage
    const LIFECYCLE_KEYS = ['intake','hearing_prep','initial_inventory','monthly_records','annual_return_prep','court_review','complete'];
    const stageCounts = {};
    for (const m of (mattersRaw || []).filter(m => m.status !== 'complete')) {
      stageCounts[m.stage] = (stageCounts[m.stage] || 0) + 1;
    }
    const topStage = Object.entries(stageCounts).sort(([,a],[,b]) => b - a)[0]?.[0];
    const lifecycleStageIdx = topStage ? Math.max(0, LIFECYCLE_KEYS.indexOf(topStage)) : 0;

    res.json({
      activeMatters, missingDocs, readyForReview, annualDeadlines,
      matters, upcomingAppts, clientTasks, docStats,
      annualReturnProgress, readinessScore, lifecycleStageIdx,
      totalRequired, totalUploaded, totalTasks, completedTasks, overdueTasks,
    });
  } catch (err) {
    console.error('Partner dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
