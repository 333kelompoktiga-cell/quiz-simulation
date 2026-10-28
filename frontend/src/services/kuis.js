import { kirimTerautentikasi } from './auth'

// Endpoint Bab dan Kuis sudah ada di backend. Endpoint Soal belum; bentuk
// yang diharapkan frontend ditulis di docs/KONTRAK_API_SOAL.md supaya tim
// backend bisa menyamakan tanpa menebak.

export const TINGKAT_KESULITAN = ['Mudah', 'Sedang', 'Sulit']

// Dilempar kalau route-nya belum dibuat di backend. Express membalas 404
// berupa HTML, jadi payload-nya kosong, beda dengan 404 "data tidak ada".
export class EndpointBelumAdaError extends Error {
  constructor(message = 'Endpoint ini belum tersedia di backend.') {
    super(message)
    this.name = 'EndpointBelumAdaError'
  }
}

async function panggil(path, opsi) {
  try {
    return await kirimTerautentikasi(path, opsi)
  } catch (err) {
    if (err.status === 404 && !err.payload) throw new EndpointBelumAdaError()
    throw err
  }
}

// Fungsi Bab tinggal di services/bab.js; diekspor ulang supaya halaman
// kuis cukup mengimpor dari satu tempat.
export { ambilDaftarBab } from './bab'

// ── Kuis ──

// Tanpa idBab: semua kuis. Dengan idBab: hanya kuis di bab itu (filter
// ?idBab= sudah didukung getAllKuis di backend).
export async function ambilDaftarKuis(idBab) {
  const query = idBab ? `?idBab=${encodeURIComponent(idBab)}` : ''
  return (await panggil(`/kuis${query}`, { method: 'GET' })).data
}

export async function ambilKuis(idKuis) {
  return (await panggil(`/kuis/${idKuis}`, { method: 'GET' })).data
}

export async function ambilDosenPengelola() {
  return (await panggil('/kuis/dosen-pengelola', { method: 'GET' })).data
}

export async function ubahAksesKuis(idKuis, data) {
  return (await panggil(`/kuis/${idKuis}/akses`, { method: 'PUT', body: data })).data
}

export async function buatKuis(data) {
  return (await panggil('/kuis', { body: data })).data
}

export async function ubahKuis(idKuis, data) {
  return (await panggil(`/kuis/${idKuis}`, { method: 'PUT', body: data })).data
}

export async function hapusKuis(idKuis) {
  return (await panggil(`/kuis/${idKuis}`, { method: 'DELETE' })).message
}

// ── Soal (menunggu backend) ──

// Opsi disimpan di database lengkap dengan labelnya ("A. teks"), mengikuti
// data hasil Ekstrak Soal. Di editor labelnya dilepas supaya urutan opsi
// bisa diubah tanpa guru mengetik ulang hurufnya.
const LABEL_OPSI = /^[A-Z]\.\s*/

export function hurufOpsi(index) {
  return String.fromCharCode(65 + index)
}

function keEditor(soal) {
  const opsi = Array.isArray(soal?.opsi) ? soal.opsi : []
  const kunci = opsi.findIndex((o) => o.isCorrect)
  return {
    pertanyaan: typeof soal?.pertanyaan === 'string' ? soal.pertanyaan : '',
    opsi: opsi.map((o) => (typeof o?.opsi === 'string' ? o.opsi : '').replace(LABEL_OPSI, '')),
    kunci: kunci === -1 ? null : kunci,
    difficulty: soal?.difficulty ?? 'Sedang',
    targetTime: soal?.targetTime ?? 60,
    pembahasan: typeof soal?.pembahasan === 'string' ? soal.pembahasan : '',
    ringkasan: typeof soal?.ringkasan === 'string' ? soal.ringkasan : '',
  }
}

function keApi(soal) {
  return {
    pertanyaan: soal.pertanyaan.trim(),
    difficulty: soal.difficulty,
    targetTime: Number(soal.targetTime),
    pembahasan: soal.pembahasan.trim() || null,
    ringkasan: soal.ringkasan.trim() || null,
    opsi: soal.opsi.map((teks, i) => ({
      opsi: `${hurufOpsi(i)}. ${teks.trim()}`,
      isCorrect: i === soal.kunci,
    })),
  }
}

export async function ambilSoalKuis(idKuis) {
  const payload = await panggil(`/kuis/${idKuis}/soal`, { method: 'GET' })
  return payload.data.map(keEditor)
}

// Menimpa seluruh soal milik kuis. Editor selalu mengirim daftar lengkap,
// jadi backend tidak perlu melacak soal mana yang ditambah atau dihapus.
export async function simpanSoalKuis(idKuis, daftarSoal) {
  const payload = await panggil(`/kuis/${idKuis}/soal`, {
    method: 'PUT',
    body: { soal: daftarSoal.map(keApi) },
  })
  return payload.data
}

// ── Pengerjaan kuis mahasiswa ──

export async function mulaiPengerjaanKuis(idKuis, pin) {
  const payload = await panggil('/pengerjaan', {
    method: 'POST',
    body: { idKuis, pin },
  })
  return payload.data
}

export async function simpanJawabanPengerjaan(idPengerjaan, jawaban) {
  const payload = await panggil(`/pengerjaan/${encodeURIComponent(idPengerjaan)}/jawaban`, {
    method: 'PUT',
    body: { jawaban },
  })
  return payload.data
}

export async function submitPengerjaanKuis(idPengerjaan, jawaban) {
  const payload = await panggil(`/pengerjaan/${encodeURIComponent(idPengerjaan)}/submit`, {
    method: 'POST',
    body: { jawaban },
  })
  return payload.data
}

export async function ambilHasilPengerjaan(idPengerjaan) {
  const payload = await panggil(`/pengerjaan/${encodeURIComponent(idPengerjaan)}`, {
    method: 'GET',
  })
  return payload.data
}

export async function ambilPembahasanPengerjaan(idPengerjaan) {
  const payload = await panggil(`/pengerjaan/${encodeURIComponent(idPengerjaan)}/pembahasan`, {
    method: 'GET',
  })
  return payload.data
}

export async function importSoalPdf({ file, idKuis, startPage, endPage, upload = true }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('idKuis', idKuis)
  formData.append('startPage', String(startPage))
  formData.append('endPage', String(endPage))
  formData.append('upload', String(upload))

  const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/soal/import-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: formData, // jangan set Content-Type manual
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 207) throw new Error(data.message || 'Gagal mengimpor soal dari PDF.')
  return data
}
