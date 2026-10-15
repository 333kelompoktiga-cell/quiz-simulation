<script setup>
import { computed } from 'vue'
import AdminHeader from './AdminHeader.vue'
import TombolKembali from './TombolKembali.vue'
import lockIcon from '../assets/icons/lock.svg'

// Pengganti halaman Edit Kuis / Edit Soal kalau kuis dibuat dosen lain
// (bisaDikelola = false dari backend). Bab dipakai bersama, tapi kuis dan
// soalnya hanya boleh diubah pembuatnya.
const props = defineProps({
  kuis: { type: Object, required: true },
  namaBab: { type: String, default: '' },
})

const pembuat = computed(() => props.kuis.namaPembuat || 'dosen lain')
const tautanKembali = computed(() => `/bab/${props.kuis.idBab}/kuis`)

const rincian = computed(() => [
  { label: 'DIBUAT OLEH', nilai: pembuat.value },
  { label: 'BAB', nilai: props.namaBab || '-' },
  { label: 'DURASI', nilai: props.kuis.durasi ? `${props.kuis.durasi} menit` : '-' },
  {
    label: 'TANGGAL DIBUAT',
    nilai: props.kuis.tanggalDibuat
      ? new Date(props.kuis.tanggalDibuat).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '-',
  },
])
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <AdminHeader />

    <main class="px-4 sm:px-10 lg:px-20 pt-10 pb-14 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <TombolKembali :to="tautanKembali" class="mb-2" />
        <p class="font-mono text-[18px] leading-7 tracking-[1px] text-wf-text">
          <RouterLink to="/bab" class="hover:underline">Bab</RouterLink>
          <template v-if="namaBab">
            / <RouterLink :to="tautanKembali" class="hover:underline uppercase">{{ namaBab }}</RouterLink>
          </template>
          / LIHAT KUIS
        </p>
        <h1 class="text-[28px] leading-9 font-semibold">{{ kuis.judul }}</h1>
      </div>

      <section
        class="bg-wf-card border border-wf-border-subtle rounded-xl p-5 lg:p-7 flex flex-col gap-6 max-w-[760px]"
      >
        <div class="flex items-start gap-4">
          <span class="size-12 shrink-0 rounded-full bg-wf-brand-soft border border-wf-brand-border grid place-items-center">
            <img :src="lockIcon" alt="" class="size-6" />
          </span>
          <div class="flex flex-col gap-1">
            <h2 class="text-[20px] leading-7 font-semibold">Kuis ini milik {{ pembuat }}</h2>
            <p class="text-[17px] leading-6 text-wf-secondary">
              Anda hanya bisa mengubah kuis dan soal yang Anda buat sendiri. Kalau kuis ini perlu diperbaiki,
              hubungi dosen pembuatnya, atau buat kuis baru di bab ini.
            </p>
          </div>
        </div>

        <dl class="grid sm:grid-cols-2 gap-x-6 gap-y-4 border-t border-wf-border-subtle pt-5">
          <div v-for="baris in rincian" :key="baris.label" class="flex flex-col gap-1">
            <dt class="font-mono text-[14px] leading-5 tracking-[1px] text-wf-muted">{{ baris.label }}</dt>
            <dd class="text-[17px] leading-6">{{ baris.nilai }}</dd>
          </div>
        </dl>

        <div class="flex flex-wrap gap-4">
          <RouterLink
            :to="tautanKembali"
            class="rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-white transition"
          >
            KEMBALI KE KELOLA KUIS
          </RouterLink>
          <RouterLink
            :to="`/kuis/tambah?idBab=${kuis.idBab}`"
            class="rounded-xl border border-wf-brand-border bg-wf-card hover:bg-wf-brand-soft px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-wf-brand transition"
          >
            + BUAT KUIS SENDIRI
          </RouterLink>
        </div>
      </section>
    </main>
  </div>
</template>
