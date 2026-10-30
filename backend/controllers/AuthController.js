import { sessionId } from '../utils/loginSession.js';
import { supabase, supabaseAdmin } from '../config/db.js';
import { successResponse, errorResponse } from '../models/apiResponse.js';
import { urlFotoProfil } from '../services/fotoProfilService.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const validPassword = (password) => {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[@#$!_\-]/.test(password);
  return minLength && hasUpper && hasLower && hasDigit && hasSpecial;
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(
        errorResponse({ message: 'Email dan kata sandi wajib diisi.' }),
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Supabase yang mencocokkan password dengan hash di auth.users
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.session || !data.user) {
      return res.status(401).json(
        errorResponse({
          message: 'Email atau password salah. Pastikan email sudah diverifikasi.',
        }),
      );
    }

    // Ambil data tambahan dari public."User" (yang tidak ada di auth.users)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('User')
      .select('nama, username, role, fotoProfil')
      .eq('idUser', data.user.id)
      .single();

    if (profileError || !profile) {
      console.error('Gagal mengambil profil pengguna:', {
        authUserId: data.user.id,
        authEmail: data.user.email,
        supabaseUrl: process.env.SUPABASE_URL,
        error: profileError
          ? {
              message: profileError.message,
              code: profileError.code,
              details: profileError.details,
              hint: profileError.hint,
            }
          : null,
        profileFound: Boolean(profile),
      });

      return res.status(404).json(
        errorResponse({ message: 'Profil pengguna tidak ditemukan. Hubungi admin.' }),
      );
    }

    // Claim atomically: a concurrent login must not replace the current device.
    const idSession = sessionId(data.session.access_token);
    const { data: claimed, error: sessionError } = idSession
      ? await supabaseAdmin.rpc('claim_login_session', { p_id_akun: data.user.id, p_session_id: idSession })
      : { error: new Error('Token tidak memiliki session_id.') };
    if (sessionError || !claimed) {
      await supabaseAdmin.auth.admin.signOut(data.session.access_token, 'local');
      return res.status(sessionError ? 500 : 409).json(errorResponse({
        message: sessionError ? 'Gagal mencatat sesi login.' : 'Akun masih login di perangkat lain. Logout dari perangkat tersebut terlebih dahulu.',
        code: sessionError ? 'SESSION_ERROR' : 'AKUN_SEDANG_LOGIN',
      }));
    }

    return res.json(
      successResponse({
        message: 'Login berhasil.',
        data: {
          token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          previous_session_ended: false,
          user: {
            id_user: data.user.id,
            email: data.user.email,
            nama: profile.nama,
            username: profile.username,
            nickname: profile.username,
            role: profile.role,
            foto_profil: urlFotoProfil(profile.fotoProfil),
          },
        },
      }),
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse({ message: error.message || 'Login gagal.' }),
    );
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Identitas diambil dari token, bukan dari body. Kalau email/username
    // di body masih dipercaya, siapa pun bisa memaksa logout akun orang lain.
    if (!token) {
      return res.status(401).json(
        errorResponse({ message: 'Token akses wajib disertakan untuk logout.' }),
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    // Sesi ini sudah tidak berlaku: kedaluwarsa, atau sudah dicabut karena
    // akun dipakai login di perangkat lain. Tidak ada yang perlu ditutup.
    // Menutup baris SessionLogin di sini justru akan mematikan sesi BARU
    // milik orang yang sama, jadi sengaja tidak disentuh.
    if (userError || !userData?.user) {
      return res.json(
        successResponse({ message: 'Sesi sudah tidak aktif.' }),
      );
    }

    const idSession = sessionId(token);
    if (!idSession) return res.status(401).json(errorResponse({ message: 'Sesi tidak valid.' }));
    // Conditional update prevents an old token from ending another session.
    const { error } = await supabaseAdmin.from('SessionLogin')
      .update({ logoutTime: new Date().toISOString() })
      .eq('idAkun', userData.user.id).eq('sessionId', idSession).is('logoutTime', null);
    await supabaseAdmin.auth.admin.signOut(token, 'local');

    if (error) {
      return res.status(500).json(errorResponse({ message: error.message }));
    }

    return res.json(
      successResponse({ message: 'Logout berhasil. Sesi telah diakhiri.' }),
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse({ message: error.message || 'Logout gagal.' }),
    );
  }
};

