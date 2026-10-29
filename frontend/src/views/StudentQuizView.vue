<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  mulaiPengerjaanKuis,
  simpanJawabanPengerjaan,
  submitPengerjaanKuis,
} from '../services/kuis'
import { SessionExpiredError } from '../services/auth'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const kuis = ref(null)
const soal = ref([])
const jawaban = ref({})
const waktuPerSoal = ref({})
const ragu = ref(new Set())
const nomorAktif = ref(0)
const sisaDetik = ref(0)
const loading = ref(false)
const errorMsg = ref('')
const submitted = ref(false)
const submitting = ref(false)
const idPengerjaan = ref('')
let timerId
let waktuMulaiSoal = 0
let saveQueue = Promise.resolve()

// ── PIN dari dosen ──
// Pop-up muncul begitu halaman dibuka (setelah klik MULAI). Pengerjaan baru dibuat
// di backend setelah PIN benar; kalau salah, backend menolak dan soal tidak dimuat.
const tampilPin = ref(true)
const pinInput = ref('')
const errorPin = ref('')
const memeriksaPin = ref(false)

const soalAktif = computed(() => soal.value[nomorAktif.value])
const terjawab = computed(() => Object.keys(jawaban.value).length)
const jumlahRagu = computed(() => [...ragu.value].filter((index) => jawaban.value[index] !== undefined).length)
const belumDijawab = computed(() => soal.value.length - terjawab.value)
const waktu = computed(() => {
  const menit = Math.floor(sisaDetik.value / 60).toString().padStart(2, '0')
  const detik = (sisaDetik.value % 60).toString().padStart(2, '0')
  return `00:${menit}:${detik}`
})

function pilihJawaban(indexOpsi) {
  jawaban.value = { ...jawaban.value, [nomorAktif.value]: indexOpsi }
  catatWaktuSoal(nomorAktif.value)
  waktuMulaiSoal = Date.now()
  simpanJawabanKeServer()
}

function toggleRagu() {
  const salinan = new Set(ragu.value)
  if (salinan.has(nomorAktif.value)) salinan.delete(nomorAktif.value)
  else salinan.add(nomorAktif.value)
  ragu.value = salinan
}

function statusNomor(index) {
  if (index === nomorAktif.value) return 'aktif'
  if (ragu.value.has(index)) return 'ragu'
  if (jawaban.value[index] !== undefined) return 'terjawab'
  return 'kosong'
}

function formatOpsi(teks) {
  return teks.replace(/^[A-Z]\.\s*/, '')
}

function keluarUjian() {
  if (window.confirm('Keluar dari ujian? Jawaban yang belum dikirim akan tetap tersimpan di halaman ini.')) {
    router.back()
  }
}

function catatWaktuSoal(index) {
  const question = soal.value[index]
  if (!question || !waktuMulaiSoal) return
  const elapsed = Math.max(0, Math.floor((Date.now() - waktuMulaiSoal) / 1000))
  waktuPerSoal.value = {
    ...waktuPerSoal.value,
    [question.idSoal]: (waktuPerSoal.value[question.idSoal] || 0) + elapsed,
  }
}

function daftarJawaban() {
  return soal.value.flatMap((question, index) => {
    const selectedIndex = jawaban.value[index]
    if (selectedIndex === undefined) return []
    const option = question.opsi[selectedIndex]
    if (!option?.idOpsi) return []
    const elapsed = waktuPerSoal.value[question.idSoal] || 0
    const activeSeconds = index === nomorAktif.value && waktuMulaiSoal
      ? Math.max(0, Math.floor((Date.now() - waktuMulaiSoal) / 1000))
      : 0
    return [{
      idSoal: question.idSoal,
      idOpsi: option.idOpsi,
      waktuPengerjaan: elapsed + activeSeconds,
    }]
  })
}

function simpanJawabanKeServer() {
  const answers = daftarJawaban()
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => simpanJawabanPengerjaan(idPengerjaan.value, answers))
  saveQueue.catch((error) => {
    errorMsg.value = error.message
  })
}

