const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const today  = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const daysLeft = d => Math.round((new Date(d) - new Date()) / 86400000);

// ── Client Dashboard ──────────────────────────────────────────────────────────
router.get('/client', requireAuth, (req, res) => {
  try {
    const db  = getDb();
    const uid = req.user.id;

    const matter = db.prepare(`
      SELECT m.*, u.first_name||' '||u.last_name AS attorney_name, u.email AS attorney_email
      FROM matters m LEFT JOIN users u ON m.attorney_id=u.id
      WHERE m.client_id=? ORDER BY m.updated_at DESC LIMIT 1
    `).get(uid) || null;

    const ids = db.prepare('SELECT id FROM matters WHERE client_id=?').all(uid).map(r => r.id);
    if (!ids.length) {
      return res.json({
        matter, openTasks:0, overdueTasks:0, tasks:[], upcomingAppts:[],
        requiredDocsPending:0, uploadedDocs:[], messages:[], deadlines:[],
        readinessScore:100, totalDocs:0, completedDocs:0, totalTasks:0, completedTasks:0,
      });
    }

    const inList = ids.map(() => '?').join(',');
    const t = today(), n = nowISO();

    const openTasks      = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${inList}) AND status!='completed'`).get(...ids).c;
    const overdueTasks   = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${inList}) AND status!='completed' AND due_date<?`).get(...ids, t).c;
    const totalTasks     = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${inList})`).get(...ids).c;
    const completedTasks = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE matter_id IN (${inList}) AND status='completed'`).get(...ids).c;
    const tasks          = db.prepare(`SELECT * FROM tasks WHERE matter_id IN (${inList}) AND status!='completed' ORDER BY due_date ASC LIMIT 6`).all(...ids);
    const upcomingAppts  = db.prepare(`SELECT * FROM appointments WHERE matter_id IN (${inList}) AND start_time>=? ORDER BY start_time ASC LIMIT 3`).all(...ids, n);
    const allDocs        = db.prepare(`SELECT category,status,required FROM documents WHERE matter_id IN (${inList})`).all(...ids);
    const rawMessages    = db.prepare(`SELECT m.*,u.first_name||' '||u.last_name AS from_name,u.avatar_initials AS from_initials FROM messages m LEFT JOIN users u ON m.from_user_id=u.id WHERE m.to_user_id=? ORDER BY m.created_at DESC LIMIT 5`).all(uid);
    const taskDeadlines  = db.prepare(`SELECT title,description,due_date FROM tasks WHERE matter_id IN (${inList}) AND status!='completed' AND due_date>? ORDER BY due_date ASC LIMIT 4`).all(...ids, t);

    const requiredDocs       = allDocs.filter(d => d.required);
    const totalDocs          = requiredDocs.length;
    const completedDocs      = requiredDocs.filter(d => d.status === 'uploaded').length;
    const requiredDocsPending = totalDocs - completedDocs;

    const catMap = {};
    for (const d of allDocs) {
      const k = d.category || 'Uncategorized';
      if (!catMap[k]) catMap[k] = { category: k, uploaded: 0, total: 0 };
      catMap[k].total++;
      if (d.status === 'uploaded') catMap[k].uploaded++;
    }
    const uploadedDocs = Object.values(catMap).sort((a, b) => a.category.localeCompare(b.category));

    const deadlines = [];
    if (matter?.important_date) {
      const dl = daysLeft(matter.important_date);
      if (dl >= 0) deadlines.push({ title: `Court Hearing – ${matter.description}`, description: `${matter.court} · ${matter.county}`, date: matter.important_date, days_left: dl, urgent: dl <= 14 });
    }
    for (const td of taskDeadlines) {
      const dl = daysLeft(td.due_date);
      deadlines.push({ ...td, date: td.due_date, days_left: dl, urgent: dl <= 7 });
    }
    deadlines.sort((a, b) => a.days_left - b.days_left);

    const docScore     = totalDocs  > 0 ? (completedDocs / totalDocs) * 60 : 60;
    const taskScore    = totalTasks > 0 ? (completedTasks / totalTasks) * 30 : 30;
    const overdueScore = totalTasks > 0 ? Math.max(0, (1 - overdueTasks / totalTasks)) * 10 : 10;
    const readinessScore = Math.round(docScore + taskScore + overdueScore);

    res.json({ matter, openTasks, overdueTasks, tasks, upcomingAppts, requiredDocsPending, uploadedDocs, messages: rawMessages, deadlines, readinessScore, totalDocs, completedDocs, totalTasks, completedTasks });
  } catch (err) { console.error('Client dashboard error:', err.message); res.status(500).json({ error: err.message }); }
});

