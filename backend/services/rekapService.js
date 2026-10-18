// services/rekapService.js
// Perhitungan rekap skor fuzzy untuk dosen (menu Report Nilai). Fungsi di sini murni:
// menerima baris dari tabel PengerjaanKuis/Soal, tidak memanggil database, supaya mudah dites.
// Aturan lengkapnya ada di frontend/docs/KONTRAK_API_REKAP.md.
import { LINGUISTIC_LEVELS } from './fuzzy/membership.js';

const KATEGORI = [
  LINGUISTIC_LEVELS.TINGGI,
  LINGUISTIC_LEVELS.SEDANG,
  LINGUISTIC_LEVELS.RENDAH,
  LINGUISTIC_LEVELS.SANGAT_RENDAH,
];

const dua = (n) => Number(Number(n).toFixed(2));
const rataRata = (angka) => (angka.length ? dua(angka.reduce((a, b) => a + b, 0) / angka.length) : null);
const waktu = (iso) => (iso ? new Date(iso).getTime() : 0);

// Satu mahasiswa = percobaan terakhir (attempt terbesar). Input hanya attempt berstatus selesai.
export function pilihPercobaanTerakhir(attempts = []) {
  const perMahasiswa = new Map();
  for (const a of attempts) {
    const ada = perMahasiswa.get(a.idUser);
    if (!ada) {
      perMahasiswa.set(a.idUser, { terakhir: a, jumlah: 1 });
      continue;
    }
    ada.jumlah += 1;
    const lebihBaru = a.attempt > ada.terakhir.attempt
      || (a.attempt === ada.terakhir.attempt && waktu(a.waktuSelesai) > waktu(ada.terakhir.waktuSelesai));
    if (lebihBaru) ada.terakhir = a;
  }
  return perMahasiswa;
}

// Ringkasan satu kuis untuk daftar HA6.
export function ringkasKuis(attempts = []) {
  const terakhir = [...pilihPercobaanTerakhir(attempts).values()].map((p) => p.terakhir);
  return {
    jumlahPeserta: terakhir.length,
    rataRataSkorFuzzy: rataRata(terakhir.map((a) => Number(a.skorFuzzy) || 0)),
    terakhirDikerjakan: attempts.reduce(
      (maks, a) => (waktu(a.waktuSelesai) > waktu(maks) ? a.waktuSelesai : maks),
      null,
    ),
  };
}

// Nomor soal mengikuti urutan soal di kuis (Soal.urutan), bukan urutan acak saat dikerjakan,
// supaya "No. 4" di rekap kuis sama dengan "4" di detail pengerjaan.
export function nomorSoalKuis(soal = []) {
  const urut = [...soal].sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || String(a.idSoal).localeCompare(String(b.idSoal)));
  return new Map(urut.map((s, i) => [s.idSoal, { nomor: i + 1, pertanyaan: s.pertanyaan }]));
}

const idSoalItem = (item) => item?.soalId ?? item?.idSoal ?? null;

// Isi halaman HA7. attempts sudah berisi mahasiswa:User(nama, username) dan hasilDetail.
export function susunRekapKuis({ attempts = [], soal = [] }) {
  const perMahasiswa = pilihPercobaanTerakhir(attempts);
  const nomor = nomorSoalKuis(soal);
  const sebaranKategori = Object.fromEntries(KATEGORI.map((k) => [k, 0]));
  const statSoal = new Map();
  const mahasiswa = [];

  for (const { terakhir: a, jumlah } of perMahasiswa.values()) {
    if (a.kategoriFuzzy in sebaranKategori) sebaranKategori[a.kategoriFuzzy] += 1;
    for (const item of Array.isArray(a.hasilDetail) ? a.hasilDetail : []) {
      const id = idSoalItem(item);
      if (id === null) continue;
      const s = statSoal.get(id) ?? { total: 0, benar: 0, waktu: 0 };
      s.total += 1;
      if (item.meta?.isCorrect) s.benar += 1;
      s.waktu += Number(item.meta?.responseTime) || 0;
      statSoal.set(id, s);
    }
    mahasiswa.push({
      idUser: a.idUser,
      nama: a.mahasiswa?.nama ?? null,
      nim: a.mahasiswa?.username ?? null,
      idPengerjaan: a.idPengerjaan,
      attempt: a.attempt,
      jumlahPercobaan: jumlah,
      skorFuzzy: dua(Number(a.skorFuzzy) || 0),
      kategoriFuzzy: a.kategoriFuzzy,
      totalBenar: a.totalBenar,
      totalSoal: a.totalSoal,
      waktuSelesai: a.waktuSelesai,
    });
  }

  // Soal yang sudah dihapus dari kuis tidak ikut ditampilkan.
  const soalPalingBanyakSalah = [...statSoal]
    .filter(([id]) => nomor.has(id))
    .map(([id, s]) => ({
      idSoal: id,
      nomor: nomor.get(id).nomor,
      pertanyaan: nomor.get(id).pertanyaan,
      persenBenar: dua((s.benar / s.total) * 100),
      rataRataWaktu: dua(s.waktu / s.total),
      jumlahMenjawab: s.total,
    }))
    .sort((a, b) => a.persenBenar - b.persenBenar || b.jumlahMenjawab - a.jumlahMenjawab || a.nomor - b.nomor)
    .slice(0, 5);

  return {
    ringkasan: {
      jumlahPeserta: mahasiswa.length,
      rataRataSkorFuzzy: rataRata(mahasiswa.map((m) => m.skorFuzzy)),
      jumlahSangatRendah: sebaranKategori[LINGUISTIC_LEVELS.SANGAT_RENDAH],
    },
    sebaranKategori,
    soalPalingBanyakSalah,
    mahasiswa,
  };
}

// Daftar jawaban per soal untuk halaman HA8, dari PengerjaanKuis.hasilDetail.
export function susunSoalPengerjaan({ hasilDetail = [], soal = [] }) {
  const nomor = nomorSoalKuis(soal);
  return (Array.isArray(hasilDetail) ? hasilDetail : [])
    .map((item) => {
      const id = idSoalItem(item);
      const info = nomor.get(id);
      return {
        nomor: info?.nomor ?? item.nomorSoal,
        idSoal: id,
        pertanyaan: info?.pertanyaan ?? null,
        isCorrect: item.meta?.isCorrect === true,
        responseTime: Number(item.meta?.responseTime) || 0,
        targetTime: Number(item.meta?.targetTime) || 60,
        difficulty: item.meta?.difficulty ?? null,
        skorFuzzy: dua(Number(item.crispScore) || 0),
        kategoriFuzzy: item.linguisticLevel ?? null,
      };
    })
    .sort((a, b) => a.nomor - b.nomor);
}
