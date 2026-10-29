// controllers/KuisController.js
import { supabaseAdmin } from '../config/db.js';
import { successResponse, errorResponse } from '../models/apiResponse.js';
import { ROLE } from '../config/roles.js';
import { bisaDikelola, bisaAturAkses, KOLOM_AKSES_KUIS } from '../utils/aksesKuis.js';
import { buatPasswordKuis } from '../utils/passwordKuis.js';
import { siapkanPengaturanAcak, jumlahSoalDikerjakan } from '../utils/acakSoal.js';

// pembuat:User(nama) = nama dosen pembuat lewat FK Kuis.idUser, supaya daftar kuis
// dalam satu bab bisa dibedakan ("Kuis 1 - Dosen A", "Kuis 1 - Dosen B").
const KUIS_COLUMNS =
  'idKuis, idUser, idBab, judul, deskripsi, durasi, maksPercobaan, acakSoal, jumlahTampil, tanggalDibuat, pin, aksesKelola, dosenPengelola, pembuat:User(nama)';

// Password kuis dibuat otomatis oleh server saat kuis dibuat (lihat utils/passwordKuis.js):
// tepat 8 karakter ASCII yang bisa dicetak (huruf besar/kecil, angka, simbol), tanpa spasi.
// Kolom Kuis.pin harus bertipe teks dan tidak boleh dibatasi CHECK "hanya angka".
const PIN_FORMAT = /^[\x21-\x7E]{8}$/;
const PIN_TIDAK_VALID = 'Password kuis harus berupa teks 8 karakter tanpa spasi.';

// Password hanya terlihat oleh dosen yang boleh mengelola kuis ini. Mahasiswa dan dosen lain
// cukup tahu apakah kuis sudah dibuka (adaPin), bukan password-nya.
const keRespons = ({ pin, pembuat, ...kuis }, user) => {
  const kelola = bisaDikelola(kuis, user);
  return {
    ...kuis,
    namaPembuat: pembuat?.nama ?? null,
    adaPin: pin !== null,
    bisaDikelola: kelola,
    bisaAturAkses: bisaAturAkses(kuis, user),
    ...(kelola && { pin }),
  };
};

// Menampilkan semua kuis — bisa diakses semua role yang sudah login.
// Bisa difilter per bab lewat query ?idBab=... (dipakai mahasiswa: pilih bab dulu, baru lihat kuis-nya)
export const getAllKuis = async (req, res) => {
  try {
    const { idBab } = req.query;

    // Soal(count) = jumlah soal per kuis, ditampilkan frontend di daftar kuis ("· 10 soal").
    let query = supabaseAdmin
      .from('Kuis')
      .select(`${KUIS_COLUMNS}, Soal(count)`)
      .order('tanggalDibuat', { ascending: false });

    if (idBab) {
      query = query.eq('idBab', idBab);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json(errorResponse({ message: error.message }));
    }

    const idKuis = data.map((kuis) => kuis.idKuis);
    const riwayatPerKuis = new Map();
    const percobaanPerKuis = new Map();
    if (idKuis.length) {
      const { data: riwayat, error: riwayatError } = await supabaseAdmin
        .from('PengerjaanKuis')
        .select('idPengerjaan, idKuis, status, skorFuzzy, kategoriFuzzy, akurasi, waktuSelesai')
        .eq('idUser', req.currentUser.id)
        .in('idKuis', idKuis)
        .order('waktuSelesai', { ascending: false });

      if (riwayatError) {
        return res.status(500).json(errorResponse({ message: riwayatError.message }));
      }
      for (const hasil of riwayat || []) {
        const ringkasan = percobaanPerKuis.get(hasil.idKuis) || { jumlah: 0, aktif: false };
        ringkasan.jumlah += 1;
        ringkasan.aktif ||= hasil.status === 'berlangsung';
        percobaanPerKuis.set(hasil.idKuis, ringkasan);
        if (hasil.status === 'selesai' && !riwayatPerKuis.has(hasil.idKuis)) riwayatPerKuis.set(hasil.idKuis, hasil);
      }
    }

    const daftar = data.map(({ Soal, ...kuis }) => {
      const hasilTerakhir = riwayatPerKuis.get(kuis.idKuis);
      const percobaan = percobaanPerKuis.get(kuis.idKuis) || { jumlah: 0, aktif: false };
      const sisaPercobaan = Math.max(0, kuis.maksPercobaan - percobaan.jumlah);
      const jumlahSoal = Soal[0]?.count ?? 0;
      const tersedia = kuis.pin !== null && jumlahSoal > 0;
      return {
        ...keRespons(kuis, req.currentUser),
        jumlahSoal,
        // Jumlah soal yang dikerjakan mahasiswa per percobaan (bisa lebih sedikit kalau acak soal aktif).
        jumlahSoalTampil: jumlahSoalDikerjakan(kuis, jumlahSoal),
        tersedia,
        jumlahPercobaan: percobaan.jumlah,
        sisaPercobaan,
        adaPercobaanAktif: percobaan.aktif,
        bisaMengerjakan: jumlahSoal > 0 && (percobaan.aktif || (tersedia && sisaPercobaan > 0)),
        nilaiTerakhir: hasilTerakhir?.skorFuzzy ?? null,
        kategoriTerakhir: hasilTerakhir?.kategoriFuzzy ?? null,
        akurasiTerakhir: hasilTerakhir?.akurasi ?? null,
        idPengerjaanTerakhir: hasilTerakhir?.idPengerjaan ?? null,
        statusBelajar: hasilTerakhir ? 'Selesai' : tersedia ? 'Tersedia' : 'Belum dibuka',
      };
    });

    return res.json(
      successResponse({ message: 'Berhasil mengambil daftar kuis.', data: daftar }),
    );
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal mengambil daftar kuis.' }));
  }
};

