const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const router = express.Router();

const iconsDir = path.resolve(__dirname, '..', '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/avif'];
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.avif']);

const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, iconsDir); },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return cb(new Error('Extensión de archivo no permitida'));
    }
    const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8) + ext;
    cb(null, name);
  }
});

function fileFilter(req, file, cb) {
  if (allowedMimeTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipo de archivo no permitido'), false);
}

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const filename = req.file.filename;
  res.json({ filename, url: `/icons/${filename}` });
});

router.delete('/:filename', (req, res) => {
  const name = req.params.filename;
  // prevent path traversal
  if (name.includes('..') || name.includes('/') || name.includes('\\') || path.basename(name) !== name) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const ext = path.extname(name).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    return res.status(400).json({ error: 'Invalid filename extension' });
  }
  const filePath = path.join(iconsDir, name);
  fs.unlink(filePath, (err) => {
    if (err) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  });
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload error' });
  }
  next();
});

module.exports = router;
