const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { all, one, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g,'_')}`),
  }),
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB)||20)*1024*1024 },
  fileFilter: (req, file, cb) => cb(null, ['.pdf','.doc','.docx','.jpg','.jpeg','.png'].includes(path.extname(file.originalname).toLowerCase())),
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { matterId } = req.query;
    if (matterId) return res.json(await all('SELECT * FROM documents WHERE matter_id=? ORDER BY created_at DESC', [matterId]));
    if (req.user.role === 'client') {
      const ids = (await all('SELECT id FROM matters WHERE client_id=?', [req.user.id])).map(m => m.id);
      if (!ids.length) return res.json([]);
      return res.json(await all(`SELECT * FROM documents WHERE matter_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_at DESC`, ids));
    }
    res.json(await all('SELECT * FROM documents ORDER BY created_at DESC'));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/upload', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const { matterId, category, docType } = req.body;
    const inserted = [];
    for (const f of req.files) {
      const r = await run('INSERT INTO documents (matter_id,user_id,name,category,doc_type,file_path,file_size,status) VALUES (?,?,?,?,?,?,?,?)',
        [matterId||null, req.user.id, f.originalname, category||null, docType||null, f.filename, f.size, 'uploaded']);
      inserted.push(await one('SELECT * FROM documents WHERE id=?', [r.insertId]));
    }
    res.status(201).json(inserted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    await run('UPDATE documents SET status=? WHERE id=?', [req.body.status, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await one('SELECT * FROM documents WHERE id=?', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.file_path) { const fp = path.join(UPLOAD_DIR, doc.file_path); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    await run('DELETE FROM documents WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/download/:id', requireAuth, async (req, res) => {
  try {
    const doc = await one('SELECT * FROM documents WHERE id=?', [req.params.id]);
    if (!doc?.file_path) return res.status(404).json({ error: 'File not found' });
    res.download(path.join(UPLOAD_DIR, doc.file_path), doc.name);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
