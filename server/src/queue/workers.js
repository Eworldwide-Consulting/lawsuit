// Starts all background workers. Called once at boot from index.js.
// Each worker pulls jobs from its queue and processes them with retry + backoff.

const { createWorker, QUEUE_NAMES } = require('./index');
const EmailService        = require('../services/email.service');
const AuditService        = require('../services/audit.service');
const logger              = require('../logger');

function startWorkers() {
  // Email worker — concurrency 3 so SMTP isn't flooded
  const emailWorker = createWorker(QUEUE_NAMES.EMAIL, job => EmailService.processJob(job), { concurrency: 3 });
  emailWorker.on('completed', job => logger.debug({ job: job.name }, 'Email job done'));
  emailWorker.on('failed',    (job, err) => logger.error({ job: job.name, err }, 'Email job failed'));

  // Audit worker — single-threaded to keep write order predictable
  const auditWorker = createWorker(QUEUE_NAMES.AUDIT, job => AuditService.processJob(job), { concurrency: 1 });
  auditWorker.on('failed', (job, err) => logger.error({ job: job.name, err }, 'Audit job failed'));

  // Notification worker — no secondary processing yet; placeholder for future email digests
  const notifWorker = createWorker(QUEUE_NAMES.NOTIFICATION, async () => {}, { concurrency: 5 });
  notifWorker.on('failed', (job, err) => logger.error({ job: job.name, err }, 'Notification job failed'));

  logger.info('Queue workers started');
  return { emailWorker, auditWorker, notifWorker };
}

module.exports = { startWorkers };