export const getKuisById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('Kuis')
      .select(KUIS_COLUMNS)
      .eq('idKuis', id)
      .single();

    if (error || !data) {
      return res.status(404).json(errorResponse({ message: 'Kuis tidak ditemukan.' }));
    }

    return res.json(successResponse({ message: 'Berhasil mengambil kuis.', data: keRespons(data, req.currentUser) }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal mengambil kuis.' }));
  }
};

// Hanya admin (guru) yang bisa membuat kuis — pemiliknya adalah guru yang sedang login
export const createKuis = async (req, res) => {
  try {
    // pin tidak diterima dari client: password dibuat otomatis oleh server.
    const { idBab, judul, deskripsi, durasi, maksPercobaan = 1 } = req.body;
    if (!Number.isInteger(maksPercobaan) || maksPercobaan < 1 || maksPercobaan > 3) {
      return res.status(400).json(errorResponse({ message: 'maksPercobaan harus bilangan bulat 1 sampai 3.' }));
    }

    if (!idBab || !judul || !judul.trim()) {
      return res.status(400).json(errorResponse({ message: 'idBab dan judul wajib diisi.' }));
    }

    const acak = siapkanPengaturanAcak(req.body);
    if (acak.error) return res.status(400).json(errorResponse({ message: acak.error }));

    // durasi opsional: kalau tidak dikirim database memakai default kolomnya (30 menit).
    const payload = {
      idUser: req.currentUser.id,
      idBab,
      judul: judul.trim(),
      deskripsi: deskripsi ?? null,
      pin: buatPasswordKuis(),
      maksPercobaan,
      ...acak.data,
    };
    if (durasi !== undefined && durasi !== null) {
      const durasiInt = Number(durasi);
      if (!Number.isInteger(durasiInt) || durasiInt <= 0) {
        return res.status(400).json(errorResponse({ message: 'durasi harus berupa bilangan bulat positif.' }));
      }
      payload.durasi = durasiInt;
    }

    const { data, error } = await supabaseAdmin
      .from('Kuis')
      .insert(payload)
      .select(KUIS_COLUMNS)
      .single();

    if (error) {
      // 23503 = foreign key violation — idBab yang dikirim tidak ada
      if (error.code === '23503') {
        return res.status(400).json(errorResponse({ message: 'Bab yang dipilih tidak ditemukan.' }));
      }
      return res.status(500).json(errorResponse({ message: error.message || 'Gagal membuat kuis.' }));
    }

    return res.status(201).json(successResponse({ message: 'Kuis berhasil dibuat.', data: keRespons(data, req.currentUser) }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal membuat kuis.' }));
  }
};

// Pemilik dan dosen yang diberi hak kelola boleh mengubah kuis.
export const updateKuis = async (req, res) => {
  try {
    const { id } = req.params;
    // generatePin: true = buat password baru (dipakai tombol "Generate" di pop-up password).
    const { idBab, judul, deskripsi, durasi, pin, generatePin, acakSoal, jumlahTampil, maksPercobaan } = req.body;

    if (idBab === undefined && judul === undefined && deskripsi === undefined
      && durasi === undefined && pin === undefined && generatePin === undefined
      && acakSoal === undefined && jumlahTampil === undefined && maksPercobaan === undefined) {
      return res.status(400).json(errorResponse({ message: 'Tidak ada data yang diubah.' }));
    }

    const { data: existing, error: findError } = await supabaseAdmin
      .from('Kuis')
      .select(KOLOM_AKSES_KUIS)
      .eq('idKuis', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json(errorResponse({ message: 'Kuis tidak ditemukan.' }));
    }

    if (!bisaDikelola(existing, req.currentUser)) {
      return res.status(403).json(
        errorResponse({ message: 'Kamu belum diberi hak untuk mengelola kuis ini.' }),
      );
    }

    const acak = siapkanPengaturanAcak(req.body);
    if (acak.error) return res.status(400).json(errorResponse({ message: acak.error }));

    const updatePayload = { ...acak.data };
    if (maksPercobaan !== undefined) {
      if (!Number.isInteger(maksPercobaan) || maksPercobaan < 1 || maksPercobaan > 3) {
        return res.status(400).json(errorResponse({ message: 'maksPercobaan harus bilangan bulat 1 sampai 3.' }));
      }
      updatePayload.maksPercobaan = maksPercobaan;
    }
    if (judul !== undefined) {
      if (!judul.trim()) {
        return res.status(400).json(errorResponse({ message: 'Judul tidak boleh kosong.' }));
      }
      updatePayload.judul = judul.trim();
    }
    if (deskripsi !== undefined) updatePayload.deskripsi = deskripsi;
    if (idBab !== undefined) updatePayload.idBab = idBab;
    if (durasi !== undefined) {
      const durasiInt = Number(durasi);
      if (!Number.isInteger(durasiInt) || durasiInt <= 0) {
        return res.status(400).json(errorResponse({ message: 'durasi harus berupa bilangan bulat positif.' }));
      }
      updatePayload.durasi = durasiInt;
    }
    // pin: null = menutup kuis lagi (mahasiswa tidak bisa memulai attempt baru).
    // Kalau dikirim, harus sesuai format password kuis.
    if (pin !== undefined) {
      if (pin !== null && (typeof pin !== 'string' || !PIN_FORMAT.test(pin))) {
        return res.status(400).json(errorResponse({ message: PIN_TIDAK_VALID }));
      }
      updatePayload.pin = pin;
    }
    // Password baru hanya dibuat kalau diminta eksplisit; menyimpan/mengedit kuis tidak mengubahnya.
    if (generatePin === true) updatePayload.pin = buatPasswordKuis();

    const { data, error } = await supabaseAdmin
      .from('Kuis')
      .update(updatePayload)
      .eq('idKuis', id)
      .select(KUIS_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23503') {
        return res.status(400).json(errorResponse({ message: 'Bab yang dipilih tidak ditemukan.' }));
      }
      return res.status(500).json(errorResponse({ message: error.message || 'Gagal memperbarui kuis.' }));
    }

    return res.json(successResponse({ message: 'Kuis berhasil diperbarui.', data: keRespons(data, req.currentUser) }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal memperbarui kuis.' }));
  }
};

// Hanya admin pembuat kuis ini sendiri yang boleh menghapusnya
export const deleteKuis = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabaseAdmin
      .from('Kuis')
      .select('idKuis, judul, idUser')
      .eq('idKuis', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json(errorResponse({ message: 'Kuis tidak ditemukan.' }));
    }

    if (!bisaAturAkses(existing, req.currentUser)) {
      return res.status(403).json(
        errorResponse({ message: 'Kamu hanya bisa menghapus kuis yang kamu buat sendiri.' }),
      );
    }

    // FK Soal.idKuis memakai ON DELETE SET NULL, jadi soal tidak ikut terhapus otomatis.
    // Catat dulu idSoal-nya, karena setelah kuis dihapus idKuis di soal sudah menjadi NULL.
    const { data: daftarSoal, error: soalError } = await supabaseAdmin
      .from('Soal')
      .select('idSoal')
      .eq('idKuis', id);

    if (soalError) {
      return res.status(500).json(errorResponse({ message: soalError.message || 'Gagal membaca soal kuis.' }));
    }

    const { error } = await supabaseAdmin.from('Kuis').delete().eq('idKuis', id);

    if (!error && daftarSoal.length) {
      // OpsiJawaban dan JawabanMahasiswa ikut terhapus lewat ON DELETE CASCADE.
      const { error: hapusSoalError } = await supabaseAdmin
        .from('Soal')
        .delete()
        .in('idSoal', daftarSoal.map((s) => s.idSoal));

      if (hapusSoalError) {
        return res.status(500).json(
          errorResponse({ message: `Kuis terhapus, tetapi soalnya gagal dihapus: ${hapusSoalError.message}` }),
        );
      }
    }

    if (error) {
      // 23503 = foreign key violation — masih dipakai pengerjaan_kuis
      if (error.code === '23503') {
        return res.status(409).json(
          errorResponse({ message: 'Kuis tidak bisa dihapus karena masih ada pengerjaan yang terkait.' }),
        );
      }
      return res.status(500).json(errorResponse({ message: error.message || 'Gagal menghapus kuis.' }));
    }

    return res.json(successResponse({ message: `Kuis "${existing.judul}" berhasil dihapus.` }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal menghapus kuis.' }));
  }
};
// Daftar minimal profil dosen; tidak menyertakan email atau data autentikasi.
export const getDosenPengelola = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('User')
      .select('idUser, nama, username').eq('role', ROLE.ADMIN).order('nama');
    if (error) throw error;
    return res.json(successResponse({ message: 'Daftar dosen.', data }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message }));
  }
};

