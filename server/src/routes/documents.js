const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`),
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const { matterId } = req.query;
  let docs;
  if (matterId) {
    docs = db.prepare('SELECT * FROM documents WHERE matter_id = ? ORDER BY created_at DESC').all(matterId);
  } else if (req.user.role === 'client') {
    docs = db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  } else {
    docs = db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all();
  }
  res.json(docs);
});

router.post('/upload', requireAuth, upload.array('files', 10), (req, res) => {
  const { matterId, category, docType } = req.body;
  const db = getDb();
  const inserted = req.files.map(f => {
    const result = db.prepare(`
      INSERT INTO documents (matter_id, user_id, name, category, doc_type, file_path, file_size, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')
    `).run(matterId || null, req.user.id, f.originalname, category || null, docType || null, f.filename, f.size);
    return db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
  });
  res.status(201).json(inserted);
});

router.put('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const db = getDb();
  db.prepare('UPDATE documents SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (doc.file_path) {
    const fp = path.join(UPLOAD_DIR, doc.file_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/download/:id', requireAuth, (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc || !doc.file_path) return res.status(404).json({ error: 'File not found' });
  res.download(path.join(UPLOAD_DIR, doc.file_path), doc.name);
});

module.exports = router;
