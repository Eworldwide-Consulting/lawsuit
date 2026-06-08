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
    res.json(await AppointmentRepo.findAll(pagination));
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
    res.json(await AppointmentRepo.findAllAfter(now, 10));
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
    await AppointmentRepo.delete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;