import { ROLE } from './roles'

const API_URL = import.meta.env.VITE_API_URL || '/api'

if (!API_URL) {
  console.error('VITE_API_URL belum diisi. Salin frontend/.env.example jadi frontend/.env lalu jalankan ulang `npm run dev`.')
}

const USER_KEY = 'user'
const TOKEN_KEY = 'token'
const REFRESH_KEY = 'refresh_token'
const EXPIRES_KEY = 'expires_at'
const NOTICE_KEY = 'session_notice'
const AVATAR_KEY = 'avatar_url'

// Token ditukar lebih awal, bukan tepat saat mati, supaya permintaan yang
// sedang berjalan tidak keburu ditolak di tengah jalan.
const AMBANG_PERBARUI_DETIK = 120

// Batas waktu tidak aktif (idle) sebelum sesi otomatis logout (dalam detik).
// Ubah nilai ini jika ingin mengganti durasi idle timeout (saat ini: 10 menit / 600 detik).
export const BATAS_IDLE_DETIK = 10 * 60
const LAST_ACTIVE_KEY = 'last_active_at'

function labelDurasiIdle() {
  return BATAS_IDLE_DETIK % 60 === 0 ? `${BATAS_IDLE_DETIK / 60} menit` : `${BATAS_IDLE_DETIK} detik`
}

// Dilempar kalau sesi benar-benar habis: refresh token ikut ditolak, atau
// akun direbut perangkat lain. Pemanggil cukup mengarahkan ke halaman login.
export class SessionExpiredError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

async function kirim(path, { method = 'POST', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error(`Tidak bisa terhubung ke server. Pastikan backend sudah jalan di ${API_URL}`)
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    // Biarkan null, pesan error dirakit pemanggil.
  }

  return { res, payload }
}

function lemparKalauGagal({ res, payload }) {
  if (!res.ok || payload?.status !== 'success') {
    const err = new Error(payload?.message || `Permintaan gagal (HTTP ${res.status}).`)
    // Pemanggil kadang perlu membedakan, mis. 404 dari route yang belum
    // dibuat (payload null karena Express membalas HTML) dengan 404 data.
    err.status = res.status
    err.payload = payload
    throw err
  }
  return payload
}

// ── Menjaga sesi tetap hidup ──

let refreshBerjalan = null

export async function refreshSession() {
  // Kalau beberapa permintaan bersamaan sama-sama butuh token baru, cukup
  // satu panggilan refresh yang jalan. Tanpa ini token bisa saling menimpa.
  if (refreshBerjalan) return refreshBerjalan

  refreshBerjalan = (async () => {
    const refresh_token = localStorage.getItem(REFRESH_KEY)
    if (!refresh_token) {
      throw new SessionExpiredError('Sesi tidak ditemukan. Silakan login kembali.')
    }

    const hasil = await kirim('/auth/refresh', { body: { refresh_token } })

    if (hasil.res.status === 401) {
      clearSession()
      throw new SessionExpiredError(hasil.payload?.message || 'Sesi sudah berakhir. Silakan login kembali.')
    }

    const payload = lemparKalauGagal(hasil)
    simpanToken(payload.data)
    return payload.data
  })()

  try {
    return await refreshBerjalan
  } finally {
    refreshBerjalan = null
  }
}

async function pastikanTokenSegar() {
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || 0)
  if (!expiresAt) return

  const sisaDetik = expiresAt - Math.floor(Date.now() / 1000)
  if (sisaDetik > AMBANG_PERBARUI_DETIK) return

  await refreshSession()
}

// Permintaan yang butuh login: token disegarkan dulu, dan kalau server tetap
// menjawab 401 maka sesinya memang sudah tidak berlaku.
export async function kirimTerautentikasi(path, { method = 'POST', body } = {}) {
  const terakhirAktif = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0)
  if (terakhirAktif && Date.now() - terakhirAktif >= BATAS_IDLE_DETIK * 1000) {
    await jalankanLogoutIdle()
    throw new SessionExpiredError(`Sesi berakhir karena tidak ada aktivitas selama ${labelDurasiIdle()}.`)
  }

  await pastikanTokenSegar()

  const hasil = await kirim(path, { method, body, token: getToken() })

  if (hasil.res.status === 401) {
    clearSession()
    setNotice('Sesi Anda sudah berakhir. Silakan login kembali.')
    throw new SessionExpiredError(hasil.payload?.message || 'Sesi berakhir. Silakan login kembali.')
  }

  return lemparKalauGagal(hasil)
}

// ── Endpoint ──

export async function login(email, password) {
  const payload = lemparKalauGagal(
    await kirim('/auth/login', { body: { email: email.trim(), password } }),
  )
  return payload.data
}

export async function logout() {
  return kirimTerautentikasi('/auth/logout')
}