async function kirimJawaban(automatic = false) {
  if (submitting.value || !idPengerjaan.value) return
  if (!automatic && !window.confirm('Kirim jawaban sekarang? Setelah dikirim, jawaban tidak dapat diubah.')) return

  submitting.value = true
  errorMsg.value = ''
  window.clearInterval(timerId)
  catatWaktuSoal(nomorAktif.value)
  waktuMulaiSoal = 0
  try {
    await saveQueue.catch(() => {})
    const result = await submitPengerjaanKuis(idPengerjaan.value, daftarJawaban())
    submitted.value = true
    await router.replace({
      path: `/kuis/${props.id}/hasil`,
      query: { pengerjaan: result.idPengerjaan },
    })
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    errorMsg.value = error.message
    submitting.value = false
    if (sisaDetik.value > 0) {
      waktuMulaiSoal = Date.now()
      timerId = window.setInterval(hitungMundur, 1000)
    }
  }
}

function hitungMundur() {
  const elapsed = Math.floor((Date.now() - new Date(waktuMulaiServer.value).getTime()) / 1000)
  sisaDetik.value = Math.max(0, batasWaktu.value - elapsed)
  if (sisaDetik.value === 0) void kirimJawaban(true)
}

const waktuMulaiServer = ref('')
const batasWaktu = ref(0)

watch(nomorAktif, (_, previousIndex) => {
  catatWaktuSoal(previousIndex)
  waktuMulaiSoal = Date.now()
  simpanJawabanKeServer()
})

// Membuat pengerjaan di backend (PIN diperiksa di sana) lalu memuat soal.
async function mulaiKuis(pin) {
  const data = await mulaiPengerjaanKuis(props.id, pin)
  idPengerjaan.value = data.pengerjaan.idPengerjaan
  kuis.value = data.kuis
  soal.value = data.soal
  waktuMulaiServer.value = data.pengerjaan.waktuMulai
  batasWaktu.value = Math.max(1, Number(data.kuis.durasi) || 30) * 60

  const jawabanTersimpan = new Map(data.jawaban.map((answer) => [answer.idSoal, answer]))
  soal.value.forEach((question, index) => {
    const saved = jawabanTersimpan.get(question.idSoal)
    if (!saved) return
    const optionIndex = question.opsi.findIndex((option) => option.idOpsi === saved.idOpsi)
    if (optionIndex !== -1) jawaban.value[index] = optionIndex
    waktuPerSoal.value[question.idSoal] = Number(saved.responseTime) || 0
  })

  hitungMundur()
  if (sisaDetik.value > 0) timerId = window.setInterval(hitungMundur, 1000)
  waktuMulaiSoal = Date.now()
}

async function verifikasiPin() {
  const pin = pinInput.value.trim()
  if (!pin) {
    errorPin.value = 'Masukkan PIN dari dosen.'
    return
  }

  errorPin.value = ''
  memeriksaPin.value = true
  try {
    await mulaiKuis(pin)
    tampilPin.value = false
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    // Pesan dari backend, mis. "PIN salah." atau "Kuis ini belum dibuka oleh dosen."
    errorPin.value = err.message
    pinInput.value = ''
  } finally {
    memeriksaPin.value = false
  }
}

function batalPin() {
  router.back()
}

