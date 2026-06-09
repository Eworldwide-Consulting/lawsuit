const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');
const { one, all, run } = require('../db');
const { isStaff }       = require('../domain/user');
const { ForbiddenError, NotFoundError, ValidationError } = require('../lib/errors');
const AuditService        = require('../services/audit.service');
const NotificationService = require('../services/notification.service');
const TaskRepo            = require('../repositories/task.repository');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png',
]);
const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);
const MAX_BYTES   = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) =>
      cb(null, `cl-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`),
  }),
  limits:     { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (ALLOWED_EXT.has(ext) && ALLOWED_MIME.has(mime)) return cb(null, true);
    cb(Object.assign(new Error('File type not allowed'), { status: 400 }), false);
  },
});

// ── Helper: verify the current user can access the given matter ─────────────
async function assertMatterAccess(matterId, user) {
  const matter = await one(`SELECT id, client_id, attorney_id, matter_type FROM matters WHERE id = ?`, [matterId]);
  if (!matter) throw new NotFoundError('Matter not found');
  if (!isStaff(user) && matter.client_id !== user.id) throw new ForbiddenError();
  return matter;
}

// ── Helper: ensure checklist items exist for a matter (lazy init) ───────────
async function ensureItems(matterId, matterType) {
  const existing = await all(
    `SELECT id FROM matter_checklist_items WHERE matter_id = ? LIMIT 1`, [matterId]
  );
  if (existing.length > 0) return;

  const templates = await all(
    `SELECT * FROM checklist_templates WHERE matter_type = ? ORDER BY section_order, item_order`,
    [matterType]
  );

  for (const t of templates) {
    await run(
      `INSERT INTO matter_checklist_items
         (matter_id, template_id, section, section_order, label, description, default_status, status, item_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [matterId, t.id, t.section, t.section_order, t.label, t.description,
       t.default_status, t.default_status, t.item_order]
    );
  }
}

// ── GET /api/checklists/matter/:matterId ────────────────────────────────────
// Returns all checklist items for a matter (grouped by section), creating them
// from template if this is the first access.
router.get('/matter/:matterId', requireAuth, async (req, res, next) => {
  try {
    const matter = await assertMatterAccess(req.params.matterId, req.user);
    await ensureItems(matter.id, matter.matter_type);

    const items = await all(
      `SELECT ci.*, u.first_name AS reviewer_first, u.last_name AS reviewer_last
       FROM matter_checklist_items ci
       LEFT JOIN users u ON u.id = ci.reviewed_by
       WHERE ci.matter_id = ?
       ORDER BY ci.section_order, ci.item_order`,
      [matter.id]
    );

    // Group into sections
    const sectionMap = {};
    for (const item of items) {
      if (!sectionMap[item.section]) {
        sectionMap[item.section] = { section: item.section, order: item.section_order, items: [] };
      }
      sectionMap[item.section].items.push(item);
    }
    const sections = Object.values(sectionMap).sort((a, b) => a.order - b.order);

    // Progress: accepted needed_now items / total needed_now items
    const neededNow = items.filter(i => i.default_status === 'needed_now');
    const accepted  = neededNow.filter(i => i.status === 'accepted');
    const progress  = neededNow.length > 0
      ? Math.round((accepted.length / neededNow.length) * 100)
      : 0;

    res.json({ matterType: matter.matter_type, sections, progress, totalItems: items.length });
  } catch (err) { next(err); }
});

// ── POST /api/checklists/items/:itemId/upload ───────────────────────────────
// Client uploads a file for a checklist item → status becomes 'submitted'
router.post('/items/:itemId/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const item = await one(`SELECT * FROM matter_checklist_items WHERE id = ?`, [req.params.itemId]);
    if (!item) throw new NotFoundError('Checklist item not found');

    const matter = await one(`SELECT * FROM matters WHERE id = ?`, [item.matter_id]);
    if (!matter) throw new NotFoundError('Matter not found');

    // Clients can only upload for their own matter; staff can upload for any
    if (!isStaff(req.user) && matter.client_id !== req.user.id) throw new ForbiddenError();

    // Reject if already accepted
    if (item.status === 'accepted') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({ error: 'Item already accepted' });
    }

    if (!req.file) throw new ValidationError('No file provided');

    // Remove old file if replacing
    if (item.file_path && fs.existsSync(item.file_path)) {
      fs.unlink(item.file_path, () => {});
    }

    await run(
      `UPDATE matter_checklist_items
       SET file_name = ?, file_path = ?, file_size = ?, file_mime = ?,
           status = 'submitted', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.file.originalname, req.file.path, req.file.size, req.file.mimetype, item.id]
    );

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.DOCUMENT_UPLOADED,
      entity: 'checklist_item', entityId: item.id,
      meta: { label: item.label, matterId: item.matter_id, fileName: req.file.originalname },
      ip: req.ip,
    });

    const updated = await one(`SELECT * FROM matter_checklist_items WHERE id = ?`, [item.id]);
    res.json(updated);
  } catch (err) { next(err); }
});

