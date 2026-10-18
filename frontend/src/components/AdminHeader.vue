<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUser, keluar, halamanAwal } from '../services/auth'
import { ROLE } from '../services/roles'
import logoImage from '../assets/logo-esikap.png'
import avatarImage from '../assets/icons/avatar.svg'
import logOutIcon from '../assets/icons/log-out.svg'

const route = useRoute()
const router = useRouter()
const user = getUser()
const loggingOut = ref(false)

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

    <div class="flex items-center gap-4">
      <p class="text-[15px] lg:text-[17px] leading-6 text-wf-secondary">
        {{ user?.role ?? 'Admin' }}<span v-if="user?.nama"> · {{ user.nama }}</span>
      </p>
      <img :src="avatarImage" alt="" class="size-8 shrink-0" />
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
