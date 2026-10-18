// controllers/RekapController.js
// Rekap skor fuzzy untuk dosen (menu Report Nilai di frontend, Figma HA6-HA8).
// Semua endpoint hanya membaca data. Kontraknya: frontend/docs/KONTRAK_API_REKAP.md.
import { supabaseAdmin } from '../config/db.js';
import { successResponse, errorResponse } from '../models/apiResponse.js';
import { bisaDikelola, KOLOM_AKSES_KUIS } from '../utils/aksesKuis.js';
import { jumlahSoalDikerjakan } from '../utils/acakSoal.js';
import { ringkasKuis, susunRekapKuis, susunSoalPengerjaan } from '../services/rekapService.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KOLOM_KUIS = `${KOLOM_AKSES_KUIS}, idBab, judul, durasi, pin, acakSoal, jumlahTampil, tanggalDibuat, bab:Bab(namaBab)`;
const KOLOM_PENGERJAAN =
  'idPengerjaan, idUser, idKuis, attempt, skorFuzzy, kategoriFuzzy, totalBenar, totalSoal, waktuSelesai, hasilDetail, mahasiswa:User(nama, username)';

const idInvalid = (res) => res.status(400).json(errorResponse({ message: 'ID harus berupa UUID yang valid.' }));
const dbError = (res, error, fallback) =>
  res.status(500).json(errorResponse({ message: error?.message || fallback }));
const bukanPengelola = (res) =>
  res.status(403).json(errorResponse({ message: 'Anda hanya bisa melihat rekap kuis yang Anda kelola.' }));
const dua = (n) => Number(Number(n).toFixed(2));

// Supabase membatasi 1000 baris per permintaan, jadi pengerjaan diambil per halaman.
async function ambilSemua(buatQuery) {
  const BATAS = 1000;
  const semua = [];
  for (let dari = 0; ; dari += BATAS) {
    const { data, error } = await buatQuery().order('idPengerjaan').range(dari, dari + BATAS - 1);
    if (error) return { data: null, error };
    semua.push(...data);
    if (data.length < BATAS) return { data: semua, error: null };
  }
}

const ambilSoalKuis = (idKuis) =>
  supabaseAdmin.from('Soal').select('idSoal, urutan, pertanyaan').eq('idKuis', idKuis);

// GET /api/rekap/kuis — kuis yang bisa dikelola dosen ini beserta ringkasannya.
export const getRekapDaftarKuis = async (req, res) => {
  try {
    const { data: semuaKuis, error } = await supabaseAdmin
      .from('Kuis')
      .select(`${KOLOM_KUIS}, Soal(count)`)
      .order('tanggalDibuat', { ascending: false });
    if (error) return dbError(res, error, 'Gagal mengambil daftar kuis.');

    const kuis = semuaKuis.filter((k) => bisaDikelola(k, req.currentUser));
    const idKuis = kuis.map((k) => k.idKuis);

    const perKuis = new Map();
    if (idKuis.length) {
      const { data: attempts, error: attemptsError } = await ambilSemua(() => supabaseAdmin
        .from('PengerjaanKuis')
        .select('idPengerjaan, idKuis, idUser, attempt, skorFuzzy, waktuSelesai')
        .in('idKuis', idKuis)
        .eq('status', 'selesai'));
      if (attemptsError) return dbError(res, attemptsError, 'Gagal mengambil data pengerjaan.');
      for (const a of attempts) {
        if (!perKuis.has(a.idKuis)) perKuis.set(a.idKuis, []);
        perKuis.get(a.idKuis).push(a);
      }
    }

    const daftar = kuis
      .map((k) => ({
        idKuis: k.idKuis,
        judul: k.judul,
        idBab: k.idBab,
        namaBab: k.bab?.namaBab ?? null,
        jumlahSoal: jumlahSoalDikerjakan(k, k.Soal?.[0]?.count ?? 0),
        ...ringkasKuis(perKuis.get(k.idKuis) ?? []),
      }))
      // Yang terakhir dikerjakan di atas; kuis tanpa peserta di akhir.
      .sort((a, b) => (b.terakhirDikerjakan ? Date.parse(b.terakhirDikerjakan) : 0)
        - (a.terakhirDikerjakan ? Date.parse(a.terakhirDikerjakan) : 0));

    return res.json(successResponse({ message: 'Berhasil mengambil rekap kuis.', data: daftar }));
  } catch (error) {
    return dbError(res, error, 'Gagal mengambil rekap kuis.');
  }
};

