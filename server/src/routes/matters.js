const router = require('express').Router();
const { getDb } = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    let rows;
    if (req.user.role === 'client') {
      rows = db.prepare(`
        SELECT m.*, u.first_name||' '||u.last_name AS attorney_name
        FROM matters m LEFT JOIN users u ON m.attorney_id=u.id
        WHERE m.client_id=? ORDER BY m.updated_at DESC
      `).all(req.user.id);
    } else {
      rows = db.prepare(`
        SELECT m.*,
          a.first_name||' '||a.last_name AS attorney_name,
          c.first_name||' '||c.last_name AS client_name
        FROM matters m
        LEFT JOIN users a ON m.attorney_id=a.id
        LEFT JOIN users c ON m.client_id=c.id
        ORDER BY m.updated_at DESC
      `).all();
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/overview', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const total    = db.prepare("SELECT COUNT(*) c FROM matters").get().c;
    const active   = db.prepare("SELECT COUNT(*) c FROM matters WHERE status='active'").get().c;
    const atRisk   = db.prepare("SELECT COUNT(*) c FROM matters WHERE status='at_risk'").get().c;
    const complete = db.prepare("SELECT COUNT(*) c FROM matters WHERE status='complete'").get().c;
    res.json({ total, active, atRisk, complete });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireAuth, (req, res) => {
  try {
    const m = getDb().prepare(`
      SELECT m.*,
        c.first_name||' '||c.last_name AS client_name, c.email AS client_email, c.phone AS client_phone,
        a.first_name||' '||a.last_name AS attorney_name
      FROM matters m
      LEFT JOIN users c ON m.client_id=c.id
      LEFT JOIN users a ON m.attorney_id=a.id
      WHERE m.id=?
    `).get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Matter not found' });
    res.json(m);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, (req, res) => {
  try {
    const { matterType, description, court, county, urgent, importantDate,
            hasDocuments, workedWithFirmBefore, additionalNotes, matterStatus } = req.body;
    const db = getDb();
    const r  = db.prepare(`
      INSERT INTO matters (client_id,matter_type,stage,description,court,county,urgent,
        important_date,has_documents,worked_with_firm_before,additional_notes,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(req.user.id, matterType||null, 'intake', description||null, court||null,
           county||null, urgent?1:0, importantDate||null, hasDocuments?1:0,
           workedWithFirmBefore?1:0, additionalNotes||null, matterStatus||'active');
    const caseNum = `${new Date().getFullYear().toString().slice(2)}-${String(r.lastInsertRowid).padStart(4,'0')}`;
    db.prepare('UPDATE matters SET case_number=? WHERE id=?').run(caseNum, r.lastInsertRowid);
    res.status(201).json(db.prepare('SELECT * FROM matters WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, requireRole('attorney','partner'), (req, res) => {
  try {
    const { stage, status, description, court, county, urgent, importantDate, additionalNotes } = req.body;
    const db = getDb();
    const sets = [], vals = [];
    if (stage           !== undefined) { sets.push('stage=?');            vals.push(stage); }
    if (status          !== undefined) { sets.push('status=?');           vals.push(status); }
    if (description     !== undefined) { sets.push('description=?');      vals.push(description); }
    if (court           !== undefined) { sets.push('court=?');            vals.push(court); }
    if (county          !== undefined) { sets.push('county=?');           vals.push(county); }
    if (urgent          !== undefined) { sets.push('urgent=?');           vals.push(urgent?1:0); }
    if (importantDate   !== undefined) { sets.push('important_date=?');   vals.push(importantDate); }
    if (additionalNotes !== undefined) { sets.push('additional_notes=?'); vals.push(additionalNotes); }
    if (sets.length) {
      sets.push("updated_at=datetime('now')");
      db.prepare(`UPDATE matters SET ${sets.join(',')} WHERE id=?`).run(...vals, req.params.id);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/timeline', requireAuth, (req, res) => {
  try {
    const STAGES = ['intake','hearing_prep','initial_inventory','monthly_records','annual_return_prep','court_review','complete'];
    const m = getDb().prepare('SELECT stage FROM matters WHERE id=?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    const cur = STAGES.indexOf(m.stage);
    res.json(STAGES.map((s,i) => ({ stage:s, completed:i<cur, current:i===cur, upcoming:i>cur })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
