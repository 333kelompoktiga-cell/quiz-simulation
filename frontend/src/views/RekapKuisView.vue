<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import TombolKembali from '../components/TombolKembali.vue'
import KotakRingkasan from '../components/KotakRingkasan.vue'
import PillKategori from '../components/PillKategori.vue'
import RekapBelumTersedia from '../components/RekapBelumTersedia.vue'
import { SessionExpiredError } from '../services/auth'
import { EndpointBelumAdaError } from '../services/kuis'
import {
  KATEGORI_FUZZY,
  ambilRekapKuis,
  formatDurasi,
  formatSkor,
  labelKategori,
  unduhExcelRekap,
  warnaKategori,
} from '../services/rekap'

// Figma "HA7 Admin - rekap per kuis". Skor yang dipakai hanya skor fuzzy,
// dari percobaan terakhir tiap mahasiswa.
const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const BATAS_AWAL = 10

const rekap = ref(null)
const memuat = ref(true)
const belumTersedia = ref(false)
const errorMsg = ref('')
const cari = ref('')
const filterKategori = ref('semua')
const urut = ref({ kolom: 'skor', arah: 'turun' })
const tampilSemua = ref(false)
const mengunduh = ref(false)
const errorUnduh = ref('')

const kuis = computed(() => rekap.value?.kuis ?? {})
const keteranganKuis = computed(() => {
  const k = kuis.value
  const bagian = []
  if (k.namaBab) bagian.push(`Bab ${k.namaBab}`)
  if (k.jumlahSoal != null) bagian.push(`${k.jumlahSoal} soal`)
  if (k.durasi) bagian.push(`durasi ${k.durasi} menit`)
  bagian.push(k.adaPin ? 'password aktif' : 'belum ada password')
  return bagian.join(' · ')
})

const sebaran = computed(() => {
  const isi = rekap.value?.sebaranKategori ?? {}
  const maks = Math.max(1, ...KATEGORI_FUZZY.map((k) => isi[k] ?? 0))
  return KATEGORI_FUZZY.map((k) => ({ kategori: k, jumlah: isi[k] ?? 0, persen: Math.round(((isi[k] ?? 0) / maks) * 100) }))
})

// Semua mahasiswa sesuai urutan yang dipilih. Dipakai tabel (setelah difilter)
// dan file unduhan (tanpa filter, supaya nilai satu kelas lengkap).
const mahasiswaUrut = computed(() => {
  const { kolom, arah } = urut.value
  const tanda = arah === 'naik' ? 1 : -1
  return [...(rekap.value?.mahasiswa ?? [])].sort((a, b) =>
    kolom === 'nama'
      ? tanda * (a.nama ?? '').localeCompare(b.nama ?? '', 'id')
      : tanda * ((Number(a.skorFuzzy) || 0) - (Number(b.skorFuzzy) || 0)),
  )
})

const mahasiswa = computed(() => {
  const kata = cari.value.trim().toLowerCase()
  return mahasiswaUrut.value.filter(
    (m) =>
      (filterKategori.value === 'semua' || m.kategoriFuzzy === filterKategori.value) &&
      (!kata || m.nama?.toLowerCase().includes(kata) || String(m.nim ?? '').includes(kata)),
  )
})
const mahasiswaTampil = computed(() => (tampilSemua.value ? mahasiswa.value : mahasiswa.value.slice(0, BATAS_AWAL)))

// Daftar dipendekkan lagi setiap kali filter berubah.
watch([cari, filterKategori], () => (tampilSemua.value = false))

// Unduhan berisi semua mahasiswa sesuai urutan tabel, tanpa terpengaruh filter.
async function unduhExcel() {
  if (mengunduh.value) return
  errorUnduh.value = ''
  mengunduh.value = true
  try {
    await unduhExcelRekap(kuis.value.judul, mahasiswaUrut.value)
  } catch (err) {
    errorUnduh.value = `File Excel gagal dibuat. ${err?.message ?? ''}`.trim()
  } finally {
    mengunduh.value = false
  }
}

