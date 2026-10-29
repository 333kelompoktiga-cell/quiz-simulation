// controllers/BabController.js
import { supabaseAdmin } from '../config/db.js';
import { successResponse, errorResponse } from '../models/apiResponse.js';

const BAB_COLUMNS = 'idBab, namaBab, deskripsi, urutanBab, dibuatOleh, tanggalDibuat, tanggalDiupdate';

// Nomor bab dipakai untuk mengurutkan daftar, jadi harus benar-benar angka bulat.
// Minimal 1 — tidak ada bab nomor 0, meski dikirim paksa lewat API.
const urutanValid = (nilai) => Number.isInteger(nilai) && nilai >= 1;

// 23505 = unique violation — bisa terjadi pada:
//   - idx_bab_nama_unik        → nama bab unik (tidak peka huruf besar/kecil)
//   - idx_bab_urutan_per_admin → urutan bab unik per admin (dibuatOleh + urutanBab)
// Fungsi ini memeriksa pesan error untuk membedakan keduanya.
const tanganiUniqueViolation = (res, error, namaBab, urutanBab) => {
  const msg = `${error.message || ''} ${error.details || ''}`;
  if (msg.includes('urutan') || msg.includes('urutanBab') || msg.includes('idx_bab_urutan_per_admin')) {
    return res.status(409).json(
      errorResponse({ message: `Nomor urut bab ${urutanBab} sudah Anda gunakan. Silakan gunakan nomor urut lain.` }),
    );
  }
  return res.status(409).json(
    errorResponse({ message: `Bab dengan nama "${namaBab}" sudah ada.` }),
  );
};

// Menampilkan semua bab — bisa diakses semua role yang sudah login (guru, superadmin, mahasiswa).
// Diurutkan dari bab pertama, bukan dari yang terbaru dibuat.
export const getAllBab = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('Bab')
      .select(BAB_COLUMNS)
      .order('urutanBab', { ascending: true });

    if (error) {
      return res.status(500).json(errorResponse({ message: error.message }));
    }

    return res.json(
      successResponse({ message: 'Berhasil mengambil daftar bab.', data }),
    );
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal mengambil daftar bab.' }));
  }
};

export const getBabById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('Bab')
      .select(BAB_COLUMNS)
      .eq('idBab', id)
      .single();

    if (error || !data) {
      return res.status(404).json(errorResponse({ message: 'Bab tidak ditemukan.' }));
    }

    return res.json(successResponse({ message: 'Berhasil mengambil bab.', data }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal mengambil bab.' }));
  }
};

