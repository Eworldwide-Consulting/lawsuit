const router = require('express').Router();
const { requireAuth }  = require('../middleware/auth');
const AppointmentRepo  = require('../repositories/appointment.repository');
const MatterRepo       = require('../repositories/matter.repository');
const { parsePagination } = require('../lib/pagination');
const { isStaff }      = require('../domain/user');
const { nowIso }       = require('../lib/dates');
const { NotFoundError, ForbiddenError, ValidationError } = require('../lib/errors');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    if (req.user.role === 'client') {
      const matterRows = await MatterRepo.idsByClientId(req.user.id);
      if (!matterRows.length) return res.json([]);
      return res.json(await AppointmentRepo.findByMatters(matterRows.map(m => m.id), pagination));
    }
    // Attorneys see only their own matters' appointments; partners/itsupport (law firm heads) see all.
    const attorneyId = req.user.role === 'attorney' ? req.user.id : null;
    res.json(await AppointmentRepo.findAll(pagination, attorneyId));
  } catch (err) { next(err); }
});

router.get('/upcoming', requireAuth, async (req, res, next) => {
  try {
    const now = nowIso();
    if (req.user.role === 'client') {
      const matterRows = await MatterRepo.idsByClientId(req.user.id);
      if (!matterRows.length) return res.json([]);
      return res.json(await AppointmentRepo.findByMattersAfter(matterRows.map(m => m.id), now, 5));
    }
    const attorneyId = req.user.role === 'attorney' ? req.user.id : null;
    res.json(await AppointmentRepo.findAllAfter(now, 10, attorneyId));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { matterId, title, type, startTime, endTime, location, notes } = req.body;
    if (!title || !startTime)
      throw new ValidationError('title and startTime required');

    // H5: verify the client owns the matter they're attaching this appointment to
    if (matterId && req.user.role === 'client') {
      const matter = await MatterRepo.findById(matterId);
      if (!matter || matter.client_id !== req.user.id) throw new ForbiddenError();
    }

    res.status(201).json(await AppointmentRepo.create({ matterId, title, type, startTime, endTime, location, notes }));
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isStaff(req.user.role)) throw new ForbiddenError();
    const appt = await AppointmentRepo.findById(req.params.id);
    if (!appt) throw new NotFoundError('Appointment');
    // An attorney could previously delete ANY firm-wide appointment — isStaff()
    // alone doesn't check they're the assigned attorney (partners/itsupport unrestricted).
    if (req.user.role === 'attorney') {
      const matter = appt.matter_id ? await MatterRepo.findById(appt.matter_id) : null;
      if (!matter || matter.attorney_id !== req.user.id) throw new ForbiddenError();
    }
    await AppointmentRepo.delete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Helper: verify the current user can act on the given appointment ────────
// An attorney could previously act on ANY firm-wide appointment — isStaff()
// alone doesn't check they're the assigned attorney (partners/itsupport unrestricted).
async function assertApptAccess(apptId, user) {
  const appt = await AppointmentRepo.findById(apptId);
  if (!appt) throw new NotFoundError('Appointment');
  if (user.role === 'partner' || user.role === 'itsupport') return appt;
  const matter = appt.matter_id ? await MatterRepo.findById(appt.matter_id) : null;
  if (user.role === 'attorney') {
    if (!matter || matter.attorney_id !== user.id) throw new ForbiddenError();
  } else if (!matter || matter.client_id !== user.id) {
    throw new ForbiddenError();
  }
  return appt;
}

// Mark a past appointment as missed — surfaces the Reschedule action client-side.
router.put('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (status !== 'no_show') throw new ValidationError('status must be "no_show"');
    await assertApptAccess(req.params.id, req.user);
    await AppointmentRepo.updateStatus(req.params.id, status);
    res.json(await AppointmentRepo.findById(req.params.id));
  } catch (err) { next(err); }
});

// Reschedule: creates a new appointment at the new time, marks the original 'rescheduled'.
router.post('/:id/reschedule', requireAuth, async (req, res, next) => {
  try {
    const { startTime, endTime } = req.body;
    if (!startTime) throw new ValidationError('startTime required');
    await assertApptAccess(req.params.id, req.user);
    const rescheduled = await AppointmentRepo.reschedule(req.params.id, { startTime, endTime });
    res.status(201).json(rescheduled);
  } catch (err) { next(err); }
});

module.exports = router;