<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ambilDaftarBab } from '../services/bab'
import { ambilDaftarKuis } from '../services/kuis'
import { SessionExpiredError } from '../services/auth'
import StudentHeader from '../components/StudentHeader.vue'

const router = useRouter()
const bab = ref([])
const kuis = ref([])
const loading = ref(true)
const errorMsg = ref('')
const notice = ref('')
const kataPencarian = ref('')
const filterAktif = ref('semua')

const daftarBab = computed(() => {
  const sudahAda = new Set()
  return [...bab.value]
    .sort((a, b) => (a.urutanBab ?? 0) - (b.urutanBab ?? 0))
    .filter((item) => {
      if (item.idBab && sudahAda.has(item.idBab)) return false
      if (item.idBab) sudahAda.add(item.idBab)
      return true
    })
    .map((item) => {
      const kuisBab = kuis.value.filter((quiz) => quiz.idBab === item.idBab)
      const kuisDibuka = kuisBab.filter((quiz) => quiz.tersedia)
      const progresTersedia = Number.isInteger(item.selesai) && Number.isInteger(item.total)
      return {
        ...item,
        deskripsi: item.deskripsi || 'Materi dan latihan pada bab ini.',
        selesai: kuisDibuka.length
          ? kuisDibuka.filter((quiz) => quiz.statusBelajar === 'Selesai').length
          : progresTersedia ? Math.min(item.selesai, item.total) : 0,
        total: kuisDibuka.length || (progresTersedia ? item.total : 0),
        kuisTersedia: kuisDibuka.length > 0,
      }
    })
})

const babTersaring = computed(() => {
  const kata = kataPencarian.value.trim().toLowerCase()
  return daftarBab.value.filter((item) => {
    const cocokNama = !kata || `${item.namaBab} ${item.deskripsi}`.toLowerCase().includes(kata)
    const selesai = persentase(item) === 100
    const sedangBerjalan = persentase(item) > 0 && !selesai
    const cocokFilter = filterAktif.value === 'semua'
      || (filterAktif.value === 'selesai' && selesai)
      || (filterAktif.value === 'berjalan' && sedangBerjalan)
    return cocokNama && cocokFilter
  })
})

function statusBab(item) {
  if (!item.kuisTersedia) return { label: 'Belum dibuka', kelas: 'bg-wf-no text-white' }
  if (item.total > 0 && item.selesai === item.total) return { label: 'Selesai', kelas: 'bg-wf-ok text-white' }
  if (item.selesai > 0) return { label: 'Sedang', kelas: 'bg-wf-accent-light text-wf-text border border-wf-accent' }
  return { label: 'Belum mulai', kelas: 'bg-wf-no text-white' }
}

function persentase(item) {
  return item.total ? Math.round((item.selesai / item.total) * 100) : 0
}

function bukaBab(item) {
  if (item.idBab) {
    router.push(`/latihan/${item.idBab}`)
    return
  }
  notice.value = `Latihan ${item.namaBab} belum memiliki ID bab dari server.`
}

