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

    res.status(201).json(inserted);
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