// Klik kategori di kartu evaluasi = filter tabel ke kategori itu (klik lagi untuk batal),
// lalu gulir ke daftar mahasiswa supaya hasilnya langsung terlihat.
const daftarRef = ref(null)
async function pilihKategori(kategori) {
  filterKategori.value = filterKategori.value === kategori ? 'semua' : kategori
  await nextTick()
  daftarRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Seluruh baris mahasiswa bisa diklik. Klik pada tautan di dalamnya dibiarkan
// berjalan sendiri supaya tidak berpindah dua kali.
function bukaBaris(event, tujuan) {
  if (event.target.closest('a, button')) return
  router.push(tujuan)
}

function ubahUrutan(kolom) {
  if (urut.value.kolom === kolom) {
    urut.value = { kolom, arah: urut.value.arah === 'naik' ? 'turun' : 'naik' }
  } else {
    urut.value = { kolom, arah: kolom === 'nama' ? 'naik' : 'turun' }
  }
}

function panahUrut(kolom) {
  if (urut.value.kolom !== kolom) return ''
  return urut.value.arah === 'naik' ? '↑' : '↓'
}

function ariaUrut(kolom) {
  if (urut.value.kolom !== kolom) return 'none'
  return urut.value.arah === 'naik' ? 'ascending' : 'descending'
}

onMounted(async () => {
  try {
    rekap.value = await ambilRekapKuis(props.id)
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
        <TombolKembali to="/rekap" class="mb-2" />
        <p class="font-mono text-[18px] leading-7 tracking-[1px] text-wf-text">
          <RouterLink to="/rekap" class="hover:underline">Rekap</RouterLink>
          <template v-if="kuis.judul"> / <span class="uppercase">{{ kuis.judul }}</span></template>
        </p>
      </div>

      <p v-if="memuat" class="text-wf-muted">Memuat rekap kuis...</p>
      <RekapBelumTersedia v-else-if="belumTersedia" />
      <p v-else-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
        {{ errorMsg }} <RouterLink to="/rekap" class="underline font-semibold">Kembali ke Report Mahasiswa</RouterLink>
      </p>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-col gap-2">
            <h1 class="text-[28px] leading-9 font-semibold">{{ kuis.judul }}</h1>
            <p class="text-[17px] lg:text-[19px] leading-[26px] text-wf-secondary">{{ keteranganKuis }}</p>
          </div>
          <button
            v-if="rekap.mahasiswa?.length"
            type="button"
            @click="unduhExcel"
            :aria-busy="mengunduh"
            class="rounded-xl border border-wf-brand-border bg-wf-card hover:bg-wf-brand-soft px-6 py-4 text-[18px] lg:text-[20px] leading-7 font-semibold tracking-[0.2px] text-wf-brand transition"
          >
            {{ mengunduh ? 'MENYIAPKAN...' : 'UNDUH EXCEL' }}
          </button>
        </div>
        <p v-if="errorUnduh" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
          {{ errorUnduh }}
        </p>

        <div class="grid gap-4 sm:grid-cols-3">
          <KotakRingkasan :angka="rekap.ringkasan?.jumlahPeserta ?? 0" label="Peserta" />
          <KotakRingkasan :angka="formatSkor(rekap.ringkasan?.rataRataSkorFuzzy)" label="Rata-rata skor fuzzy" />
          <KotakRingkasan :angka="rekap.ringkasan?.jumlahSangatRendah ?? 0" label="Perlu perhatian" />
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <section class="bg-wf-card border border-wf-border-subtle rounded-md p-6 flex flex-col gap-2">
            <h2 class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-secondary">EVALUASI KATEGORI FUZZY PER QUIZ</h2>
            <p class="text-[14px] leading-5 text-wf-muted mb-1">Klik kategori untuk menyaring daftar mahasiswa.</p>
            <button
              v-for="baris in sebaran"
              :key="baris.kategori"
              type="button"
              @click="pilihKategori(baris.kategori)"
              :aria-pressed="filterKategori === baris.kategori"
              class="-mx-2 px-2 py-1.5 rounded-md flex items-center gap-3 text-left transition hover:bg-wf-brand-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-wf-brand"
              :class="filterKategori === baris.kategori ? 'bg-wf-brand-soft ring-1 ring-wf-brand-border' : ''"
            >
              <span class="w-[130px] shrink-0 text-[17px]">{{ labelKategori(baris.kategori) }}</span>
              <span class="flex-1 h-2.5 rounded-full bg-wf-muted-surface overflow-hidden" aria-hidden="true">
                <span class="block h-full rounded-full" :class="warnaKategori(baris.kategori).bar" :style="{ width: `${baris.persen}%` }"></span>
              </span>
              <span class="w-[60px] shrink-0 text-right text-[15px] font-semibold text-wf-secondary">{{ baris.jumlah }} mhs</span>
            </button>
          </section>

          <section class="bg-wf-card border border-wf-border-subtle rounded-md p-6 flex flex-col gap-2">
            <h2 class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-secondary mb-2">SOAL PALING BANYAK SALAH</h2>
            <p v-if="!rekap.soalPalingBanyakSalah?.length" class="text-[15px] text-wf-muted">Belum ada data jawaban.</p>
            <div
              v-for="s in rekap.soalPalingBanyakSalah?.slice(0, 3)"
              :key="s.idSoal ?? s.nomor"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b border-wf-border-subtle last:border-b-0"
            >
              <span class="w-[56px] shrink-0 text-[17px] font-semibold">No. {{ s.nomor }}</span>
              <span class="flex-1 min-w-[160px] text-[17px] leading-6">{{ s.pertanyaan }}</span>
              <span class="text-[15px] text-wf-secondary">{{ Math.round(s.persenBenar) }}% benar · rata {{ formatDurasi(s.rataRataWaktu) }}</span>
            </div>
          </section>
        </div>

        <section ref="daftarRef" class="scroll-mt-6 bg-wf-card border border-wf-border-subtle rounded-md p-6 flex flex-col gap-4">
          <h2 class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-secondary">DAFTAR MAHASISWA · {{ rekap.mahasiswa?.length ?? 0 }}</h2>

          <p v-if="!rekap.mahasiswa?.length" class="py-6 text-center text-wf-secondary">
            Belum ada mahasiswa yang menyelesaikan kuis ini.
          </p>

          <template v-else>
            <div class="flex flex-wrap items-center gap-3">
              <input
                v-model="cari"
                type="search"
                placeholder="Cari nama atau NIM"
                aria-label="Cari nama atau NIM"
                class="flex-1 min-w-[220px] bg-wf-card border border-wf-border rounded-md px-4 py-2.5 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
              />
              <div class="flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
                <button
                  v-for="k in ['semua', ...KATEGORI_FUZZY]"
                  :key="k"
                  type="button"
                  @click="filterKategori = k"
                  :aria-pressed="filterKategori === k"
                  class="rounded-md border px-2.5 py-1.5 text-[15px] font-semibold"
                  :class="filterKategori === k ? 'bg-wf-brand-soft border-wf-brand-border text-wf-brand' : 'bg-wf-card border-wf-border text-wf-secondary hover:text-wf-text'"
                >
                  {{ k === 'semua' ? 'Semua' : labelKategori(k) }}
                </button>
              </div>
            </div>

            <p v-if="mahasiswa.length === 0" class="py-4 text-center text-wf-muted">Tidak ada mahasiswa yang cocok dengan filter.</p>

            <div v-else class="relative overflow-x-auto">
              <table class="w-full min-w-[820px] text-left">
                <thead>
                  <tr class="border-b border-wf-border-subtle text-[13px] leading-5 tracking-[1px] text-wf-secondary">
                    <th class="py-2.5 pr-4 font-semibold" :aria-sort="ariaUrut('nama')">
                      <button type="button" @click="ubahUrutan('nama')" class="font-semibold tracking-[1px] hover:text-wf-text">
                        NAMA {{ panahUrut('nama') }}
                      </button>
                    </th>
                    <th class="py-2.5 pr-4 font-semibold">NIM</th>
                    <th class="py-2.5 pr-4 font-semibold" :aria-sort="ariaUrut('skor')">
                      <button type="button" @click="ubahUrutan('skor')" class="font-semibold tracking-[1px] hover:text-wf-text">
                        SKOR FUZZY {{ panahUrut('skor') }}
                      </button>
                    </th>
                    <th class="py-2.5 pr-4 font-semibold">KATEGORI</th>
                    <th class="py-2.5 pr-4 font-semibold">BENAR</th>
                    <th class="py-2.5 pr-4 font-semibold">PERCOBAAN</th>
                    <th class="py-2.5"><span class="sr-only">Detail</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="m in mahasiswaTampil"
                    :key="m.idUser"
                    class="border-b border-wf-border-subtle last:border-b-0 cursor-pointer transition hover:bg-wf-brand-soft/60"
                    @click="bukaBaris($event, `/rekap/pengerjaan/${m.idPengerjaan}`)"
                  >
                    <td class="py-3.5 pr-4">
                      <RouterLink :to="`/rekap/pengerjaan/${m.idPengerjaan}`" class="text-[17px] font-semibold text-wf-brand hover:underline">
                        {{ m.nama }}
                      </RouterLink>
                    </td>
                    <td class="py-3.5 pr-4 text-[17px]">{{ m.nim }}</td>
                    <td class="py-3.5 pr-4 text-[17px] font-semibold">{{ formatSkor(m.skorFuzzy) }}</td>
                    <td class="py-3.5 pr-4"><PillKategori :kategori="m.kategoriFuzzy" /></td>
                    <td class="py-3.5 pr-4 text-[17px]">{{ m.totalBenar }}/{{ m.totalSoal }}</td>
                    <td class="py-3.5 pr-4 text-[17px] text-wf-secondary">{{ m.jumlahPercobaan }}x</td>
                    <td class="py-3.5 text-right">
                      <RouterLink :to="`/rekap/pengerjaan/${m.idPengerjaan}`" class="text-[15px] font-semibold text-wf-brand hover:underline">
                        Detail
                      </RouterLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button
              v-if="!tampilSemua && mahasiswa.length > BATAS_AWAL"
              type="button"
              @click="tampilSemua = true"
              class="self-end text-[15px] font-semibold italic text-wf-brand hover:underline"
            >
              Lihat selengkapnya ({{ mahasiswa.length - BATAS_AWAL }} lagi) &gt;
            </button>

            <p class="text-[15px] leading-6 font-semibold text-wf-secondary">
              Skor yang dipakai adalah skor fuzzy (0–100), dihitung dari ketepatan jawaban, waktu menjawab, dan tingkat kesulitan soal.
              Skor ini dipakai untuk penilaian sekaligus melihat siapa yang perlu dibantu. Klik nama untuk melihat detail.
            </p>
          </template>
        </section>
      </template>
    </main>
  </div>
</template>
