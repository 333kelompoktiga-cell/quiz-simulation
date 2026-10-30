import { listOptions, pagination } from '../utils/listQuery.js';
// controllers/AccountController.js
import { supabaseAdmin } from '../config/db.js';
import { successResponse, errorResponse } from '../models/apiResponse.js';
import { ROLE } from '../config/roles.js';

const VALID_ROLES = [ROLE.ADMIN, ROLE.MAHASISWA];

// Awal Untuk Superadmin — endpoint ini hanya bisa diakses oleh superadmin
// Menampilkan semua user (role admin & user) — gabungan dari auth.users (id, email) dan public.user (nama, role)
export const getAllUsers = async (req, res) => {
  try {
    let options;
    try { options = listOptions(req.query); } catch (error) { return res.status(400).json(errorResponse({ message: error.message })); }
    if (req.query.role && !VALID_ROLES.includes(req.query.role)) return res.status(400).json(errorResponse({ message: 'Role tidak valid.' }));
    const { data: result, error } = await supabaseAdmin.rpc('list_accounts_superadmin', {
      p_search: options.search, p_role: req.query.role || null,
      p_offset: options.from, p_limit: options.limit,
    });
    if (error) return res.status(500).json(errorResponse({ message: error.message }));
    const users = result.users;
    const total = result.total;
    return res.json(
      { ...successResponse({
        message: 'Berhasil mengambil daftar user.',
        data: users,
      }), pagination: pagination(options, total) },
    );
  } catch (error) {
    return res.status(500).json(
      errorResponse({ message: error.message || 'Gagal mengambil daftar user.' }),
    );
  }
};

const validPassword = (password) => {
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[@#$!_\-]/.test(password);
  return minLength && hasUpper && hasLower && hasDigit && hasSpecial;
};

const getUsernameFromEmail = (email) => email.split('@')[0];

export const createAccount = async (req, res) => {
  try {
    const { nama, email, role, password } = req.body;

    if (!nama || !email || !role || !password) {
      return res.status(400).json(errorResponse({ message: 'Nama, email, role, dan password wajib diisi.' }));
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json(
        errorResponse({ message: `Role tidak valid. Role yang diperbolehkan: ${VALID_ROLES.join(', ')}.` }),
      );
    }

    if (!validPassword(password)) {
      return res.status(400).json(
        errorResponse({
          message: 'Kata sandi minimal 8 karakter serta wajib memiliki huruf besar, huruf kecil, angka, dan simbol (@ # $ ! _ -).',
        }),
      );
    }

    const username = getUsernameFromEmail(normalizedEmail);

    // 1. Buat akun auth (auth.users)
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // dibuat langsung oleh superadmin, tidak perlu verifikasi email
    });

    if (createError || !newAuthUser?.user) {
      return res.status(400).json(errorResponse({ message: createError?.message || 'Gagal membuat akun autentikasi.' }));
    }

    const newUserId = newAuthUser.user.id;

    // 2. Simpan profil (public.user)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('User')
      .insert({ idUser: newUserId, nama, username, role })
      .select('idUser, nama, username, role')
      .single();

    if (profileError) {
      // rollback akun auth kalau insert profil gagal, biar tidak jadi akun "yatim"
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return res.status(500).json(errorResponse({ message: profileError.message || 'Gagal menyimpan profil pengguna.' }));
    }

    return res.status(201).json(
      successResponse({
        message: 'Akun berhasil dibuat.',
        data: { id: profile.idUser, nama: profile.nama, email: normalizedEmail, role: profile.role },
      }),
    );
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal membuat akun.' }));
  }
};

// controllers/AccountController.js (update deleteAccount)

export const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(errorResponse({ message: 'ID akun wajib disertakan.' }));
    }

    // Cegah superadmin menghapus akunnya sendiri lewat endpoint ini
    if (req.currentUser?.id === id) {
      return res.status(400).json(errorResponse({ message: 'Tidak bisa menghapus akun sendiri.' }));
    }

    // 1. Cek dulu apakah profil ada
    const { data: profile, error: findError } = await supabaseAdmin
      .from('User')
      .select('idUser, nama, username, role')
      .eq('idUser', id)
      .single();

    if (findError || !profile) {
      return res.status(404).json(errorResponse({ message: 'Akun tidak ditemukan.' }));
    }

    // Cegah penghapusan akun superadmin lain lewat endpoint ini
    if (profile.role === ROLE.SUPER_ADMIN) {
      return res.status(403).json(errorResponse({ message: 'Akun superadmin tidak bisa dihapus lewat endpoint ini.' }));
    }

    // 2. Cek status online — logoutTime NULL artinya user sedang aktif login
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('SessionLogin')
      .select('logoutTime')
      .eq('idAkun', id)
      .maybeSingle();

    if (sessionError) {
      return res.status(500).json(errorResponse({ message: sessionError.message || 'Gagal memeriksa status sesi.' }));
    }

    if (session && session.logoutTime === null) {
      return res.status(409).json(errorResponse({ message: 'Akun sedang online, tidak dapat dihapus.' }));
    }

    // 3. Hapus dari auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteAuthError) {
      return res.status(500).json(errorResponse({ message: deleteAuthError.message || 'Gagal menghapus akun autentikasi.' }));
    }

    // 4. Jaga-jaga kalau FK-nya tidak cascade — hapus manual juga
    await supabaseAdmin.from('User').delete().eq('idUser', id);

    // 5. Bersihkan juga baris SessionLogin-nya biar tidak jadi sampah data
    await supabaseAdmin.from('SessionLogin').delete().eq('idAkun', id);

    return res.json(
      successResponse({ message: `Akun "${profile.nama}" berhasil dihapus.` }),
    );
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal menghapus akun.' }));
  }
};

// Akhir dari Superadmin