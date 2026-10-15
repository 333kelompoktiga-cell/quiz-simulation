<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ambilBab } from '../services/bab'
import { ambilHasilPengerjaan } from '../services/kuis'
import { getAvatar, getUser, SessionExpiredError } from '../services/auth'
import logoImage from '../assets/logo-esikap.png'
import avatarImage from '../assets/icons/avatar.svg'
import StudentHeader from '../components/StudentHeader.vue'

const props = defineProps({ id: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const user = ref(getUser())
const avatar = ref(getAvatar() || avatarImage)
const bab = ref(null)
const hasil = ref(null)
const loading = ref(true)
const errorMsg = ref('')

const tahapDefault = [
  {
    judul: 'Kata Baku',
    ringkasan: '1 dari 2 soal belum tepat. Anda memilih "analisa", bentuk bakunya "analisis".',
    tujuan: 'menjelaskan pengertian kata baku dan tidak baku · membedakan keduanya dalam kalimat · memilih kata baku untuk konteks formal dan akademik · memperbaiki kata tidak baku.',
    kegiatan: 'baca ciri-ciri kata baku · amati contoh aktivitas, analisis, izin, risiko · kelompokkan baku / tidak baku · latihan pilihan ganda · perbaiki 10 kalimat · tulis 5 kalimat.',
  },
  {
    judul: 'Imbuhan di- dan Kata Depan di',
    ringkasan: '3 dari 3 soal tepat: "dibaca", "di sekolah", dan "dikirim" semuanya benar.',
    tujuan: 'menjelaskan perbedaan imbuhan di- dan kata depan di · menulis kata berimbuhan di- secara serangkai · menulis kata depan di secara terpisah · memperbaiki kesalahan penulisannya.',
    kegiatan: 'pelajari aturannya · amati dibaca, ditulis, dikerjakan · amati di rumah, di sekolah, di kelas · kelompokkan 20 contoh · perbaiki 4 kalimat salah · tulis 5 + 5 kalimat.',
  },
]

const tahap = computed(() => {
  const kelemahan = (hasil.value?.detailItems || [])
    .filter((item) => !item.meta?.isCorrect || Number(item.crispScore) < 60)
    .sort((a, b) => Number(a.crispScore || 0) - Number(b.crispScore || 0))
  if (!kelemahan.length) return tahapDefault

  const kelompok = new Map()
  for (const item of kelemahan) {
    const topik = item.linguisticLevel || 'Materi yang perlu diperkuat'
    if (!kelompok.has(topik)) kelompok.set(topik, [])
    kelompok.get(topik).push(item)
  }
  return [...kelompok.entries()].map(([judul, items]) => ({
    judul,
    ringkasan: `${items.length} soal perlu diperkuat berdasarkan ketepatan dan kecepatan jawaban Anda.`,
    tujuan: `Memahami kembali konsep ${judul.toLowerCase()} dan mengenali pola kesalahan pada soal yang belum tepat.`,
    kegiatan: `Pelajari kembali konsep ${judul.toLowerCase()} · tinjau pembahasan soal · kerjakan latihan serupa dengan memperhatikan waktu.`,
  }))
})
const namaBab = computed(() => bab.value?.namaBab || 'Ejaan')
const nilaiTerakhir = computed(() => hasil.value?.skorFuzzy ?? hasil.value?.akurasi ?? 0)

onMounted(async () => {
  try {
    const idPengerjaan = route.query.pengerjaan
    if (typeof idPengerjaan !== 'string' || !idPengerjaan) {
      throw new Error('Roadmap baru tersedia setelah Anda menyelesaikan kuis.')
    }
    const [dataBab, dataHasil] = await Promise.all([
      ambilBab(props.id),
      ambilHasilPengerjaan(idPengerjaan),
    ])
    bab.value = dataBab
    hasil.value = dataHasil
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
    <StudentHeader active="peta" />

    <main class="mx-auto max-w-[1000px] px-6 pb-12 pt-9 sm:px-10 lg:px-0">
      <div class="flex flex-wrap items-center gap-3">
        <RouterLink to="/peta-belajar" class="tombol-kembali">
          <span aria-hidden="true" class="text-xl leading-none">←</span>
          <span>KEMBALI KE PETA BELAJAR</span>
        </RouterLink>
        <span class="text-wf-muted" aria-hidden="true">/</span>
        <span class="font-mono text-[13px] uppercase tracking-[0.12em] text-wf-secondary">{{ namaBab }}</span>
      </div>
      <h1 class="mt-5 text-[27px] font-bold sm:text-[30px]">Roadmap bab {{ namaBab }}</h1>
      <p class="mt-1 text-[17px] text-wf-secondary">
        Bahasa Indonesia · {{ tahap.length }} tahap · nilai terakhir {{ nilaiTerakhir }}. Urutan tahap di dalam bab ini beserta status penguasaan Anda.
      </p>

      <p v-if="loading" class="mt-7 text-wf-secondary">Memuat roadmap...</p>
      <p v-else-if="errorMsg" role="alert" class="mt-7 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-wf-no-text">{{ errorMsg }}</p>
      <section v-else class="mt-6 flex flex-col gap-4">
        <article v-for="(item, index) in tahap" :key="item.judul" class="grid gap-4 rounded-md border border-wf-border-subtle bg-wf-card p-5 sm:grid-cols-[48px_minmax(0,1fr)] sm:items-center">
          <div class="flex size-9 items-center justify-center rounded-full border-2 border-wf-brand text-[17px]">{{ index + 1 }}</div>
          <div>
            <h2 class="text-[18px] font-bold">Tahap {{ index + 1 }} — {{ item.judul }}</h2>
            <p class="mt-2 text-[16px] leading-6 text-wf-secondary">{{ item.ringkasan }}</p>
            <p class="mt-2 text-[16px] leading-6 text-wf-secondary"><strong class="font-medium text-wf-text">Tujuan:</strong> {{ item.tujuan }}</p>
            <p class="mt-2 text-[16px] leading-6 text-wf-secondary"><strong class="font-medium text-wf-text">Kegiatan:</strong> {{ item.kegiatan }}</p>
          </div>
        </article>
        <RouterLink to="/peta-belajar" class="tombol-kembali mt-3">
          <span aria-hidden="true" class="text-xl leading-none">←</span>
          KEMBALI KE PETA BELAJAR
        </RouterLink>
      </section>
    </main>
  </div>
</template>
