// controllers/SoalController.js
// Bentuk data soal mengikuti frontend/docs/KONTRAK_API_SOAL.md.
import { supabaseAdmin } from '../config/db.js';
import { bisaDikelola, KOLOM_AKSES_KUIS } from '../utils/aksesKuis.js';
import { ROLE } from '../config/roles.js';
import { successResponse, errorResponse } from '../models/apiResponse.js';

// `opsi:OpsiJawaban(...)` = alias PostgREST, supaya di respons namanya `opsi` sesuai kontrak.
const SOAL_SELECT =
  'idSoal, idKuis, urutan, pertanyaan, difficulty, targetTime, poin, pembahasan, ringkasan, opsi:OpsiJawaban(idOpsi, opsi, isCorrect)';

// Di API difficulty berupa teks (sama dengan DIFFICULTY_LEVELS di services/fuzzy/membership.js),
// tapi di database disimpan sebagai angka supaya bisa dirata-rata (HasilAnalisis.rataDifficulty).
const DIFFICULTY_KE_ANGKA = Object.freeze({ Mudah: 1, Sedang: 2, Sulit: 3 });
const ANGKA_KE_DIFFICULTY = Object.freeze({ 1: 'Mudah', 2: 'Sedang', 3: 'Sulit' });

const MIN_OPSI = 2;
const MAX_OPSI = 6;

const teksTerisi = (nilai) => typeof nilai === 'string' && nilai.trim() !== '';
const angkaBulat = (nilai, min) => Number.isInteger(nilai) && nilai >= min;

// Teks opsional: string kosong disimpan sebagai null. Mengembalikan undefined kalau tipenya salah.
const teksAtauNull = (nilai) => {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai !== 'string') return undefined;
  return nilai.trim() || null;
};

// Memeriksa satu soal dari body dan mengubahnya ke bentuk kolom database.
// Mengembalikan { error } atau { data }. `wajibSemua` = false untuk PUT /api/soal/:id,
// di mana field yang tidak dikirim tidak ikut diubah.
const siapkanSoal = (body, { wajibSemua }) => {
  const data = {};
  const ada = (field) => wajibSemua || body[field] !== undefined;

  if (ada('pertanyaan')) {
    if (!teksTerisi(body.pertanyaan)) return { error: 'Pertanyaan wajib diisi.' };
    data.pertanyaan = body.pertanyaan.trim();
  }
  if (ada('difficulty')) {
    if (!Object.hasOwn(DIFFICULTY_KE_ANGKA, body.difficulty ?? '')) {
      return { error: 'difficulty harus Mudah, Sedang, atau Sulit.' };
    }
    data.difficulty = DIFFICULTY_KE_ANGKA[body.difficulty];
  }
  // targetTime dalam detik, dipakai fuzzifyResponseTime. Kalau tidak dikirim, DB memakai default 60.
  if (body.targetTime !== undefined) {
    if (!angkaBulat(body.targetTime, 1)) return { error: 'targetTime harus bilangan bulat lebih dari 0 (detik).' };
    data.targetTime = body.targetTime;
  }
  if (body.poin !== undefined) {
    if (body.poin !== null && !angkaBulat(body.poin, 0)) return { error: 'Poin harus berupa angka bulat tidak negatif.' };
    data.poin = body.poin;
  }
  for (const field of ['pembahasan', 'ringkasan']) {
    if (body[field] !== undefined || wajibSemua) {
      const nilai = teksAtauNull(body[field]);
      if (nilai === undefined) return { error: `${field} harus berupa teks.` };
      data[field] = nilai;
    }
  }
  if (ada('opsi')) {
    const { opsi } = body;
    if (!Array.isArray(opsi) || opsi.length < MIN_OPSI || opsi.length > MAX_OPSI) {
      return { error: `Opsi jawaban harus berisi ${MIN_OPSI} sampai ${MAX_OPSI} pilihan.` };
    }
    if (!opsi.every((o) => teksTerisi(o?.opsi))) return { error: 'Setiap opsi jawaban wajib berisi teks.' };
    if (opsi.filter((o) => o.isCorrect === true).length !== 1) {
      return { error: 'Harus ada tepat satu opsi jawaban yang benar.' };
    }
    data.opsi = opsi.map((o) => ({ opsi: o.opsi.trim(), isCorrect: o.isCorrect === true }));
  }

  return { data };
};

