<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAvatar, getUser, keluar, halamanAwal } from '../services/auth'
import { ROLE } from '../services/roles'
import logoImage from '../assets/logo-esikap.png'
import avatarImage from '../assets/icons/avatar.svg'
import logOutIcon from '../assets/icons/log-out.svg'

const route = useRoute()
const router = useRouter()
const user = getUser()
const avatar = getAvatar() || avatarImage
const loggingOut = ref(false)

// Menu profil seperti di header mahasiswa: data singkat akun dan tautan ke
// halaman Akun saya. Tertutup lagi kalau klik di luar menu atau tekan Esc.
const profilTerbuka = ref(false)
const menuProfil = ref(null)

function tutupKalauDiLuar(event) {
  if (!menuProfil.value?.contains(event.target)) profilTerbuka.value = false
}

function tutupDenganEsc(event) {
  if (event.key === 'Escape') profilTerbuka.value = false
}

onMounted(() => {
  document.addEventListener('click', tutupKalauDiLuar)
  document.addEventListener('keydown', tutupDenganEsc)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', tutupKalauDiLuar)
  document.removeEventListener('keydown', tutupDenganEsc)
})

// Super Admin hanya mengelola akun; endpoint Kuis/Bab menolak role itu.
// Navbar admin sesuai wireframe: Kuis dan Rekap. "Kuis" membuka Kelola Bab
// dan tetap aktif di seluruh alur bab → kuis → soal. "Report Nilai" membuka
// rekap skor fuzzy (/rekap) dan tetap aktif sampai detail pengerjaan.
const superAdmin = user?.role === ROLE.SUPER_ADMIN
const menu = superAdmin
  ? [{ label: 'Akun', to: '/akun', aktifDi: ['/akun'] }]
  : [
      { label: 'Kuis', to: '/bab', aktifDi: ['/bab', '/kuis'] },
      { label: 'Report Nilai', to: '/rekap', aktifDi: ['/rekap'] },
    ]

function aktif(item) {
  return item.aktifDi?.some((awalan) => route.path.startsWith(awalan))
}

async function handleLogout() {
  loggingOut.value = true
  await keluar()
  router.push('/')
}
</script>

<template>
  <header
    class="bg-wf-card border-b border-wf-border px-4 sm:px-10 lg:px-20 py-4 lg:py-6 flex flex-wrap items-center justify-between gap-4"
  >
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 lg:gap-10">
      <RouterLink :to="halamanAwal(user)" class="block h-10 w-[125px] shrink-0">
        <img :src="logoImage" alt="eSikap" class="size-full object-contain" />
      </RouterLink>
      <nav class="flex flex-wrap items-center gap-x-5 gap-y-1 sm:gap-x-6 lg:gap-10 text-[17px] lg:text-[19px] leading-[26px]">
        <template v-for="item in menu" :key="item.label">
          <RouterLink
            v-if="item.to"
            :to="item.to"
            class="py-1 border-b-2"
            :class="aktif(item) ? 'border-wf-brand text-wf-text' : 'border-transparent text-wf-secondary hover:text-wf-text'"
          >
            {{ item.label }}
          </RouterLink>
          <span v-else class="py-1 text-wf-secondary/60 cursor-not-allowed" title="Segera hadir">
            {{ item.label }}
          </span>
        </template>
      </nav>
    </div>

    <!-- Di HP blok ini turun ke baris kedua di sisi kiri, jadi menu profil
         dibuka dari kiri; di layar lebar menempel ke kanan seperti biasa. -->
    <div ref="menuProfil" class="relative flex w-full items-center gap-4 sm:w-auto">
      <button
        type="button"
        class="flex items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-wf-muted-surface focus:outline-none focus:ring-2 focus:ring-wf-brand/20"
        aria-haspopup="menu"
        :aria-expanded="profilTerbuka"
        @click="profilTerbuka = !profilTerbuka"
      >
        <span class="text-[15px] lg:text-[17px] leading-6 text-wf-secondary">
          {{ user?.role ?? 'Admin' }}<span v-if="user?.nama"> · {{ user.nama }}</span>
        </span>
        <img :src="avatar" alt="" class="size-8 shrink-0 rounded-full object-cover" />
      </button>
      <div
        v-if="profilTerbuka"
        class="absolute left-0 top-12 z-20 w-64 overflow-hidden rounded-lg border border-wf-border-subtle bg-wf-card shadow-lg sm:left-auto sm:right-0"
        role="menu"
      >
        <div class="border-b border-wf-border-subtle px-4 py-3">
          <p class="font-semibold text-wf-text">{{ user?.nama || '-' }}</p>
          <p class="mt-1 break-all text-xs text-wf-secondary">{{ user?.email || 'Email tidak tersedia' }}</p>
          <p class="mt-2 inline-block rounded border border-wf-brand-border px-2 py-0.5 text-xs text-wf-brand">{{ user?.role ?? 'Admin' }}</p>
        </div>
        <RouterLink
          to="/profil"
          role="menuitem"
          class="block px-4 py-3 text-sm text-wf-text hover:bg-wf-muted-surface"
          @click="profilTerbuka = false"
        >
          Akun saya
        </RouterLink>
      </div>
      <!-- Ikon Lucide "log-out" (set ikon yang sama dengan ikon lain di Figma). -->
      <button
        type="button"
        @click="handleLogout"
        :disabled="loggingOut"
        :aria-label="loggingOut ? 'Sedang keluar' : 'Keluar'"
        :title="loggingOut ? 'Sedang keluar...' : 'Keluar'"
        class="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-wf-no-border disabled:opacity-60 disabled:cursor-wait"
      >
        <span class="size-6"><img :src="logOutIcon" alt="" class="size-full" /></span>
      </button>
    </div>
  </header>
</template>
