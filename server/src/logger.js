const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

// Only use pino-pretty when explicitly in dev AND the package is installed.
// In production (or when NODE_ENV is unset) fall back to plain JSON so a
// missing devDependency never crashes the process.
const pinoPrettyAvailable = (() => {
  try { require.resolve('pino-pretty'); return true; } catch { return false; }
})();
const usePretty = !isProduction && pinoPrettyAvailable;

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(usePretty && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
  formatters: {
    level(label) { return { level: label }; },
  },
  base: { service: 'trivanta-api', env: process.env.NODE_ENV || 'production' },
  serializers: {
    req(req) {
      return { method: req.method, url: req.url, id: req.id };
    },
    err: pino.stdSerializers.err,
  },
});

module.exports = logger;