// JANGAN DI OTAK-ATIK!! INI ADALAH ENDPOINT PAKETAN UNTUK RESET PASSWORD: endpoint ini hanya dipakai untuk reset password di frontend, bukan untuk login.
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json(
        errorResponse({ message: 'Email wajib diisi.' }),
      );
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${process.env.BACKEND_URL}/api/auth/reset-password-page`,
    });

    if (error) {
      let remainingMinutes = null;
      let unlockTimeStr = null;

      // Jika terkena limit email, hitung sisa menitnya
      if (error.code === 'over_email_send_rate_limit') {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const targetUser = usersData?.users?.find((u) => u.email === normalizedEmail);

        if (targetUser?.recovery_sent_at) {
          const lastSentMs = new Date(targetUser.recovery_sent_at).getTime();
          const ONE_HOUR = 60 * 60 * 1000;
          const unlockTimeMs = lastSentMs + ONE_HOUR;
          const diffMs = unlockTimeMs - Date.now();

          if (diffMs > 0) {
            remainingMinutes = Math.ceil(diffMs / (60 * 1000));
            unlockTimeStr = new Date(unlockTimeMs).toLocaleTimeString('id-ID');
          }
        }
      }

      console.error('\n🔴 [DEBUG SUPABASE RATE LIMIT]:', {
        status: error.status,
        code: error.code,
        message: error.message,
        sisa_waktu: remainingMinutes ? `${remainingMinutes} menit lagi` : 'Maks 60 menit',
        estimasi_bisa_kirim_jam: unlockTimeStr || 'Menunggu 1 jam dari email terakhir',
      });

      return res.status(429).json({
        success: false,
        code: error.code,
        message: `Terkena batas limit email Supabase. Silakan tunggu sekitar ${remainingMinutes || 60} menit lagi (jam ${unlockTimeStr || '1 jam kedepan'}).`,
        debug: {
          sisa_menit: remainingMinutes,
          bisa_kirim_lagi_jam: unlockTimeStr,
        },
      });
    }

    console.info('[RESET_PASSWORD_EMAIL_ACCEPTED]', {
      waktu: new Date().toISOString(),
      status: 200,
      pesan: 'Supabase menerima permintaan reset password.',
    });

    return res.json(
      successResponse({
        message: 'Jika email terdaftar, tautan reset password telah dikirim.',
      }),
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse({ message: error.message || 'Gagal mengirim email reset password.' }),
    );
  }
};

// JANGAN DI OTAK-ATIK!! INI ADALAH ENDPOINT PAKETAN UNTUK RESET PASSWORD
// Route GET ini yang dibuka waktu user klik link di email
export const resetPasswordPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(path.join(__dirname, '../templates/reset-password.html'));
};

export const resetPasswordBackground = (req, res) => {
  res.sendFile(path.join(__dirname, '../templates/background-itk.jpg.jpeg'));
};

// JANGAN DI OTAK ATIK!! INI ADALAH ENDPOINT PAKETAN UNTUK RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { access_token, password } = req.body;
    const frontendOrigins = (process.env.FRONTEND_URLS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => new URL(origin));
    const frontendOrigin = frontendOrigins.find((origin) => origin.hostname === req.hostname)
      || frontendOrigins[0]
      || new URL('http://localhost:5173');
    const loginUrl = new URL('/', frontendOrigin);

    if (!['http:', 'https:'].includes(loginUrl.protocol)) {
      throw new Error('FRONTEND_URLS harus menggunakan URL HTTP atau HTTPS.');
    }

    if (!access_token || !password) {
      return res.status(400).json(
        errorResponse({ message: 'Token dan password baru wajib diisi.' }),
      );
    }

    if (!validPassword(password)) {
      return res.status(400).json(
        errorResponse({
          message: 'Kata sandi minimal 8 karakter serta wajib memiliki huruf besar, huruf kecil, angka, dan simbol (@ # $ ! _ -).',
        }),
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(access_token);

    if (userError || !userData?.user) {
      return res.status(401).json(
        errorResponse({ message: 'Tautan reset password tidak valid atau sudah kedaluwarsa.' }),
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      { password },
    );

    if (updateError) {
      return res.status(400).json(errorResponse({ message: updateError.message }));
    }

    // Cabut sesi lama supaya reset password benar-benar "mengusir" sesi yang mungkin dibajak
    await supabaseAdmin.auth.admin.signOut(access_token, 'global');

    // Pastikan status SessionLogin di-set logout agar user bisa langsung login kembali
    await supabaseAdmin
      .from('SessionLogin')
      .update({ logoutTime: new Date().toISOString() })
      .eq('idAkun', userData.user.id);

    return res.json(
      successResponse({
        message: 'Password berhasil diubah. Silakan login dengan password baru.',
        data: { loginUrl: loginUrl.toString() },
      }),
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse({ message: error.message || 'Gagal mengubah password.' }),
    );
  }
};

// Menukar refresh token dengan access token baru. Dipanggil frontend secara
// diam-diam sebelum token 60 menit itu kedaluwarsa, supaya pengguna yang
// sedang mengerjakan kuis tidak tiba-tiba terlempar ke halaman login.
export const refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json(
        errorResponse({ message: 'Refresh token wajib disertakan.' }),
      );
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    // Gagal berarti sesinya memang sudah tidak berlaku: kedaluwarsa, sudah
    // logout, atau dicabut karena akun dipakai login di perangkat lain.
    if (error || !data?.session) {
      return res.status(401).json(
        errorResponse({ message: 'Sesi sudah berakhir. Silakan login kembali.' }),
      );
    }

    const { data: active, error: activeError } = await supabaseAdmin.from('SessionLogin')
      .select('sessionId').eq('idAkun', data.user.id).is('logoutTime', null).maybeSingle();
    if (activeError) return res.status(500).json(errorResponse({ message: 'Gagal memeriksa sesi.' }));
    if (!active || active.sessionId !== sessionId(data.session.access_token)) {
      await supabaseAdmin.auth.admin.signOut(data.session.access_token, 'local');
      return res.status(401).json(errorResponse({ message: 'Sesi sudah berakhir. Silakan login kembali.' }));
    }

    return res.json(
      successResponse({
        message: 'Sesi diperbarui.',
        data: {
          token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      }),
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse({ message: error.message || 'Gagal memperbarui sesi.' }),
    );
  }
};

// Dipakai frontend saat halaman dimuat untuk memastikan sesinya benar-benar
// masih hidup di server, bukan sekadar ada token tersimpan di browser.
export const me = async (req, res) => {
  return res.json(
    successResponse({
      message: 'Sesi aktif.',
      data: {
        user: {
          id_user: req.currentUser.id,
          email: req.currentUser.email,
          nama: req.currentUser.nama,
          username: req.currentUser.username,
          nickname: req.currentUser.username,
          role: req.currentUser.role,
          foto_profil: urlFotoProfil(req.currentUser.fotoProfil),
        },
      },
    }),
  );
};

export const updateMe = async (req, res) => {
  try {
    const nama = typeof req.body.nama === 'string' ? req.body.nama.trim() : '';
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';

    if (!nama || !username) {
      return res.status(400).json(
        errorResponse({ message: 'Nama dan username wajib diisi.' }),
      );
    }

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json(
        errorResponse({ message: 'Username harus 3-30 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.' }),
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('User')
      .select('idUser')
      .eq('username', username)
      .neq('idUser', req.currentUser.id)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json(errorResponse({ message: existingError.message }));
    }
    if (existing) {
      return res.status(409).json(errorResponse({ message: 'Username sudah digunakan.' }));
    }

    const { data: profile, error } = await supabaseAdmin
      .from('User')
      .update({ nama, username })
      .eq('idUser', req.currentUser.id)
      .select('idUser, nama, username, role')
      .single();

    if (error || !profile) {
      return res.status(500).json(errorResponse({ message: error?.message || 'Gagal memperbarui profil.' }));
    }

    return res.json(
      successResponse({
        message: 'Profil berhasil diperbarui.',
        data: {
          user: {
            id_user: profile.idUser,
            email: req.currentUser.email,
            nama: profile.nama,
            username: profile.username,
            nickname: profile.username,
            role: profile.role,
          },
        },
      }),
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse({ message: error.message || 'Gagal memperbarui profil.' }),
    );
  }
};