// GET /api/rekap/kuis/:idKuis — isi halaman rekap satu kuis.
export const getRekapKuis = async (req, res) => {
  try {
    const { idKuis } = req.params;
    if (!UUID.test(idKuis)) return idInvalid(res);

    const { data: kuis, error } = await supabaseAdmin.from('Kuis').select(KOLOM_KUIS).eq('idKuis', idKuis).maybeSingle();
    if (error) return dbError(res, error, 'Gagal mengambil kuis.');
    if (!kuis) return res.status(404).json(errorResponse({ message: 'Kuis tidak ditemukan.' }));
    if (!bisaDikelola(kuis, req.currentUser)) return bukanPengelola(res);

    const [{ data: soal, error: soalError }, { data: attempts, error: attemptsError }] = await Promise.all([
      ambilSoalKuis(idKuis),
      ambilSemua(() => supabaseAdmin
        .from('PengerjaanKuis')
        .select(KOLOM_PENGERJAAN)
        .eq('idKuis', idKuis)
        .eq('status', 'selesai')),
    ]);
    if (soalError) return dbError(res, soalError, 'Gagal mengambil soal kuis.');
    if (attemptsError) return dbError(res, attemptsError, 'Gagal mengambil data pengerjaan.');

    return res.json(successResponse({
      message: 'Berhasil mengambil rekap kuis.',
      data: {
        kuis: {
          idKuis: kuis.idKuis,
          judul: kuis.judul,
          idBab: kuis.idBab,
          namaBab: kuis.bab?.namaBab ?? null,
          durasi: kuis.durasi,
          jumlahSoal: jumlahSoalDikerjakan(kuis, soal.length),
          adaPin: kuis.pin !== null,
        },
        ...susunRekapKuis({ attempts, soal }),
      },
    }));
  } catch (error) {
    return dbError(res, error, 'Gagal mengambil rekap kuis.');
  }
};

// GET /api/rekap/pengerjaan/:idPengerjaan — detail satu percobaan satu mahasiswa.
export const getRekapPengerjaan = async (req, res) => {
  try {
    const { idPengerjaan } = req.params;
    if (!UUID.test(idPengerjaan)) return idInvalid(res);

    const { data: attempt, error } = await supabaseAdmin
      .from('PengerjaanKuis')
      .select(`${KOLOM_PENGERJAAN}, status, waktuMulai, durasiPengerjaan, rekomendasi`)
      .eq('idPengerjaan', idPengerjaan)
      .maybeSingle();
    if (error) return dbError(res, error, 'Gagal mengambil pengerjaan.');
    if (!attempt || attempt.status !== 'selesai') {
      return res.status(404).json(errorResponse({ message: 'Pengerjaan tidak ditemukan atau belum selesai.' }));
    }

    const { data: kuis, error: kuisError } = await supabaseAdmin
      .from('Kuis').select(KOLOM_KUIS).eq('idKuis', attempt.idKuis).maybeSingle();
    if (kuisError) return dbError(res, kuisError, 'Gagal mengambil kuis.');
    if (!kuis) return res.status(404).json(errorResponse({ message: 'Kuis tidak ditemukan.' }));
    if (!bisaDikelola(kuis, req.currentUser)) return bukanPengelola(res);

    const [{ data: soal, error: soalError }, { count, error: countError }] = await Promise.all([
      ambilSoalKuis(attempt.idKuis),
      supabaseAdmin
        .from('PengerjaanKuis')
        .select('idPengerjaan', { count: 'exact', head: true })
        .eq('idKuis', attempt.idKuis)
        .eq('idUser', attempt.idUser)
        .eq('status', 'selesai'),
    ]);
    if (soalError) return dbError(res, soalError, 'Gagal mengambil soal kuis.');
    if (countError) return dbError(res, countError, 'Gagal menghitung percobaan.');

    return res.json(successResponse({
      message: 'Berhasil mengambil detail pengerjaan.',
      data: {
        idPengerjaan: attempt.idPengerjaan,
        attempt: attempt.attempt,
        jumlahPercobaan: count ?? attempt.attempt,
        waktuMulai: attempt.waktuMulai,
        waktuSelesai: attempt.waktuSelesai,
        waktuPengerjaan: attempt.durasiPengerjaan,
        skorFuzzy: dua(Number(attempt.skorFuzzy) || 0),
        kategoriFuzzy: attempt.kategoriFuzzy,
        totalBenar: attempt.totalBenar,
        totalSoal: attempt.totalSoal,
        rekomendasi: attempt.rekomendasi,
        mahasiswa: { idUser: attempt.idUser, nama: attempt.mahasiswa?.nama ?? null, nim: attempt.mahasiswa?.username ?? null },
        kuis: { idKuis: kuis.idKuis, judul: kuis.judul, namaBab: kuis.bab?.namaBab ?? null },
        soal: susunSoalPengerjaan({ hasilDetail: attempt.hasilDetail, soal }),
      },
    }));
  } catch (error) {
    return dbError(res, error, 'Gagal mengambil detail pengerjaan.');
  }
};
