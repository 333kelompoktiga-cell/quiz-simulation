import { verifyLoggedIn } from '../middleware/verifyLoggedIn.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
// routes/soalImport.routes.js
import express from 'express';
import multer from 'multer';
import { importSoalFromPdf } from '../controllers/SoalImportController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Hanya file PDF yang diperbolehkan.'));
    }
    cb(null, true);
  },
});

// POST /api/soal/import-pdf
router.post('/import-pdf', verifyLoggedIn, verifyAdmin, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, importSoalFromPdf);

export default router;