const router       = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { all, run, one } = require('../db');

const staffOnly = [requireAuth, requireRole('attorney', 'partner', 'itsupport')];

// Hardcoded legal form templates — standard forms that don't vary between firms
const TEMPLATES = [
  {
    id: 'intake-questionnaire',
    category: 'Intake',
    name: 'Client Intake Questionnaire',
    description: 'Comprehensive questionnaire covering personal info, family background, and legal history.',
    fields: ['Full Name', 'Date of Birth', 'Address', 'Phone', 'Email', 'Emergency Contact', 'Prior Legal History'],
    estimatedMinutes: 15,
  },
  {
    id: 'guardianship-questionnaire',
    category: 'Intake',
    name: 'Guardianship Information Form',
    description: 'Gathers information about the proposed ward, existing care arrangements, and family structure.',
    fields: ['Ward Name', 'Ward DOB', 'Current Residence', 'Medical Conditions', 'Financial Overview', 'Family Members'],
    estimatedMinutes: 20,
  },
  {
    id: 'conflict-check',
    category: 'Compliance',
    name: 'Conflict of Interest Check',
    description: 'Documents the attorney conflict check process before engagement.',
    fields: ['Client Name', 'Opposing Parties', 'Related Entities', 'Attorney Certification'],
    estimatedMinutes: 5,
  },
  {
    id: 'consent-representation',
    category: 'Agreement',
    name: 'Consent to Representation',
    description: 'Client consent confirming they understand the scope and terms of representation.',
    fields: ['Client Name', 'Attorney Name', 'Scope of Work', 'Acknowledgment'],
    estimatedMinutes: 5,
  },
  {
    id: 'retainer-agreement',
    category: 'Agreement',
    name: 'Retainer Agreement',
    description: 'Standard retainer agreement covering fees, billing, and termination provisions.',
    fields: ['Client Name', 'Retainer Amount', 'Hourly Rate', 'Billing Cycle', 'Scope', 'Termination Clause'],
    estimatedMinutes: 10,
  },
  {
    id: 'nda',
    category: 'Agreement',
    name: 'Non-Disclosure Agreement',
    description: 'Mutual NDA for cases involving sensitive business or personal information.',
    fields: ['Disclosing Party', 'Receiving Party', 'Confidential Information Description', 'Duration', 'Jurisdiction'],
    estimatedMinutes: 8,
  },
  {
    id: 'medical-release',
    category: 'Authorization',
    name: 'Medical Records Release',
    description: 'HIPAA-compliant authorization for release of medical records in guardianship proceedings.',
    fields: ['Patient Name', 'Date of Birth', 'Healthcare Provider', 'Records Requested', 'Purpose', 'Expiration Date'],
    estimatedMinutes: 5,
  },
  {
    id: 'financial-disclosure',
    category: 'Disclosure',
    name: 'Financial Disclosure Statement',
    description: 'Comprehensive asset and liability disclosure required in guardianship/conservatorship filings.',
    fields: ['Assets', 'Liabilities', 'Income Sources', 'Expenses', 'Real Property', 'Bank Accounts'],
    estimatedMinutes: 25,
  },
  {
    id: 'power-of-attorney',
    category: 'Authorization',
    name: 'Power of Attorney',
    description: 'General or limited POA granting authority for financial, medical, or legal decisions.',
    fields: ['Principal Name', 'Agent Name', 'Powers Granted', 'Effective Date', 'Limitations', 'Notarization'],
    estimatedMinutes: 10,
  },
  {
    id: 'letters-guardianship',
    category: 'Court',
    name: 'Petition for Letters of Guardianship',
    description: 'Initial petition for court to appoint a guardian for an incapacitated person.',
    fields: ['Petitioner', 'Proposed Ward', 'Proposed Guardian', 'Incapacity Description', 'Existing Care', 'Relatives'],
    estimatedMinutes: 30,
  },
  {
    id: 'annual-report',
    category: 'Court',
    name: 'Annual Guardian Report',
    description: 'Yearly status report on ward wellbeing, financial management, and care activities.',
    fields: ["Ward's Current Condition", 'Residence', 'Medical Treatment', 'Financial Summary', 'Activities', 'Goals'],
    estimatedMinutes: 20,
  },
  {
    id: 'fee-waiver',
    category: 'Court',
    name: 'Application for Fee Waiver',
    description: 'Court fee waiver application for clients who cannot afford filing fees.',
    fields: ['Applicant Name', 'Case Number', 'Monthly Income', 'Expenses', 'Assets', 'Dependents'],
    estimatedMinutes: 10,
  },
];

// ── Guardian Information Collection form ─────────────────────────────────────
// Client fills guardian + protected person details for their matter; the
// legal team reads it from the matter view. One row per matter (upsert).

const GUARDIAN_FIELDS = [
  'guardian_name', 'guardian_relationship', 'guardian_dob',
  'guardian_phone', 'guardian_email', 'guardian_address',
  'ward_name', 'ward_dob', 'ward_residence',
  'ward_medical_conditions', 'ward_care_needs', 'ward_current_caregiver',
];

async function assertMatterAccess(matterId, user) {
  const MatterRepo = require('../repositories/matter.repository');
  const matter = await MatterRepo.findById(matterId);
  if (!matter) return { error: 'Matter not found', status: 404 };
  const staff = ['attorney', 'partner', 'itsupport'].includes(user.role);
  if (!staff && matter.client_id !== user.id) return { error: 'Forbidden', status: 403 };
  return { matter };
}

