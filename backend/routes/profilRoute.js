// routes/profileRoute.js
import express from 'express';
import { updateFotoProfil, deleteFotoProfil, getProfilSaya } from '../controllers/ProfilController.js';
import { verifyLoggedIn } from '../middleware/verifyLoggedIn.js';
import { verifyMahasiswa } from '../middleware/verifyMahasiswa.js';
import { uploadFoto } from '../middleware/uploadFoto.js';

const router = express.Router();

router.use(verifyLoggedIn);

// Data akun (bergabung, terakhir masuk) dibaca halaman Akun saya, yang juga
// dipakai Admin dan Super Admin. Jadi endpoint ini terbuka untuk semua role.
router.get('/', getProfilSaya);

// Foto profil tetap hanya untuk mahasiswa
router.put('/foto', verifyMahasiswa, uploadFoto, updateFotoProfil);
router.delete('/foto', verifyMahasiswa, deleteFotoProfil);

export default router;