onBeforeUnmount(() => window.clearInterval(timerId))
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <header class="border-b border-wf-border bg-wf-card">
      <div class="mx-auto flex max-w-[1140px] items-center justify-between gap-5 px-6 py-5 sm:px-10">
        <div>
          <p class="font-semibold uppercase tracking-[0.08em] text-wf-secondary">Bahasa Indonesia · Bab {{ kuis?.urutanBab ?? 1 }}</p>
          <h1 class="mt-2 text-[21px] font-bold">{{ kuis?.judul || 'Kuis' }}</h1>
        </div>
        <div class="flex items-center gap-5">
          <div class="text-right">
            <p class="font-semibold uppercase tracking-[0.08em] text-wf-secondary">Sisa waktu</p>
            <strong class="text-[20px]">{{ waktu }}</strong>
          </div>
          <button type="button" :disabled="submitting || tampilPin" class="rounded-xl border border-wf-brand-border px-5 py-3 text-[18px] font-semibold text-wf-brand hover:bg-wf-brand-soft disabled:opacity-50" @click="keluarUjian">
            KELUAR UJIAN
          </button>
        </div>
      </div>
      <div class="h-1.5 bg-wf-brand-soft">
        <div class="h-full bg-wf-brand transition-all" :style="{ width: `${soal.length ? ((nomorAktif + 1) / soal.length) * 100 : 0}%` }"></div>
      </div>
    </header>

    <main class="mx-auto max-w-[990px] px-6 pb-12 pt-9 sm:px-10 lg:px-0">
      <p v-if="loading" class="text-wf-secondary">Memuat soal...</p>
      <!-- Soal baru tampil setelah PIN benar; selama pop-up PIN terbuka, area ini kosong -->
      <div v-else-if="tampilPin"></div>
      <div v-else-if="errorMsg" role="alert" class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-wf-no-text">
        <p>{{ errorMsg }}</p>
        <button v-if="idPengerjaan" type="button" class="mt-3 font-semibold underline" @click="errorMsg = ''; kirimJawaban(true)">Coba kirim jawaban lagi</button>
      </div>
      <section v-else-if="submitted" class="rounded-md border border-green-200 bg-green-50 p-8 text-center">
        <h2 class="text-2xl font-bold text-wf-ok">Jawaban berhasil dikirim</h2>
        <p class="mt-2 text-wf-secondary">Hasil pengerjaan akan diproses oleh sistem.</p>
        <button type="button" class="tombol-kembali mt-6" @click="router.back()">
          KEMBALI KE LATIHAN
        </button>
      </section>
      <section v-else-if="soal.length" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_305px]">
        <article class="rounded-md border border-wf-border-subtle bg-wf-card p-6 sm:p-7">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <p class="font-mono text-[14px] uppercase tracking-[0.12em] text-wf-secondary">Soal {{ nomorAktif + 1 }} dari {{ soal.length }}</p>
            <div class="flex gap-2">
              <span class="rounded-md border border-wf-brand-border px-2 py-1 text-sm text-wf-secondary">{{ soalAktif.difficulty || 'Sedang' }}</span>
              <span class="rounded-md border border-wf-brand-border px-2 py-1 text-sm text-wf-secondary">Tingkat: {{ soalAktif.difficulty || 'Mudah' }}</span>
            </div>
          </div>
          <h2 class="mt-6 text-[18px] font-bold leading-6"><span class="whitespace-pre-line">{{ soalAktif.pertanyaan }}</span></h2>
          <p class="mt-5 font-mono text-[15px] text-wf-secondary">Pilih salah satu:</p>
          <div class="mt-5 flex flex-col gap-3">
            <label
              v-for="(opsi, indexOpsi) in soalAktif.opsi"
              :key="opsi.idOpsi || opsi.opsi"
              class="flex cursor-pointer items-center gap-4 rounded-md border px-4 py-4 text-[19px] transition"
              :class="jawaban[nomorAktif] === indexOpsi ? 'border-2 border-wf-brand bg-wf-brand-soft' : 'border-wf-border hover:border-wf-brand-border'"
            >
              <input v-model="jawaban[nomorAktif]" type="radio" :value="indexOpsi" :disabled="submitting" class="size-5 accent-wf-brand" @change="pilihJawaban(indexOpsi)" />
              <span class="font-semibold">{{ String.fromCharCode(65 + indexOpsi) }}</span>
              <span class="whitespace-pre-line">{{ formatOpsi(opsi.opsi) }}</span>
            </label>
          </div>
          <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-wf-border-subtle pt-5">
            <button type="button" :disabled="nomorAktif === 0 || submitting" class="tombol-kembali disabled:cursor-not-allowed disabled:opacity-40" @click="nomorAktif--">
              SEBELUMNYA
            </button>
            <button type="button" :disabled="submitting" class="rounded-xl border border-wf-brand-border px-5 py-3 text-[17px] font-semibold text-wf-brand hover:bg-wf-brand-soft disabled:opacity-40" @click="toggleRagu">
              {{ ragu.has(nomorAktif) ? 'HAPUS TANDA RAGU' : 'TANDAI RAGU' }}
            </button>
            <button type="button" :disabled="nomorAktif === soal.length - 1 || submitting" class="rounded-xl border border-wf-brand-border px-5 py-3 text-[17px] font-semibold text-wf-brand disabled:opacity-40" @click="nomorAktif++">SELANJUTNYA</button>
          </div>
        </article>

        <aside class="flex flex-col gap-6">
          <div class="rounded-md border border-wf-border-subtle bg-wf-card p-5">
            <h2 class="font-mono text-[15px] uppercase tracking-[0.12em] text-wf-secondary">Navigasi soal</h2>
            <div class="mt-5 grid grid-cols-4 gap-3">
              <button
                v-for="(_, index) in soal"
                :key="index"
                type="button"
                class="h-11 rounded-md border text-[19px] font-semibold"
                :class="{
                  'border-2 border-wf-brand text-wf-text': statusNomor(index) === 'aktif',
                  'border-wf-brand-border bg-wf-brand-soft': statusNomor(index) === 'terjawab',
                  'border-dashed border-red-400': statusNomor(index) === 'ragu',
                  'border-wf-border-subtle text-wf-secondary': statusNomor(index) === 'kosong',
                }"
                @click="nomorAktif = index"
              >
                {{ index + 1 }}
              </button>
            </div>
            <p class="mt-5 font-mono text-[13px] text-wf-secondary">{{ terjawab }} terjawab · {{ jumlahRagu }} ragu · {{ belumDijawab }} belum</p>
          </div>
          <div class="rounded-md border border-wf-border-subtle bg-wf-card p-5">
            <h2 class="font-mono text-[15px] uppercase tracking-[0.12em] text-wf-secondary">Keterangan</h2>
            <div class="mt-5 space-y-3 text-sm text-wf-secondary">
              <p><span class="legend border-2 border-wf-brand"></span> Soal aktif</p>
              <p><span class="legend border-wf-brand-border bg-wf-brand-soft"></span> Sudah dijawab</p>
              <p><span class="legend border-wf-border-subtle"></span> Belum dijawab</p>
            </div>
          </div>
          <button type="button" :disabled="submitting" class="rounded-xl bg-wf-accent px-5 py-4 text-[19px] font-bold text-white hover:bg-wf-accent-hover disabled:opacity-60" @click="kirimJawaban()">
            {{ submitting ? 'MENGIRIM...' : 'KIRIM JAWABAN' }}
          </button>
        </aside>
      </section>
      <p v-else class="rounded-md border border-wf-border-subtle bg-wf-card p-8 text-center text-wf-secondary">Soal untuk kuis ini belum tersedia.</p>
    </main>

    <!-- ════════ POP-UP PIN ════════ -->
    <div v-if="tampilPin" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-pin"
        class="w-full max-w-[440px] bg-wf-card border border-wf-border-subtle rounded-xl p-6 flex flex-col gap-5 shadow-lg"
        @submit.prevent="verifikasiPin"
      >
        <div class="flex flex-col gap-1">
          <p class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">MULAI KUIS</p>
          <h2 id="judul-pin" class="text-[22px] leading-[30px] font-semibold">Masukkan PIN</h2>
          <p class="text-[15px] leading-6 text-wf-secondary">Masukkan PIN yang diberikan dosen untuk mulai mengerjakan.</p>
        </div>

        <label class="flex flex-col gap-2">
          <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-muted">PIN KUIS</span>
          <input
            v-model="pinInput"
            type="text"
            maxlength="8"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            autofocus
            :disabled="memeriksaPin"
            placeholder="8 karakter"
            class="bg-wf-card border border-wf-border rounded-md p-4 text-center font-mono text-[22px] leading-7 tracking-[3px] placeholder:text-wf-muted placeholder:tracking-normal placeholder:text-[17px] focus:outline-none focus:ring-2 focus:ring-wf-brand"
            :class="errorPin ? 'border-wf-no' : ''"
          />
        </label>

        <p v-if="errorPin" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
          {{ errorPin }}
        </p>

        <div class="flex justify-end gap-3">
          <button type="button" :disabled="memeriksaPin" class="rounded-xl border border-wf-brand-border px-5 py-3 text-[17px] font-semibold text-wf-brand hover:bg-wf-brand-soft disabled:opacity-50" @click="batalPin">
            BATAL
          </button>
          <button type="submit" :disabled="memeriksaPin" class="rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-5 py-3 text-[17px] font-semibold tracking-[0.2px] text-white disabled:opacity-60">
            {{ memeriksaPin ? 'MEMERIKSA...' : 'MULAI' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.legend {
  display: inline-block;
  width: 1.35rem;
  height: 1.35rem;
  margin-right: .5rem;
  vertical-align: middle;
  border-radius: .35rem;
}
</style>