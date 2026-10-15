<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ambilRoadmapBab, perbaruiRoadmapBab } from '../services/petaBelajar'
import { SessionExpiredError } from '../services/auth'
import StudentHeader from '../components/StudentHeader.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const roadmapData = ref(null)
const loading = ref(true)
const regenerating = ref(false)
const errorMsg = ref('')
const notice = ref('')

const namaBab = computed(() => roadmapData.value?.namaBab || 'Materi Bab')
const tahapan = computed(() => roadmapData.value?.tahapan || [])
const status = computed(() => roadmapData.value?.status || 'roadmap')

async function muatRoadmap() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await ambilRoadmapBab(props.id)
    roadmapData.value = data
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    errorMsg.value = err.message || 'Gagal memuat roadmap bab.'
  } finally {
    loading.value = false
  }
}

async function handleRegenerate() {
  regenerating.value = true
  errorMsg.value = ''
  notice.value = ''
  try {
    const data = await perbaruiRoadmapBab(props.id)
    roadmapData.value = data
    notice.value = 'Roadmap berhasil diperbarui berdasarkan hasil kuis terbaru Anda!'
  } catch (err) {
    errorMsg.value = err.message || 'Gagal memperbarui roadmap.'
  } finally {
    regenerating.value = false
  }
}

onMounted(() => {
  muatRoadmap()
})
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <StudentHeader active="peta" />

    <main class="mx-auto max-w-[1000px] px-6 pb-12 pt-8 sm:px-10 lg:px-0">
      <div class="flex flex-wrap items-center gap-3">
        <RouterLink to="/peta-belajar" class="tombol-kembali">
          <span aria-hidden="true" class="text-xl leading-none">←</span>
          KEMBALI KE PETA BELAJAR
        </RouterLink>
        <span class="text-wf-muted" aria-hidden="true">/</span>
        <span class="font-mono text-[13px] uppercase tracking-[0.12em] text-wf-secondary">{{ namaBab }}</span>
      </div>

      <div class="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-wf-border-subtle pb-5">
        <div>
          <h1 class="text-[24px] font-bold sm:text-[28px] text-wf-text">Roadmap Bab: {{ namaBab }}</h1>
          <p class="mt-1 text-[15px] text-wf-secondary leading-relaxed">
            Dihimpun dari seluruh pengerjaan kuis pada bab ini. AI menganalisis kelemahan soal dan menyusun tahapan penguatan materi.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            class="flex items-center gap-2 rounded-xl border border-wf-brand-border bg-wf-brand-soft px-4 py-2.5 text-xs font-semibold text-wf-brand transition hover:bg-wf-brand/10 disabled:opacity-50"
            :disabled="loading || regenerating"
            @click="handleRegenerate"
          >
            <span v-if="regenerating" class="size-3.5 animate-spin rounded-full border-2 border-wf-brand border-t-transparent"></span>
            <span>{{ regenerating ? 'AI Sedang Menganalisis...' : '↻ Perbarui dari Kuis Terbaru' }}</span>
          </button>
          <RouterLink
            :to="`/latihan/${props.id}`"
            class="rounded-xl bg-wf-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-wf-accent-hover"
          >
            Kerjakan Kuis Bab Ini
          </RouterLink>
        </div>
      </div>

      <div v-if="roadmapData && !loading" class="mt-5 rounded-xl border border-wf-border-subtle bg-wf-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-wf-secondary">Diagnosis AI untuk Bab Ini</span>
            <p class="mt-1 text-[15px] font-medium text-wf-text">{{ roadmapData.ringkasanBab }}</p>
          </div>
          <div class="flex flex-wrap gap-4 text-xs">
            <div class="rounded-lg bg-wf-page px-3 py-2 border border-wf-border-subtle">
              <span class="text-wf-secondary">Kuis Selesai: </span>
              <strong class="text-wf-text">{{ roadmapData.totalKuisSelesai }} / {{ roadmapData.totalKuisBab }}</strong>
            </div>
            <div class="rounded-lg bg-wf-page px-3 py-2 border border-wf-border-subtle">
              <span class="text-wf-secondary">Soal Perlu Diperkuat: </span>
              <strong :class="roadmapData.totalSoalSalah > 0 ? 'text-amber-600' : 'text-emerald-600'">
                {{ roadmapData.totalSoalSalah }} butir
              </strong>
            </div>
          </div>
        </div>
      </div>

      <p v-if="notice" role="status" class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {{ notice }}
      </p>
      <p v-if="errorMsg" role="alert" class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-wf-no-text">
        {{ errorMsg }}
      </p>

      <!-- Loading State -->
      <div v-if="loading" class="mt-12 flex flex-col items-center justify-center py-12 text-center">
        <div class="size-10 animate-spin rounded-full border-4 border-wf-brand border-t-transparent"></div>
        <p class="mt-4 text-[15px] font-medium text-wf-text">Menyusun Peta Belajar dengan AI...</p>
        <p class="mt-1 text-xs text-wf-secondary">Membaca butir soal salah dan menyusun materi perbaikan khusus untuk Anda.</p>
      </div>

      <!-- State: Belum Dikerjakan -->
      <div v-else-if="status === 'belum_dikerjakan'" class="mt-8 rounded-xl border border-dashed border-wf-border p-8 text-center bg-wf-card">
        <p class="text-base font-semibold text-wf-text">Belum ada kuis yang diselesaikan pada bab ini.</p>
        <p class="mt-1 text-sm text-wf-secondary">Kerjakan minimal satu kuis untuk memicu AI menyusun roadmap belajar personal Anda.</p>
        <RouterLink
          :to="`/latihan/${props.id}`"
          class="mt-4 inline-block rounded-xl bg-wf-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-wf-accent-hover"
        >
          Mulai Latihan Kuis
        </RouterLink>
      </div>

      <!-- State: Sempurna (Semua Benar) -->
      <div v-else-if="status === 'sempurna'" class="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-6">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-lg font-bold">✓</div>
          <div>
            <h2 class="text-lg font-bold text-emerald-900">Penguasaan Sempurna!</h2>
            <p class="text-sm text-emerald-800">
              Seluruh butir soal pada kuis bab ini Anda jawab dengan benar. Anda siap untuk beralih ke materi bab berikutnya.
            </p>
          </div>
        </div>
      </div>

      <!-- Daftar Tahapan Belajar dari AI -->
      <section v-if="tahapan.length && !loading" class="mt-6 flex flex-col gap-5">
        <article
          v-for="(item, index) in tahapan"
          :key="item.judul || index"
          class="grid gap-4 rounded-xl border border-wf-border-subtle bg-wf-card p-6 shadow-sm transition sm:grid-cols-[48px_minmax(0,1fr)] sm:items-start"
        >
          <!-- Badge Tahap Ke -->
          <div class="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-wf-brand bg-wf-brand-soft text-[16px] font-bold text-wf-brand">
            {{ index + 1 }}
          </div>

          <!-- Rincian Tahap -->
          <div class="space-y-3">
            <div>
              <span class="text-xs font-semibold uppercase tracking-wider text-wf-brand">Tahap {{ index + 1 }}</span>
              <h2 class="text-[18px] font-bold text-wf-text">{{ item.judul }}</h2>
            </div>

            <!-- Ringkasan / Analisis Kesalahan -->
            <div class="rounded-lg bg-amber-50/70 border border-amber-200/80 p-3.5 text-sm text-amber-900 leading-relaxed">
              <strong class="font-semibold text-amber-950">Analisis Kesalahan: </strong>
              {{ item.ringkasan }}
            </div>

            <!-- Tujuan Belajar -->
            <p class="text-[14px] leading-relaxed text-wf-secondary">
              <strong class="font-medium text-wf-text">Tujuan Belajar: </strong>
              {{ item.tujuan }}
            </p>

            <!-- Rekomendasi Kegiatan -->
            <p class="text-[14px] leading-relaxed text-wf-secondary">
              <strong class="font-medium text-wf-text">Kegiatan yang Disarankan: </strong>
              {{ item.kegiatan }}
            </p>

            <!-- Soal Terkait yang Diidentifikasi AI -->
            <div v-if="item.soalTerkait && item.soalTerkait.length" class="pt-1">
              <span class="text-xs font-medium text-wf-secondary">Butir Soal Terkait:</span>
              <div class="mt-1 flex flex-wrap gap-2">
                <span
                  v-for="(soal, sIdx) in item.soalTerkait"
                  :key="sIdx"
                  class="rounded-md bg-wf-page px-2.5 py-1 text-xs text-wf-secondary border border-wf-border-subtle font-mono"
                >
                  {{ soal }}
                </span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <!-- Navigasi Bawah -->
      <div class="mt-8 flex flex-wrap items-center justify-between gap-4">
        <RouterLink
          to="/peta-belajar"
          class="rounded-xl border border-wf-border-subtle bg-wf-card px-5 py-3 text-sm font-bold text-wf-secondary hover:border-wf-brand hover:text-wf-brand shadow-sm transition"
        >
          ← KEMBALI KE PETA BELAJAR
        </RouterLink>

        <button
          type="button"
          class="rounded-xl bg-wf-accent px-6 py-3 text-sm font-bold text-white hover:bg-wf-accent-hover shadow-sm transition disabled:opacity-50"
          :disabled="regenerating || loading"
          @click="handleRegenerate"
        >
          {{ regenerating ? 'Memperbarui...' : '↻ PERBARUI DARI KUIS TERBARU' }}
        </button>
      </div>
    </main>
  </div>
</template>
