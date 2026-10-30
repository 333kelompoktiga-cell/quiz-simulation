import { sessionId } from '../utils/loginSession.js';
// middleware/verifyLoggedIn.js
import { supabase, supabaseAdmin } from '../config/db.js';
import { errorResponse } from '../models/apiResponse.js';

export const verifyLoggedIn = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json(errorResponse({ message: 'Token akses tidak ditemukan.' }));
    }

    // 1. Verifikasi token ke Supabase Auth
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      return res.status(401).json(errorResponse({ message: 'Token tidak valid atau sudah kedaluwarsa.' }));
    }

    // 2. Ambil profil dari public."User"
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('User')
      .select('idUser, nama, username, role, fotoProfil')
      .eq('idUser', userData.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json(errorResponse({ message: 'Profil pengguna tidak ditemukan.' }));
    }

    // 3. Pastikan ada sesi aktif — lastLogin terisi dan logoutTime masih NULL
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('SessionLogin')
      .select('lastLogin, logoutTime, sessionId')
      .eq('idAkun', userData.user.id)
      .maybeSingle();

    if (sessionError) {
      return res.status(500).json(errorResponse({ message: sessionError.message || 'Gagal memeriksa status sesi.' }));
    }

    if (!session || !session.lastLogin || session.logoutTime !== null || !sessionId(token) || session.sessionId !== sessionId(token)) {
      return res.status(401).json(errorResponse({ message: 'Sesi tidak aktif. Silakan login terlebih dahulu.' }));
    }

    req.currentUser = { id: userData.user.id, email: userData.user.email, ...profile };
    next();
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal memverifikasi sesi.' }));
  }
};