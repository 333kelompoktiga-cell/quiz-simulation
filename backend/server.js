import './config/polyfills.js';
import { supabase, supabaseAdmin } from './config/db.js';
import authRoute from './routes/authRoute.js';
import accountRoute from './routes/accountRoute.js';
import babRoute from './routes/babRoute.js';
import kuisRoute from './routes/kuisRoute.js';
import soalRoute from './routes/soalRoute.js';
import profileRoute from './routes/profilRoute.js';
import pengerjaanRoute from './routes/pengerjaanRoute.js';
import soalImportRoute from './routes/soalImportRoute.js';
import roadmapRoute from './routes/roadmapRoute.js';
import rekapRoute from './routes/rekapRoute.js';

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();

// Di belakang proxy (Railway, Render, Nginx), IP asli ada di X-Forwarded-For.
// Tanpa ini pembatas percobaan login akan melihat semua orang sebagai satu IP.
// Sengaja tidak aktif secara default: mempercayai header itu sembarangan
// justru membuat batasannya bisa diakali.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

// CORS dibatasi ke alamat frontend yang dikenal. Sebelumnya cors() terbuka,
// artinya situs mana pun bisa memanggil API ini dari browser pengguna.
// BACKEND_URL ikut diizinkan karena halaman reset password dilayani oleh
// backend ini sendiri, lalu memanggil /api/auth/reset-password di origin
// yang sama. Tanpa ini permintaannya ditolak CORS-nya sendiri.
const originDiizinkan = [
  ...(process.env.FRONTEND_URLS || 'http://localhost:5173').split(','),
  process.env.BACKEND_URL || 'http://localhost:3000',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
]
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Permintaan tanpa origin berasal dari Postman, curl, atau aplikasi
      // non-browser. Itu tetap diizinkan supaya pengujian tidak terganggu.
      if (!origin || originDiizinkan.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin tidak diizinkan: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());

app.use('/api/auth', authRoute);
// ini kenapa ada 2 accountRoute? yang ada di AccountController.js itu khusus superadmin
// app.use('/api/', accountRoute);
app.use('/api/bab', babRoute);
app.use('/api/kuis', kuisRoute);
app.use('/api/soal', soalImportRoute, soalRoute);
app.use('/api/account', accountRoute);
app.use('/api/profile', profileRoute);
app.use('/api/pengerjaan', pengerjaanRoute);
app.use('/api/peta-belajar', roadmapRoute);
app.use('/api/rekap', rekapRoute);

app.get('/health', async (_, res) => {
  try {
    // pakai `supabase` (anon key) untuk health check publik — bukan supabaseAdmin
    const { error } = await supabase.from('User').select('idUser').limit(1);

    if (error) throw error;

    res.status(200).json({
      status: 'ok',
      message: 'Server dan database berjalan normal.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Server hidup, tetapi koneksi database bermasalah.',
      ...(process.env.NODE_ENV !== 'production' && { error: error.message }),
    });
  }
});

const PORT = process.env.PORT || 3000;
const NETWORK_IP = '192.168.100.56';

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
  console.log('Server eKuis Backend berjalan di:');
  console.log(`- Local: http://localhost:${PORT}`);
  console.log(`- Network/HP: http://${NETWORK_IP}:${PORT}`);
});
}

export default app;
