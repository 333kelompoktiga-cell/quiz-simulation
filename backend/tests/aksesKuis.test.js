import test from 'node:test';
import assert from 'node:assert/strict';
import { bisaDikelola, bisaAturAkses } from '../utils/aksesKuis.js';
import { ROLE } from '../config/roles.js';

const pemilik = { id: 'pemilik', role: ROLE.ADMIN };
const dosen = { id: 'dosen', role: ROLE.ADMIN };
const kuis = { idUser: pemilik.id, aksesKelola: 'pribadi', dosenPengelola: [] };

test('kuis pribadi hanya dapat dikelola pemilik', () => {
  assert.equal(bisaDikelola(kuis, pemilik), true);
  assert.equal(bisaDikelola(kuis, dosen), false);
});
test('semua dosen dapat mengelola tanpa mendapat hak mengatur akses atau menghapus', () => {
  const bersama = { ...kuis, aksesKelola: 'semua' };
  assert.equal(bisaDikelola(bersama, dosen), true);
  assert.equal(bisaAturAkses(bersama, dosen), false);
  assert.equal(bisaAturAkses(bersama, pemilik), true);
});
test('mode tertentu membatasi pengelola ke dosen terpilih', () => {
  const bersama = { ...kuis, aksesKelola: 'tertentu', dosenPengelola: [dosen.id] };
  assert.equal(bisaDikelola(bersama, dosen), true);
  assert.equal(bisaDikelola(bersama, { id: 'lain', role: ROLE.ADMIN }), false);
  assert.equal(bisaDikelola(bersama, pemilik), true);
});
test('mencabut akses berlaku pada pemeriksaan berikutnya', () => {
  assert.equal(bisaDikelola({ ...kuis, aksesKelola: 'tertentu', dosenPengelola: [] }, dosen), false);
  assert.equal(bisaDikelola({ ...kuis, dosenPengelola: [dosen.id] }, dosen), false);
});
test('mahasiswa dan super admin tidak mendapat hak kelola dosen', () => {
  for (const role of [ROLE.MAHASISWA, ROLE.SUPER_ADMIN]) {
    for (const aksesKelola of ['pribadi', 'semua', 'tertentu']) {
      const bersama = { ...kuis, aksesKelola, dosenPengelola: [pemilik.id] };
      const user = { id: pemilik.id, role };
      assert.equal(bisaDikelola(bersama, user), false);
      assert.equal(bisaAturAkses(bersama, user), false);
    }
  }
});
test('kuis tanpa pemilik tetap dapat diwarisi dosen', () => {
  assert.equal(bisaDikelola({ ...kuis, idUser: null }, dosen), true);
  assert.equal(bisaAturAkses({ ...kuis, idUser: null }, dosen), true);
});
