const config = require('../config');

module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) req.log?.error({ err, requestId: req.id }, 'Unhandled error');
  res.status(status).json({
    error: config.isProduction && status >= 500 ? 'Internal server error' : err.message,
    requestId: req.id,
  });
};