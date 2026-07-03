const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');
const DocumentRepo = require('../repositories/document.repository');
const MatterRepo   = require('../repositories/matter.repository');
const { ALLOWED_EXTENSIONS, DOCUMENT_STATUSES, MAX_FILE_BYTES } = require('../domain/document');
const { parsePagination } = require('../lib/pagination');
const { isStaff } = require('../domain/user');
const { NotFoundError, ForbiddenError, ValidationError } = require('../lib/errors');
const NotificationService = require('../services/notification.service');
const AuditService        = require('../services/audit.service');
const EmailService        = require('../services/email.service');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// H4: whitelist both extension AND declared MIME type.
// Extension-only checks can be bypassed by renaming files (e.g. payload.php → payload.pdf).
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`),
  }),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIME.has(mime)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('File type not allowed'), { status: 400 }), false);
    }
  },
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { matterId } = req.query;
    const pagination   = parsePagination(req.query);

    if (matterId) {
      if (req.user.role === 'client') {
        const matter = await MatterRepo.findById(matterId);
        if (!matter || matter.client_id !== req.user.id) throw new ForbiddenError();
      }
      return res.json(await DocumentRepo.findByMatter(matterId, pagination));
    }

    if (req.user.role === 'client') {
      const matterRows = await MatterRepo.idsByClientId(req.user.id);
      // Include documents from the client's matters AND any they uploaded directly
      // (matter_id=null) — those are uploaded via the Documents page without a matter.
      return res.json(
        await DocumentRepo.findByClientAll(req.user.id, matterRows.map(m => m.id), pagination)
      );
    }

    res.json(await DocumentRepo.findAll(pagination));
  } catch (err) { next(err); }
});

router.post('/upload', requireAuth, upload.array('files', 10), async (req, res, next) => {
  try {
    const { matterId, category, docType } = req.body;

    if (matterId && req.user.role === 'client') {
      const matter = await MatterRepo.findById(matterId);
      if (!matter || matter.client_id !== req.user.id) throw new ForbiddenError();
    }

    const inserted = await Promise.all(
      req.files.map(f => DocumentRepo.create({
        matterId, userId: req.user.id,
        name: f.originalname, category, docType,
        filename: f.filename, size: f.size,
      }))
    );

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.DOCUMENT_UPLOADED,
      entity: 'document', entityId: inserted[0]?.id,
      meta: { count: inserted.length, matterId: matterId || null },
      ip: req.ip,
    });

    // Uploads land as status='uploaded' — not yet visible to the attorney.
    // The client must explicitly submit via POST /:id/submit-review below.
    res.status(201).json(inserted);
  } catch (err) { next(err); }
});

// Client explicitly submits an uploaded document for attorney review/approval.
// Moves status 'uploaded' → 'pending', which surfaces it in /pending-review
// and the attorney's Document Review (approval) panel.
router.post('/:id/submit-review', requireAuth, async (req, res, next) => {
  try {
    const doc = await DocumentRepo.findById(req.params.id);
    if (!doc) throw new NotFoundError('Document');
    if (doc.user_id !== req.user.id) throw new ForbiddenError();
    if (doc.status !== 'uploaded')
      return res.status(400).json({ error: 'Only newly uploaded documents can be sent for review.' });
    if (!doc.matter_id)
      return res.status(400).json({ error: 'This document is not linked to a case, so it cannot be sent for attorney review.' });

    const matter = await MatterRepo.findById(doc.matter_id);
    if (!matter?.attorney_id)
      return res.status(400).json({ error: 'Your case does not have an attorney assigned yet. Please contact support.' });

    await DocumentRepo.updateStatus(doc.id, 'pending');

    const { one: dbOne } = require('../db');
    const attorney = await dbOne(
      'SELECT id, first_name, last_name, email FROM users WHERE id = ?',
      [matter.attorney_id]
    );
    const uploaderName = `${req.user.first_name} ${req.user.last_name}`.trim();

    if (attorney) {
      NotificationService.create({
        userId:     attorney.id,
        type:       'document_uploaded',
        title:      'Document submitted for review',
        body:       `${uploaderName} submitted "${doc.name}" for review on case ${matter.case_number || `#${doc.matter_id}`} — approval required.`,
        entityType: 'document',
        entityId:   doc.id,
      });

      try {
        EmailService.sendDocumentUploaded(attorney.email, {
          attorneyName: attorney.first_name,
          clientName:   uploaderName,
          caseNumber:   matter.case_number || `Matter #${doc.matter_id}`,
          docNames:     [doc.name],
          reviewUrl:    `${require('../config').client.url}/dashboard`,
        });
      } catch { /* non-fatal */ }
    }

    AuditService.log({
      userId: req.user.id, action: 'document.submitted_for_review',
      entity: 'document', entityId: doc.id,
      meta: { docName: doc.name, matterId: doc.matter_id },
      ip: req.ip,
    });

    res.json({ success: true, status: 'pending' });
  } catch (err) { next(err); }
});

