const router = require('express').Router();
const { requireAuth }    = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const MessageService     = require('../services/message.service');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await MessageService.inbox(req.user.id));
  } catch (err) { next(err); }
});

router.get('/sent', requireAuth, async (req, res, next) => {
  try {
    res.json(await MessageService.sent(req.user.id));
  } catch (err) { next(err); }
});

router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    res.json({ count: await MessageService.unreadCount(req.user.id) });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, validate(schemas.sendMessage), async (req, res, next) => {
  try {
    const { toUserId, matterId, subject, body } = req.validated.body;
    res.status(201).json(await MessageService.send({ fromUser: req.user, toUserId, matterId, subject, body }));
  } catch (err) { next(err); }
});

router.put('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await MessageService.markRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;