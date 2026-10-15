<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import { SessionExpiredError, takeNotice, getUser } from '../services/auth'
import { ambilDaftarBab, hapusBab } from '../services/bab'
import { ambilDaftarKuis } from '../services/kuis'

// Figma "HA1 Admin — kelola materi" (Kelola Bab). Tambah dan edit bab ada di
// halaman sendiri (BabFormView), sesuai frame "Tambah bab - Dokumen".
const router = useRouter()

const daftarBab = ref([])
const jumlahKuisPerBab = ref(new Map())
// Nama dosen pembuat kuis per bab, dan nama dosen per idUser dari daftar kuis.
// GET /bab hanya mengirim id pembuat bab (dibuatOleh), jadi namanya dicari di sini.
const pembuatKuisPerBab = ref(new Map())
const namaDosen = ref(new Map())
const idSaya = getUser()?.id_user
const loading = ref(true)
const search = ref('')
const filterStatus = ref('semua')
const errorMsg = ref('')
const infoMsg = ref('')

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Tabel Bab belum punya kolom status. Chip Terbit/Draf baru muncul kalau
// backend sudah mengirimnya, sama seperti di halaman Kelola Kuis.
const adaStatus = computed(() => daftarBab.value.some((bab) => bab.status))

const totalKuis = computed(() => [...jumlahKuisPerBab.value.values()].reduce((a, b) => a + b, 0))

const daftarYangTampil = computed(() => {
  const kata = search.value.trim().toLowerCase()
  return daftarBab.value.filter(
    (bab) =>
      (!kata || bab.namaBab.toLowerCase().includes(kata)) &&
      (filterStatus.value === 'semua' || bab.status === filterStatus.value),
  )
})

function jumlahKuis(bab) {
  return jumlahKuisPerBab.value.get(bab.idBab) ?? 0
}

// Pembuat bab ditulis "Anda" kalau milik sendiri. Nama dosen lain diambil dari
// backend kalau sudah dikirim, atau dari kuis yang pernah dia buat.
function pembuatBab(bab) {
  if (bab.dibuatOleh && bab.dibuatOleh === idSaya) return 'Anda'
  return bab.namaPembuat ?? namaDosen.value.get(bab.dibuatOleh) ?? null
}

function daftarPembuat(bab) {
  const nama = new Set()
  const babOleh = pembuatBab(bab)
  if (babOleh) nama.add(babOleh)
  for (const n of pembuatKuisPerBab.value.get(bab.idBab) ?? []) nama.add(n)
  return [...nama]
}

function keteranganBab(bab) {
  const tanggal = bab.tanggalDiupdate
    ? `Diperbarui ${formatTanggal(bab.tanggalDiupdate)}`
    : `Dibuat ${formatTanggal(bab.tanggalDibuat)}`
  const bagian = [`Bab ${bab.urutanBab}`, tanggal, `dipakai ${jumlahKuis(bab)} kuis`]
  const pembuat = daftarPembuat(bab)
  if (pembuat.length) bagian.push(`oleh ${pembuat.join(', ')}`)
  return bagian.join(' · ')
}

function tanganiError(err) {
  // kirimTerautentikasi sudah membersihkan sesi dan menitipkan pesan.
  if (err instanceof SessionExpiredError) {
    router.push('/')
    return
  }
  errorMsg.value = err?.message || 'Terjadi kesalahan.'
}

