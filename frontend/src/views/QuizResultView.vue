<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ambilHasilPengerjaan,
  ambilPembahasanPengerjaan,
  ambilKuis,
} from '../services/kuis'
import { SessionExpiredError } from '../services/auth'
import StudentHeader from '../components/StudentHeader.vue'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const route = useRoute()
const kuis = ref(null)
const hasil = ref(null)
const pembahasan = ref([])
const loading = ref(true)
const loadingPembahasan = ref(false)
const tampilPembahasan = ref(false)
const errorMsg = ref('')
const errorPembahasan = ref('')

const total = computed(() => hasil.value?.totalSoal ?? 0)
const benar = computed(() => hasil.value?.totalBenar ?? 0)
const salah = computed(() => hasil.value?.totalSalah ?? 0)
const nilai = computed(() => Math.round(Number(hasil.value?.akurasi) || 0))
const waktu = computed(() => {
  const seconds = Number(hasil.value?.waktuPengerjaan) || 0
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
})

function statusSoal(index) {
  return hasil.value?.detailItems?.[index]?.meta?.isCorrect ? 'Tepat' : 'Belum tepat'
}

function ulangi() {
  router.push(`/kuis/${props.id}/kerjakan`)
}

async function togglePembahasan() {
  tampilPembahasan.value = !tampilPembahasan.value
  if (!tampilPembahasan.value || pembahasan.value.length) return

  loadingPembahasan.value = true
  errorPembahasan.value = ''
  try {
    pembahasan.value = await ambilPembahasanPengerjaan(route.query.pengerjaan)
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    errorPembahasan.value = error.message
  } finally {
    loadingPembahasan.value = false
  }
}