export const updateAksesKuis = async (req, res) => {
  try {
    const { aksesKelola, dosenPengelola = [] } = req.body;
    if (!['pribadi', 'semua', 'tertentu'].includes(aksesKelola)
      || !Array.isArray(dosenPengelola)
      || dosenPengelola.some((id) => typeof id !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return res.status(400).json(errorResponse({ message: 'Pengaturan hak akses tidak valid.' }));
    }
    const { data: kuis, error: findError } = await supabaseAdmin.from('Kuis')
      .select(KOLOM_AKSES_KUIS).eq('idKuis', req.params.id).maybeSingle();
    if (findError) throw findError;
    if (!kuis) return res.status(404).json(errorResponse({ message: 'Kuis tidak ditemukan.' }));
    if (!bisaAturAkses(kuis, req.currentUser)) {
      return res.status(403).json(errorResponse({ message: 'Hanya pemilik kuis yang boleh mengatur hak akses.' }));
    }
    const ids = aksesKelola === 'tertentu'
      ? [...new Set(dosenPengelola.map((id) => id.toLowerCase()))].filter((id) => id !== kuis.idUser) : [];
    if (aksesKelola === 'tertentu' && !ids.length) {
      return res.status(400).json(errorResponse({ message: 'Pilih minimal satu dosen lain.' }));
    }
    if (ids.length) {
      const { data: dosen, error } = await supabaseAdmin.from('User')
        .select('idUser').eq('role', ROLE.ADMIN).in('idUser', ids);
      if (error) throw error;
      if (dosen.length !== ids.length) {
        return res.status(400).json(errorResponse({ message: 'Semua pengelola harus berupa akun dosen aktif.' }));
      }
    }
    const { data, error } = await supabaseAdmin.from('Kuis')
      .update({ aksesKelola, dosenPengelola: ids }).eq('idKuis', req.params.id)
      .select(KUIS_COLUMNS).single();
    if (error) throw error;
    return res.json(successResponse({ message: 'Hak akses kuis berhasil disimpan.', data: keRespons(data, req.currentUser) }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal menyimpan hak akses.' }));
  }
};
