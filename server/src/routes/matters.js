const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const MatterService       = require('../services/matter.service');
const MatterRepo          = require('../repositories/matter.repository');
const { parsePagination } = require('../lib/pagination');
const NotificationService = require('../services/notification.service');
const AuditService        = require('../services/audit.service');
const { ForbiddenError, NotFoundError, ValidationError } = require('../lib/errors');

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

    await MatterService.update(req.params.id, { attorney_id });

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.MATTER_UPDATED,
      entity: 'matter', entityId: req.params.id,
      meta: { attorney_id, action: 'client_self_assigned' },
      ip: req.ip,
    });

    // Notify the newly assigned attorney
    NotificationService.matterUpdated(attorney_id, {
      caseNumber: matter.case_number,
      matterId:   Number(req.params.id),
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/:id/timeline', requireAuth, async (req, res, next) => {
  try {
    res.json(await MatterService.timeline(req.params.id, req.user));
  } catch (err) { next(err); }
});

module.exports = router;