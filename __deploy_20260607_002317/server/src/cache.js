const Redis = require('ioredis');
const logger = require('./logger');

// undefined = not yet initialized; null = no Redis configured; Redis instance = connected
let client = undefined;
const memStore = new Map();

function connect() {
  if (!process.env.REDIS_URL) {
    logger.info('No REDIS_URL set — using in-memory cache (single-instance only)');
    return null;
  }
  const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true,
  });
  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error({ err }, 'Redis error'));
  return redis;
}

function getClient() {
  if (client !== undefined) return client;
  client = connect();
  return client;
}

async function get(key) {
  const redis = getClient();
  if (redis) {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  }
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.ttl && Date.now() > entry.ttl) { memStore.delete(key); return null; }
  return entry.value;
}

async function set(key, value, ttlSeconds = 300) {
  const redis = getClient();
  if (redis) {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return;
  }
  memStore.set(key, { value, ttl: Date.now() + ttlSeconds * 1000 });
}

async function del(key) {
  const redis = getClient();
  if (redis) { await redis.del(key); return; }
  memStore.delete(key);
}

async function delPattern(pattern) {
  const redis = getClient();
  if (redis) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(keys);
    return;
  }
  const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const k of memStore.keys()) { if (re.test(k)) memStore.delete(k); }
}

async function healthCheck() {
  const redis = getClient();
  if (!redis) return { status: 'memory', latency: 0 };
  const start = Date.now();
  await redis.ping();
  return { status: 'redis', latency: Date.now() - start };
}

module.exports = { get, set, del, delPattern, healthCheck, getClient };