// ── Attorney Dashboard ────────────────────────────────────────────────────────
router.get('/attorney', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const n  = nowISO(), t = today();

    const totalMatters  = db.prepare("SELECT COUNT(*) c FROM matters").get().c;
    const activeMatters = db.prepare("SELECT COUNT(*) c FROM matters WHERE status='active'").get().c;
    const atRiskMatters = db.prepare("SELECT COUNT(*) c FROM matters WHERE status='at_risk'").get().c;
    const missingDocs   = db.prepare("SELECT COUNT(*) c FROM documents WHERE status='pending' AND required=1").get().c;
    const overdueTasks  = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE status!='completed' AND due_date<?`).get(t).c;

    const matters = db.prepare(`
      SELECT m.*, c.first_name||' '||c.last_name AS client_name, c.avatar_initials AS client_initials,
             a.first_name||' '||a.last_name AS attorney_name
      FROM matters m LEFT JOIN users c ON m.client_id=c.id LEFT JOIN users a ON m.attorney_id=a.id
      ORDER BY m.updated_at DESC LIMIT 10
    `).all();

    const upcomingAppts = db.prepare(`
      SELECT a.*, m.description AS matter_description, m.case_number
      FROM appointments a LEFT JOIN matters m ON a.matter_id=m.id
      WHERE a.start_time>=? ORDER BY a.start_time ASC LIMIT 5
    `).all(n);

    const recentMessages = db.prepare(`
      SELECT m.*, u.first_name||' '||u.last_name AS from_name, u.avatar_initials AS from_initials
      FROM messages m LEFT JOIN users u ON m.from_user_id=u.id
      WHERE m.to_user_id=? ORDER BY m.created_at DESC LIMIT 5
    `).all(req.user.id);

    const base = 12000, months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const cur  = new Date().getMonth();
    const revenueData = months.map((month, i) => {
      if (i > cur) return { month, revenue: 0, collected: 0 };
      const revenue   = Math.round((totalMatters * base + i * 1800) / 1000);
      const collected = Math.round(revenue * (0.78 + (i % 4) * 0.03));
      return { month, revenue, collected };
    });
    const ytdRevenue     = revenueData.reduce((s, d) => s + d.revenue * 1000, 0);
    const collectedMonth = revenueData[cur].collected * 1000;
    const outstandingAR  = Math.round(ytdRevenue * 0.17);
    const profitability  = Math.max(20, 35 - atRiskMatters * 3);
    const partnerDraws   = Math.round(ytdRevenue * 0.05);
    const healthScore    = Math.min(95, Math.max(40, 80 - atRiskMatters * 5 - Math.min(15, missingDocs)));

    res.json({ totalMatters, activeMatters, atRiskMatters, matters, upcomingAppts, missingDocs, overdueTasks, recentMessages, ytdRevenue, collectedMonth, outstandingAR, profitability, partnerDraws, revenueData, healthScore });
  } catch (err) { console.error('Attorney dashboard error:', err.message); res.status(500).json({ error: err.message }); }
});

// ── Partner Dashboard ─────────────────────────────────────────────────────────
router.get('/partner', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const t  = today(), n = nowISO();
    const future40 = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);

    const activeMatters  = db.prepare("SELECT COUNT(*) c FROM matters WHERE status!='complete'").get().c;
    const missingDocs    = db.prepare("SELECT COUNT(*) c FROM documents WHERE status='pending' AND required=1").get().c;
    const readyForReview = db.prepare("SELECT COUNT(*) c FROM matters WHERE stage='court_review'").get().c;
    const annualDeadlines= db.prepare('SELECT COUNT(*) c FROM matters WHERE important_date IS NOT NULL AND important_date>=? AND important_date<=?').get(t, future40).c;
    const totalTasks     = db.prepare('SELECT COUNT(*) c FROM tasks').get().c;
    const completedTasks = db.prepare("SELECT COUNT(*) c FROM tasks WHERE status='completed'").get().c;
    const overdueTasks   = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE status!='completed' AND due_date<?`).get(t).c;

    const matters = db.prepare(`
      SELECT m.*, c.first_name||' '||c.last_name AS client_name, c.avatar_initials AS client_initials,
             a.first_name||' '||a.last_name AS attorney_name
      FROM matters m LEFT JOIN users c ON m.client_id=c.id LEFT JOIN users a ON m.attorney_id=a.id
      ORDER BY m.updated_at DESC LIMIT 10
    `).all().map(m => {
      const docs    = db.prepare('SELECT required,status FROM documents WHERE matter_id=?').all(m.id);
      const req_    = docs.filter(d => d.required);
      const missing = req_.filter(d => d.status === 'pending').length;
      const uploaded= req_.filter(d => d.status === 'uploaded').length;
      const total   = req_.length;
      return { ...m, missing_docs_count: missing, uploaded_docs_count: uploaded, total_docs_count: total, readiness_pct: total > 0 ? Math.round((uploaded / total) * 100) : 100 };
    });

    const upcomingAppts = db.prepare(`
      SELECT a.*, m.description AS matter_description, m.case_number
      FROM appointments a LEFT JOIN matters m ON a.matter_id=m.id
      WHERE a.start_time>=? ORDER BY a.start_time ASC LIMIT 6
    `).all(n);

    const clientTasks = db.prepare(`
      SELECT tk.*, m.description AS matter_description, u.first_name||' '||u.last_name AS client_name
      FROM tasks tk LEFT JOIN matters m ON tk.matter_id=m.id LEFT JOIN users u ON tk.assigned_to=u.id
      WHERE tk.status!='completed' ORDER BY tk.due_date ASC LIMIT 20
    `).all().map(tk => ({ ...tk, days_left: tk.due_date ? daysLeft(tk.due_date) : null }));

    const allRequired = db.prepare("SELECT category,status FROM documents WHERE required=1").all();
    const catMap = {};
    for (const d of allRequired) {
      const k = d.category || 'Uncategorized';
      if (!catMap[k]) catMap[k] = { category: k, uploaded: 0, total: 0 };
      catMap[k].total++;
      if (d.status === 'uploaded') catMap[k].uploaded++;
    }
    const docStats       = Object.values(catMap).sort((a, b) => a.category.localeCompare(b.category));
    const totalRequired  = allRequired.length;
    const totalUploaded  = allRequired.filter(d => d.status === 'uploaded').length;
    const docScore       = totalRequired > 0 ? (totalUploaded / totalRequired) * 60 : 60;
    const taskScore      = totalTasks > 0 ? (completedTasks / totalTasks) * 30 : 30;
    const overdueScore   = totalTasks > 0 ? Math.max(0, (1 - overdueTasks / totalTasks)) * 10 : 10;
    const readinessScore = Math.round(docScore + taskScore + overdueScore);
    const annualReturnProgress = totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0;

    const LIFECYCLE = ['intake','hearing_prep','initial_inventory','monthly_records','annual_return_prep','court_review','complete'];
    const stageCounts = {};
    for (const m of matters.filter(m => m.status !== 'complete')) stageCounts[m.stage] = (stageCounts[m.stage] || 0) + 1;
    const topStage = Object.entries(stageCounts).sort(([,a],[,b]) => b-a)[0]?.[0];
    const lifecycleStageIdx = topStage ? Math.max(0, LIFECYCLE.indexOf(topStage)) : 0;

    res.json({ activeMatters, missingDocs, readyForReview, annualDeadlines, matters, upcomingAppts, clientTasks, docStats, annualReturnProgress, readinessScore, lifecycleStageIdx, totalRequired, totalUploaded, totalTasks, completedTasks, overdueTasks });
  } catch (err) { console.error('Partner dashboard error:', err.message); res.status(500).json({ error: err.message }); }
});

module.exports = router;
