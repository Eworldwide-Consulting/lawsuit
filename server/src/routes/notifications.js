const router  = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const NotificationService = require('../services/notification.service');
const { parsePagination } = require('../lib/pagination');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const [items, unread] = await Promise.all([
      NotificationService.getForUser(req.user.id, { limit, offset }),
      NotificationService.getUnreadCount(req.user.id),
    ]);
    res.json({ items, unread });
  } catch (err) { next(err); }
});

router.put('/read-all', requireAuth, async (req, res, next) => {
  try {
    await NotificationService.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await NotificationService.markRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;