<script setup>
import { computed } from 'vue'
import HeaderAplikasi from './HeaderAplikasi.vue'

// Tampilan navbar sama dengan admin; yang berbeda hanya isi menunya.
// Halaman menandai menu aktif lewat prop `active`.
const props = defineProps({ active: { type: String, default: '' } })

const menu = computed(() => [
  { label: 'Latihan', to: '/dashboard', aktif: props.active === 'latihan' },
  { label: 'Statistik', to: '/statistik', aktif: props.active === 'statistik' },
  { label: 'Peta belajar', to: '/peta-belajar', aktif: props.active === 'peta' },
])
</script>

<template>
  <HeaderAplikasi :menu="menu" />
</template>
