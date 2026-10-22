<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ambilHasilPengerjaan, ambilKuis } from '../services/kuis'
import { getAvatar, getUser, SessionExpiredError } from '../services/auth'
import StudentHeader from '../components/StudentHeader.vue'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const user = ref(getUser())
const avatar = ref(getAvatar() || avatarImage)
const kuis = ref(null)
const hasil = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const detailItems = computed(() => hasil.value?.detailItems || [])
const kelemahan = computed(() => detailItems.value
  .filter((item) => !item.meta?.isCorrect || Number(item.crispScore) < 60)
  .sort((a, b) => Number(a.crispScore || 0) - Number(b.crispScore || 0)))

function labelKesulitan(item) {
  return item.meta?.difficulty || 'Sedang'
}

function kembaliKeHasil() {
  router.push({
    path: `/kuis/${props.id}/hasil`,
    query: { pengerjaan: route.query.pengerjaan },
  })
}

onMounted(async () => {
  try {
    const idPengerjaan = route.query.pengerjaan
    if (typeof idPengerjaan !== 'string' || !idPengerjaan) {
      throw new Error('ID pengerjaan tidak tersedia. Buka laporan dari halaman hasil kuis.')
    }
    const [dataHasil, dataKuis] = await Promise.all([
      ambilHasilPengerjaan(idPengerjaan),
      ambilKuis(props.id),
    ])
    hasil.value = dataHasil
    kuis.value = dataKuis
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    errorMsg.value = error.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <StudentHeader active="latihan" />

    <main class="mx-auto max-w-[900px] px-6 pb-12 pt-8 sm:px-0">
      <button type="button" class="tombol-kembali" @click="kembaliKeHasil">
        <span aria-hidden="true" class="text-xl leading-none">←</span>
        KEMBALI KE HASIL KUIS
      </button>
      <p v-if="loading" class="mt-7 text-wf-secondary">Menyusun laporan diagnostik...</p>
      <p v-else-if="errorMsg" role="alert" class="mt-7 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-wf-no-text">{{ errorMsg }}</p>
      <template v-else>
        <h1 class="mt-5 text-[27px] font-bold sm:text-[30px]">Laporan diagnostik</h1>
        <p class="mt-1 text-[16px] text-wf-secondary">{{ kuis?.judul || 'Kuis' }} · berdasarkan pola jawaban dan waktu pengerjaan Anda</p>

        <section class="mt-6 grid gap-4 sm:grid-cols-3">
          <article class="rounded-md border border-wf-border-subtle bg-wf-card p-5">
            <p class="text-xs font-semibold uppercase text-wf-secondary">Penguasaan fuzzy</p>
            <strong class="mt-2 block text-2xl">{{ hasil.kategoriFuzzy }}</strong>
            <p class="mt-1 text-sm text-wf-secondary">Skor {{ hasil.skorFuzzy }}</p>
          </article>
          <article class="rounded-md border border-wf-border-subtle bg-wf-card p-5">
            <p class="text-xs font-semibold uppercase text-wf-secondary">Akurasi</p>
            <strong class="mt-2 block text-2xl">{{ hasil.akurasi }}%</strong>
            <p class="mt-1 text-sm text-wf-secondary">{{ hasil.totalBenar }} benar dari {{ hasil.totalSoal }} soal</p>
          </article>
          <article class="rounded-md border border-wf-border-subtle bg-wf-card p-5">
            <p class="text-xs font-semibold uppercase text-wf-secondary">Waktu rata-rata</p>
            <strong class="mt-2 block text-2xl">{{ hasil.rataRataWaktu }} dtk</strong>
            <p class="mt-1 text-sm text-wf-secondary">Kecepatan dibandingkan target soal</p>
          </article>
        </section>

        <section class="mt-5 rounded-md border border-wf-border-subtle bg-wf-card p-5">
          <h2 class="text-lg font-bold">Temuan diagnostik</h2>
          <p class="mt-3 leading-7 text-wf-secondary">{{ hasil.rekomendasi || 'Belum ada rekomendasi diagnostik.' }}</p>
        </section>

        <section class="mt-5 rounded-md border border-wf-border-subtle bg-wf-card p-5">
          <h2 class="text-lg font-bold">Soal yang perlu diperkuat</h2>
          <p v-if="!kelemahan.length" class="mt-3 text-wf-secondary">Tidak ada kelemahan utama yang terdeteksi pada pengerjaan ini.</p>
          <div v-else class="mt-4 flex flex-col gap-3">
            <article v-for="item in kelemahan" :key="item.soalId || item.nomorSoal" class="rounded-md border border-wf-border-subtle px-4 py-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <strong>Soal {{ item.nomorSoal }}</strong>
                <span class="text-sm text-wf-no-text">{{ item.linguisticLevel }} · {{ labelKesulitan(item) }}</span>
              </div>
              <p class="mt-1 text-sm text-wf-secondary">Skor fuzzy {{ item.crispScore }} · waktu {{ item.meta?.responseTime ?? 0 }} detik</p>
            </article>
          </div>
        </section>

        <div class="mt-6 flex flex-wrap gap-3">
          <RouterLink to="/peta-belajar" class="rounded-xl bg-wf-accent px-5 py-3 font-semibold text-white hover:bg-wf-accent-hover">BUKA LEARNING ROADMAP</RouterLink>
          <button type="button" class="tombol-kembali" @click="kembaliKeHasil">
            <span aria-hidden="true" class="text-xl leading-none">←</span>
            KEMBALI KE HASIL
          </button>
        </div>
      </template>
    </main>
  </div>
</template>
