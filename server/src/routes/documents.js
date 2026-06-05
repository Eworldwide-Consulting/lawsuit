const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { all, one, run }      = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { inList, parsePagination }  = require('../utils');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`),
  }),
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    cb(null, ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())),
});

// ── List ──────────────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const { matterId } = req.query;
    const { limit, offset } = parsePagination(req.query);

    if (matterId) {
      // Scope check: clients can only see docs for their own matters
      if (req.user.role === 'client') {
        const matter = await one('SELECT client_id FROM matters WHERE id = ?', [matterId]);
        if (!matter || matter.client_id !== req.user.id)
          return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json(
        await all(
          'SELECT * FROM documents WHERE matter_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
          [matterId, limit, offset]
        )
      );
    }

    if (req.user.role === 'client') {
      const matterRows = await all('SELECT id FROM matters WHERE client_id = ?', [req.user.id]);
      if (!matterRows.length) return res.json([]);
      const ids = matterRows.map((m) => m.id);
      return res.json(
        await all(
          `SELECT * FROM documents WHERE matter_id IN (${inList(ids)}) ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [...ids, limit, offset]
        )
      );
    }

    res.json(
      await all('SELECT * FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset])
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Upload ────────────────────────────────────────────────────────────────────

router.post('/upload', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const { matterId, category, docType } = req.body;

    // Verify the client owns this matter before attaching documents
    if (matterId && req.user.role === 'client') {
      const matter = await one('SELECT client_id FROM matters WHERE id = ?', [matterId]);
      if (!matter || matter.client_id !== req.user.id)
        return res.status(403).json({ error: 'Forbidden' });
    }

    const inserted = [];
    for (const f of req.files) {
      const r = await run(
        'INSERT INTO documents (matter_id, user_id, name, category, doc_type, file_path, file_size, status) VALUES (?,?,?,?,?,?,?,?)',
        [matterId || null, req.user.id, f.originalname, category || null, docType || null, f.filename, f.size, 'uploaded']
      );
      inserted.push(await one('SELECT * FROM documents WHERE id = ?', [r.insertId]));
    }

    res.status(201).json(inserted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Status update — attorneys/partners only ───────────────────────────────────

router.put('/:id/status', requireAuth, requireRole('attorney', 'partner', 'itsupport'), async (req, res) => {
  try {
    const VALID_STATUSES = ['pending', 'uploaded', 'approved', 'rejected'];
    if (!VALID_STATUSES.includes(req.body.status))
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });

    const doc = await one('SELECT id FROM documents WHERE id = ?', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    await run('UPDATE documents SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete — owner or attorney/partner ───────────────────────────────────────

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await one('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // Clients can only delete their own uploads; staff can delete any
    const isOwner = doc.user_id === req.user.id;
    const isStaff = ['attorney', 'partner', 'itsupport'].includes(req.user.role);
    if (!isOwner && !isStaff)
      return res.status(403).json({ error: 'Forbidden' });

    if (doc.file_path) {
      const fp = path.join(UPLOAD_DIR, doc.file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }

    await run('DELETE FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Download — must own the matter or be staff ────────────────────────────────

router.get('/download/:id', requireAuth, async (req, res) => {
  try {
    const doc = await one(
      `SELECT d.*, m.client_id FROM documents d LEFT JOIN matters m ON d.matter_id = m.id WHERE d.id = ?`,
      [req.params.id]
    );
    if (!doc?.file_path) return res.status(404).json({ error: 'File not found' });

    const isOwner = doc.user_id === req.user.id || doc.client_id === req.user.id;
    const isStaff = ['attorney', 'partner', 'itsupport'].includes(req.user.role);
    if (!isOwner && !isStaff)
      return res.status(403).json({ error: 'Forbidden' });

    res.download(path.join(UPLOAD_DIR, doc.file_path), doc.name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