router.get('/guardianship', requireAuth, async (req, res, next) => {
  try {
    const { matterId } = req.query;
    if (!matterId) return res.status(400).json({ error: 'matterId required' });

    const access = await assertMatterAccess(matterId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const form = await one('SELECT * FROM guardianship_forms WHERE matter_id = ?', [matterId]);
    res.json({ form: form || null });
  } catch (err) { next(err); }
});

router.put('/guardianship', requireAuth, async (req, res, next) => {
  try {
    const { matterId, submit } = req.body;
    if (!matterId) return res.status(400).json({ error: 'matterId required' });

    const access = await assertMatterAccess(matterId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const vals   = GUARDIAN_FIELDS.map(f => String(req.body[f] ?? '').trim().slice(0, 2000) || null);
    const status = submit ? 'submitted' : 'draft';
    const now    = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const existing = await one('SELECT id, status FROM guardianship_forms WHERE matter_id = ?', [matterId]);
    if (existing) {
      await run(
        `UPDATE guardianship_forms
         SET ${GUARDIAN_FIELDS.map(f => `${f} = ?`).join(', ')}, status = ?, updated_at = ?
         WHERE id = ?`,
        [...vals, status, now, existing.id]
      );
    } else {
      await run(
        `INSERT INTO guardianship_forms (matter_id, client_id, ${GUARDIAN_FIELDS.join(', ')}, status, updated_at)
         VALUES (?,?,${GUARDIAN_FIELDS.map(() => '?').join(',')},?,?)`,
        [matterId, access.matter.client_id || req.user.id, ...vals, status, now]
      );
    }

    // First submission notifies the assigned attorney
    if (submit && existing?.status !== 'submitted' && access.matter.attorney_id) {
      try {
        const NotificationService = require('../services/notification.service');
        await NotificationService.create({
          userId:     access.matter.attorney_id,
          type:       'form_request',
          title:      'Guardian Information form submitted',
          body:       `${req.user.first_name} ${req.user.last_name} completed the Guardian Information form for case ${access.matter.case_number || `#${matterId}`}.`,
          entityType: 'matter',
          entityId:   Number(matterId),
        });
      } catch { /* non-critical */ }
    }

    const form = await one('SELECT * FROM guardianship_forms WHERE matter_id = ?', [matterId]);
    res.json({ form });
  } catch (err) { next(err); }
});

router.get('/templates', requireAuth, (req, res) => {
  const { category } = req.query;
  const list = category
    ? TEMPLATES.filter(t => t.category.toLowerCase() === category.toLowerCase())
    : TEMPLATES;
  res.json({ templates: list });
});

router.get('/sent', ...staffOnly, async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT sf.*, u.first_name, u.last_name, u.email
       FROM sent_forms sf
       JOIN users u ON sf.client_id = u.id
       ORDER BY sf.sent_at DESC LIMIT 100`
    );
    res.json({ forms: rows });
  } catch (err) {
    // sent_forms table may not exist yet — return empty
    if (err.message?.includes('no such table') || err.message?.includes("doesn't exist")) {
      return res.json({ forms: [] });
    }
    next(err);
  }
});

router.post('/send', ...staffOnly, async (req, res, next) => {
  try {
    const { templateId, clientId, matterId, note } = req.body;
    if (!templateId || !clientId)
      return res.status(400).json({ error: 'templateId and clientId are required' });

    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template)
      return res.status(404).json({ error: 'Template not found' });

    // Ensure sent_forms table exists (idempotent)
    const db = require('../database').getDb();
    if (db.type === 'sqlite') {
      db.sqlite.exec(`
        CREATE TABLE IF NOT EXISTS sent_forms (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id TEXT NOT NULL,
          client_id   INTEGER NOT NULL,
          matter_id   INTEGER,
          sent_by     INTEGER NOT NULL,
          note        TEXT,
          status      TEXT DEFAULT 'sent',
          sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME
        )
      `);
    } else if (db.type === 'mysql') {
      await db.pool.execute(`
        CREATE TABLE IF NOT EXISTS sent_forms (
          id           INT AUTO_INCREMENT PRIMARY KEY,
          template_id  VARCHAR(100) NOT NULL,
          client_id    INT NOT NULL,
          matter_id    INT,
          sent_by      INT NOT NULL,
          note         TEXT,
          status       VARCHAR(20) DEFAULT 'sent',
          sent_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME
        )
      `);
    }

    const r = await run(
      `INSERT INTO sent_forms (template_id, client_id, matter_id, sent_by, note) VALUES (?,?,?,?,?)`,
      [templateId, clientId, matterId || null, req.user.id, note || null]
    );

    // Notify client via notification service
    try {
      const NotificationService = require('../services/notification.service');
      await NotificationService.send({
        userId: clientId,
        type: 'form_request',
        title: 'Form Request',
        message: `Your attorney has sent you a form to complete: ${template.name}`,
        meta: { formId: r.insertId, templateId },
      });
    } catch { /* notification failure is non-critical */ }

    res.status(201).json({ id: r.insertId, template, status: 'sent' });
  } catch (err) { next(err); }
});

router.delete('/sent/:id', ...staffOnly, async (req, res, next) => {
  try {
    await run('DELETE FROM sent_forms WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
