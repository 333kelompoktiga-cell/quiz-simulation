<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ambilDaftarBab } from '../services/bab'
import { getAvatar, getUser, SessionExpiredError } from '../services/auth'
import StudentHeader from '../components/StudentHeader.vue'
import logoImage from '../assets/logo-esikap.png'
import avatarImage from '../assets/icons/avatar.svg'

const router = useRouter()
const route = useRoute()
const user = ref(getUser())
const avatar = ref(getAvatar() || avatarImage)
const bab = ref([])
const loading = ref(true)
const errorMsg = ref('')
const dapatKembaliKeHasil = computed(() =>
  typeof route.query.kuis === 'string'
  && route.query.kuis.length > 0
  && typeof route.query.pengerjaan === 'string'
  && route.query.pengerjaan.length > 0)

function kembaliKeHasil() {
  if (!dapatKembaliKeHasil.value) return
  router.push({
    path: `/kuis/${route.query.kuis}/hasil`,
    query: { pengerjaan: route.query.pengerjaan },
  })
}

const fallbackBab = [
  { namaBab: 'Ejaan', nilai: 60, penguasaan: 45 },
  { namaBab: 'Tanda Baca', nilai: 80, penguasaan: 64 },
  { namaBab: 'Paragraf', nilai: 94, penguasaan: 72 },
  { namaBab: 'Kalimat Efektif', nilai: 72, penguasaan: 86 },
]

const statistikBab = computed(() => {
  const sumber = bab.value.length ? bab.value : fallbackBab
  return sumber.map((item, index) => ({
    ...item,
    nilai: item.nilai ?? fallbackBab[index % fallbackBab.length].nilai,
    penguasaan: item.penguasaan ?? fallbackBab[index % fallbackBab.length].penguasaan,
  }))
})

const rataRata = computed(() => {
  if (!statistikBab.value.length) return 0
  return Math.round(statistikBab.value.reduce((sum, item) => sum + item.nilai, 0) / statistikBab.value.length)
})

const babSelesai = computed(() => statistikBab.value.filter((item) => item.nilai >= 80).length)
const perluDiulang = computed(() => statistikBab.value.filter((item) => item.nilai < 70).length)
const soalDikerjakan = computed(() => statistikBab.value.reduce((sum, item) => sum + (item.soalDikerjakan || 0), 0) || 55)

function warnaNilai(nilai) {
  if (nilai < 60) return 'bg-red-400'
  if (nilai < 80) return 'bg-amber-400'
  return 'bg-emerald-400'
}

onMounted(async () => {
  try {
    bab.value = await ambilDaftarBab()
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    errorMsg.value = err.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <StudentHeader active="statistik" />

    <main class="mx-auto max-w-[1200px] px-6 pb-12 pt-8 sm:px-10 lg:px-0">
      <div class="flex flex-wrap items-center gap-3">
        <button v-if="dapatKembaliKeHasil" type="button" class="tombol-kembali" @click="kembaliKeHasil">
          KEMBALI KE HASIL KUIS
        </button>
        <h1 class="text-[24px] font-bold sm:text-[26px]">Statistik saya</h1>
      </div>
      <p v-if="errorMsg" role="alert" class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-wf-no-text">{{ errorMsg }}</p>
      <p v-if="loading" class="mt-6 text-wf-secondary">Memuat statistik...</p>

      <template v-else>
        <section class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article class="stat-card"><strong>{{ babSelesai }}</strong><span>BAB SELESAI</span></article>
          <article class="stat-card"><strong>{{ soalDikerjakan }}</strong><span>SOAL DIKERJAKAN</span></article>
          <article class="stat-card"><strong>{{ rataRata }}</strong><span>RATA-RATA</span></article>
          <article class="stat-card"><strong>{{ perluDiulang }}</strong><span>PERLU DIULANG</span></article>
        </section>

        <section class="mt-5 rounded-md border border-wf-border-subtle bg-wf-card p-5">
          <h2 class="font-semibold uppercase text-[12px] text-wf-secondary">Penguasaan per bab</h2>
          <div class="mt-4">
            <div v-for="item in statistikBab" :key="item.idBab || item.namaBab" class="mastery-row">
              <span>{{ item.namaBab }}</span>
              <div class="h-2 w-32 overflow-hidden rounded-full bg-wf-brand-soft sm:w-40">
                <div class="h-full rounded-full" :class="warnaNilai(item.nilai)" :style="{ width: `${item.penguasaan}%` }"></div>
              </div>
            </div>
          </div>
        </section>

        <section class="mt-5 rounded-md border border-wf-border-subtle bg-wf-card p-5">
          <h2 class="text-[21px] font-bold">Nilai <em>per</em> bab</h2>
          <p class="mt-3 text-[12px] font-semibold uppercase text-wf-secondary">Indikator penilaian</p>
          <div class="mt-2 flex flex-wrap gap-4 text-xs text-wf-secondary">
            <span><i class="legend bg-red-400"></i>≤ 60</span>
            <span><i class="legend bg-amber-400"></i>61 - 79</span>
            <span><i class="legend bg-emerald-400"></i>≥ 80</span>
          </div>
          <div class="mt-6 flex h-40 items-end gap-3 border-b border-wf-border-subtle px-1 sm:gap-5">
            <div v-for="item in statistikBab.slice(0, 6)" :key="`chart-${item.idBab || item.namaBab}`" class="flex h-full flex-1 flex-col items-center justify-end">
              <span class="mb-2 text-xs font-semibold text-wf-secondary">{{ item.nilai }}</span>
              <div class="w-full rounded-t-sm" :class="warnaNilai(item.nilai)" :style="{ height: `${Math.max(item.nilai, 8)}%` }"></div>
              <span class="mt-2 max-w-full truncate text-center text-[11px] text-wf-secondary">{{ item.namaBab }}</span>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  min-height: 94px;
  flex-direction: column;
  justify-content: center;
  border: 1px solid #c9c5d8;
  border-radius: .35rem;
  background: #fff;
  padding: 1rem;
}

.stat-card strong {
  font-size: 30px;
  line-height: 1;
}

.stat-card span {
  margin-top: .55rem;
  color: #6b6780;
  font-size: 14px;
  font-weight: 700;
}

.mastery-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid #e2e0ec;
  padding: .75rem 0;
  font-size: 15px;
}

.mastery-row:last-child {
  border-bottom: 0;
}

.legend {
  display: inline-block;
  width: .55rem;
  height: .55rem;
  margin-right: .35rem;
  border-radius: 1px;
}
</style>
