const router = require('express').Router();
const { one, all, run } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'client') {
      rows = await all(`SELECT m.*, CONCAT(a.first_name,' ',a.last_name) AS attorney_name FROM matters m LEFT JOIN users a ON m.attorney_id=a.id WHERE m.client_id=? ORDER BY m.updated_at DESC`, [req.user.id]);
    } else {
      rows = await all(`SELECT m.*, CONCAT(a.first_name,' ',a.last_name) AS attorney_name, CONCAT(c.first_name,' ',c.last_name) AS client_name FROM matters m LEFT JOIN users a ON m.attorney_id=a.id LEFT JOIN users c ON m.client_id=c.id ORDER BY m.updated_at DESC`);
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/overview', requireAuth, async (req, res) => {
  try {
    const total    = await one('SELECT COUNT(*) c FROM matters');
    const active   = await one("SELECT COUNT(*) c FROM matters WHERE status='active'");
    const atRisk   = await one("SELECT COUNT(*) c FROM matters WHERE status='at_risk'");
    const complete = await one("SELECT COUNT(*) c FROM matters WHERE status='complete'");
    res.json({ total: total.c, active: active.c, atRisk: atRisk.c, complete: complete.c });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const m = await one(`SELECT m.*, CONCAT(c.first_name,' ',c.last_name) AS client_name, c.email AS client_email, c.phone AS client_phone, CONCAT(a.first_name,' ',a.last_name) AS attorney_name FROM matters m LEFT JOIN users c ON m.client_id=c.id LEFT JOIN users a ON m.attorney_id=a.id WHERE m.id=?`, [req.params.id]);
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(m);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { matterType, description, court, county, urgent, importantDate, hasDocuments, workedWithFirmBefore, additionalNotes, matterStatus } = req.body;
    const r = await run(`INSERT INTO matters (client_id,matter_type,stage,description,court,county,urgent,important_date,has_documents,worked_with_firm_before,additional_notes,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, matterType||null, 'intake', description||null, court||null, county||null, urgent?1:0, importantDate||null, hasDocuments?1:0, workedWithFirmBefore?1:0, additionalNotes||null, matterStatus||'active']);
    const caseNum = `${new Date().getFullYear().toString().slice(2)}-${String(r.insertId).padStart(4,'0')}`;
    await run('UPDATE matters SET case_number=? WHERE id=?', [caseNum, r.insertId]);
    res.status(201).json(await one('SELECT * FROM matters WHERE id=?', [r.insertId]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', requireAuth, requireRole('attorney','partner'), async (req, res) => {
  try {
    const { stage, status, description, court, county, urgent, importantDate, additionalNotes } = req.body;
    const sets = [], vals = [];
    if (stage!==undefined)          { sets.push('stage=?');            vals.push(stage); }
    if (status!==undefined)         { sets.push('status=?');           vals.push(status); }
    if (description!==undefined)    { sets.push('description=?');      vals.push(description); }
    if (court!==undefined)          { sets.push('court=?');            vals.push(court); }
    if (county!==undefined)         { sets.push('county=?');           vals.push(county); }
    if (urgent!==undefined)         { sets.push('urgent=?');           vals.push(urgent?1:0); }
    if (importantDate!==undefined)  { sets.push('important_date=?');   vals.push(importantDate); }
    if (additionalNotes!==undefined){ sets.push('additional_notes=?'); vals.push(additionalNotes); }
    if (sets.length) await run(`UPDATE matters SET ${sets.join(',')} WHERE id=?`, [...vals, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/timeline', requireAuth, async (req, res) => {
  try {
    const STAGES = ['intake','hearing_prep','initial_inventory','monthly_records','annual_return_prep','court_review','complete'];
    const m = await one('SELECT stage FROM matters WHERE id=?', [req.params.id]);
    if (!m) return res.status(404).json({ error: 'Not found' });
    const cur = STAGES.indexOf(m.stage);
    res.json(STAGES.map((s,i) => ({ stage:s, completed:i<cur, current:i===cur, upcoming:i>cur })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
