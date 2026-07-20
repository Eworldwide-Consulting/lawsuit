const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const MatterService       = require('../services/matter.service');
const MatterRepo          = require('../repositories/matter.repository');
const UserRepo            = require('../repositories/user.repository');
const { parsePagination } = require('../lib/pagination');
const NotificationService = require('../services/notification.service');
const EmailService        = require('../services/email.service');
const AuditService        = require('../services/audit.service');
const config              = require('../config');
const { ForbiddenError, NotFoundError, ValidationError } = require('../lib/errors');
const { all, one, run }   = require('../db');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await MatterService.list(req.user, parsePagination(req.query)));
  } catch (err) { next(err); }
});

router.get('/stats/overview', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  try {
    res.json(await MatterRepo.stats());
  } catch (err) { next(err); }
});

// Pending client requests — matters where this attorney is assigned but hasn't accepted yet
router.get('/pending-requests', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT m.*,
              (u.first_name || ' ' || u.last_name) AS client_name,
              u.email    AS client_email,
              u.phone    AS client_phone,
              u.avatar_initials AS client_initials,
              u.created_at AS client_joined
       FROM matters m
       JOIN users u ON u.id = m.client_id
       WHERE m.attorney_id = ? AND (m.case_accepted = 0 OR m.case_accepted IS NULL)
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json({ matters: rows, count: rows.length });
  } catch (err) { next(err); }
});

// Staff lookup: resolve a client-facing case number (e.g. "26-0004") to the
// matter, client contact info, intake form data, and document checklist
// progress in one payload.
router.get('/by-case-number/:caseNumber', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  try {
    const matter = await one(
      `SELECT m.*,
              c.first_name || ' ' || c.last_name AS client_name,
              c.email AS client_email,
              c.phone AS client_phone,
              a.first_name || ' ' || a.last_name AS attorney_name
       FROM matters m
       LEFT JOIN users c ON m.client_id   = c.id
       LEFT JOIN users a ON m.attorney_id = a.id
       WHERE m.case_number = ?`,
      [req.params.caseNumber]
    );
    if (!matter) throw new NotFoundError('No case found with that case number');

    const { getSchema, normalizeMatterType } = require('../domain/intakeFormSchema');
    const formRow = await one('SELECT * FROM intake_forms WHERE matter_id = ?', [matter.id]);
    const intakeForm = {
      matterType: normalizeMatterType(matter.matter_type),
      schema:     getSchema(matter.matter_type),
      data:       formRow?.form_data ? JSON.parse(formRow.form_data) : {},
      status:     formRow?.status || null,
    };

    const checklistItems = await all(
      `SELECT default_status, status FROM matter_checklist_items WHERE matter_id = ?`,
      [matter.id]
    );
    const neededNow = checklistItems.filter(i => i.default_status === 'needed_now');
    const accepted  = neededNow.filter(i => i.status === 'accepted');
    const checklist = {
      totalItems: checklistItems.length,
      neededNow:  neededNow.length,
      accepted:   accepted.length,
      progress:   neededNow.length > 0 ? Math.round((accepted.length / neededNow.length) * 100) : 0,
    };

    res.json({ matter, intakeForm, checklist });
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    res.json(await MatterService.getById(req.params.id, req.user));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const matter = await MatterService.create(req.body, req.user.id);
    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.MATTER_CREATED,
      entity: 'matter', entityId: matter.id,
      meta: { caseNumber: matter.case_number, matterType: matter.matter_type },
      ip: req.ip,
    });
    res.status(201).json(matter);
  } catch (err) { next(err); }
});