onMounted(async () => {
  try {
    const [dataBab, dataKuis] = await Promise.all([
      ambilDaftarBab(),
      ambilDaftarKuis(),
    ])
    bab.value = dataBab
    kuis.value = dataKuis
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
    <StudentHeader active="latihan" />

    <main class="mx-auto max-w-[1200px] px-6 pb-12 pt-9 sm:px-10 lg:px-0">
      <section class="mb-5">
        <h1 class="text-[24px] font-bold leading-tight sm:text-[26px]">Latihan</h1>
        <p class="mt-2 text-[16px] leading-6 text-wf-secondary sm:text-[17px]">
          Pilih bab yang anda ingin kerjakan. Kemudian satu bab bisa terdiri dari beberapa kuis yang bisa di kerjakan.
        </p>
      </section>

      <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label class="relative min-w-0 flex-1">
          <span class="sr-only">Cari mata kuliah atau bab</span>
          <input
            v-model="kataPencarian"
            type="search"
            placeholder="Cari mata kuliah atau bab..."
            class="w-full rounded-md border border-wf-border-subtle bg-wf-card px-3 py-3 text-[15px] text-wf-text outline-none placeholder:text-wf-muted focus:border-wf-brand focus:ring-2 focus:ring-wf-brand/20"
          />
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-[15px] font-semibold transition"
            :class="filterAktif === 'semua' ? 'border-wf-brand-border bg-wf-brand-soft text-wf-text' : 'border-wf-border-subtle bg-wf-card text-wf-secondary hover:text-wf-text'"
            @click="filterAktif = 'semua'"
          >
            Semua
          </button>
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-[15px] font-semibold transition"
            :class="filterAktif === 'berjalan' ? 'border-wf-accent bg-wf-accent-light text-wf-text' : 'border-wf-border-subtle bg-wf-card text-wf-secondary hover:text-wf-text'"
            @click="filterAktif = 'berjalan'"
          >
            Sedang berjalan
          </button>
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-[15px] font-semibold transition"
            :class="filterAktif === 'selesai' ? 'border-wf-ok bg-green-50 text-wf-ok' : 'border-wf-border-subtle bg-wf-card text-wf-secondary hover:text-wf-text'"
            @click="filterAktif = 'selesai'"
          >
            Selesai
          </button>
        </div>
      </div>

      <p v-if="notice" role="status" class="mb-5 rounded-lg border border-wf-brand-border bg-wf-brand-soft px-4 py-3 text-sm text-wf-brand">
        {{ notice }}
      </p>
      <p v-if="errorMsg" role="alert" class="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ errorMsg }}
      </p>
      <p v-if="loading" class="py-8 text-center text-wf-secondary">Memuat daftar bab...</p>

      <section v-else-if="babTersaring.length" class="grid gap-5 md:grid-cols-2">
        <article
          v-for="(item, index) in babTersaring"
          :key="item.idBab || item.namaBab"
          class="rounded-md border border-wf-border-subtle bg-wf-card p-5 shadow-[0_1px_2px_rgba(27,25,48,0.02)] sm:p-5"
        >
          <div class="flex items-start justify-between gap-4">
            <span class="font-mono text-[13px] uppercase tracking-[0.12em] text-wf-secondary">
              Bab {{ daftarBab.indexOf(item) + 1 }}
            </span>
            <span class="rounded-md px-2 py-1 text-[14px] font-semibold leading-5" :class="statusBab(item).kelas">
              {{ statusBab(item).label }}
            </span>
          </div>
          <h2 class="mt-5 text-[19px] font-bold">{{ item.namaBab }}</h2>
          <p class="mt-1 min-h-12 text-[15px] leading-6 text-wf-secondary">{{ item.deskripsi }}</p>

          <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-wf-brand-soft">
            <div class="h-full rounded-full bg-wf-brand transition-all" :style="{ width: `${persentase(item)}%` }"></div>
          </div>
          <div class="mt-3 flex items-center justify-between font-mono text-[13px] text-wf-secondary">
            <span>{{ item.selesai }} dari {{ item.total }} tahap selesai</span>
            <strong class="text-wf-text">{{ persentase(item) }}%</strong>
          </div>

          <button
            type="button"
            class="mt-5 w-full rounded-xl border border-wf-brand-border px-4 py-3 text-[18px] font-bold text-wf-brand transition hover:bg-wf-brand-soft focus:outline-none focus:ring-2 focus:ring-wf-brand/30"
            @click="bukaBab(item)"
          >
            BUKA BAB
          </button>
        </article>
      </section>
      <p v-else class="rounded-md border border-wf-border-subtle bg-wf-card px-5 py-8 text-center text-wf-secondary">
        Tidak ada bab yang sesuai dengan pencarian atau filter.
      </p>
    </main>
  </div>
</template>
