import { kirimTerautentikasi } from './auth'
import { EndpointBelumAdaError } from './kuis'

// Rekap skor fuzzy untuk dosen (menu Report Nilai, Figma HA6-HA8).
// Endpoint-nya belum ada di backend; bentuk yang diharapkan frontend ditulis
// di docs/KONTRAK_API_REKAP.md. Selama belum ada, halaman menampilkan
// "Data rekap belum tersedia" lewat EndpointBelumAdaError.

async function panggil(path) {
  try {
    return (await kirimTerautentikasi(path, { method: 'GET' })).data
  } catch (err) {
    if (err.status === 404 && !err.payload) throw new EndpointBelumAdaError()
    throw err
  }
}

export function ambilDaftarRekapKuis() {
  return panggil('/rekap/kuis')
}

export function ambilRekapKuis(idKuis) {
  return panggil(`/rekap/kuis/${encodeURIComponent(idKuis)}`)
}

export function ambilRekapPengerjaan(idPengerjaan) {
  return panggil(`/rekap/pengerjaan/${encodeURIComponent(idPengerjaan)}`)
}

// Urutan dan label kategori mengikuti backend (services/fuzzy/membership.js).
export const KATEGORI_FUZZY = ['Tinggi', 'Sedang', 'Rendah', 'Sangat Rendah']

const WARNA_KATEGORI = {
  Tinggi: { pill: 'bg-wf-ok-soft text-wf-ok-text', bar: 'bg-wf-ok' },
  Sedang: { pill: 'bg-wf-warn-soft text-wf-warn-text', bar: 'bg-wf-warn' },
  Rendah: { pill: 'bg-wf-no-soft text-wf-no-text', bar: 'bg-wf-no' },
  'Sangat Rendah': { pill: 'bg-wf-no-soft text-wf-no-text', bar: 'bg-wf-no' },
}

export function warnaKategori(kategori) {
  return WARNA_KATEGORI[kategori] ?? { pill: 'bg-wf-muted-surface text-wf-secondary', bar: 'bg-wf-muted' }
}

// "Sangat Rendah" dari backend ditulis "Sangat rendah" di layar (sentence case).
export function labelKategori(kategori) {
  return kategori === 'Sangat Rendah' ? 'Sangat rendah' : kategori || '-'
}

export function formatSkor(skor) {
  return skor == null ? '–' : String(Math.round(Number(skor)))
}

export function formatTanggal(iso, denganJam = false) {
  if (!iso) return '–'
  const opsi = { day: 'numeric', month: 'short', year: 'numeric' }
  if (denganJam) Object.assign(opsi, { hour: '2-digit', minute: '2-digit' })
  return new Date(iso).toLocaleString('id-ID', opsi)
}

// Durasi pengerjaan dari backend dalam detik (PengerjaanKuis.durasiPengerjaan),
// ditulis lengkap menit dan detik, mis. "1 mnt 25 dtk".
export function formatDurasi(detik) {
  const d = Math.max(0, Math.round(Number(detik) || 0))
  const menit = Math.floor(d / 60)
  const sisa = d % 60
  if (!menit) return `${sisa} dtk`
  return sisa ? `${menit} mnt ${sisa} dtk` : `${menit} mnt`
}

// Penanda waktu per soal yang salah, memakai batas himpunan "Cepat" dan "Lama"
// di fuzzifyResponseTime (backend): <= 30% target = cepat, >= 110% target = lama.
export function catatanWaktuSoal(soal) {
  if (soal.isCorrect) return ''
  const target = Number(soal.targetTime) > 0 ? Number(soal.targetTime) : 60
  const waktu = Number(soal.responseTime) || 0
  if (waktu <= 0.3 * target) return 'terburu-buru'
  if (waktu >= 1.1 * target) return 'ragu'
  return ''
}

// CSV dengan pemisah titik koma dan BOM supaya langsung terbaca rapi di Excel
// berbahasa Indonesia. Skor dibulatkan seperti yang tampil di layar.
export function unduhCsvRekap(judulKuis, daftarMahasiswa) {
  const sel = (v) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const baris = [
    ['Nama', 'NIM', 'Skor fuzzy', 'Kategori', 'Benar', 'Jumlah soal', 'Percobaan', 'Selesai'],
    ...daftarMahasiswa.map((m) => [
      m.nama,
      m.nim,
      formatSkor(m.skorFuzzy),
      labelKategori(m.kategoriFuzzy),
      m.totalBenar,
      m.totalSoal,
      m.jumlahPercobaan,
      formatTanggal(m.waktuSelesai, true),
    ]),
  ]
  const isi = '﻿' + baris.map((b) => b.map(sel).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `rekap-${(judulKuis || 'kuis').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
