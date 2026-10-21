// routes/kuisRoute.js
import express from 'express';
import {
  getDosenPengelola, updateAksesKuis, getAllKuis, getKuisById, createKuis, updateKuis, deleteKuis,
} from '../controllers/KuisController.js';
import { getSoalKuis, simpanSoalKuis } from '../controllers/SoalController.js';
import { verifyLoggedIn } from '../middleware/verifyLoggedIn.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';

const router = express.Router();

router.get('/', verifyLoggedIn, getAllKuis);
router.get('/dosen-pengelola', verifyLoggedIn, verifyAdmin, getDosenPengelola);
router.put('/:id/akses', verifyLoggedIn, verifyAdmin, updateAksesKuis);
router.get('/:id', verifyLoggedIn, getKuisById);
router.post('/', verifyLoggedIn, verifyAdmin, createKuis);
router.put('/:id', verifyLoggedIn, verifyAdmin, updateKuis);
router.delete('/:id', verifyLoggedIn, verifyAdmin, deleteKuis);

// Soal satu kuis sekaligus — dipakai halaman editor soal di frontend.
// Khusus dosen: mahasiswa mendapat soal lewat POST /api/pengerjaan setelah lolos PIN.
router.get('/:idKuis/soal', verifyLoggedIn, verifyAdmin, getSoalKuis);
router.put('/:idKuis/soal', verifyLoggedIn, verifyAdmin, simpanSoalKuis);

export default router;
