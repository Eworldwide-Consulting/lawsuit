// Daily sweep: emails a client when their active, attorney-accepted matter
// still has required ("needed_now") checklist items that haven't been
// uploaded yet — the thing dragging their Matter Readiness score down.
// Throttled to at most one reminder per matter every REMINDER_INTERVAL_DAYS
// via matters.last_doc_reminder_sent_at (see migration 014).
const { all, run } = require('../db');
const EmailService  = require('../services/email.service');
const logger         = require('../logger');

const REMINDER_INTERVAL_DAYS = 3;
const SWEEP_INTERVAL_MS      = 24 * 60 * 60 * 1000; // once a day
const INITIAL_DELAY_MS       = 60 * 1000;            // let the rest of boot settle first

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function sweepOnce() {
  const threshold = new Date(Date.now() - REMINDER_INTERVAL_DAYS * 86400000)
    .toISOString().slice(0, 19).replace('T', ' ');

  const matters = await all(
    `SELECT m.id, m.case_number,
            c.first_name AS client_first_name, c.email AS client_email
     FROM matters m
     JOIN users c ON c.id = m.client_id
     WHERE m.case_accepted = 1
       AND m.status IN ('active', 'at_risk')
       AND (m.last_doc_reminder_sent_at IS NULL OR m.last_doc_reminder_sent_at < ?)`,
    [threshold]
  );

  for (const matter of matters) {
    try {
      if (!matter.client_email) continue;

      const items = await all(
        `SELECT label, status, default_status FROM matter_checklist_items WHERE matter_id = ?`,
        [matter.id]
      );
      const missing = items.filter(
        i => i.default_status === 'needed_now' && !['submitted', 'accepted'].includes(i.status)
      );
      if (missing.length === 0) continue;

      await EmailService.sendDocumentUploadReminder(matter.client_email, {
        firstName:     matter.client_first_name,
        caseNumber:    matter.case_number,
        missingCount:  missing.length,
        missingLabels: missing.map(i => i.label),
      });

      await run('UPDATE matters SET last_doc_reminder_sent_at = ? WHERE id = ?', [nowSql(), matter.id]);
    } catch (err) {
      logger.error({ matterId: matter.id, err }, 'Document reminder sweep failed for matter');
    }
  }

  return matters.length;
}

function startDocumentReminderSweep() {
  setTimeout(() => {
    sweepOnce().catch(err => logger.error({ err }, 'Document reminder sweep crashed'));
    setInterval(() => {
      sweepOnce().catch(err => logger.error({ err }, 'Document reminder sweep crashed'));
    }, SWEEP_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

module.exports = { startDocumentReminderSweep, sweepOnce };
