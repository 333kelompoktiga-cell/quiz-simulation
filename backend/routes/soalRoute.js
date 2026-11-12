// routes/soalRoute.js
import express from 'express';
import multer from 'multer';
import {
  getAllSoal, getSoalById, createSoal, updateSoal, deleteSoal, uploadGambarSoal,
} from '../controllers/SoalController.js';
import { verifyLoggedIn } from '../middleware/verifyLoggedIn.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { UKURAN_MAKS_GAMBAR } from '../services/gambarSoalService.js';
import { errorResponse } from '../models/apiResponse.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UKURAN_MAKS_GAMBAR, files: 1 },
}).single('gambar');

const middlewareUploadGambar = (req, res, next) => {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file gambar maksimal 5 MB.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Kirim satu file pada field "gambar".'
          : err.message;
      return res.status(400).json(errorResponse({ message }));
    }
    return res.status(400).json(errorResponse({ message: err.message || 'Gagal membaca file gambar.' }));
  });
};

const router = express.Router();

// Endpoint upload gambar soal ke Supabase Storage
router.post('/upload-gambar', verifyLoggedIn, verifyAdmin, middlewareUploadGambar, uploadGambarSoal);

// Khusus dosen: mahasiswa mendapat soal lewat POST /api/pengerjaan setelah lolos PIN
router.get('/', verifyLoggedIn, verifyAdmin, getAllSoal);
router.get('/:id', verifyLoggedIn, verifyAdmin, getSoalById);
router.post('/', verifyLoggedIn, verifyAdmin, createSoal);
router.put('/:id', verifyLoggedIn, verifyAdmin, updateSoal);
router.delete('/:id', verifyLoggedIn, verifyAdmin, deleteSoal);

export default router;
