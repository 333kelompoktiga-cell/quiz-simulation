import { reactive, ref } from 'vue'
import { kirimTerautentikasi } from './auth'

// Status regenerasi per bab: idBab -> boolean (reaktif global lintas halaman)
export const statusRegenerasi = reactive({})

// Cache data roadmap per bab: idBab -> data roadmap
export const roadmapCache = reactive({})

// Notifikasi global yang dapat diakses dan ditampilkan antar halaman
export const notifikasiPetaBelajar = ref('')

// Map promise yang sedang berjalan agar request tidak terputus saat berganti view/halaman
const pendingPromises = new Map()

const STORAGE_PREFIX = 'esikap_roadmap_regen_'

function syncStorage() {
  try {
    for (const [idBab, isRunning] of Object.entries(statusRegenerasi)) {
      if (isRunning) {
        sessionStorage.setItem(`${STORAGE_PREFIX}${idBab}`, Date.now().toString())
      } else {
        sessionStorage.removeItem(`${STORAGE_PREFIX}${idBab}`)
      }
    }
  } catch {
    // Abaikan jika sessionStorage tidak tersedia
  }
}

/**
 * Memeriksa apakah suatu bab sedang dalam proses regenerasi oleh AI
 */
export function isBabRegenerating(idBab) {
  if (statusRegenerasi[idBab]) return true

  try {
    const ts = sessionStorage.getItem(`${STORAGE_PREFIX}${idBab}`)
    if (ts) {
      // Berlaku hingga 60 detik jika halaman sempat di-refresh
      if (Date.now() - parseInt(ts, 10) < 60000) {
        statusRegenerasi[idBab] = true
        return true
      } else {
        sessionStorage.removeItem(`${STORAGE_PREFIX}${idBab}`)
      }
    }
  } catch {}

  return false
}

/**
 * Mengambil promise regenerasi yang sedang berjalan di latar belakang (jika ada)
 */
export function getOngoingRegeneratePromise(idBab) {
  return pendingPromises.get(idBab) || null
}

/**
 * Mengambil daftar ringkasan peta belajar seluruh bab
 */
export async function ambilDaftarPetaBelajar() {
  return (await kirimTerautentikasi('/peta-belajar', { method: 'GET' })).data
}

/**
 * Mengambil data roadmap bab (mendukung cache lokal dan menunggu proses latar belakang jika aktif)
 */
export async function ambilRoadmapBab(idBab, forceFresh = false) {
  // Jika sedang berjalan proses regenerasi di background untuk bab ini, tunggu hingga selesai
  if (pendingPromises.has(idBab)) {
    try {
      return await pendingPromises.get(idBab)
    } catch {
      // Jika regenerasi background gagal, lanjutkan fetch biasa
    }
  }

  // Gunakan cache lokal jika tidak dipaksa ambil baru
  if (!forceFresh && roadmapCache[idBab]) {
    return roadmapCache[idBab]
  }

  const res = await kirimTerautentikasi(`/peta-belajar/${encodeURIComponent(idBab)}`, { method: 'GET' })
  roadmapCache[idBab] = res.data
  return res.data
}

/**
 * Memicu pembaruan roadmap bab dari hasil kuis terbaru di latar belakang
 */
export async function perbaruiRoadmapBab(idBab) {
  // Jika bab ini sedang diproses di background, langsung sambungkan ke promise yang ada
  if (pendingPromises.has(idBab)) {
    return await pendingPromises.get(idBab)
  }

  statusRegenerasi[idBab] = true
  syncStorage()

  const promise = (async () => {
    try {
      const res = await kirimTerautentikasi(
        `/peta-belajar/${encodeURIComponent(idBab)}/regenerate`,
        { method: 'POST' }
      )
      const data = res.data
      roadmapCache[idBab] = data
      notifikasiPetaBelajar.value = `Roadmap "${data.namaBab || 'Materi'}" berhasil diperbarui dari kuis terbaru!`
      return data
    } finally {
      statusRegenerasi[idBab] = false
      pendingPromises.delete(idBab)
      syncStorage()
    }
  })()

  pendingPromises.set(idBab, promise)
  return await promise
}
