<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ambilRoadmapBab,
  perbaruiRoadmapBab,
  isBabRegenerating,
  getOngoingRegeneratePromise,
  roadmapCache,
} from '../services/petaBelajar'
import { getUser, SessionExpiredError } from '../services/auth'
import StudentHeader from '../components/StudentHeader.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const user = ref(getUser())
const roadmapData = ref(roadmapCache[props.id] || null)
const loading = ref(!roadmapCache[props.id])
const isRegenerating = computed(() => isBabRegenerating(props.id))
const errorMsg = ref('')
const notice = ref('')

const namaBab = computed(() => roadmapData.value?.namaBab || 'Materi Bab')
const tahapan = computed(() => roadmapData.value?.tahapan || [])
const status = computed(() => roadmapData.value?.status || 'roadmap')

async function muatRoadmap() {
  errorMsg.value = ''

  // Jika sedang ada proses regenerasi latar belakang untuk bab ini
  if (isBabRegenerating(props.id)) {
    const ongoing = getOngoingRegeneratePromise(props.id)
    if (ongoing) {
      if (!roadmapData.value) loading.value = true
      ongoing
        .then((data) => {
          roadmapData.value = data
          notice.value = 'Roadmap berhasil diperbarui berdasarkan hasil kuis terbaru Anda!'
        })
        .catch((err) => {
          errorMsg.value = err.message || 'Gagal memperbarui roadmap.'
        })
        .finally(() => {
          loading.value = false
        })
      return
    }
  }

  // Jika sudah ada cache di memori lokal
  if (roadmapCache[props.id]) {
    roadmapData.value = roadmapCache[props.id]
    loading.value = false
  } else {
    loading.value = true
  }

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
  errorMsg.value = ''
  notice.value = ''
  try {
    const data = await perbaruiRoadmapBab(props.id)
    roadmapData.value = data
    notice.value = 'Roadmap berhasil diperbarui berdasarkan hasil kuis terbaru Anda!'
  } catch (err) {
    errorMsg.value = err.message || 'Gagal memperbarui roadmap.'
  }
}

