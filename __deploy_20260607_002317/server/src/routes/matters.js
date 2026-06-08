const router = require('express').Router();
const { one, all, run }      = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { MATTER_STAGES, parsePagination } = require('../utils');

// ── List ──────────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    let rows;

    if (req.user.role === 'client') {
      rows = await all(
        `SELECT m.*,
                a.first_name || ' ' || a.last_name AS attorney_name
         FROM matters m
         LEFT JOIN users a ON m.attorney_id = a.id
         WHERE m.client_id = ?
         ORDER BY m.updated_at DESC
         LIMIT ? OFFSET ?`,
        [req.user.id, limit, offset]
      );
    } else {
      rows = await all(
        `SELECT m.*,
                a.first_name || ' ' || a.last_name AS attorney_name,
                c.first_name || ' ' || c.last_name AS client_name
         FROM matters m
         LEFT JOIN users a ON m.attorney_id = a.id
         LEFT JOIN users c ON m.client_id   = c.id
         ORDER BY m.updated_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats — attorneys/partners only to prevent clients seeing firm-wide data ──

router.get('/stats/overview', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res) => {
  try {
    // Single query with conditional aggregation instead of 4 separate COUNT calls
    const row = await one(`
      SELECT
        COUNT(*)                                        AS total,
        SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'at_risk'  THEN 1 ELSE 0 END) AS at_risk,
        SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS complete
      FROM matters
    `);
    res.json({
      total:    Number(row.total),
      active:   Number(row.active),
      atRisk:   Number(row.at_risk),
      complete: Number(row.complete),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Single matter ─────────────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const m = await one(
      `SELECT m.*,
              c.first_name || ' ' || c.last_name AS client_name,
              c.email AS client_email,
              c.phone AS client_phone,
              a.first_name || ' ' || a.last_name AS attorney_name
       FROM matters m
       LEFT JOIN users c ON m.client_id   = c.id
       LEFT JOIN users a ON m.attorney_id = a.id
       WHERE m.id = ?`,
      [req.params.id]
    );
    if (!m) return res.status(404).json({ error: 'Not found' });

    // Clients can only see their own matters
    if (req.user.role === 'client' && m.client_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    res.json(m);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create ────────────────────────────────────────────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      matterType, description, court, county,
      urgent, importantDate, hasDocuments,
      workedWithFirmBefore, additionalNotes, matterStatus,
    } = req.body;

    const r = await run(
      `INSERT INTO matters
         (client_id, matter_type, stage, description, court, county,
          urgent, important_date, has_documents, worked_with_firm_before,
          additional_notes, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id, matterType || null, 'intake',
        description || null, court || null, county || null,
        urgent ? 1 : 0, importantDate || null,
        hasDocuments ? 1 : 0, workedWithFirmBefore ? 1 : 0,
        additionalNotes || null, matterStatus || 'active',
      ]
    );

    // Generate case number and set it in the same logical step.
    // Two-trip is unavoidable because we need the auto-increment id first —
    // but we do it immediately so the matter is never in a number-less state
    // from the caller's perspective.
    const caseNum = `${new Date().getFullYear().toString().slice(2)}-${String(r.insertId).padStart(4, '0')}`;
    await run('UPDATE matters SET case_number = ? WHERE id = ?', [caseNum, r.insertId]);

    res.status(201).json(await one('SELECT * FROM matters WHERE id = ?', [r.insertId]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update — attorneys and partners only ──────────────────────────────────────

router.put('/:id', requireAuth, requireRole('attorney', 'partner'), async (req, res) => {
  try {
    const { stage, status, description, court, county, urgent, importantDate, additionalNotes, attorney_id } = req.body;

    const sets = [];
    const vals = [];

    if (attorney_id !== undefined) {
      if (attorney_id === null) {
        sets.push('attorney_id = ?');
        vals.push(null);
      } else {
        const atty = await one(
          "SELECT id, email_verified, approval_status FROM users WHERE id = ? AND role IN ('attorney','partner')",
          [attorney_id]
        );
        if (!atty)
          return res.status(400).json({ error: 'Attorney not found' });
        if (!atty.email_verified)
          return res.status(400).json({ error: 'This attorney has not verified their email address yet' });
        if (atty.approval_status !== null && atty.approval_status !== 'approved')
          return res.status(400).json({ error: 'This attorney account is pending approval and cannot be assigned' });
        sets.push('attorney_id = ?');
        vals.push(attorney_id);
      }
    }

    if (stage           !== undefined) { sets.push('stage = ?');           vals.push(stage); }
    if (status          !== undefined) { sets.push('status = ?');          vals.push(status); }
    if (description     !== undefined) { sets.push('description = ?');     vals.push(description); }
    if (court           !== undefined) { sets.push('court = ?');           vals.push(court); }
    if (county          !== undefined) { sets.push('county = ?');          vals.push(county); }
    if (urgent          !== undefined) { sets.push('urgent = ?');          vals.push(urgent ? 1 : 0); }
    if (importantDate   !== undefined) { sets.push('important_date = ?');  vals.push(importantDate); }
    if (additionalNotes !== undefined) { sets.push('additional_notes = ?');vals.push(additionalNotes); }

    if (sets.length) {
      sets.push('updated_at = CURRENT_TIMESTAMP');
      await run(`UPDATE matters SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Timeline ──────────────────────────────────────────────────────────────────

router.get('/:id/timeline', requireAuth, async (req, res) => {
  try {
    const m = await one('SELECT stage, client_id FROM matters WHERE id = ?', [req.params.id]);
    if (!m) return res.status(404).json({ error: 'Not found' });

    if (req.user.role === 'client' && m.client_id !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    const cur = MATTER_STAGES.indexOf(m.stage);
    res.json(
      MATTER_STAGES.map((stage, i) => ({
        stage,
        completed: i < cur,
        current:   i === cur,
        upcoming:  i > cur,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
