const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
  formatters: {
    level(label) { return { level: label }; },
  },
  base: { service: 'trivanta-api', env: process.env.NODE_ENV || 'development' },
  serializers: {
    req(req) {
      return { method: req.method, url: req.url, id: req.id };
    },
    err: pino.stdSerializers.err,
  },
});

module.exports = logger;