onMounted(() => {
  muatRoadmap()
})
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <StudentHeader active="peta" />

    <main class="mx-auto max-w-[900px] px-6 pb-16 pt-8 sm:px-10 lg:px-0">
      <!-- Breadcrumb -->
      <nav aria-label="Breadcrumb" class="font-mono text-[14px] uppercase tracking-wider text-wf-secondary sm:text-[15px]">
        <RouterLink to="/peta-belajar" class="font-semibold text-wf-brand hover:underline">Peta Belajar</RouterLink>
        <span class="mx-2 text-wf-border">/</span>
        <span class="text-wf-text font-medium">{{ namaBab }}</span>
      </nav>

      <!-- Header Bab & Tombol Aksi -->
      <div class="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-wf-border-subtle pb-5">
        <div>
          <h1 class="text-[24px] font-bold sm:text-[28px] text-wf-text">Roadmap Bab: {{ namaBab }}</h1>
          <p class="mt-1 text-[14px] text-wf-secondary leading-relaxed">
            Dihimpun dari butir-butir soal yang belum tepat dari seluruh kuis di bab ini untuk menyusun tahapan penguatan konsep secara terukur.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            class="flex items-center gap-2 rounded-xl border border-wf-brand-border bg-wf-brand-soft px-4 py-2.5 text-xs font-semibold text-wf-brand transition hover:bg-wf-brand/10 disabled:opacity-50"
            :disabled="loading || isRegenerating"
            @click="handleRegenerate"
          >
            <span v-if="isRegenerating" class="size-3.5 animate-spin rounded-full border-2 border-wf-brand border-t-transparent"></span>
            <span>{{ isRegenerating ? 'AI Sedang Menganalisis...' : '↻ Perbarui dari Kuis Terbaru' }}</span>
          </button>
          <RouterLink
            :to="`/latihan/${props.id}`"
            class="rounded-xl bg-wf-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-wf-accent-hover"
          >
            Kerjakan Kuis Bab Ini
          </RouterLink>
        </div>
      </div>

      <!-- Banner Proses Pembaruan Latar Belakang (Persistent across navigation) -->
      <div
        v-if="isRegenerating"
        class="mt-4 flex items-center gap-3.5 rounded-xl border border-wf-brand-border bg-wf-brand-soft/90 p-4 text-wf-brand shadow-sm animate-pulse"
      >
        <span class="size-5 animate-spin rounded-full border-2 border-wf-brand border-t-transparent flex-shrink-0"></span>
        <div class="text-xs sm:text-sm">
          <strong class="font-bold text-wf-brand">AI sedang memperbarui roadmap di latar belakang...</strong>
          <p class="text-xs text-wf-secondary mt-0.5 leading-relaxed">
            Proses analisis kuis terbaru tetap berjalan meskipun Anda berpindah ke halaman lain. Hasil akan otomatis tersimpan dan diperbarui.
          </p>
        </div>
      </div>

      <!-- Ringkasan Performa Bab -->
      <div v-if="roadmapData && !loading" class="mt-5 rounded-xl border border-wf-border-subtle bg-wf-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-wf-secondary">Diagnosis AI untuk Bab Ini</span>
            <p class="mt-1 text-[14px] font-medium text-wf-text leading-relaxed">{{ roadmapData.ringkasanBab }}</p>
          </div>
          <div class="flex flex-wrap gap-3 text-xs">
            <div class="rounded-lg bg-wf-page px-3 py-2 border border-wf-border-subtle">
              <span class="text-wf-secondary">Kuis Selesai: </span>
              <strong class="text-wf-text">{{ roadmapData.totalKuisSelesai }} / {{ roadmapData.totalKuisBab }}</strong>
            </div>
            <div class="rounded-lg bg-wf-page px-3 py-2 border border-wf-border-subtle">
              <span class="text-wf-secondary">Soal Belum Tepat: </span>
              <strong :class="roadmapData.totalSoalSalah > 0 ? 'text-amber-600' : 'text-emerald-600'">
                {{ roadmapData.totalSoalSalah }} butir
              </strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifikasi & Error -->
      <p v-if="notice" role="status" class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {{ notice }}
      </p>
      <p v-if="errorMsg" role="alert" class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-wf-no-text">
        {{ errorMsg }}
      </p>

      <!-- Loading State -->
      <div v-if="loading" class="mt-12 flex flex-col items-center justify-center py-12 text-center">
        <div class="size-10 animate-spin rounded-full border-4 border-wf-brand border-t-transparent"></div>
        <p class="mt-4 text-[15px] font-medium text-wf-text">Menyusun Peta Belajar...</p>
        <p class="mt-1 text-xs text-wf-secondary">Menganalisis butir soal salah dari seluruh kuis dan merancang tahapan belajar terukur.</p>
      </div>

      <!-- State: Belum Dikerjakan -->
      <div v-else-if="status === 'belum_dikerjakan'" class="mt-8 rounded-xl border border-dashed border-wf-border p-8 text-center bg-wf-card">
        <p class="text-base font-semibold text-wf-text">Belum ada kuis yang diselesaikan pada bab ini.</p>
        <p class="mt-1 text-sm text-wf-secondary">Kerjakan minimal satu kuis untuk memicu penyusunan roadmap belajar personal Anda.</p>
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

      <!-- Daftar Tahapan Belajar Pedagogis -->
      <section v-if="tahapan.length && !loading" class="mt-6 flex flex-col gap-6">
        <article
          v-for="(item, index) in tahapan"
          :key="item.judul || index"
          class="rounded-xl border border-wf-border-subtle bg-wf-card p-6 shadow-sm transition hover:border-wf-brand/40"
        >
          <!-- Judul Tahap -->
          <div class="border-b border-wf-border-subtle pb-3">
            <h2 class="text-[18px] sm:text-[20px] font-bold text-wf-text">
              Tahap {{ item.tahapKe || index + 1 }} — {{ item.judul }}
            </h2>
            <div class="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold"
                :class="item.prioritas && item.prioritas.includes('tinggi')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : item.prioritas && item.prioritas.includes('akhir')
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'"
              >
                {{ item.prioritas || 'Prioritas tinggi' }}
              </span>
              <span class="text-xs text-wf-secondary font-medium">·</span>
              <span class="text-xs text-wf-secondary font-medium">{{ item.estimasiWaktu || '15 menit' }}</span>
            </div>
          </div>

          <!-- Rincian Pedagogis: Tujuan, Aktivitas, Kriteria Selesai -->
          <div class="mt-4 space-y-3.5">
            <!-- Tujuan -->
            <p class="text-[14px] sm:text-[15px] leading-relaxed text-wf-text">
              <strong class="font-semibold text-wf-text">Tujuan:</strong> {{ item.tujuan }}
            </p>

            <!-- Aktivitas Belajar & Latihan (Poin-Poin Bullets) -->
            <div v-if="item.aktivitas && item.aktivitas.length" class="pt-1">
              <span class="text-xs font-semibold uppercase tracking-wider text-wf-secondary">Aktivitas Belajar & Latihan:</span>
              <ul class="mt-1.5 space-y-1.5 text-[14px] text-wf-text pl-1">
                <li v-for="(act, aIdx) in item.aktivitas" :key="aIdx" class="flex items-start gap-2.5">
                  <span class="text-wf-brand font-bold select-none leading-none pt-1">•</span>
                  <span class="leading-relaxed">{{ act }}</span>
                </li>
              </ul>
            </div>
            <div v-else-if="item.kegiatan" class="pt-1">
              <span class="text-xs font-semibold uppercase tracking-wider text-wf-secondary">Aktivitas Belajar & Latihan:</span>
              <p class="mt-1 text-[14px] text-wf-text leading-relaxed">• {{ item.kegiatan }}</p>
            </div>

            <!-- Kriteria Selesai / Target Terukur -->
            <div class="pt-2">
              <div class="inline-flex items-center gap-2 rounded-lg bg-emerald-50/90 border border-emerald-200 px-3.5 py-1.5 text-[13px] font-medium text-emerald-800">
                <span class="font-semibold text-emerald-950">Kriteria selesai:</span>
                <span>{{ item.kriteriaSelesai || 'minimal 2 dari 3 soal benar.' }}</span>
              </div>
            </div>

            <!-- Butir Soal Terkait dari Kuis Sebelumnya (Collapsible) -->
            <details v-if="item.soalTerkait && item.soalTerkait.length" class="mt-4 pt-3 text-xs border-t border-wf-border-subtle group">
              <summary class="cursor-pointer font-medium text-wf-secondary hover:text-wf-brand select-none flex items-center gap-1.5">
                <span>🔍 Tinjau butir soal terkait yang belum tepat ({{ item.soalTerkait.length }} butir)</span>
              </summary>
              <div class="mt-2.5 flex flex-col gap-1.5 pl-2 border-l-2 border-wf-border-subtle">
                <div
                  v-for="(soal, sIdx) in item.soalTerkait"
                  :key="sIdx"
                  class="rounded-md bg-wf-page p-2.5 text-xs text-wf-secondary font-mono leading-relaxed"
                >
                  {{ soal }}
                </div>
              </div>
            </details>
          </div>
        </article>
      </section>

      <!-- Navigasi Bawah -->
      <div class="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-wf-border-subtle pt-6">
        <RouterLink
          to="/peta-belajar"
          class="rounded-xl border border-wf-border-subtle bg-wf-card px-5 py-3 text-sm font-bold text-wf-secondary hover:border-wf-brand hover:text-wf-brand shadow-sm transition"
        >
          KEMBALI KE PETA BELAJAR
        </RouterLink>

        <button
          type="button"
          class="rounded-xl bg-wf-accent px-6 py-3 text-sm font-bold text-white hover:bg-wf-accent-hover shadow-sm transition disabled:opacity-50"
          :disabled="isRegenerating || loading"
          @click="handleRegenerate"
        >
          {{ isRegenerating ? 'Memperbarui di Latar Belakang...' : '↻ PERBARUI DARI KUIS TERBARU' }}
        </button>
      </div>
    </main>
  </div>
</template>
