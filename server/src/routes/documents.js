const router   = require('express').Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const supabase = require('../supabase');
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
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { matterId } = req.query;
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });

    if (matterId) {
      query = query.eq('matter_id', matterId);
    } else if (req.user.role === 'client') {
      const { data: matters } = await supabase
        .from('matters').select('id').eq('client_id', req.user.id);
      const ids = (matters || []).map(m => m.id);
      if (!ids.length) return res.json([]);
      query = query.in('matter_id', ids);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const { matterId, category, docType } = req.body;
    const inserted = await Promise.all(req.files.map(async f => {
      const { data } = await supabase
        .from('documents')
        .insert({
          matter_id: matterId || null,
          user_id:   req.user.id,
          name:      f.originalname,
          category:  category || null,
          doc_type:  docType  || null,
          file_path: f.filename,
          file_size: f.size,
          status:    'uploaded',
        })
        .select()
        .single();
      return data;
    }));
    res.status(201).json(inserted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('documents').update({ status: req.body.status }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data: doc } = await supabase
      .from('documents').select('*').eq('id', req.params.id).maybeSingle();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.file_path) {
      const fp = path.join(UPLOAD_DIR, doc.file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await supabase.from('documents').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:id', requireAuth, async (req, res) => {
  try {
    const { data: doc } = await supabase
      .from('documents').select('*').eq('id', req.params.id).maybeSingle();
    if (!doc || !doc.file_path) return res.status(404).json({ error: 'File not found' });
    res.download(path.join(UPLOAD_DIR, doc.file_path), doc.name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