// ── PUT /api/checklists/items/:itemId/review ────────────────────────────────
// Attorney reviews an item: accept | needs_correction | not_applicable
router.put('/items/:itemId/review', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    const { action, correctionReason } = req.body;
    const VALID = ['accepted', 'needs_correction', 'not_applicable'];
    if (!VALID.includes(action)) throw new ValidationError(`action must be one of: ${VALID.join(', ')}`);
    if (action === 'needs_correction' && !correctionReason?.trim()) {
      throw new ValidationError('correctionReason is required when action is needs_correction');
    }

    const item = await one(`SELECT * FROM matter_checklist_items WHERE id = ?`, [req.params.itemId]);
    if (!item) throw new NotFoundError('Checklist item not found');

    const matter = await one(`SELECT * FROM matters WHERE id = ?`, [item.matter_id]);
    if (!matter) throw new NotFoundError('Matter not found');

    // Must have a file to accept or request correction
    if (action !== 'not_applicable' && !item.file_path) {
      throw new ValidationError('No file uploaded to review');
    }

    const notes = action === 'needs_correction' ? correctionReason.trim() : null;

    await run(
      `UPDATE matter_checklist_items
       SET status = ?, attorney_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [action, notes, req.user.id, item.id]
    );

    // Create an open task when correction is needed
    if (action === 'needs_correction') {
      const taskTitle = `Checklist correction needed: ${item.label.slice(0, 80)}`;
      await TaskRepo.create({
        matterId:    matter.id,
        assignedTo:  matter.client_id,
        title:       taskTitle,
        description: correctionReason.trim(),
        priority:    'high',
        dueDate:     null,
        actionLabel: 'Fix & Re-upload',
      });

      // Notify client
      NotificationService.create({
        userId:     matter.client_id,
        type:       'document_reviewed',
        title:      'Document needs correction',
        body:       `"${item.label.slice(0, 60)}" — ${correctionReason.trim().slice(0, 120)}`,
        entityType: 'checklist_item',
        entityId:   item.id,
      });
    }

    if (action === 'accepted') {
      NotificationService.create({
        userId:     matter.client_id,
        type:       'document_reviewed',
        title:      'Document accepted',
        body:       `Your document "${item.label.slice(0, 60)}" has been accepted.`,
        entityType: 'checklist_item',
        entityId:   item.id,
      });
    }

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.DOCUMENT_STATUS_CHANGED,
      entity: 'checklist_item', entityId: item.id,
      meta:   { label: item.label, reviewAction: action, matterId: matter.id },
      ip:     req.ip,
    });

    const updated = await one(
      `SELECT ci.*, u.first_name AS reviewer_first, u.last_name AS reviewer_last
       FROM matter_checklist_items ci
       LEFT JOIN users u ON u.id = ci.reviewed_by
       WHERE ci.id = ?`,
      [item.id]
    );
    res.json(updated);
  } catch (err) { next(err); }
});

// ── GET /api/checklists/review-queue ───────────────────────────────────────
// Attorney view: all submitted items across matters they manage, with
// matter context for the review panel.
router.get('/review-queue', requireAuth, requireRole('attorney', 'partner'), async (req, res, next) => {
  try {
    const items = await all(
      `SELECT ci.*,
              m.case_number, m.matter_type, m.title AS matter_title,
              u.first_name AS client_first, u.last_name AS client_last
       FROM matter_checklist_items ci
       JOIN matters m ON m.id = ci.matter_id
       JOIN users   u ON u.id = m.client_id
       WHERE ci.status = 'submitted'
       ORDER BY ci.updated_at DESC
       LIMIT 200`,
      []
    );
    res.json(items);
  } catch (err) { next(err); }
});

// ── GET /api/checklists/download/:itemId ───────────────────────────────────
// Stream the uploaded file for attorney review
router.get('/download/:itemId', requireAuth, async (req, res, next) => {
  try {
    const item = await one(`SELECT * FROM matter_checklist_items WHERE id = ?`, [req.params.itemId]);
    if (!item) throw new NotFoundError('Checklist item not found');
    if (!item.file_path) throw new NotFoundError('No file uploaded for this item');

    const matter = await one(`SELECT * FROM matters WHERE id = ?`, [item.matter_id]);
    if (!isStaff(req.user) && matter.client_id !== req.user.id) throw new ForbiddenError();

    if (!fs.existsSync(item.file_path)) throw new NotFoundError('File not found on disk');

    res.setHeader('Content-Disposition', `inline; filename="${item.file_name || 'document'}"`);
    res.setHeader('Content-Type', item.file_mime || 'application/octet-stream');
    fs.createReadStream(item.file_path).pipe(res);
  } catch (err) { next(err); }
});

// ── GET /api/checklists/templates/:matterType ──────────────────────────────
// Preview template items (no matter required) — used by attorney / onboarding
router.get('/templates/:matterType', requireAuth, async (req, res, next) => {
  try {
    const templates = await all(
      `SELECT * FROM checklist_templates WHERE matter_type = ? ORDER BY section_order, item_order`,
      [req.params.matterType]
    );
    res.json(templates);
  } catch (err) { next(err); }
});

module.exports = router;