onMounted(async () => {
  try {
    const idPengerjaan = route.query.pengerjaan
    if (typeof idPengerjaan !== 'string' || !idPengerjaan) {
      throw new Error('ID pengerjaan tidak tersedia. Mulai kuis melalui halaman latihan.')
    }
    const [dataHasil, dataKuis] = await Promise.all([
      ambilHasilPengerjaan(idPengerjaan),
      ambilKuis(props.id),
    ])
    hasil.value = dataHasil
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

    <main class="mx-auto max-w-[628px] px-6 pb-12 pt-8 sm:px-0">
      <p v-if="loading" class="text-wf-secondary">Memuat ringkasan hasil...</p>
      <p v-else-if="errorMsg" role="alert" class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-wf-no-text">{{ errorMsg }}</p>
      <template v-else>
        <section class="grid grid-cols-2 gap-4 rounded-md border border-wf-border-subtle bg-wf-card p-5 sm:grid-cols-4">
          <div class="score-ring">
            <strong>{{ nilai }}</strong>
          </div>
          <div class="result-stat"><strong>{{ benar }}</strong><span>BENAR</span></div>
          <div class="result-stat"><strong>{{ salah }}</strong><span>SALAH</span></div>
          <div class="result-stat"><strong>{{ waktu }}</strong><span>WAKTU</span></div>
        </section>
        <section class="mt-4 rounded-md border border-wf-border-subtle bg-wf-card p-5">
          <p><strong>Skor fuzzy:</strong> {{ hasil.skorFuzzy }} ({{ hasil.kategoriFuzzy }})</p>
          <p v-if="hasil.rekomendasi" class="mt-2 text-wf-secondary">{{ hasil.rekomendasi }}</p>
        </section>

        <section class="mt-5 rounded-md border border-wf-border-subtle bg-wf-card p-5">
          <h2 class="font-mono text-[13px] uppercase tracking-[0.12em] text-wf-secondary">Hasil tiap soal</h2>
          <div class="mt-4 flex flex-col gap-3">
            <div v-for="(item, index) in hasil.detailItems" :key="item.soalId || index" class="flex items-center justify-between rounded-md border border-wf-border-subtle px-4 py-3">
              <span class="text-[16px]"><b :class="statusSoal(index) === 'Tepat' ? 'text-wf-ok' : 'text-wf-no'">{{ statusSoal(index) === 'Tepat' ? '✓' : '×' }}</b><span class="ml-3">{{ index + 1 }}. {{ item.linguisticLevel }} · {{ item.crispScore }}</span></span>
              <strong class="text-sm" :class="statusSoal(index) === 'Tepat' ? 'text-wf-ok' : 'text-wf-no-text'">{{ statusSoal(index) }}</strong>
            </div>
          </div>
        </section>

        <div class="mt-5 flex flex-wrap gap-3">
          <button type="button" class="rounded-xl border border-wf-accent-light px-4 py-3 font-semibold text-wf-brand hover:bg-wf-brand-soft" @click="togglePembahasan">
            {{ loadingPembahasan ? 'MEMUAT...' : tampilPembahasan ? 'SEMBUNYIKAN PEMBAHASAN' : 'BUKA PEMBAHASAN SEMUA SOAL' }}
          </button>
          <button type="button" class="rounded-xl bg-wf-brand px-4 py-3 font-semibold text-white hover:bg-wf-accent-hover" @click="router.push({ path: `/kuis/${props.id}/diagnostik`, query: { pengerjaan: route.query.pengerjaan } })">
            BUKA LAPORAN DIAGNOSTIK
          </button>
          <button
            type="button"
            class="rounded-xl border border-wf-accent-light px-4 py-3 font-semibold text-wf-brand hover:bg-wf-brand-soft"
            @click="router.push({ path: '/statistik', query: { kuis: props.id, pengerjaan: route.query.pengerjaan } })"
          >
            STATISTIK
          </button>
        </div>
        <p v-if="errorPembahasan" role="alert" class="mt-3 text-sm text-red-700">{{ errorPembahasan }}</p>
        <section v-if="tampilPembahasan" class="mt-4 flex flex-col gap-4">
          <article v-for="item in pembahasan" :key="item.idSoal" class="rounded-md border border-wf-border-subtle bg-wf-card p-5">
            <h2 class="font-semibold">{{ item.nomorSoal }}. {{ item.pertanyaan }}</h2>
            <ul class="mt-3 flex flex-col gap-2">
              <li v-for="option in item.opsi" :key="option.idOpsi" :class="option.isCorrect ? 'font-semibold text-green-700' : option.dipilih ? 'text-red-700' : 'text-wf-secondary'">
                {{ option.isCorrect ? '✓ ' : option.dipilih ? '× ' : '' }}{{ option.opsi }}
                <span v-if="option.dipilih">(jawaban Anda)</span>
                <span v-if="option.isCorrect">(jawaban benar)</span>
              </li>
            </ul>
            <p v-if="item.pembahasan" class="mt-4">{{ item.pembahasan }}</p>
            <p v-if="item.ringkasan" class="mt-2 text-sm text-wf-secondary">{{ item.ringkasan }}</p>
          </article>
        </section>
        <div class="mt-3 flex flex-wrap justify-between gap-3">
          <button type="button" class="rounded-xl border border-wf-brand-border px-4 py-3 font-semibold text-wf-brand hover:bg-wf-brand-soft" @click="ulangi">ULANGI BAB INI</button>
          <RouterLink to="/dashboard" class="rounded-xl bg-wf-accent px-5 py-3 font-semibold text-white hover:bg-wf-accent-hover">BAB BERIKUTNYA: TANDA BACA</RouterLink>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.score-ring {
  display: flex;
  width: 86px;
  height: 86px;
  align-items: center;
  justify-content: center;
  border: 11px solid #16a34a;
  border-right-color: #dc2626;
  border-radius: 9999px;
  font-size: 30px;
  font-weight: 700;
}

.result-stat {
  display: flex;
  min-height: 86px;
  flex-direction: column;
  justify-content: center;
  border: 1px solid #cbb3e4;
  border-radius: 4px;
  padding: 12px 16px;
}

.result-stat strong {
  font-size: 30px;
  line-height: 1;
}

.result-stat span {
  margin-top: 8px;
  color: #6b6780;
  font-weight: 700;
}
</style>