// Halaman ini dipakai untuk menguji backend, jadi kegagalan ditampilkan apa
// adanya, tanpa data contoh pengganti.
async function muatBab() {
  loading.value = true
  errorMsg.value = ''
  try {
    // GET /bab tidak menyertakan jumlah kuis, jadi dihitung dari daftar kuis.
    const [bab, kuis] = await Promise.all([ambilDaftarBab(), ambilDaftarKuis()])
    const jumlah = new Map()
    const pembuat = new Map()
    const nama = new Map()
    for (const k of kuis) {
      jumlah.set(k.idBab, (jumlah.get(k.idBab) ?? 0) + 1)
      if (k.idUser && k.namaPembuat) nama.set(k.idUser, k.namaPembuat)
      const oleh = k.idUser && k.idUser === idSaya ? 'Anda' : k.namaPembuat
      if (!oleh) continue
      if (!pembuat.has(k.idBab)) pembuat.set(k.idBab, new Set())
      pembuat.get(k.idBab).add(oleh)
    }
    jumlahKuisPerBab.value = jumlah
    pembuatKuisPerBab.value = pembuat
    namaDosen.value = nama
    daftarBab.value = bab
  } catch (err) {
    tanganiError(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Pesan sukses titipan halaman Tambah/Edit Bab.
  infoMsg.value = takeNotice() || ''
  muatBab()
})

async function handleHapus(bab) {
  const dipakai = jumlahKuis(bab)
  const peringatan = dipakai ? `\n\nBab ini masih dipakai ${dipakai} kuis, jadi server kemungkinan akan menolaknya.` : ''
  if (!window.confirm(`Hapus bab "${bab.namaBab}"?${peringatan}`)) return

  errorMsg.value = ''
  infoMsg.value = ''
  try {
    infoMsg.value = await hapusBab(bab.idBab)
    daftarBab.value = daftarBab.value.filter((b) => b.idBab !== bab.idBab)
  } catch (err) {
    tanganiError(err)
  }
}
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <AdminHeader />

    <main class="px-4 sm:px-10 lg:px-20 py-10 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h1 class="text-[28px] leading-9 font-semibold">Kelola Bab</h1>
        <p class="text-[17px] lg:text-[19px] leading-[26px] text-wf-secondary">
          Tambah, ubah, dan hapus bab. Klik kartu bab untuk mengelola kuis dan soal di dalamnya.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-4 lg:gap-6">
        <input
          v-model="search"
          type="search"
          placeholder="Cari judul Bab"
          aria-label="Cari judul bab"
          class="flex-1 min-w-[240px] bg-wf-card border border-wf-border rounded-md p-4 text-[17px] lg:text-[19px] leading-[26px] placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
        />

        <div v-if="adaStatus" class="flex items-center gap-3" role="group" aria-label="Filter status">
          <button
            v-for="opsi in [
              { nilai: 'semua', label: 'Semua Bab' },
              { nilai: 'terbit', label: 'Terbit' },
              { nilai: 'draf', label: 'Draf' },
            ]"
            :key="opsi.nilai"
            type="button"
            @click="filterStatus = opsi.nilai"
            :aria-pressed="filterStatus === opsi.nilai"
            class="px-2 py-1 rounded-md border text-[17px] font-semibold tracking-[0.5px]"
            :class="
              filterStatus === opsi.nilai
                ? 'bg-wf-ok border-wf-brand-border text-white'
                : 'bg-wf-brand-soft border-wf-brand-border text-wf-text'
            "
          >
            {{ opsi.label }}
          </button>
        </div>

        <RouterLink
          to="/bab/tambah"
          class="ml-auto rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-white transition"
        >
          + TAMBAH BAB
        </RouterLink>
      </div>

      <p v-if="infoMsg" role="status" class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-[15px] text-green-800">
        {{ infoMsg }}
      </p>
      <p v-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
        {{ errorMsg }}
      </p>

      <p v-if="loading" class="text-wf-muted">Memuat daftar bab...</p>

      <div
        v-else-if="!errorMsg && daftarBab.length === 0"
        class="bg-wf-card border border-dashed border-wf-border rounded-md px-6 py-10 text-center text-wf-secondary"
      >
        <p class="text-[19px] font-semibold text-wf-text">Belum ada bab</p>
        <p class="mt-1 text-[15px]">Klik <b>+ TAMBAH BAB</b> untuk membuat bab pertama.</p>
      </div>

      <p v-else-if="!errorMsg && daftarYangTampil.length === 0" class="text-wf-muted">
        Tidak ada bab yang cocok dengan pencarian.
      </p>

      <section v-else-if="daftarYangTampil.length" class="flex flex-col gap-4">
        <div class="flex items-center justify-between font-mono">
          <h2 class="text-[17px] leading-6 tracking-[0.6px] text-wf-secondary">BAB</h2>
          <p class="text-[15px] leading-5 tracking-[1px] text-wf-muted">
            {{ daftarBab.length }} bab · {{ totalKuis }} kuis
          </p>
        </div>

        <article
          v-for="bab in daftarYangTampil"
          :key="bab.idBab"
          class="group relative bg-wf-card border border-wf-border-subtle rounded-md px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-3 transition hover:border-wf-brand-border hover:shadow-sm"
        >
          <div class="flex-1 min-w-[240px] flex flex-col gap-2">
            <h3 class="text-[19px] leading-[26px] font-semibold">
              <!-- after:inset-0 merentangkan tautan ini ke seluruh kartu, jadi kartu di mana pun bisa diklik -->
              <RouterLink
                :to="`/bab/${bab.idBab}/kuis`"
                class="text-wf-brand group-hover:underline focus:outline-none after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-wf-brand"
              >
                {{ bab.namaBab }}
              </RouterLink>
            </h3>
            <p v-if="bab.deskripsi" class="text-[15px] leading-6 text-wf-secondary">{{ bab.deskripsi }}</p>
            <p class="font-mono text-[14px] leading-5 font-bold tracking-[1px] text-wf-secondary">
              {{ keteranganBab(bab) }}
            </p>
          </div>

          <!-- relative z-10: tombol tetap di atas tautan kartu -->
          <div class="relative z-10 flex flex-wrap items-center gap-3">
            <span
              v-if="bab.status"
              class="px-2 py-1 rounded-md border text-[17px] font-semibold tracking-[0.5px]"
              :class="bab.status === 'terbit' ? 'bg-wf-accent-light border-wf-accent-hover' : 'bg-wf-brand-soft border-wf-brand-border'"
            >
              {{ bab.status === 'terbit' ? 'Terbit' : 'Draf' }}
            </span>
            <RouterLink :to="`/bab/${bab.idBab}/edit`" class="tombol-aksi">Edit</RouterLink>
            <button type="button" @click="handleHapus(bab)" class="tombol-aksi-bahaya">Hapus</button>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>
