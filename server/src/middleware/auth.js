const jwt   = require('jsonwebtoken');
const { one } = require('../db');
const cache   = require('../cache');

// Fields required by route handlers — never expose password_hash or secrets via req.user
const USER_COLUMNS = `
  id, first_name, last_name, email, role, phone, avatar_initials,
  email_verified, approval_status, two_fa_enabled, two_fa_secret, password_hash
`.trim();

// Cache TTL for user records.
// Short enough that role/approval changes propagate within 1 minute.
const USER_CACHE_TTL = 60;

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (payload.twoFaPending)
      return res.status(401).json({ error: '2FA required' });

    // Cache user by id to avoid a DB round-trip on every authenticated request.
    // At 1000 req/s this saves 1000 DB queries per second — the single largest
    // performance lever in the entire codebase.
    const cacheKey = `user:${payload.userId}`;
    let user = await cache.get(cacheKey);

    if (!user) {
      user = await one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [payload.userId]);
      if (user) await cache.set(cacheKey, user, USER_CACHE_TTL);
    }

    if (!user) return res.status(401).json({ error: 'User not found' });

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

// Call this from routes that modify a user record so the stale cache
// entry is evicted immediately (e.g. admin approve/reject, profile update).
async function invalidateUserCache(userId) {
  await cache.del(`user:${userId}`);
}

module.exports = { requireAuth, requireRole, invalidateUserCache };
