<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getUser } from '../services/auth'
import { ROLE } from '../services/roles'
import HeaderAplikasi from './HeaderAplikasi.vue'

const route = useRoute()

// Super Admin hanya mengelola akun; endpoint Kuis/Bab menolak role itu.
// Navbar admin sesuai wireframe: Kuis dan Rekap. "Kuis" membuka Kelola Bab
// dan tetap aktif di seluruh alur bab → kuis → soal. "Report Nilai" membuka
// rekap skor fuzzy (/rekap) dan tetap aktif sampai detail pengerjaan.
const superAdmin = getUser()?.role === ROLE.SUPER_ADMIN
const daftarMenu = superAdmin
  ? [{ label: 'Akun', to: '/akun', aktifDi: ['/akun'] }]
  : [
      { label: 'Kuis', to: '/bab', aktifDi: ['/bab', '/kuis'] },
      { label: 'Report Nilai', to: '/rekap', aktifDi: ['/rekap'] },
    ]

const menu = computed(() =>
  daftarMenu.map((item) => ({
    ...item,
    aktif: item.aktifDi.some((awalan) => route.path.startsWith(awalan)),
  })),
)
</script>

<template>
  <HeaderAplikasi :menu="menu" />
</template>