router.put('/:id', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    // Snapshot stage before update to detect stage changes
    const before = await MatterRepo.findById(req.params.id);
    await MatterService.update(req.params.id, req.body);

    const stageChanged = req.body.stage && before?.stage !== req.body.stage;
    const action = stageChanged
      ? AuditService.ACTIONS.MATTER_STAGE_CHANGED
      : AuditService.ACTIONS.MATTER_UPDATED;

    AuditService.log({
      userId: req.user.id, action,
      entity: 'matter', entityId: req.params.id,
      meta: stageChanged ? { from: before.stage, to: req.body.stage } : null,
      ip: req.ip,
    });

    // Notify the client when their matter is updated
    if (before?.client_id) {
      NotificationService.matterUpdated(before.client_id, {
        caseNumber: before.case_number,
        matterId:   Number(req.params.id),
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Client self-assigns an attorney to their own matter
router.post('/:id/assign-attorney', requireAuth, async (req, res, next) => {
  try {
    const matter = await MatterRepo.findById(req.params.id);
    if (!matter) throw new NotFoundError('Matter');
    if (req.user.role !== 'client' || matter.client_id !== req.user.id)
      throw new ForbiddenError('You can only assign an attorney to your own matter');
    const { attorney_id } = req.body;
    if (!attorney_id) throw new ValidationError('attorney_id is required');

    // Set case_accepted=0 so attorney must explicitly accept the request
    await run(
      `UPDATE matters SET attorney_id = ?, case_accepted = 0, case_accepted_at = NULL WHERE id = ?`,
      [attorney_id, req.params.id]
    );

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.MATTER_UPDATED,
      entity: 'matter', entityId: req.params.id,
      meta: { attorney_id, action: 'client_self_assigned' },
      ip: req.ip,
    });

    // In-app notification to attorney
    NotificationService.matterUpdated(attorney_id, {
      caseNumber: matter.case_number,
      matterId:   Number(req.params.id),
    });

    // Email notification to attorney — non-fatal if email is unconfigured
    try {
      const attorney = await UserRepo.findById(attorney_id);
      const client   = await UserRepo.findById(req.user.id);
      if (attorney?.email) {
        EmailService.sendAttorneyCaseRequest(attorney.email, {
          attorneyName: attorney.first_name,
          clientName:   `${client?.first_name || ''} ${client?.last_name || ''}`.trim() || req.user.email,
          caseNumber:   matter.case_number,
          matterType:   matter.matter_type,
          dashboardUrl: `${config.client.url}/dashboard`,
        });
      }
    } catch { /* email failure must never block the response */ }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Attorney accepts a case — initialises checklist and notifies client
router.post('/:id/accept', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    const matter = await MatterRepo.findById(req.params.id);
    if (!matter) throw new NotFoundError('Matter');
    if (matter.attorney_id !== req.user.id) throw new ForbiddenError('Not assigned to this case');

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await run(
      `UPDATE matters SET case_accepted = 1, case_accepted_at = ?, status = 'active' WHERE id = ?`,
      [now, req.params.id]
    );

    // Auto-initialise the checklist for this matter type (lazy-create from template).
    // 'guardianship_conservatorship' maps to 'joint_guardianship_conservatorship' in templates.
    try {
      const { all: dbAll, run: dbRun } = require('../db');
      const existing = await dbAll(
        `SELECT id FROM matter_checklist_items WHERE matter_id = ? LIMIT 1`, [matter.id]
      );
      if (existing.length === 0 && matter.matter_type) {
        const templateType = matter.matter_type === 'guardianship_conservatorship'
          ? 'joint_guardianship_conservatorship'
          : matter.matter_type;
        const templates = await dbAll(
          `SELECT * FROM checklist_templates WHERE matter_type = ? ORDER BY section_order, item_order`,
          [templateType]
        );
        for (const t of templates) {
          await dbRun(
            `INSERT INTO matter_checklist_items
               (matter_id, template_id, section, section_order, label, description, default_status, status, item_order)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [matter.id, t.id, t.section, t.section_order, t.label, t.description,
             t.default_status, t.default_status, t.item_order]
          );
        }
      }
    } catch { /* checklist init failure is non-fatal */ }

    // In-app notification + email to client
    if (matter.client_id) {
      NotificationService.matterUpdated(matter.client_id, {
        caseNumber: matter.case_number,
        matterId:   Number(req.params.id),
      });
      try {
        const client = await UserRepo.findById(matter.client_id);
        if (client?.email) {
          EmailService.sendClientCaseAccepted(client.email, {
            clientName:   client.first_name,
            attorneyName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
            caseNumber:   matter.case_number,
            dashboardUrl: `${config.client.url}/dashboard`,
          });
        }
      } catch { /* email failure is non-fatal */ }
    }

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.MATTER_UPDATED,
      entity: 'matter', entityId: req.params.id,
      meta: { action: 'attorney_accepted_case', matterId: req.params.id },
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Attorney declines a case request
router.post('/:id/decline', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    const matter = await MatterRepo.findById(req.params.id);
    if (!matter) throw new NotFoundError('Matter');
    if (matter.attorney_id !== req.user.id) throw new ForbiddenError('Not assigned to this case');

    const { reason } = req.body;
    await run(
      `UPDATE matters SET attorney_id = NULL, case_accepted = 0, decline_reason = ? WHERE id = ?`,
      [reason || null, req.params.id]
    );

    // In-app notification + email to client
    if (matter.client_id) {
      NotificationService.matterUpdated(matter.client_id, {
        caseNumber: matter.case_number,
        matterId:   Number(req.params.id),
      });
      try {
        const client = await UserRepo.findById(matter.client_id);
        if (client?.email) {
          EmailService.sendClientCaseDeclined(client.email, {
            clientName:   client.first_name,
            attorneyName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
            caseNumber:   matter.case_number,
            reason:       reason || null,
            dashboardUrl: `${config.client.url}/dashboard`,
          });
        }
      } catch { /* email failure is non-fatal */ }
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/:id/timeline', requireAuth, async (req, res, next) => {
  try {
    res.json(await MatterService.timeline(req.params.id, req.user));
  } catch (err) { next(err); }
});

module.exports = router;