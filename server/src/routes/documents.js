const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf','.doc','.docx','.jpg','.jpeg','.png'].includes(path.extname(file.originalname).toLowerCase());
    cb(null, ok);
  },
});

router.get('/', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { matterId } = req.query;
    if (matterId) {
      return res.json(db.prepare('SELECT * FROM documents WHERE matter_id=? ORDER BY created_at DESC').all(matterId));
    }
    if (req.user.role === 'client') {
      const ids = db.prepare('SELECT id FROM matters WHERE client_id=?').all(req.user.id).map(m => m.id);
      if (!ids.length) return res.json([]);
      return res.json(db.prepare(`SELECT * FROM documents WHERE matter_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_at DESC`).all(...ids));
    }
    res.json(db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/upload', requireAuth, upload.array('files', 10), (req, res) => {
  try {
    const { matterId, category, docType } = req.body;
    const db      = getDb();
    const inserted = req.files.map(f => {
      const r = db.prepare('INSERT INTO documents (matter_id,user_id,name,category,doc_type,file_path,file_size,status) VALUES (?,?,?,?,?,?,?,?)')
        .run(matterId||null, req.user.id, f.originalname, category||null, docType||null, f.filename, f.size, 'uploaded');
      return db.prepare('SELECT * FROM documents WHERE id=?').get(r.lastInsertRowid);
    });
    res.status(201).json(inserted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/status', requireAuth, (req, res) => {
  try {
    getDb().prepare('UPDATE documents SET status=? WHERE id=?').run(req.body.status, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db  = getDb();
    const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.file_path) {
      const fp = path.join(UPLOAD_DIR, doc.file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/download/:id', requireAuth, (req, res) => {
  try {
    const doc = getDb().prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
    if (!doc || !doc.file_path) return res.status(404).json({ error: 'File not found' });
    res.download(path.join(UPLOAD_DIR, doc.file_path), doc.name);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
