const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/client', requireAuth, (req, res) => {
  const db = getDb();
  const matter = db.prepare(`
    SELECT m.*, a.first_name || ' ' || a.last_name as attorney_name, a.email as attorney_email
    FROM matters m LEFT JOIN users a ON m.attorney_id = a.id
    WHERE m.client_id = ? ORDER BY m.updated_at DESC LIMIT 1
  `).get(req.user.id);

  const openTasks = db.prepare(`
    SELECT COUNT(*) as c FROM tasks t JOIN matters m ON t.matter_id = m.id
    WHERE m.client_id = ? AND t.status != 'completed'
  `).get(req.user.id).c;

  const overdueTasks = db.prepare(`
    SELECT COUNT(*) as c FROM tasks t JOIN matters m ON t.matter_id = m.id
    WHERE m.client_id = ? AND t.status = 'pending' AND t.due_date < date('now')
  `).get(req.user.id).c;

  const tasks = db.prepare(`
    SELECT t.* FROM tasks t JOIN matters m ON t.matter_id = m.id
    WHERE m.client_id = ? AND t.status != 'completed'
    ORDER BY t.due_date ASC LIMIT 6
  `).all(req.user.id);

  const upcomingAppts = db.prepare(`
    SELECT a.* FROM appointments a JOIN matters m ON a.matter_id = m.id
    WHERE m.client_id = ? AND a.start_time >= datetime('now')
    ORDER BY a.start_time ASC LIMIT 3
  `).all(req.user.id);

  const reqDocs = db.prepare(`
    SELECT COUNT(*) as c FROM documents d JOIN matters m ON d.matter_id = m.id
    WHERE m.client_id = ? AND d.required = 1 AND d.status = 'pending'
  `).get(req.user.id).c;

  const uploadedDocs = db.prepare(`
    SELECT d.category, COUNT(*) as uploaded,
      (SELECT COUNT(*) FROM documents d2 WHERE d2.matter_id = d.matter_id AND d2.category = d.category) as total
    FROM documents d JOIN matters m ON d.matter_id = m.id
    WHERE m.client_id = ? AND d.status = 'uploaded'
    GROUP BY d.category
  `).all(req.user.id);

  const messages = db.prepare(`
    SELECT msg.*, u.first_name || ' ' || u.last_name as from_name, u.avatar_initials as from_initials
    FROM messages msg JOIN users u ON msg.from_user_id = u.id
    WHERE msg.to_user_id = ? ORDER BY msg.created_at DESC LIMIT 5
  `).all(req.user.id);

  res.json({ matter, openTasks, overdueTasks, tasks, upcomingAppts, requiredDocsPending: reqDocs, uploadedDocs, messages });
});

router.get('/attorney', requireAuth, (req, res) => {
  const db = getDb();
  const totalMatters = db.prepare('SELECT COUNT(*) as c FROM matters').get().c;
  const activeMatters = db.prepare("SELECT COUNT(*) as c FROM matters WHERE status = 'active'").get().c;
  const atRiskMatters = db.prepare("SELECT COUNT(*) as c FROM matters WHERE status = 'at_risk'").get().c;

  const matters = db.prepare(`
    SELECT m.*, c.first_name || ' ' || c.last_name as client_name, c.avatar_initials as client_initials,
      a.first_name || ' ' || a.last_name as attorney_name
    FROM matters m
    LEFT JOIN users c ON m.client_id = c.id
    LEFT JOIN users a ON m.attorney_id = a.id
    ORDER BY m.updated_at DESC LIMIT 10
  `).all();

  const upcomingAppts = db.prepare(`
    SELECT * FROM appointments WHERE start_time >= datetime('now')
    ORDER BY start_time ASC LIMIT 5
  `).all();

  const missingDocs = db.prepare("SELECT COUNT(*) as c FROM documents WHERE status = 'pending' AND required = 1").get().c;
  const recentMessages = db.prepare(`
    SELECT msg.*, u.first_name || ' ' || u.last_name as from_name, u.avatar_initials as from_initials
    FROM messages msg JOIN users u ON msg.from_user_id = u.id
    WHERE msg.to_user_id = ? ORDER BY msg.created_at DESC LIMIT 5
  `).all(req.user.id);

  res.json({ totalMatters, activeMatters, atRiskMatters, matters, upcomingAppts, missingDocs, recentMessages,
    ytdRevenue: 1840000, collectedMonth: 246000, outstandingAR: 318000, profitability: 31, partnerDraws: 92000 });
});

router.get('/partner', requireAuth, (req, res) => {
  const db = getDb();
  const activeMatters = db.prepare('SELECT COUNT(*) as c FROM matters').get().c;
  const missingDocs = db.prepare("SELECT COUNT(*) as c FROM documents WHERE status = 'pending' AND required = 1").get().c;
  const readyForReview = db.prepare("SELECT COUNT(*) as c FROM matters WHERE stage = 'court_review'").get().c;

  const matters = db.prepare(`
    SELECT m.*, c.first_name || ' ' || c.last_name as client_name, c.avatar_initials as client_initials,
      a.first_name || ' ' || a.last_name as attorney_name
    FROM matters m
    LEFT JOIN users c ON m.client_id = c.id
    LEFT JOIN users a ON m.attorney_id = a.id
    ORDER BY m.updated_at DESC LIMIT 10
  `).all();

  res.json({ activeMatters, missingDocs, readyForReview, annualDeadlines: 18, matters,
    annualReturnProgress: 72, readinessScore: 78 });
});

module.exports = router;
