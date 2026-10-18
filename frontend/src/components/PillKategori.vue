<script setup>
import { computed } from 'vue'
import { labelKategori, warnaKategori } from '../services/rekap'

// Komponen "Pill kategori fuzzy" di Figma.
const props = defineProps({
  kategori: { type: String, default: '' },
  awalan: { type: String, default: '' },
})

const teks = computed(() => {
  const label = labelKategori(props.kategori)
  return props.awalan ? `${props.awalan} ${label.toLowerCase()}` : label
})
</script>

<template>
  <span
    class="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[13px] leading-5 font-semibold whitespace-nowrap"
    :class="warnaKategori(kategori).pill"
  >
    {{ teks }}
  </span>
</template>