// Bentuk respons: difficulty jadi teks, opsi urut sesuai labelnya (A, B, C, ...).
// Admin melihat kunci jawaban, pembahasan, dan ringkasan. Mahasiswa tidak, supaya
// jawabannya tidak bisa diintip lewat Network tab sebelum mengerjakan kuis.
const keRespons = (soal, isAdmin) => {
  const opsi = [...soal.opsi].sort((a, b) => a.opsi.localeCompare(b.opsi));
  const hasil = { ...soal, difficulty: ANGKA_KE_DIFFICULTY[soal.difficulty] ?? null, opsi };
  if (isAdmin) return hasil;

  const { pembahasan, ringkasan, ...sisa } = hasil;
  return { ...sisa, opsi: opsi.map(({ isCorrect, ...o }) => o) };
};

const urutkanSoal = (query) =>
  query.order('urutan', { ascending: true, nullsFirst: false }).order('idSoal', { ascending: true });

// Soal tidak punya pemilik sendiri — pemiliknya adalah pembuat kuisnya.
// Mengembalikan { status, message } kalau ditolak, atau null kalau admin ini boleh mengurusnya.
const cekAksesKuis = async (idKuis, currentUserId) => {
  // Soal tanpa kuis = bank soal, boleh diurus admin mana pun.
  if (idKuis === null) return null;

  const { data: kuis, error } = await supabaseAdmin
    .from('Kuis')
    .select(KOLOM_AKSES_KUIS)
    .eq('idKuis', idKuis)
    .maybeSingle();

  if (error || !kuis) {
    return { status: 404, message: 'Kuis tidak ditemukan.' };
  }

  // idUser NULL = pembuatnya sudah dihapus, kuisnya diwariskan ke semua admin.
  if (!bisaDikelola(kuis, { id: currentUserId, role: ROLE.ADMIN })) {
    return { status: 403, message: 'Kamu belum diberi hak untuk mengelola soal kuis ini.' };
  }

  return null;
};

// ── Soal per kuis: dipakai halaman editor soal di frontend ──

// GET /api/kuis/:idKuis/soal — semua soal satu kuis, urut sesuai saat disimpan.
export const getSoalKuis = async (req, res) => {
  try {
    const { idKuis } = req.params;

    const { data: kuis } = await supabaseAdmin.from('Kuis').select('idKuis').eq('idKuis', idKuis).maybeSingle();
    if (!kuis) {
      return res.status(404).json(errorResponse({ message: 'Kuis tidak ditemukan.' }));
    }

    const { data, error } = await urutkanSoal(
      supabaseAdmin.from('Soal').select(SOAL_SELECT).eq('idKuis', idKuis),
    );

    if (error) {
      return res.status(500).json(errorResponse({ message: error.message }));
    }

    const isAdmin = req.currentUser.role === ROLE.ADMIN;
    return res.json(
      successResponse({ message: 'Berhasil mengambil soal.', data: data.map((s) => keRespons(s, isAdmin)) }),
    );
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal mengambil soal.' }));
  }
};

// PUT /api/kuis/:idKuis/soal — mengganti SELURUH soal kuis dengan daftar yang dikirim.
// Editor frontend selalu mengirim daftar lengkap, jadi tidak perlu melacak mana yang ditambah/dihapus.
export const simpanSoalKuis = async (req, res) => {
  try {
    const { idKuis } = req.params;
    const { soal } = req.body;

    if (!Array.isArray(soal)) {
      return res.status(400).json(errorResponse({ message: 'Body harus berisi daftar soal: { "soal": [...] }.' }));
    }

    const daftar = [];
    for (let i = 0; i < soal.length; i++) {
      const { error, data } = siapkanSoal(soal[i] ?? {}, { wajibSemua: true });
      if (error) {
        return res.status(400).json(errorResponse({ message: `Soal ${i + 1}: ${error}` }));
      }
      daftar.push(data);
    }

    const akses = await cekAksesKuis(idKuis, req.currentUser.id);
    if (akses) {
      return res.status(akses.status).json(errorResponse({ message: akses.message }));
    }

    // Hapus soal lama + simpan soal baru dijalankan dalam satu transaksi di database
    // (fungsi simpan_soal_kuis). Kalau ada yang gagal, soal lama tetap utuh.
    const { error: rpcError } = await supabaseAdmin.rpc('simpan_soal_kuis', { p_id_kuis: idKuis, p_soal: daftar });

    if (rpcError) {
      // 23503 = foreign key violation — soal lama sudah dijawab mahasiswa (JawabanMahasiswa)
      if (rpcError.code === '23503') {
        return res.status(409).json(
          errorResponse({ message: 'Soal kuis ini tidak bisa diganti karena sudah pernah dikerjakan mahasiswa.' }),
        );
      }
      return res.status(500).json(errorResponse({ message: rpcError.message || 'Gagal menyimpan soal.' }));
    }

    const { data, error } = await urutkanSoal(
      supabaseAdmin.from('Soal').select(SOAL_SELECT).eq('idKuis', idKuis),
    );

    if (error) {
      return res.status(500).json(errorResponse({ message: error.message }));
    }

    return res.json(
      successResponse({
        message: `${data.length} soal berhasil disimpan.`,
        data: data.map((s) => keRespons(s, true)),
      }),
    );
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal menyimpan soal.' }));
  }
};

