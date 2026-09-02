const router = require('express').Router();
const { requireAuth }  = require('../middleware/auth');
const TaskRepo         = require('../repositories/task.repository');
const MatterRepo       = require('../repositories/matter.repository');
const { parsePagination } = require('../lib/pagination');
const { NotFoundError, ForbiddenError, ValidationError } = require('../lib/errors');
const NotificationService = require('../services/notification.service');
const AuditService        = require('../services/audit.service');

const VALID_STATUSES = ['pending', 'in_progress', 'completed'];

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    if (req.user.role === 'client') {
      const matterRows = await MatterRepo.idsByClientId(req.user.id);
      if (!matterRows.length) return res.json([]);
      return res.json(await TaskRepo.findByMatters(matterRows.map(m => m.id), pagination));
    }
    // An attorney could previously list every firm-wide task — only their
    // own matters' tasks now (partners/itsupport still see everything).
    const attorneyId = req.user.role === 'attorney' ? req.user.id : null;
    res.json(await TaskRepo.findAll(pagination, attorneyId));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { matterId, assignedTo, title, description, dueDate, priority, actionLabel } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const effectiveAssignee = assignedTo || req.user.id;
    const task = await TaskRepo.create({
      matterId, assignedTo: effectiveAssignee,
      title, description, dueDate, priority, actionLabel,
    });

    // Notify the assignee if someone else created the task for them
    if (effectiveAssignee !== req.user.id) {
      NotificationService.taskAssigned(effectiveAssignee, { taskTitle: title, taskId: task.id });
    }

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.TASK_CREATED,
      entity: 'task', entityId: task.id,
      meta: { title, assignedTo: effectiveAssignee, matterId: matterId || null },
      ip: req.ip,
    });

    res.status(201).json(task);
  } catch (err) { next(err); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const task = await TaskRepo.findById(req.params.id);
    if (!task) throw new NotFoundError('Task');
    // An attorney could previously update ANY firm-wide task — isStaff() alone
    // doesn't check they're actually assigned to it or its matter.
    const canAccess = task.assigned_to === req.user.id
      || (req.user.role === 'attorney' && task.matter_attorney_id === req.user.id)
      || ['partner', 'itsupport'].includes(req.user.role);
    if (!canAccess) throw new ForbiddenError();
    if (!VALID_STATUSES.includes(req.body.status))
      throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    await TaskRepo.updateStatus(req.params.id, req.body.status);

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.TASK_STATUS_CHANGED,
      entity: 'task', entityId: req.params.id,
      meta: { status: req.body.status },
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;