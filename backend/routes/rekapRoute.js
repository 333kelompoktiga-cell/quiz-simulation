// routes/rekapRoute.js
import express from 'express';
import { getRekapDaftarKuis, getRekapKuis, getRekapPengerjaan } from '../controllers/RekapController.js';
import { verifyLoggedIn } from '../middleware/verifyLoggedIn.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';

const router = express.Router();

// Khusus dosen. Hak lihat per kuis sama dengan hak kelola (bisaDikelola).
router.use(verifyLoggedIn, verifyAdmin);
router.get('/kuis', getRekapDaftarKuis);
router.get('/kuis/:idKuis', getRekapKuis);
router.get('/pengerjaan/:idPengerjaan', getRekapPengerjaan);

export default router;
