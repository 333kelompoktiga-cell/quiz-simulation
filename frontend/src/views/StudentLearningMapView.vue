<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ambilDaftarPetaBelajar } from '../services/petaBelajar'
import { getUser, SessionExpiredError } from '../services/auth'
import StudentHeader from '../components/StudentHeader.vue'

const router = useRouter()
const user = ref(getUser())
const roadmapList = ref([])
const loading = ref(true)
const errorMsg = ref('')
const notice = ref('')

function bukaRoadmap(item) {
  if (item.status === 'terkunci' || item.selesaiCount === 0) {
    notice.value = `Roadmap untuk ${item.namaBab} baru tersedia setelah Anda menyelesaikan kuis pada bab ini.`
    return
  }
  router.push(`/peta-belajar/${item.idBab}/roadmap`)
}

function bukaKuis(item) {
  router.push(`/latihan/${item.idBab}`)
}

async function muatPetaBelajar() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await ambilDaftarPetaBelajar()
    roadmapList.value = data || []
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    errorMsg.value = err.message || 'Gagal memuat peta belajar.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  muatPetaBelajar()
})
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <StudentHeader active="peta" />

    <main class="mx-auto max-w-[850px] px-6 pb-12 pt-8 sm:px-0">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-[21px] font-bold sm:text-[24px]">Peta Belajar Saya</h1>
          <p class="mt-1 text-[14px] text-wf-secondary">
            Roadmap disusun secara otomatis per bab berdasarkan analisis butir-butir soal kuis yang belum tepat menggunakan AI.
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl border border-wf-border-subtle bg-wf-card px-4 py-2 text-xs font-semibold text-wf-secondary shadow-sm hover:border-wf-brand hover:text-wf-brand"
          :disabled="loading"
          @click="muatPetaBelajar"
        >
          {{ loading ? 'Memuat...' : '↻ Segarkan' }}
        </button>
      </div>

      <p v-if="notice" role="status" class="mt-4 rounded-md border border-wf-brand-border bg-wf-brand-soft px-4 py-3 text-sm text-wf-brand">
        {{ notice }}
      </p>
      <p v-if="errorMsg" role="alert" class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-wf-no-text">
        {{ errorMsg }}
      </p>

      <div v-if="loading" class="mt-8 flex flex-col items-center justify-center py-12 text-center">
        <div class="size-8 animate-spin rounded-full border-4 border-wf-brand border-t-transparent"></div>
        <p class="mt-3 text-sm text-wf-secondary">Memuat peta belajar dan analisis materi...</p>
      </div>

      <section v-else-if="roadmapList.length" class="mt-6 flex flex-col gap-3">
        <article
          v-for="(item, index) in roadmapList"
          :key="item.idBab"
          class="grid gap-4 rounded-xl border border-wf-border-subtle bg-wf-card p-5 sm:grid-cols-[36px_minmax(0,1fr)_260px] sm:items-center transition-all hover:shadow-sm"
        >
          <!-- Nomor Urut -->
          <div
            class="flex size-8 items-center justify-center rounded-full border-2 text-sm font-bold"
            :class="item.status === 'terkunci' ? 'border-gray-300 text-gray-400' : 'border-wf-brand text-wf-brand'"
          >
            {{ index + 1 }}
          </div>

          <!-- Keterangan Bab -->
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-[16px] font-bold text-wf-text">{{ item.namaBab }}</h2>
              <span
                v-if="item.status === 'sempurna'"
                class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200"
              >
                ✓ Tuntas Sempurna
              </span>
              <span
                v-else-if="item.status === 'roadmap'"
                class="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200"
              >
                {{ item.totalSoalSalah !== null ? `${item.totalSoalSalah} soal perlu diperkuat` : 'Roadmap Siap' }}
              </span>
              <span
                v-else
                class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 border border-gray-200"
              >
                Terkunci
              </span>
            </div>

            <p class="mt-1 text-[13px] leading-5 text-wf-secondary">{{ item.ringkasan }}</p>
            <p v-if="item.deskripsi" class="mt-1 text-[12px] text-wf-secondary/80">Cakupan: {{ item.deskripsi }}</p>
            <p class="mt-1 text-[12px] font-medium text-wf-brand">
              Progres: {{ item.selesaiCount }} dari {{ item.totalKuis }} kuis diselesaikan
              <span v-if="item.jumlahTahap > 0">· {{ item.jumlahTahap }} tahap belajar disiapkan AI</span>
            </p>
          </div>

          <!-- Tombol Aksi -->
          <div class="flex flex-wrap justify-start gap-2.5 sm:justify-end">
            <button
              type="button"
              class="rounded-xl border border-wf-brand-border px-3.5 py-2.5 text-xs font-semibold text-wf-brand hover:bg-wf-brand-soft"
              @click="bukaKuis(item)"
            >
              DAFTAR KUIS
            </button>
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm transition"
              :class="item.status === 'terkunci'
                ? 'border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'bg-wf-brand text-white hover:bg-wf-accent-hover'"
              :disabled="item.status === 'terkunci'"
              @click="bukaRoadmap(item)"
            >
              {{ item.status === 'terkunci' ? 'TERKUNCI' : 'LIHAT ROADMAP' }}
            </button>
          </div>
        </article>
      </section>

      <div v-else class="mt-8 rounded-xl border border-dashed border-wf-border p-8 text-center text-wf-secondary">
        Belum ada bab materi yang terdaftar.
      </div>
    </main>
  </div>
</template>
