const jwt   = require('jsonwebtoken');
const { one } = require('../db');
const cache   = require('../cache');
const config  = require('../config');
const { USER_COLUMNS, isSuspended, isDeleted } = require('../domain/user');

const USER_CACHE_TTL = 60;

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(header.slice(7), config.jwt.secret);
    if (payload.twoFaPending)
      return res.status(401).json({ error: '2FA required' });

    const cacheKey = `user:${payload.userId}`;
    let user = await cache.get(cacheKey);

    if (!user) {
      user = await one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [payload.userId]);
      if (user) await cache.set(cacheKey, user, USER_CACHE_TTL);
    }

    if (!user) return res.status(401).json({ error: 'User not found' });

    // A suspended or deleted account is frozen mid-session: the JWT stays
    // valid but every authenticated route stops serving it. Admin actions
    // invalidate this cache entry, so the freeze lands on the next request
    // rather than after USER_CACHE_TTL.
    if (isDeleted(user))
      return res.status(403).json({ error: 'This account has been deleted.', code: 'ACCOUNT_DELETED' });
    if (isSuspended(user))
      return res.status(403).json({
        error: 'Your account is suspended. Contact support to restore access.',
        code:  'ACCOUNT_SUSPENDED',
      });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

async function invalidateUserCache(userId) {
  await cache.del(`user:${userId}`);
}

module.exports = { requireAuth, requireRole, invalidateUserCache };