// ── Soal satuan: /api/soal ──

// Bisa difilter per kuis lewat query ?idKuis=...
export const getAllSoal = async (req, res) => {
  try {
    const { idKuis } = req.query;

    let query = supabaseAdmin.from('Soal').select(SOAL_SELECT);
    if (idKuis) {
      query = query.eq('idKuis', idKuis);
    }

    const { data, error } = await urutkanSoal(query);

    if (error) {
      return res.status(500).json(errorResponse({ message: error.message }));
    }

    const isAdmin = req.currentUser.role === ROLE.ADMIN;
    return res.json(
      successResponse({ message: 'Berhasil mengambil daftar soal.', data: data.map((s) => keRespons(s, isAdmin)) }),
    );
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal mengambil daftar soal.' }));
  }
};

export const getSoalById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin.from('Soal').select(SOAL_SELECT).eq('idSoal', id).single();

    if (error || !data) {
      return res.status(404).json(errorResponse({ message: 'Soal tidak ditemukan.' }));
    }

    const isAdmin = req.currentUser.role === ROLE.ADMIN;
    return res.json(successResponse({ message: 'Berhasil mengambil soal.', data: keRespons(data, isAdmin) }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal mengambil soal.' }));
  }
};

// Hanya admin (guru). Soal dan opsinya dikirim sekaligus.
// Tanpa idKuis, soal masuk bank soal.
export const createSoal = async (req, res) => {
  try {
    const idKuis = req.body.idKuis ?? null;
    const { error: validasiError, data } = siapkanSoal(req.body, { wajibSemua: true });

    if (validasiError) {
      return res.status(400).json(errorResponse({ message: validasiError }));
    }

    const akses = await cekAksesKuis(idKuis, req.currentUser.id);
    if (akses) {
      return res.status(akses.status === 404 ? 400 : akses.status).json(errorResponse({ message: akses.message }));
    }

    const { opsi, ...kolomSoal } = data;

    const { data: soal, error: soalError } = await supabaseAdmin
      .from('Soal')
      .insert({ ...kolomSoal, idKuis })
      .select('idSoal')
      .single();

    if (soalError) {
      return res.status(500).json(errorResponse({ message: soalError.message || 'Gagal membuat soal.' }));
    }

    const { error: opsiError } = await supabaseAdmin
      .from('OpsiJawaban')
      .insert(opsi.map((o) => ({ ...o, idSoal: soal.idSoal })));

    if (opsiError) {
      // rollback soal kalau opsinya gagal, biar tidak ada soal tanpa pilihan jawaban
      await supabaseAdmin.from('Soal').delete().eq('idSoal', soal.idSoal);
      return res.status(500).json(errorResponse({ message: opsiError.message || 'Gagal menyimpan opsi jawaban.' }));
    }

    const { data: hasil } = await supabaseAdmin.from('Soal').select(SOAL_SELECT).eq('idSoal', soal.idSoal).single();

    return res.status(201).json(successResponse({ message: 'Soal berhasil dibuat.', data: keRespons(hasil, true) }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal membuat soal.' }));
  }
};

// Hanya admin pemilik kuis soal ini. Hanya field yang dikirim yang diubah.
// Kalau `opsi` dikirim, seluruh opsi lama diganti.
export const updateSoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { idKuis } = req.body;

    const { error: validasiError, data } = siapkanSoal(req.body, { wajibSemua: false });
    if (validasiError) {
      return res.status(400).json(errorResponse({ message: validasiError }));
    }
    if (Object.keys(data).length === 0 && idKuis === undefined) {
      return res.status(400).json(errorResponse({ message: 'Tidak ada data yang diubah.' }));
    }

    const { data: existing, error: findError } = await supabaseAdmin
      .from('Soal')
      .select('idSoal, idKuis')
      .eq('idSoal', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json(errorResponse({ message: 'Soal tidak ditemukan.' }));
    }

    const aksesLama = await cekAksesKuis(existing.idKuis, req.currentUser.id);
    if (aksesLama) {
      return res.status(aksesLama.status).json(errorResponse({ message: aksesLama.message }));
    }

    const { opsi, ...updatePayload } = data;

    if (idKuis !== undefined && idKuis !== existing.idKuis) {
      const aksesBaru = await cekAksesKuis(idKuis, req.currentUser.id);
      if (aksesBaru) {
        return res.status(aksesBaru.status === 404 ? 400 : aksesBaru.status).json(errorResponse({ message: aksesBaru.message }));
      }
      updatePayload.idKuis = idKuis;
      // Soal yang pindah kuis ditaruh di akhir, bukan menyelip di urutan kuis barunya.
      updatePayload.urutan = null;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabaseAdmin.from('Soal').update(updatePayload).eq('idSoal', id);
      if (error) {
        return res.status(500).json(errorResponse({ message: error.message || 'Gagal memperbarui soal.' }));
      }
    }

    if (opsi) {
      const { data: opsiLama, error: opsiLamaError } = await supabaseAdmin
        .from('OpsiJawaban')
        .select('idOpsi')
        .eq('idSoal', id);

      if (opsiLamaError) {
        return res.status(500).json(errorResponse({ message: opsiLamaError.message }));
      }

      // Opsi baru dimasukkan dulu, baru opsi lama dihapus. Kalau salah satu
      // langkah gagal, soalnya tetap punya satu set opsi yang utuh.
      const { data: opsiBaru, error: insertError } = await supabaseAdmin
        .from('OpsiJawaban')
        .insert(opsi.map((o) => ({ ...o, idSoal: id })))
        .select('idOpsi');

      if (insertError) {
        return res.status(500).json(errorResponse({ message: insertError.message || 'Gagal menyimpan opsi jawaban.' }));
      }

      const { error: deleteError } = await supabaseAdmin
        .from('OpsiJawaban')
        .delete()
        .in('idOpsi', opsiLama.map((o) => o.idOpsi));

      if (deleteError) {
        await supabaseAdmin.from('OpsiJawaban').delete().in('idOpsi', opsiBaru.map((o) => o.idOpsi));
        // 23503 = foreign key violation — opsi lama sudah dipilih mahasiswa di JawabanMahasiswa
        if (deleteError.code === '23503') {
          return res.status(409).json(
            errorResponse({ message: 'Opsi jawaban tidak bisa diganti karena soal ini sudah pernah dijawab mahasiswa.' }),
          );
        }
        return res.status(500).json(errorResponse({ message: deleteError.message || 'Gagal mengganti opsi jawaban.' }));
      }
    }

    const { data: hasil, error } = await supabaseAdmin.from('Soal').select(SOAL_SELECT).eq('idSoal', id).single();

    if (error) {
      return res.status(500).json(errorResponse({ message: error.message }));
    }

    return res.json(successResponse({ message: 'Soal berhasil diperbarui.', data: keRespons(hasil, true) }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal memperbarui soal.' }));
  }
};

// Hanya admin pemilik kuis soal ini
export const deleteSoal = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabaseAdmin
      .from('Soal')
      .select('idSoal, idKuis')
      .eq('idSoal', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json(errorResponse({ message: 'Soal tidak ditemukan.' }));
    }

    const akses = await cekAksesKuis(existing.idKuis, req.currentUser.id);
    if (akses) {
      return res.status(akses.status).json(errorResponse({ message: akses.message }));
    }

    // Soal yang sudah dijawab mahasiswa jangan dihapus — riwayat nilainya ikut hilang.
    const { count, error: countError } = await supabaseAdmin
      .from('JawabanMahasiswa')
      .select('idJawaban', { count: 'exact', head: true })
      .eq('idSoal', id);

    if (countError) {
      return res.status(500).json(errorResponse({ message: countError.message }));
    }
    if (count > 0) {
      return res.status(409).json(
        errorResponse({ message: 'Soal tidak bisa dihapus karena sudah pernah dijawab mahasiswa.' }),
      );
    }

    const { error: opsiError } = await supabaseAdmin.from('OpsiJawaban').delete().eq('idSoal', id);
    if (opsiError) {
      return res.status(500).json(errorResponse({ message: opsiError.message || 'Gagal menghapus opsi jawaban.' }));
    }

    const { error } = await supabaseAdmin.from('Soal').delete().eq('idSoal', id);
    if (error) {
      return res.status(500).json(errorResponse({ message: error.message || 'Gagal menghapus soal.' }));
    }

    return res.json(successResponse({ message: 'Soal berhasil dihapus.' }));
  } catch (error) {
    return res.status(500).json(errorResponse({ message: error.message || 'Gagal menghapus soal.' }));
  }
};