// Logout bersifat best-effort: sesi lokal tetap dibersihkan supaya
// pengguna tidak terjebak di dalam kalau server sedang bermasalah.
export async function keluar() {
  try {
    // Backend mengenali siapa yang logout dari token, lalu mencabut
    // sesinya di Supabase. Tanpa ini token lama masih bisa dipakai.
    await logout()
  } catch (err) {
    console.error('Logout di server gagal:', err.message)
  } finally {
    clearSession()
  }
}

// Admin (guru) langsung ke Kelola Bab (pintu masuk menu Kuis), Super Admin ke
// kelola akun, role lain ke dashboard.
const HALAMAN_AWAL = { [ROLE.ADMIN]: '/bab', [ROLE.SUPER_ADMIN]: '/akun' }

export function halamanAwal(user = getUser()) {
  return HALAMAN_AWAL[user?.role] ?? '/dashboard'
}

export async function fetchMe() {
  const payload = await kirimTerautentikasi('/auth/me', { method: 'GET' })
  // Sekalian menyegarkan profil tersimpan, kalau nama atau role diubah admin.
  const user = payload.data.user
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

export async function updateProfile(data) {
  const payload = await kirimTerautentikasi('/auth/me', { method: 'PUT', body: data })
  localStorage.setItem(USER_KEY, JSON.stringify(payload.data.user))
  return payload.data.user
}

export async function requestPasswordReset(email) {
  return lemparKalauGagal(
    await kirim('/auth/forgot-password', { body: { email: email.trim() } }),
  )
}

// ── Penyimpanan sesi di browser ──

function simpanToken({ token, refresh_token, expires_at }) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(REFRESH_KEY, refresh_token)
  if (expires_at) localStorage.setItem(EXPIRES_KEY, String(expires_at))
}

export function saveSession(data) {
  simpanToken(data)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  terakhirCatatAktivitas = Date.now()
  localStorage.setItem(LAST_ACTIVE_KEY, String(terakhirCatatAktivitas))
  catatAktivitasPengguna()
}

export function clearSession() {
  hentikanTimerIdle()
  ;[TOKEN_KEY, REFRESH_KEY, EXPIRES_KEY, USER_KEY, LAST_ACTIVE_KEY].forEach((k) => localStorage.removeItem(k))
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function getAvatar() {
  return localStorage.getItem(AVATAR_KEY)
}

export function saveAvatar(dataUrl) {
  localStorage.setItem(AVATAR_KEY, dataUrl)
}

export function isLoggedIn() {
  return Boolean(getToken() && localStorage.getItem(REFRESH_KEY))
}

// ── Pesan satu kali antar halaman ──

export function setNotice(message) {
  sessionStorage.setItem(NOTICE_KEY, message)
}

export function takeNotice() {
  const message = sessionStorage.getItem(NOTICE_KEY)
  sessionStorage.removeItem(NOTICE_KEY)
  return message
}

// ── Deteksi tidak aktif (Idle Timeout) ──

let timerIdleId = null
let callbackSaatIdle = null
let sedangLogoutIdle = false
let terakhirCatatAktivitas = 0

const EVENT_AKTIVITAS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']

function hentikanTimerIdle() {
  if (timerIdleId) {
    window.clearTimeout(timerIdleId)
    timerIdleId = null
  }
}

async function jalankanLogoutIdle() {
  if (sedangLogoutIdle || !isLoggedIn()) return
  sedangLogoutIdle = true
  hentikanTimerIdle()
  try {
    const token = getToken()
    if (token) {
      await kirim('/auth/logout', { token }).catch(() => {})
    }
  } finally {
    clearSession()
    setNotice(`Sesi Anda telah berakhir karena tidak ada aktivitas selama ${labelDurasiIdle()}. Silakan login kembali.`)
    sedangLogoutIdle = false
    if (typeof callbackSaatIdle === 'function') {
      callbackSaatIdle()
    }
  }
}

export function catatAktivitasPengguna() {
  if (!isLoggedIn() || sedangLogoutIdle) return
  const sekarang = Date.now()
  const terakhirStorage = Number(localStorage.getItem(LAST_ACTIVE_KEY) || 0)
  const terakhir = Math.max(terakhirCatatAktivitas, terakhirStorage)

  if (terakhir && sekarang - terakhir >= BATAS_IDLE_DETIK * 1000) {
    void jalankanLogoutIdle()
    return
  }

  terakhirCatatAktivitas = sekarang
  localStorage.setItem(LAST_ACTIVE_KEY, String(sekarang))

  hentikanTimerIdle()
  timerIdleId = window.setTimeout(() => {
    void jalankanLogoutIdle()
  }, BATAS_IDLE_DETIK * 1000)
}

export function mulaiPantauIdle(onIdleLogout) {
  callbackSaatIdle = onIdleLogout
  const handler = () => catatAktivitasPengguna()
  EVENT_AKTIVITAS.forEach((evt) => window.addEventListener(evt, handler, { passive: true }))

  if (isLoggedIn()) {
    catatAktivitasPengguna()
  }

  return () => {
    hentikanTimerIdle()
    EVENT_AKTIVITAS.forEach((evt) => window.removeEventListener(evt, handler))
  }
}
