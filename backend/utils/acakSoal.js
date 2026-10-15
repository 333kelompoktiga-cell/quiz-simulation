// utils/acakSoal.js
//
// Aturan pengacakan soal kuis:
// - Urutan soal SELALU diacak, berbeda untuk tiap mahasiswa dan tiap percobaan.
// - "Acak soal" (hanya menampilkan sebagian soal) bisa dinyalakan dosen kalau kuis
//   punya minimal 20 soal. Jumlah yang ditampilkan minimal 10, dan selalu harus
//   menyisakan minimal 10 soal cadangan (50 soal → paling banyak 40 ditampilkan).
// - Kalau soal kurang dari 20, opsi itu tidak berlaku: semua soal ditampilkan (urutan tetap acak).
import { randomInt } from 'node:crypto';

export const MIN_SOAL_ACAK = 20;
export const MIN_TAMPIL = 10;
export const MIN_CADANGAN = 10;

export const maksTampil = (totalSoal) => totalSoal - MIN_CADANGAN;

// Validasi bentuk pengaturan dari body request. Batas atas (total - 10) tidak bisa dicek di sini
// karena soal bisa disimpan setelah pengaturan kuis; batas itu ditegakkan saat soal dipilih.
// Mengembalikan { error } atau { data } berisi kolom yang dikirim.
export function siapkanPengaturanAcak({ acakSoal, jumlahTampil }) {
  const data = {};
  if (acakSoal !== undefined) {
    if (typeof acakSoal !== 'boolean') return { error: 'acakSoal harus bernilai true atau false.' };
    data.acakSoal = acakSoal;
  }
  if (jumlahTampil !== undefined) {
    if (jumlahTampil !== null && (!Number.isInteger(jumlahTampil) || jumlahTampil < MIN_TAMPIL)) {
      return { error: `Jumlah soal yang ditampilkan minimal ${MIN_TAMPIL}.` };
    }
    data.jumlahTampil = jumlahTampil;
  }
  return { data };
}

// Berapa soal yang benar-benar dikerjakan mahasiswa untuk kuis dengan `totalSoal` soal.
export function jumlahSoalDikerjakan(kuis, totalSoal) {
  if (!kuis?.acakSoal || totalSoal < MIN_SOAL_ACAK) return totalSoal;
  const diminta = Number.isInteger(kuis.jumlahTampil) ? kuis.jumlahTampil : MIN_TAMPIL;
  return Math.min(Math.max(diminta, MIN_TAMPIL), maksTampil(totalSoal));
}

// Fisher-Yates dengan crypto.randomInt supaya hasil acak tidak bisa ditebak.
function kocok(daftar) {
  const hasil = [...daftar];
  for (let i = hasil.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

// Memilih soal untuk satu percobaan baru: diacak, lalu diambil sebanyak jumlah yang ditampilkan.
// Mengembalikan daftar idSoal berurutan (disimpan di PengerjaanKuis.urutanSoal).
export function pilihSoalPengerjaan(kuis, daftarSoal) {
  const jumlah = jumlahSoalDikerjakan(kuis, daftarSoal.length);
  return kocok(daftarSoal.map((soal) => soal.idSoal)).slice(0, jumlah);
}

// Soal milik satu percobaan, sesuai urutan yang tersimpan. Percobaan lama yang dibuat sebelum
// fitur ini (urutanSoal NULL) tetap memakai semua soal kuis dengan urutan aslinya.
export function soalMilikPengerjaan(attempt, daftarSoal) {
  if (!Array.isArray(attempt?.urutanSoal)) return daftarSoal;
  const soalById = new Map(daftarSoal.map((soal) => [soal.idSoal, soal]));
  return attempt.urutanSoal.map((id) => soalById.get(id)).filter(Boolean);
}
