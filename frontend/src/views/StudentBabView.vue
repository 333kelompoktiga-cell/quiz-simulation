<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ambilBab } from '../services/bab'
import { ambilDaftarKuis } from '../services/kuis'
import { getAvatar, getUser, keluar, SessionExpiredError } from '../services/auth'
import logoImage from '../assets/logo-esikap.png'
import avatarImage from '../assets/icons/avatar.svg'
import StudentHeader from '../components/StudentHeader.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const user = ref(getUser())
const avatar = ref(getAvatar() || avatarImage)
const bab = ref(null)
const kuis = ref([])
const loading = ref(true)
const errorMsg = ref('')
const notice = ref('')
const loggingOut = ref(false)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const daftarKuis = computed(() => kuis.value)

function statusKuis(item) {
  return item.statusBelajar || (item.tersedia ? 'Tersedia' : 'Belum dibuka')
}

function statusKelas(status) {
  if (status === 'Selesai') return 'bg-wf-ok text-white'
  if (status === 'Belum dibuka') return 'bg-wf-no text-white'
  return 'bg-wf-brand-soft text-wf-text border border-wf-brand-border'
}

function ulangi(item) {
  if (!item.tersedia) {
    notice.value = `Kuis "${item.judul}" belum dibuka oleh dosen.`
    return
  }
  if (typeof item.idKuis === 'string' && UUID_PATTERN.test(item.idKuis)) {
    router.push(`/kuis/${item.idKuis}/kerjakan`)
    return
  }
  notice.value = `Kuis "${item.judul}" belum memiliki ID UUID yang valid dari server.`
}

function lihatHasil(item) {
  if (!item.idPengerjaanTerakhir) {
    notice.value = `Hasil kuis "${item.judul}" belum tersedia.`
    return
  }
  router.push({
    path: `/kuis/${item.idKuis}/hasil`,
    query: { pengerjaan: item.idPengerjaanTerakhir },
  })
}

// Satu bab bisa berisi kuis dari beberapa dosen, jadi ringkasan menyebut
// semua dosen pembuat kuis di bab ini.
const daftarPembuat = computed(() => [
  ...new Set(daftarKuis.value.map((item) => item.namaPembuat).filter(Boolean)),
])

function formatRingkasan() {
  const jumlah = daftarKuis.value.length
  const soal = daftarKuis.value.reduce((sum, item) => sum + (item.jumlahSoalTampil ?? item.jumlahSoal ?? 0), 0)
  const infoBab = bab.value?.urutanBab ? `Bab ${bab.value.urutanBab} · ` : ''
  return `${infoBab}${jumlah} kuis · ${soal} soal · dibuka oleh ${daftarPembuat.value.join(', ') || 'Guru'}`
}

async function handleLogout() {
  loggingOut.value = true
  await keluar()
  router.push('/')
}

onMounted(async () => {
  try {
    const [dataBab, dataKuis] = await Promise.all([
      ambilBab(props.id),
      ambilDaftarKuis(props.id),
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

    <main class="mx-auto max-w-[1000px] px-6 pb-12 pt-9 sm:px-10 lg:px-0">
      <div class="flex flex-wrap items-center gap-3">
        <RouterLink to="/dashboard" class="tombol-kembali">
          <span>KEMBALI KE LATIHAN</span>
        </RouterLink>
        <span class="text-wf-muted" aria-hidden="true">/</span>
        <span class="font-mono text-[13px] uppercase tracking-[0.12em] text-wf-secondary">{{ bab?.namaBab || 'Memuat...' }}</span>
      </div>
      <h1 class="mt-4 text-[27px] font-bold sm:text-[30px]">{{ bab?.namaBab || 'Latihan' }}</h1>
      <p class="mt-1 text-[16px] text-wf-secondary">{{ formatRingkasan() }}</p>
      <RouterLink to="/pembahasan-demo" class="mt-4 inline-flex rounded-xl border border-wf-brand-border px-4 py-2 text-sm font-semibold text-wf-brand hover:bg-wf-brand-soft">
        LIHAT CONTOH PEMBAHASAN
      </RouterLink>

      <p v-if="loading" class="mt-8 text-wf-secondary">Memuat daftar latihan...</p>
      <p v-else-if="errorMsg" role="alert" class="mt-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-wf-no-text">
        {{ errorMsg }}
      </p>
      <template v-else>
        <p v-if="notice" role="status" class="mt-6 rounded-md border border-wf-brand-border bg-wf-brand-soft px-4 py-3 text-sm text-wf-brand">
          {{ notice }}
        </p>
        <section class="mt-6 flex flex-col gap-5">
          <p v-if="!daftarKuis.length" class="rounded-md border border-wf-border-subtle bg-wf-card p-6 text-wf-secondary">
            Belum ada kuis yang tersedia di bab ini.
          </p>
          <article
            v-for="(item, index) in daftarKuis"
            :key="item.idKuis || item.judul"
            class="rounded-md border bg-wf-card px-5 py-5 sm:px-5"
            :class="index === 0 ? 'border-2 border-wf-brand' : 'border-wf-border-subtle'"
          >
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p class="font-mono text-[13px] uppercase tracking-[0.12em] text-wf-secondary">Latihan {{ index + 1 }}</p>
                <h2 class="mt-2 text-[20px] font-bold">{{ item.judul }}</h2>
                <p v-if="item.namaPembuat" class="mt-1 text-[15px] font-semibold text-wf-brand">oleh {{ item.namaPembuat }}</p>
                <p class="mt-1 text-[16px] text-wf-secondary">{{ item.deskripsi || 'Latihan pilihan ganda untuk menguji pemahaman materi.' }}</p>
                <p class="mt-2 font-mono text-[13px] uppercase tracking-[0.1em] text-wf-muted">
                  {{ item.jumlahSoalTampil ?? item.jumlahSoal ?? 0 }} soal · bobot 100 poin · durasi {{ item.durasi ?? '—' }} menit
                </p>
              </div>
              <div class="flex items-center gap-5">
                <div class="text-right">
                  <span class="rounded-md px-2 py-1 text-[16px] font-semibold" :class="statusKelas(statusKuis(item))">
                    {{ statusKuis(item) }}
                  </span>
                  <p class="mt-3 font-mono text-[13px] text-wf-secondary">
                    Nilai terakhir:
                    <strong v-if="item.nilaiTerakhir !== null" class="text-wf-text">{{ item.nilaiTerakhir }}</strong>
                    <span v-else>—</span>
                  </p>
                </div>
                <div class="flex flex-wrap justify-end gap-3">
                  <button
                    v-if="item.statusBelajar === 'Selesai'"
                    type="button"
                    class="rounded-xl border-2 border-wf-brand bg-wf-brand-soft px-5 py-4 text-[18px] font-bold text-wf-brand hover:bg-wf-brand hover:text-white"
                    @click="lihatHasil(item)"
                  >
                    LIHAT HASIL
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border border-wf-brand-border px-5 py-4 text-[18px] font-semibold text-wf-brand hover:bg-wf-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="!item.tersedia"
                    @click="ulangi(item)"
                  >
                    {{ item.statusBelajar === 'Selesai' ? 'ULANGI' : 'MULAI' }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>
    </main>
  </div>
</template>
