<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import RekapBelumTersedia from '../components/RekapBelumTersedia.vue'
import { SessionExpiredError } from '../services/auth'
import { EndpointBelumAdaError } from '../services/kuis'
import { ambilDaftarRekapKuis, formatSkor, formatTanggal } from '../services/rekap'

// Figma "HA6 Admin - rekap daftar kuis": kuis yang bisa dikelola dosen ini
// beserta jumlah peserta dan rata-rata skor fuzzy (percobaan terakhir).
const router = useRouter()

const daftar = ref([])
const memuat = ref(true)
const belumTersedia = ref(false)
const errorMsg = ref('')
const idBab = ref('')
const cari = ref('')

// Pilihan bab diambil dari kuis yang ada di rekap, jadi tidak perlu memanggil /bab.
const pilihanBab = computed(() => {
  const unik = new Map()
  for (const k of daftar.value) if (k.idBab && !unik.has(k.idBab)) unik.set(k.idBab, k.namaBab || 'Tanpa nama')
  return [...unik].map(([id, nama]) => ({ id, nama }))
})

const tersaring = computed(() => {
  const kata = cari.value.trim().toLowerCase()
  return daftar.value.filter(
    (k) => (!idBab.value || k.idBab === idBab.value) && (!kata || k.judul.toLowerCase().includes(kata)),
  )
})

// Seluruh baris kuis bisa diklik. Klik pada tautan atau tombol di dalamnya
// dibiarkan berjalan sendiri supaya tidak berpindah dua kali.
function bukaBaris(event, tujuan) {
  if (event.target.closest('a, button')) return
  router.push(tujuan)
}

onMounted(async () => {
  try {
    daftar.value = await ambilDaftarRekapKuis()
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
        <h1 class="text-[28px] leading-9 font-semibold">Report Mahasiswa</h1>
        <p class="text-[17px] lg:text-[19px] leading-[26px] text-wf-secondary">
          Pilih kuis untuk melihat skor fuzzy mahasiswa yang sudah mengerjakannya.
        </p>
      </div>

      <p v-if="memuat" class="text-wf-muted">Memuat rekap...</p>
      <RekapBelumTersedia v-else-if="belumTersedia" />
      <p v-else-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
        {{ errorMsg }}
      </p>

      <template v-else>
        <div class="flex flex-wrap items-center gap-4">
          <select
            v-model="idBab"
            aria-label="Filter bab"
            class="bg-wf-card border border-wf-border rounded-md px-4 py-3 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
          >
            <option value="">Semua bab</option>
            <option v-for="b in pilihanBab" :key="b.id" :value="b.id">{{ b.nama }}</option>
          </select>
          <input
            v-model="cari"
            type="search"
            placeholder="Cari judul kuis"
            aria-label="Cari judul kuis"
            class="flex-1 min-w-[220px] bg-wf-card border border-wf-border rounded-md px-4 py-3 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
          />
        </div>

        <section class="bg-wf-card border border-wf-border-subtle rounded-md p-6 flex flex-col gap-4">
          <div class="flex items-center justify-between font-mono">
            <h2 class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-secondary">KUIS SAYA</h2>
            <p class="text-[15px] leading-5 text-wf-muted">{{ tersaring.length }} kuis</p>
          </div>

          <p v-if="daftar.length === 0" class="py-6 text-center text-wf-secondary">
            Belum ada kuis yang bisa direkap. Buat kuis di menu Kuis terlebih dahulu.
          </p>
          <p v-else-if="tersaring.length === 0" class="py-6 text-center text-wf-muted">
            Tidak ada kuis yang cocok dengan filter.
          </p>

          <div v-else class="relative overflow-x-auto">
            <table class="w-full min-w-[720px] text-left">
              <thead>
                <tr class="border-b border-wf-border-subtle text-[13px] leading-5 font-semibold tracking-[1px] text-wf-secondary">
                  <th class="py-2.5 pr-4 font-semibold">KUIS · BAB</th>
                  <th class="py-2.5 pr-4 font-semibold">PESERTA</th>
                  <th class="py-2.5 pr-4 font-semibold">RATA-RATA SKOR FUZZY</th>
                  <th class="py-2.5 pr-4 font-semibold">TERAKHIR</th>
                  <th class="py-2.5"><span class="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="k in tersaring"
                  :key="k.idKuis"
                  class="border-b border-wf-border-subtle last:border-b-0"
                  :class="k.jumlahPeserta ? 'cursor-pointer transition hover:bg-wf-brand-soft/60' : ''"
                  @click="k.jumlahPeserta && bukaBaris($event, `/rekap/kuis/${k.idKuis}`)"
                >
                  <td class="py-3.5 pr-4">
                    <p class="text-[17px] leading-6 font-semibold">{{ k.judul }}</p>
                    <p class="text-[15px] leading-5 text-wf-secondary">{{ k.namaBab || '-' }}</p>
                  </td>
                  <td class="py-3.5 pr-4 text-[17px]" :class="k.jumlahPeserta ? '' : 'text-wf-muted'">{{ k.jumlahPeserta ?? 0 }}</td>
                  <td class="py-3.5 pr-4 text-[17px] font-semibold" :class="k.jumlahPeserta ? '' : 'text-wf-muted'">
                    {{ k.jumlahPeserta ? formatSkor(k.rataRataSkorFuzzy) : '–' }}
                  </td>
                  <td class="py-3.5 pr-4 text-[15px]" :class="k.jumlahPeserta ? 'text-wf-secondary' : 'text-wf-muted'">
                    {{ formatTanggal(k.terakhirDikerjakan) }}
                  </td>
                  <td class="py-3.5 text-right">
                    <RouterLink v-if="k.jumlahPeserta" :to="`/rekap/kuis/${k.idKuis}`" class="tombol-aksi">Lihat rekap</RouterLink>
                    <span v-else class="text-[15px] text-wf-muted">Belum ada peserta</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p class="text-[15px] leading-6 text-wf-secondary">
          Hanya kuis yang Anda buat atau yang dibagikan pengelolaannya ke Anda yang tampil. Skor fuzzy dihitung dari percobaan terakhir tiap mahasiswa.
        </p>
      </template>
    </main>
  </div>
</template>
