<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import TombolKembali from '../components/TombolKembali.vue'
import KotakRingkasan from '../components/KotakRingkasan.vue'
import PillKategori from '../components/PillKategori.vue'
import RekapBelumTersedia from '../components/RekapBelumTersedia.vue'
import { SessionExpiredError } from '../services/auth'
import { EndpointBelumAdaError } from '../services/kuis'
import {
  ambilRekapPengerjaan,
  catatanWaktuSoal,
  formatDurasi,
  formatSkor,
  formatTanggal,
} from '../services/rekap'

// Figma "HA8 Admin - detail pengerjaan": satu percobaan satu mahasiswa.
const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const BATAS_AWAL = 5

const data = ref(null)
const memuat = ref(true)
const belumTersedia = ref(false)
const errorMsg = ref('')
const tampilSemua = ref(false)

const kuis = computed(() => data.value?.kuis ?? {})
const mhs = computed(() => data.value?.mahasiswa ?? {})
const tautanKembali = computed(() => (kuis.value.idKuis ? `/rekap/kuis/${kuis.value.idKuis}` : '/rekap'))
const keterangan = computed(() => {
  const d = data.value
  if (!d) return ''
  const bagian = []
  if (mhs.value.nim) bagian.push(mhs.value.nim)
  if (d.attempt) bagian.push(`percobaan ${d.attempt} dari ${d.jumlahPercobaan ?? d.attempt}`)
  if (d.waktuSelesai) bagian.push(`dikerjakan ${formatTanggal(d.waktuSelesai, true)}`)
  return bagian.join(' · ')
})
const soal = computed(() => data.value?.soal ?? [])
const soalTampil = computed(() => (tampilSemua.value ? soal.value : soal.value.slice(0, BATAS_AWAL)))

function skorSoal(s) {
  const catatan = catatanWaktuSoal(s)
  return catatan ? `${formatSkor(s.skorFuzzy)} · ${catatan}` : formatSkor(s.skorFuzzy)
}

onMounted(async () => {
  try {
    data.value = await ambilRekapPengerjaan(props.id)
  } catch (err) {
    if (err instanceof SessionExpiredError) return router.push('/')
    if (err instanceof EndpointBelumAdaError) belumTersedia.value = true
    else errorMsg.value = err.message
  } finally {
    memuat.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <AdminHeader />

    <main class="px-4 sm:px-10 lg:px-20 py-10 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <TombolKembali :to="tautanKembali" class="mb-2" />
        <p class="font-mono text-[18px] leading-7 tracking-[1px] text-wf-text">
          <RouterLink to="/rekap" class="hover:underline">Rekap</RouterLink>
          <template v-if="kuis.judul">
            / <RouterLink :to="tautanKembali" class="hover:underline uppercase">{{ kuis.judul }}</RouterLink>
          </template>
          <template v-if="mhs.nama"> / <span class="uppercase">{{ mhs.nama }}</span></template>
        </p>
      </div>

      <p v-if="memuat" class="text-wf-muted">Memuat detail pengerjaan...</p>
      <RekapBelumTersedia v-else-if="belumTersedia" />
      <p v-else-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
        {{ errorMsg }} <RouterLink to="/rekap" class="underline font-semibold">Kembali ke Report Mahasiswa</RouterLink>
      </p>

      <template v-else>
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-[28px] leading-9 font-semibold">{{ mhs.nama }}</h1>
            <PillKategori :kategori="data.kategoriFuzzy" awalan="Nilai" />
          </div>
          <p class="text-[17px] lg:text-[19px] leading-[26px] text-wf-secondary">{{ keterangan }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <KotakRingkasan :angka="formatSkor(data.skorFuzzy)" label="Skor fuzzy" />
          <KotakRingkasan :angka="`${data.totalBenar ?? 0}/${data.totalSoal ?? 0}`" label="Benar" />
          <KotakRingkasan :angka="formatDurasi(data.waktuPengerjaan)" label="Durasi pengerjaan" />
        </div>

        <section class="bg-wf-card border border-wf-border-subtle rounded-md p-6 flex flex-col gap-4">
          <h2 class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-secondary">JAWABAN PER SOAL</h2>

          <p v-if="soal.length === 0" class="text-[15px] text-wf-muted">Rincian jawaban belum tersedia.</p>

          <div v-else class="relative overflow-x-auto">
            <table class="w-full min-w-[760px] text-left">
              <thead>
                <tr class="border-b border-wf-border-subtle text-[13px] leading-5 font-semibold tracking-[1px] text-wf-secondary">
                  <th class="py-2.5 pr-4 font-semibold">NO</th>
                  <th class="py-2.5 pr-4 font-semibold">PERTANYAAN</th>
                  <th class="py-2.5 pr-4 font-semibold">JAWABAN</th>
                  <th class="py-2.5 pr-4 font-semibold">WAKTU</th>
                  <th class="py-2.5 pr-4 font-semibold">KESULITAN</th>
                  <th class="py-2.5 font-semibold">SKOR FUZZY SOAL</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in soalTampil" :key="s.idSoal ?? s.nomor" class="border-b border-wf-border-subtle last:border-b-0 text-[17px]">
                  <td class="py-3 pr-4 font-semibold">{{ s.nomor }}</td>
                  <td class="py-3 pr-4 leading-6">{{ s.pertanyaan || '-' }}</td>
                  <td class="py-3 pr-4 font-semibold" :class="s.isCorrect ? 'text-wf-ok-text' : 'text-wf-no-text'">
                    {{ s.isCorrect ? 'Benar' : 'Salah' }}
                  </td>
                  <td class="py-3 pr-4 text-wf-secondary">{{ formatDurasi(s.responseTime) }}</td>
                  <td class="py-3 pr-4 text-wf-secondary">{{ s.difficulty || '-' }}</td>
                  <td class="py-3 font-semibold">{{ skorSoal(s) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            v-if="!tampilSemua && soal.length > BATAS_AWAL"
            type="button"
            @click="tampilSemua = true"
            class="self-start text-[15px] font-semibold italic text-wf-brand hover:underline"
          >
            Lihat selengkapnya ({{ soal.length - BATAS_AWAL }} lagi) &gt;
          </button>
        </section>
      </template>
    </main>
  </div>
</template>
