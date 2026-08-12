// Audit logging — never blocks a request. All writes are queued and
// processed asynchronously so audit I/O cannot add latency to API calls.

const { getQueue, QUEUE_NAMES } = require('../queue');
const { run } = require('../db');
const logger  = require('../logger');

// All known action strings — exhaustive enum prevents typo drift.
const ACTIONS = {
  // Auth
  USER_REGISTERED:        'user.registered',
  USER_LOGIN:             'user.login',
  USER_LOGIN_FAILED:      'user.login_failed',
  USER_LOGOUT:            'user.logout',
  USER_PASSWORD_CHANGED:  'user.password_changed',
  USER_2FA_ENABLED:       'user.2fa_enabled',
  USER_EMAIL_VERIFIED:    'user.email_verified',
  // Admin
  ADMIN_APPROVE_USER:     'admin.approve_user',
  ADMIN_REJECT_USER:      'admin.reject_user',
  ADMIN_FORCE_VERIFY:     'admin.force_verify',
  ADMIN_RESEND_VERIFY:    'admin.resend_verify',
  ADMIN_SUSPEND_USER:     'admin.suspend_user',
  ADMIN_REACTIVATE_USER:  'admin.reactivate_user',
  ADMIN_DELETE_USER:      'admin.delete_user',
  // Matter
  MATTER_CREATED:         'matter.created',
  MATTER_UPDATED:         'matter.updated',
  MATTER_STAGE_CHANGED:   'matter.stage_changed',
  // Document
  DOCUMENT_UPLOADED:      'document.uploaded',
  DOCUMENT_STATUS_CHANGED:'document.status_changed',
  DOCUMENT_DELETED:       'document.deleted',
  // Message
  MESSAGE_SENT:           'message.sent',
  MESSAGE_READ:           'message.read',
  // Payment
  INVOICE_CREATED:        'invoice.created',
  INVOICE_PAID:           'invoice.paid',
  // Task
  TASK_CREATED:           'task.created',
  TASK_STATUS_CHANGED:    'task.status_changed',
};

const JOB_NAME = 'write_audit';

// Queue an audit entry — fire and forget
function log({ userId, action, entity, entityId, meta, ip }) {
  return getQueue(QUEUE_NAMES.AUDIT).add(JOB_NAME, {
    userId,
    action,
    entity:    entity    || null,
    entityId:  entityId  || null,
    meta:      meta      ? JSON.stringify(meta) : null,
    ip:        ip        || null,
    createdAt: new Date().toISOString(),
  });
}

// Called by the audit worker to flush a job to the DB
async function processJob(job) {
  const d = job.data;
  try {
    await run(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, meta, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [d.userId, d.action, d.entity, d.entityId, d.meta, d.ip, d.createdAt]
    );
  } catch (err) {
    // Audit failure must never crash the app — log and swallow
    logger.error({ err, action: d.action }, 'Audit write failed');
  }
}

module.exports = { ACTIONS, log, processJob, JOB_NAME };