// Hanya admin (guru) yang bisa membuat bab. dibuatOleh hanya catatan pembuat:
// bab dipakai bersama, semua dosen bisa mengisinya dengan kuis masing-masing.
// Nomor urut bab WAJIB diisi oleh admin (tidak lagi auto-increment).
// Nomor urut bersifat UNIQUE per admin — admin berbeda boleh memakai nomor yang sama.
export const createBab = async (req, res) => {
  try {
    const { namaBab, deskripsi, urutanBab } = req.body;

    if (!namaBab || !namaBab.trim()) {
      return res.status(400).json(errorResponse({ message: 'Nama bab wajib diisi.' }));
    }

    if (urutanBab === undefined || urutanBab === null || urutanBab === '') {
      return res.status(400).json(errorResponse({ message: 'Nomor urut bab wajib diisi.' }));
    }

    const nomorUrut = typeof urutanBab === 'string' && urutanBab.trim() !== '' ? Number(urutanBab) : urutanBab;
    if (!urutanValid(nomorUrut)) {
      return res.status(400).json(errorResponse({ message: 'Urutan bab harus berupa angka bulat minimal 1.' }));
    }

    // Cek duplikat nomor urut khusus untuk admin ini sebelum insert
    const adminId = req.currentUser.id;
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('Bab')
      .select('idBab, namaBab')
      .eq('dibuatOleh', adminId)
      .eq('urutanBab', nomorUrut)
      .maybeSingle();

    if (checkError) {
      return res.status(500).json(errorResponse({ message: checkError.message || 'Gagal memeriksa nomor urut bab.' }));
    }

    if (existing) {
      return res.status(409).json(
        errorResponse({
          message: `Nomor urut bab ${nomorUrut} sudah Anda gunakan pada bab "${existing.namaBab}". Silakan gunakan nomor urut lain.`,
        }),
      );
    }

    let { data, error } = await supabaseAdmin
      .from('Bab')
      .insert({
        namaBab: namaBab.trim(),
        deskripsi: deskripsi ?? null,
        urutanBab: nomorUrut,
        dibuatOleh: adminId,
      })
      .select(BAB_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') return tanganiUniqueViolation(res, error, namaBab.trim(), nomorUrut);
      return res.status(500).json(errorResponse({ message: error.message || 'Gagal membuat bab.' }));
    }

    // Jika di database Supabase masih ada trigger BEFORE INSERT yang menimpa urutanBab
    // dengan MAX(urutanBab) + 1, paksa simpan nomorUrut inputan admin lewat UPDATE.
    if (data && data.urutanBab !== nomorUrut) {
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from('Bab')
        .update({ urutanBab: nomorUrut })
        .eq('idBab', data.idBab)
        .select(BAB_COLUMNS)
        .single();

      if (updateError) {
        await supabaseAdmin.from('Bab').delete().eq('idBab', data.idBab);
        if (updateError.code === '23505') return tanganiUniqueViolation(res, updateError, namaBab.trim(), nomorUrut);
        return res.status(500).json(errorResponse({ message: updateError.message || 'Gagal menyimpan nomor urut bab.' }));
      }
      data = updatedData;
    }

    return res.status(201).json(successResponse({ message: 'Bab berhasil dibuat.', data }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal membuat bab.' }));
  }
};

// Bab dipakai bersama, jadi admin (dosen) mana pun boleh mengubahnya
export const updateBab = async (req, res) => {
  try {
    const { id } = req.params;
    const { namaBab, deskripsi, urutanBab } = req.body;

    if (namaBab === undefined && deskripsi === undefined && urutanBab === undefined) {
      return res.status(400).json(errorResponse({ message: 'Tidak ada data yang diubah.' }));
    }

    const updatePayload = { tanggalDiupdate: new Date().toISOString() };
    if (namaBab !== undefined) {
      if (!namaBab.trim()) {
        return res.status(400).json(errorResponse({ message: 'Nama bab tidak boleh kosong.' }));
      }
      updatePayload.namaBab = namaBab.trim();
    }
    if (deskripsi !== undefined) updatePayload.deskripsi = deskripsi;
    if (urutanBab !== undefined) {
      if (urutanBab === null || urutanBab === '') {
        return res.status(400).json(errorResponse({ message: 'Nomor urut bab wajib diisi.' }));
      }
      const nomorUrut = typeof urutanBab === 'string' && urutanBab.trim() !== '' ? Number(urutanBab) : urutanBab;
      if (!urutanValid(nomorUrut)) {
        return res.status(400).json(errorResponse({ message: 'Urutan bab harus berupa angka bulat minimal 1.' }));
      }

      // Cek duplikat nomor urut untuk admin pembuat bab ini (kecuali bab yang sedang diedit)
      const { data: babIni, error: findError } = await supabaseAdmin
        .from('Bab')
        .select('idBab, dibuatOleh')
        .eq('idBab', id)
        .maybeSingle();

      if (findError) {
        return res.status(500).json(errorResponse({ message: findError.message || 'Gagal memeriksa bab.' }));
      }
      if (!babIni) {
        return res.status(404).json(errorResponse({ message: 'Bab tidak ditemukan.' }));
      }

      const pemilikId = babIni.dibuatOleh ?? req.currentUser.id;
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('Bab')
        .select('idBab, namaBab')
        .eq('dibuatOleh', pemilikId)
        .eq('urutanBab', nomorUrut)
        .neq('idBab', id)
        .maybeSingle();

      if (checkError) {
        return res.status(500).json(errorResponse({ message: checkError.message || 'Gagal memeriksa nomor urut bab.' }));
      }

      if (existing) {
        const subjek = pemilikId === req.currentUser.id ? 'Anda gunakan' : 'digunakan oleh pembuat bab ini';
        return res.status(409).json(
          errorResponse({
            message: `Nomor urut bab ${nomorUrut} sudah ${subjek} pada bab "${existing.namaBab}". Silakan gunakan nomor urut lain.`,
          }),
        );
      }

      updatePayload.urutanBab = nomorUrut;
    }

    const { data, error } = await supabaseAdmin
      .from('Bab')
      .update(updatePayload)
      .eq('idBab', id)
      .select(BAB_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') return tanganiUniqueViolation(res, error, updatePayload.namaBab, urutanBab);
      return res.status(500).json(errorResponse({ message: error.message || 'Gagal memperbarui bab.' }));
    }

    if (!data) {
      return res.status(404).json(errorResponse({ message: 'Bab tidak ditemukan.' }));
    }

    return res.json(successResponse({ message: 'Bab berhasil diperbarui.', data }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal memperbarui bab.' }));
  }
};

// Admin (dosen) mana pun boleh menghapus bab, asalkan sudah tidak ada kuis di dalamnya.
// Kuis milik dosen lain tidak boleh ikut hilang hanya karena bab-nya dihapus.
export const deleteBab = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabaseAdmin
      .from('Bab')
      .select('idBab, namaBab, Kuis(count)')
      .eq('idBab', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json(errorResponse({ message: 'Bab tidak ditemukan.' }));
    }

    const jumlahKuis = existing.Kuis[0]?.count ?? 0;
    if (jumlahKuis > 0) {
      return res.status(409).json(
        errorResponse({ message: `Bab "${existing.namaBab}" masih berisi ${jumlahKuis} kuis. Hapus semua kuisnya terlebih dahulu.` }),
      );
    }

    const { error } = await supabaseAdmin.from('Bab').delete().eq('idBab', id);

    if (error) {
      // 23503 = foreign key violation — kuis masuk di sela pengecekan, atau masih dipakai hasil analisis/roadmap
      if (error.code === '23503') {
        return res.status(409).json(
          errorResponse({ message: 'Bab tidak bisa dihapus karena masih dipakai oleh kuis atau hasil analisis.' }),
        );
      }
      return res.status(500).json(errorResponse({ message: error.message || 'Gagal menghapus bab.' }));
    }

    return res.json(successResponse({ message: `Bab "${existing.namaBab}" berhasil dihapus.` }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal menghapus bab.' }));
  }
};
