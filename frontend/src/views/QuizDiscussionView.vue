<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ambilKuis, ambilSoalKuis } from '../services/kuis'
import { SessionExpiredError } from '../services/auth'
import StudentHeader from '../components/StudentHeader.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const kuis = ref(null)
const soal = ref([])
const hasil = ref(null)
const nomorAktif = ref(0)
const loading = ref(true)
const errorMsg = ref('')

const soalContoh = [
  {
    pertanyaan: 'Penulisan kata baku yang benar terdapat pada pilihan...',
    difficulty: 'Mudah',
    pembahasan: 'Bentuk baku menurut KBBI adalah "analisis". "Analisa" terserap dari bahasa Belanda "analyse" dan sampai sekarang tidak diakui sebagai bentuk baku.',
    opsi: [
      { opsi: 'A. analisa', isCorrect: false },
      { opsi: 'B. analisis', isCorrect: true },
      { opsi: 'C. analysis', isCorrect: false },
      { opsi: 'D. analisia', isCorrect: false },
    ],
  },
  {
    pertanyaan: 'Penulisan kata depan yang tepat terdapat pada pilihan...',
    difficulty: 'Mudah',
    pembahasan: 'Kata depan di ditulis terpisah dari kata yang mengikutinya, sedangkan imbuhan di- ditulis serangkai dengan kata dasar.',
    opsi: [
      { opsi: 'A. dirumah', isCorrect: false },
      { opsi: 'B. di rumah', isCorrect: true },
      { opsi: 'C. diRumah', isCorrect: false },
      { opsi: 'D. di-rumah', isCorrect: false },
    ],
  },
]

const soalAktif = computed(() => soal.value[nomorAktif.value])
const jawabanAktif = computed(() => hasil.value?.jawaban?.[nomorAktif.value])
const kunciAktif = computed(() => {
  const opsi = soalAktif.value?.opsi || []
  const index = opsi.findIndex((item) => item.isCorrect === true)
  return index === -1 ? null : index
})
const statusAktif = computed(() => {
  if (kunciAktif.value === null || jawabanAktif.value === undefined) return null
  return kunciAktif.value === Number(jawabanAktif.value) ? 'Tepat' : 'Belum tepat'
})

function formatOpsi(teks) {
  return teks.replace(/^[A-Z]\.\s*/, '')
}

function statusOpsi(index) {
  if (kunciAktif.value === index) return 'benar'
  if (jawabanAktif.value === index && statusAktif.value === 'Belum tepat') return 'salah'
  return 'biasa'
}

function teksStatus() {
  if (statusAktif.value === 'Tepat') return 'JAWABAN ANDA BENAR ✓'
  if (statusAktif.value === 'Belum tepat') return 'JAWABAN ANDA ✕'
  return jawabanAktif.value === undefined ? 'TIDAK DIJAWAB' : 'PEMBAHASAN'
}

onMounted(async () => {
  try {
    hasil.value = JSON.parse(sessionStorage.getItem(`hasil-kuis-${props.id}`) || 'null')
    const [dataKuis, dataSoal] = await Promise.all([
      ambilKuis(props.id),
      ambilSoalKuis(props.id),
    ])
    kuis.value = dataKuis
    soal.value = hasil.value?.soal?.length ? hasil.value.soal : dataSoal
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    if (props.id === 'demo') {
      kuis.value = { judul: 'Ejaan' }
      soal.value = soalContoh
    } else {
      errorMsg.value = err.message
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <StudentHeader active="latihan" />

    <main class="mx-auto max-w-[638px] px-6 pb-12 pt-8 sm:px-0">
      <p v-if="loading" class="text-wf-secondary">Memuat pembahasan...</p>
      <p v-else-if="errorMsg" role="alert" class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-wf-no-text">{{ errorMsg }}</p>
      <article v-else-if="soalAktif" class="rounded-md border border-wf-border-subtle bg-wf-card p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <p class="font-mono text-[14px] font-bold uppercase tracking-[0.1em] text-wf-secondary">Soal {{ nomorAktif + 1 }} dari {{ soal.length }}</p>
          <div class="flex gap-2">
            <span class="rounded-md border border-wf-brand-border px-2 py-1 text-sm text-wf-secondary">{{ kuis?.judul || 'Kuis' }}</span>
            <span class="rounded-md border border-wf-brand-border px-2 py-1 text-sm text-wf-secondary">Tingkat: {{ soalAktif.difficulty || 'Mudah' }}</span>
          </div>
        </div>

        <h2 class="mt-6 text-[18px] font-bold leading-6">{{ soalAktif.pertanyaan }}</h2>

        <div class="mt-5 flex flex-col gap-3">
          <div v-for="(opsi, index) in soalAktif.opsi" :key="opsi.idOpsi || opsi.opsi" class="discussion-option" :class="`discussion-${statusOpsi(index)}`">
            <span class="discussion-radio">{{ statusOpsi(index) === 'benar' ? '✓' : statusOpsi(index) === 'salah' ? '×' : '○' }}</span>
            <span class="font-semibold">{{ String.fromCharCode(65 + index) }}</span>
            <span class="flex-1">{{ formatOpsi(opsi.opsi) }}</span>
            <strong v-if="statusOpsi(index) === 'benar'" class="text-sm">BENAR ✓</strong>
            <strong v-else-if="statusOpsi(index) === 'salah'" class="text-sm">JAWABAN ANDA ×</strong>
          </div>
        </div>

        <p v-if="statusAktif === null" class="mt-4 rounded-md bg-wf-brand-soft px-4 py-3 text-sm text-wf-secondary">
          Kunci jawaban dan pembahasan akan ditampilkan setelah hasil diproses oleh sistem.
        </p>
        <div v-else class="mt-5 rounded-md bg-[#f0e7f8] p-5">
          <p class="font-mono text-[13px] font-bold uppercase tracking-[0.08em] text-wf-secondary">Pembahasan lengkap</p>
          <p class="mt-2 leading-6">{{ soalAktif.pembahasan || soalAktif.ringkasan || 'Pembahasan untuk soal ini belum tersedia.' }}</p>
        </div>

        <div class="mt-5 flex items-center justify-between gap-3">
          <button type="button" class="tombol-kembali disabled:cursor-not-allowed disabled:opacity-40" :disabled="nomorAktif === 0" @click="nomorAktif -= 1">
            <span aria-hidden="true" class="text-xl leading-none">←</span>
            KEMBALI
          </button>
          <span class="font-mono text-xs font-bold text-wf-secondary">SOAL {{ nomorAktif + 1 }} DARI {{ soal.length }}</span>
          <button type="button" class="rounded-xl bg-wf-accent px-5 py-3 font-semibold text-white disabled:opacity-40" :disabled="nomorAktif === soal.length - 1" @click="nomorAktif += 1">
            BERIKUTNYA →
          </button>
        </div>
      </article>
      <p v-else class="rounded-md border border-wf-border-subtle bg-wf-card p-6 text-wf-secondary">Belum ada soal untuk dibahas.</p>
    </main>
  </div>
</template>

<style scoped>
.discussion-option {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #e5e1ec;
  border-radius: 6px;
  padding: 14px 12px;
}

.discussion-radio {
  font-size: 20px;
  line-height: 1;
}

.discussion-benar {
  border: 2px solid #16a34a;
  background: #dcfce7;
  color: #166534;
}

.discussion-salah {
  border: 2px solid #dc2626;
  background: #fee2e2;
  color: #991b1b;
}

.discussion-biasa {
  color: #b9b5c3;
  background: #fbfafc;
}
</style>
