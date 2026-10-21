import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import KelolaBabView from '../views/KelolaBabView.vue'
import BabFormView from '../views/BabFormView.vue'
import KelolaKuisView from '../views/KelolaKuisView.vue'
import KuisFormView from '../views/KuisFormView.vue'
import EditorKuisView from '../views/EditorKuisView.vue'
import KelolaAkunView from '../views/KelolaAkunView.vue'
import ProfileView from '../views/ProfileView.vue'
import EditPhotoView from '../views/EditPhotoView.vue'
import StudentBabView from '../views/StudentBabView.vue'
import StudentQuizView from '../views/StudentQuizView.vue'
import QuizResultView from '../views/QuizResultView.vue'
import QuizDiscussionView from '../views/QuizDiscussionView.vue'
import StudentDiagnosticView from '../views/StudentDiagnosticView.vue'
import StudentStatisticsView from '../views/StudentStatisticsView.vue'
import StudentLearningMapView from '../views/StudentLearningMapView.vue'
import StudentRoadmapView from '../views/StudentRoadmapView.vue'
import RekapView from '../views/RekapView.vue'
import RekapKuisView from '../views/RekapKuisView.vue'
import RekapPengerjaanView from '../views/RekapPengerjaanView.vue'
import { ROLE } from '../services/roles'
import {
  isLoggedIn,
  fetchMe,
  getUser,
  clearSession,
  setNotice,
  halamanAwal,
  SessionExpiredError,
} from '../services/auth'

// Endpoint tulis Bab/Kuis di backend hanya menerima role 'Admin' (guru).
const khususAdmin = { butuhLogin: true, role: 'Admin' }
// /api/account hanya menerima Super Admin.
const khususSuperAdmin = { butuhLogin: true, role: ROLE.SUPER_ADMIN }

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView, meta: { tamu: true } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { butuhLogin: true } },
    { path: '/statistik', name: 'statistik', component: StudentStatisticsView, meta: { butuhLogin: true } },
    { path: '/peta-belajar', name: 'peta-belajar', component: StudentLearningMapView, meta: { butuhLogin: true } },
    { path: '/peta-belajar/:id/roadmap', name: 'roadmap-bab', component: StudentRoadmapView, props: true, meta: { butuhLogin: true } },
    { path: '/profil', name: 'profil', component: ProfileView, meta: { butuhLogin: true } },
    { path: '/profil/edit-foto', name: 'edit-foto', component: EditPhotoView, meta: { butuhLogin: true } },
    { path: '/latihan/:id', name: 'latihan-bab', component: StudentBabView, props: true, meta: { butuhLogin: true } },
    { path: '/kuis/:id/kerjakan', name: 'kerjakan-kuis', component: StudentQuizView, props: true, meta: { butuhLogin: true } },
    { path: '/kuis/:id/hasil', name: 'hasil-kuis', component: QuizResultView, props: true, meta: { butuhLogin: true } },
    { path: '/kuis/:id/diagnostik', name: 'diagnostik-kuis', component: StudentDiagnosticView, props: true, meta: { butuhLogin: true } },
    { path: '/kuis/:id/pembahasan', name: 'pembahasan-kuis', component: QuizDiscussionView, props: true, meta: { butuhLogin: true } },
    { path: '/pembahasan-demo', name: 'pembahasan-demo', component: QuizDiscussionView, props: { id: 'demo' }, meta: { butuhLogin: true } },
    { path: '/bab', name: 'kelola-bab', component: KelolaBabView, meta: khususAdmin },
    { path: '/bab/tambah', name: 'tambah-bab', component: BabFormView, meta: khususAdmin },
    { path: '/bab/:id/edit', name: 'edit-bab', component: BabFormView, props: true, meta: khususAdmin },
    // Kelola Kuis selalu untuk satu bab (dibuka dengan klik nama bab).
    { path: '/bab/:id/kuis', name: 'kelola-kuis', component: KelolaKuisView, props: true, meta: khususAdmin },
    // Alamat lama daftar semua kuis: diarahkan ke Kelola Bab supaya link lama tidak rusak.
    { path: '/kuis', redirect: '/bab' },
    { path: '/kuis/tambah', name: 'tambah-kuis', component: EditorKuisView, meta: khususAdmin },
    { path: '/kuis/:id/edit', name: 'edit-kuis', component: KuisFormView, props: true, meta: khususAdmin },
    { path: '/kuis/:id/soal', name: 'edit-soal', component: EditorKuisView, props: true, meta: khususAdmin },
    // Report Nilai (Figma HA6-HA8): daftar kuis → rekap satu kuis → detail satu percobaan.
    { path: '/rekap', name: 'rekap', component: RekapView, meta: khususAdmin },
    { path: '/rekap/kuis/:id', name: 'rekap-kuis', component: RekapKuisView, props: true, meta: khususAdmin },
    { path: '/rekap/pengerjaan/:id', name: 'rekap-pengerjaan', component: RekapPengerjaanView, props: true, meta: khususAdmin },
    { path: '/akun', name: 'kelola-akun', component: KelolaAkunView, meta: khususSuperAdmin },
    // Alamat ngawur diarahkan ke login, bukan halaman kosong.
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Sesi divalidasi ke server sekali per pemuatan halaman. Navigasi berikutnya
// cukup mengandalkan jawaban 401, jadi tidak ada panggilan /me berulang.
let sudahDivalidasi = false

router.beforeEach(async (to) => {
  if (!isLoggedIn()) {
    sudahDivalidasi = false
  }

  if (to.meta.butuhLogin) {
    // Adanya token di browser belum berarti sesinya masih hidup di server:
    // bisa saja sudah dicabut karena akun dipakai login di perangkat lain.
    if (!isLoggedIn()) return { name: 'login' }

    if (!sudahDivalidasi) {
      try {
        await fetchMe()
        sudahDivalidasi = true
      } catch (err) {
        clearSession()
        // SessionExpiredError sudah menitipkan pesannya sendiri. Sisanya,
        // misalnya backend mati, perlu dijelaskan apa adanya ke pengguna.
        if (!(err instanceof SessionExpiredError)) {
          setNotice(err.message)
        }
        return { name: 'login' }
      }
    }

    // Role dicek setelah /me supaya memakai profil terbaru dari server.
    if (to.meta.role && getUser()?.role !== to.meta.role) {
      return halamanAwal()
    }
    return true
  }

  // Sudah login tapi membuka halaman login lagi: langsung ke halaman awal.
  if (to.meta.tamu && isLoggedIn()) {
    return halamanAwal()
  }

  return true
})

export default router
