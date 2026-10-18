import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pilihPercobaanTerakhir, ringkasKuis, nomorSoalKuis, susunRekapKuis, susunSoalPengerjaan,
} from '../services/rekapService.js';

const item = (soalId, isCorrect, responseTime, crispScore = 50, linguisticLevel = 'Sedang') => ({
  nomorSoal: 1, soalId, crispScore, linguisticLevel,
  meta: { isCorrect, responseTime, difficulty: 'Sedang', targetTime: 60 },
});
const soal = [
  { idSoal: 's2', urutan: 2, pertanyaan: 'Soal dua' },
  { idSoal: 's1', urutan: 1, pertanyaan: 'Soal satu' },
  { idSoal: 's3', urutan: 3, pertanyaan: 'Soal tiga' },
];

test('percobaan terakhir dipilih per mahasiswa dan jumlah percobaan dihitung', () => {
  const hasil = pilihPercobaanTerakhir([
    { idUser: 'a', attempt: 1, skorFuzzy: 40 },
    { idUser: 'a', attempt: 2, skorFuzzy: 70 },
    { idUser: 'b', attempt: 1, skorFuzzy: 90 },
  ]);
  assert.equal(hasil.get('a').terakhir.skorFuzzy, 70);
  assert.equal(hasil.get('a').jumlah, 2);
  assert.equal(hasil.get('b').jumlah, 1);
});

test('ringkasan kuis memakai rata-rata percobaan terakhir dan waktu selesai terbaru', () => {
  const r = ringkasKuis([
    { idUser: 'a', attempt: 1, skorFuzzy: 40, waktuSelesai: '2026-10-01T00:00:00Z' },
    { idUser: 'a', attempt: 2, skorFuzzy: 70, waktuSelesai: '2026-10-03T00:00:00Z' },
    { idUser: 'b', attempt: 1, skorFuzzy: 90, waktuSelesai: '2026-10-02T00:00:00Z' },
  ]);
  assert.deepEqual(r, { jumlahPeserta: 2, rataRataSkorFuzzy: 80, terakhirDikerjakan: '2026-10-03T00:00:00Z' });
});

test('kuis tanpa peserta punya rata-rata null', () => {
  assert.deepEqual(ringkasKuis([]), { jumlahPeserta: 0, rataRataSkorFuzzy: null, terakhirDikerjakan: null });
});

test('nomor soal mengikuti urutan di kuis', () => {
  const nomor = nomorSoalKuis(soal);
  assert.equal(nomor.get('s1').nomor, 1);
  assert.equal(nomor.get('s3').nomor, 3);
});

test('rekap kuis: sebaran kategori, perlu perhatian, dan soal paling banyak salah', () => {
  const r = susunRekapKuis({
    soal,
    attempts: [
      { idUser: 'a', idPengerjaan: 'p1', attempt: 1, skorFuzzy: 20, kategoriFuzzy: 'Sangat Rendah', hasilDetail: [item('s1', true, 10), item('s2', true, 10)] },
      { idUser: 'a', idPengerjaan: 'p2', attempt: 2, skorFuzzy: 85, kategoriFuzzy: 'Tinggi', mahasiswa: { nama: 'Ani', username: '111' }, hasilDetail: [item('s1', true, 20), item('s2', false, 3)] },
      { idUser: 'b', idPengerjaan: 'p3', attempt: 1, skorFuzzy: 15, kategoriFuzzy: 'Sangat Rendah', mahasiswa: { nama: 'Budi', username: '222' }, hasilDetail: [item('s1', false, 40), item('s2', false, 5), item('hapus', false, 5)] },
    ],
  });
  assert.equal(r.ringkasan.jumlahPeserta, 2);
  assert.equal(r.ringkasan.rataRataSkorFuzzy, 50);
  assert.equal(r.ringkasan.jumlahSangatRendah, 1);
  assert.deepEqual(r.sebaranKategori, { Tinggi: 1, Sedang: 0, Rendah: 0, 'Sangat Rendah': 1 });
  // Percobaan pertama Ani tidak dihitung; soal yang sudah dihapus tidak ditampilkan.
  assert.deepEqual(r.soalPalingBanyakSalah.map((s) => [s.nomor, s.persenBenar, s.rataRataWaktu]), [[2, 0, 4], [1, 50, 30]]);
  const ani = r.mahasiswa.find((m) => m.idUser === 'a');
  assert.equal(ani.idPengerjaan, 'p2');
  assert.equal(ani.jumlahPercobaan, 2);
  assert.equal(ani.nim, '111');
});

test('detail pengerjaan memetakan hasilDetail ke daftar soal berurutan', () => {
  const daftar = susunSoalPengerjaan({
    soal,
    hasilDetail: [item('s3', false, 3, 14.004, 'Sangat Rendah'), item('s1', true, 12, 72, 'Tinggi')],
  });
  assert.deepEqual(daftar.map((s) => [s.nomor, s.pertanyaan, s.isCorrect, s.skorFuzzy]), [
    [1, 'Soal satu', true, 72],
    [3, 'Soal tiga', false, 14],
  ]);
  assert.equal(daftar[1].kategoriFuzzy, 'Sangat Rendah');
  assert.equal(daftar[1].targetTime, 60);
});
