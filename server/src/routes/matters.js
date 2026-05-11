const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

const STAGES = ['intake', 'hearing_prep', 'initial_inventory', 'monthly_records', 'annual_return_prep', 'court_review', 'complete'];

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  let matters;
  if (req.user.role === 'client') {
    matters = db.prepare(`
      SELECT m.*, u.first_name || ' ' || u.last_name as attorney_name
      FROM matters m LEFT JOIN users u ON m.attorney_id = u.id
      WHERE m.client_id = ? ORDER BY m.updated_at DESC
    `).all(req.user.id);
  } else {
    matters = db.prepare(`
      SELECT m.*,
        c.first_name || ' ' || c.last_name as client_name,
        a.first_name || ' ' || a.last_name as attorney_name
      FROM matters m
      LEFT JOIN users c ON m.client_id = c.id
      LEFT JOIN users a ON m.attorney_id = a.id
      ORDER BY m.updated_at DESC
    `).all();
  }
  res.json(matters);
});

router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const matter = db.prepare(`
    SELECT m.*,
      c.first_name || ' ' || c.last_name as client_name,
      c.email as client_email, c.phone as client_phone,
      a.first_name || ' ' || a.last_name as attorney_name
    FROM matters m
    LEFT JOIN users c ON m.client_id = c.id
    LEFT JOIN users a ON m.attorney_id = a.id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  res.json(matter);
});

router.post('/', requireAuth, (req, res) => {
  const { matterType, description, court, county, urgent, importantDate, hasDocuments, workedWithFirmBefore, additionalNotes, matterStatus } = req.body;
  const db = getDb();
  const caseNum = `${new Date().getFullYear().toString().slice(2)}-${String(db.prepare('SELECT COUNT(*) as c FROM matters').get().c + 1).padStart(4, '0')}`;
  const result = db.prepare(`
    INSERT INTO matters (case_number, client_id, matter_type, stage, description, court, county, urgent, important_date, has_documents, worked_with_firm_before, additional_notes, status)
    VALUES (?, ?, ?, 'intake', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(caseNum, req.user.id, matterType || null, description || null, court || null, county || null, urgent ? 1 : 0, importantDate || null, hasDocuments ? 1 : 0, workedWithFirmBefore ? 1 : 0, additionalNotes || null, matterStatus || 'active');
  const matter = db.prepare('SELECT * FROM matters WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(matter);
});

router.put('/:id', requireAuth, requireRole('attorney', 'partner'), (req, res) => {
  const { stage, status, description, court, county, urgent, importantDate, additionalNotes } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE matters SET stage = COALESCE(?, stage), status = COALESCE(?, status),
    description = COALESCE(?, description), court = COALESCE(?, court), county = COALESCE(?, county),
    urgent = COALESCE(?, urgent), important_date = COALESCE(?, important_date),
    additional_notes = COALESCE(?, additional_notes), updated_at = datetime('now')
    WHERE id = ?
  `).run(stage, status, description, court, county, urgent !== undefined ? (urgent ? 1 : 0) : null, importantDate, additionalNotes, req.params.id);
  res.json({ success: true });
});

router.get('/:id/timeline', requireAuth, (req, res) => {
  const db = getDb();
  const matter = db.prepare('SELECT stage FROM matters WHERE id = ?').get(req.params.id);
  if (!matter) return res.status(404).json({ error: 'Not found' });
  const current = STAGES.indexOf(matter.stage);
  res.json(STAGES.map((s, i) => ({ stage: s, completed: i < current, current: i === current, upcoming: i > current })));
});

router.get('/stats/overview', requireAuth, (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM matters').get().c;
  const active = db.prepare("SELECT COUNT(*) as c FROM matters WHERE status = 'active'").get().c;
  const atRisk = db.prepare("SELECT COUNT(*) as c FROM matters WHERE status = 'at_risk'").get().c;
  const complete = db.prepare("SELECT COUNT(*) as c FROM matters WHERE status = 'complete'").get().c;
  res.json({ total, active, atRisk, complete });
});

module.exports = router;