// Documents pending attorney review — all docs from this attorney's clients with status='pending'
router.get('/pending-review', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  try {
    const { all: dbAll } = require('../db');
    const docs = await dbAll(
      `SELECT d.*,
              (u.first_name || ' ' || u.last_name) AS client_name,
              u.email AS client_email,
              u.avatar_initials AS client_initials,
              m.case_number, m.matter_type
       FROM documents d
       LEFT JOIN users  u ON u.id = d.user_id
       LEFT JOIN matters m ON m.id = d.matter_id
       WHERE d.status = 'pending'
         AND m.attorney_id = ?
       ORDER BY d.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ documents: docs, count: docs.length });
  } catch (err) { next(err); }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await DocumentRepo.findById(req.params.id);
    if (!doc) throw new NotFoundError('Document');
    if (doc.user_id !== req.user.id && !isStaff(req.user.role))
      throw new ForbiddenError();
    const { name, category } = req.body;
    if (!name?.trim()) throw new ValidationError('name required');
    await DocumentRepo.update(req.params.id, { name: name.trim(), category: category || null });
    res.json(await DocumentRepo.findById(req.params.id));
  } catch (err) { next(err); }
});

router.put('/:id/status', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res, next) => {
  try {
    if (!DOCUMENT_STATUSES.includes(req.body.status))
      throw new ValidationError(`status must be one of: ${DOCUMENT_STATUSES.join(', ')}`);
    const doc = await DocumentRepo.findById(req.params.id);
    if (!doc) throw new NotFoundError('Document');
    await DocumentRepo.updateStatus(req.params.id, req.body.status);

    // Notify the document owner (may be the client)
    if (doc.user_id && doc.user_id !== req.user.id) {
      NotificationService.documentReviewed(doc.user_id, {
        docName: doc.name,
        status:  req.body.status,
        matterId: doc.matter_id,
      });
    }

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.DOCUMENT_STATUS_CHANGED,
      entity: 'document', entityId: req.params.id,
      meta: { status: req.body.status, docName: doc.name },
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await DocumentRepo.findById(req.params.id);
    if (!doc) throw new NotFoundError('Document');
    if (doc.user_id !== req.user.id && !isStaff(req.user.role))
      throw new ForbiddenError();

    if (doc.file_path) {
      const fp = path.join(UPLOAD_DIR, path.basename(doc.file_path));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await DocumentRepo.delete(req.params.id);

    AuditService.log({
      userId: req.user.id, action: AuditService.ACTIONS.DOCUMENT_DELETED,
      entity: 'document', entityId: req.params.id,
      meta: { docName: doc.name },
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Inline view — browser renders PDF/images directly; DOCX falls back to download
router.get('/view/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await DocumentRepo.findByIdWithMatter(req.params.id);
    if (!doc?.file_path) throw new NotFoundError('File');

    const isOwner = doc.user_id === req.user.id || doc.client_id === req.user.id;
    if (!isOwner && !isStaff(req.user.role)) throw new ForbiddenError();

    const filePath = path.join(UPLOAD_DIR, path.basename(doc.file_path));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

router.get('/download/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await DocumentRepo.findByIdWithMatter(req.params.id);
    if (!doc?.file_path) throw new NotFoundError('File');

    const isOwner = doc.user_id === req.user.id || doc.client_id === req.user.id;
    if (!isOwner && !isStaff(req.user.role)) throw new ForbiddenError();

    res.download(path.join(UPLOAD_DIR, path.basename(doc.file_path)), doc.name);
  } catch (err) { next(err); }
});

module.exports = router;