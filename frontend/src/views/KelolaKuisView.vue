<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import TombolKembali from '../components/TombolKembali.vue'
import { takeNotice, SessionExpiredError } from '../services/auth'
import { ambilBab } from '../services/bab'
import { ambilDaftarKuis, hapusKuis, ubahKuis } from '../services/kuis'

// Figma "HA1 Admin — kelola kuiz": kuis milik SATU bab. Dibuka dari Kelola Bab
// dengan klik nama bab (/bab/:id/kuis).
const props = defineProps({ id: { type: String, required: true } })

const router = useRouter()

const bab = ref(null)
const daftarKuis = ref([])
const memuat = ref(true)
const gagalMuat = ref(false)
const errorMsg = ref('')
const infoMsg = ref('')
const cari = ref('')
const filterStatus = ref('semua')

// Kolom status (terbit/draf) belum ada di tabel Kuis. Chip filternya baru
// muncul kalau backend sudah mengirimkannya.
const adaStatus = computed(() => daftarKuis.value.some((k) => k.status))

const kuisTersaring = computed(() => {
  const kata = cari.value.trim().toLowerCase()
  return daftarKuis.value.filter(
    (k) =>
      (!kata || k.judul.toLowerCase().includes(kata)) &&
      (filterStatus.value === 'semua' || k.status === filterStatus.value),
  )
})

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Bab dipakai bersama, jadi satu bab bisa berisi kuis dari beberapa dosen.
// bisaDikelola dari backend: false = kuis dosen lain, hanya bisa dilihat.
const milikSendiri = (kuis) => kuis.bisaDikelola !== false

function keteranganKuis(kuis) {
  const bagian = [`Dibuat ${formatTanggal(kuis.tanggalDibuat)}`]
  if (kuis.namaPembuat) bagian.push(`oleh ${milikSendiri(kuis) ? 'Anda' : kuis.namaPembuat}`)
  if (kuis.jumlahSoal != null) bagian.push(`${kuis.jumlahSoal} soal`)
  if (kuis.durasi) bagian.push(`${kuis.durasi} menit`)
  if (kuis.deskripsi) bagian.push(kuis.deskripsi)
  return bagian.join(' · ')
}

function tanganiError(err) {
  if (err instanceof SessionExpiredError) {
    router.push('/')
    return
  }
  errorMsg.value = err.message
}

onMounted(async () => {
  window.addEventListener('keydown', saatTekanTombol)
  // Pesan sukses titipan halaman Tambah Kuis / Edit Kuis / Edit Soal.
  infoMsg.value = takeNotice() || ''
  try {
    const [dataBab, kuis] = await Promise.all([ambilBab(props.id), ambilDaftarKuis(props.id)])
    bab.value = dataBab
    daftarKuis.value = kuis
  } catch (err) {
    gagalMuat.value = true
    tanganiError(err)
  } finally {
    memuat.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', saatTekanTombol)
  clearTimeout(timerSalin)
})

async function handleHapus(kuis) {
  if (!window.confirm(`Hapus kuis "${kuis.judul}"? Tindakan ini tidak bisa dibatalkan.`)) return

  errorMsg.value = ''
  infoMsg.value = ''
  try {
    infoMsg.value = await hapusKuis(kuis.idKuis)
    daftarKuis.value = daftarKuis.value.filter((k) => k.idKuis !== kuis.idKuis)
  } catch (err) {
    tanganiError(err)
  }
}

// ── Password kuis ──
// Password dibuat otomatis sekali oleh backend saat kuis dibuat. Menyimpan atau
// mengedit kuis TIDAK mengubahnya; hanya tombol "Generate password baru" di pop-up
// yang membuat password baru.

const idKuisPassword = ref(null)
const membuatPassword = ref(false)
const tersalin = ref(false)
const errorPassword = ref('')
let timerSalin = null

const kuisPassword = computed(() => daftarKuis.value.find((k) => k.idKuis === idKuisPassword.value) ?? null)

function bukaPassword(kuis) {
  errorPassword.value = ''
  tersalin.value = false
  idKuisPassword.value = kuis.idKuis
}

function tutupPassword() {
  idKuisPassword.value = null
}

function saatTekanTombol(e) {
  if (e.key === 'Escape' && idKuisPassword.value !== null) tutupPassword()
}

async function salinPassword() {
  const pin = kuisPassword.value?.pin
  if (!pin) return
  try {
    await navigator.clipboard.writeText(pin)
    tersalin.value = true
    clearTimeout(timerSalin)
    timerSalin = setTimeout(() => (tersalin.value = false), 2000)
  } catch {
    errorPassword.value = 'Gagal menyalin. Salin password secara manual.'
  }
}

async function generatePasswordBaru() {
  const kuis = kuisPassword.value
  if (!kuis) return
  if (kuis.pin && !window.confirm('Password lama tidak akan berlaku lagi. Buat password baru?')) return

  errorPassword.value = ''
  membuatPassword.value = true
  try {
    // Backend membuat password baru saat menerima generatePin: true.
    const hasil = await ubahKuis(kuis.idKuis, { generatePin: true })
    daftarKuis.value = daftarKuis.value.map((k) =>
      k.idKuis === kuis.idKuis ? { ...k, pin: hasil.pin, adaPin: true } : k,
    )
    tersalin.value = false
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      router.push('/')
      return
    }
    errorPassword.value = err.message
  } finally {
    membuatPassword.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <AdminHeader />

    <main class="px-4 sm:px-10 lg:px-20 py-10 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <TombolKembali to="/bab" class="mb-2" />
        <p class="font-mono text-[18px] leading-7 tracking-[1px] text-wf-text uppercase">
          <RouterLink to="/bab" class="hover:underline normal-case">Bab</RouterLink>
          <template v-if="bab"> / {{ bab.namaBab }}</template> / KELOLA KUIS
        </p>
        <h1 class="text-[28px] leading-9 font-semibold">Kelola Kuis</h1>
        <p class="text-[17px] lg:text-[19px] leading-[26px] text-wf-secondary">
          Tambah, ubah, dan hapus kuis beserta soalnya<template v-if="bab"> di bab {{ bab.namaBab }}</template>.
        </p>
      </div>

      <p v-if="memuat" class="text-wf-muted">Memuat daftar kuis...</p>

      <p
        v-else-if="gagalMuat"
        role="alert"
        class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text"
      >
        {{ errorMsg }} <RouterLink to="/bab" class="underline font-semibold">Kembali ke daftar bab</RouterLink>
      </p>

      <template v-else>
        <div class="flex flex-wrap items-center gap-4 lg:gap-6">
          <input
            v-model="cari"
            type="search"
            placeholder="Cari judul kuis"
            aria-label="Cari judul kuis"
            class="flex-1 min-w-[240px] bg-wf-card border border-wf-border rounded-md p-4 text-[17px] lg:text-[19px] leading-[26px] placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
          />

          <div v-if="adaStatus" class="flex items-center gap-3" role="group" aria-label="Filter status">
            <button
              v-for="opsi in [
                { nilai: 'semua', label: 'Semua kuis' },
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
            :to="`/kuis/tambah?idBab=${id}`"
            class="ml-auto rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-white transition"
          >
            + TAMBAH KUIS
          </RouterLink>
        </div>

        <p v-if="infoMsg" role="status" class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-[15px] text-green-800">
          {{ infoMsg }}
        </p>
        <p v-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
          {{ errorMsg }}
        </p>

        <div
          v-if="daftarKuis.length === 0"
          class="bg-wf-card border border-dashed border-wf-border rounded-md px-6 py-10 text-center text-wf-secondary"
        >
          <p class="text-[19px] font-semibold text-wf-text">Belum ada kuis di bab ini</p>
          <p class="mt-1 text-[15px]">Klik <b>+ TAMBAH KUIS</b> untuk membuat kuis pertama.</p>
        </div>

        <p v-else-if="kuisTersaring.length === 0" class="text-wf-muted">
          Tidak ada kuis yang cocok dengan pencarian.
        </p>

        <section v-else class="flex flex-col gap-4">
          <div class="flex items-center justify-between font-mono">
            <h2 class="text-[17px] leading-6 tracking-[0.6px] text-wf-secondary">KUIS</h2>
            <p class="text-[15px] leading-5 tracking-[1px] text-wf-muted">{{ daftarKuis.length }} kuis</p>
          </div>

          <article
            v-for="kuis in kuisTersaring"
            :key="kuis.idKuis"
            class="bg-wf-card border border-wf-border-subtle rounded-md px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            <div class="flex-1 min-w-[240px] flex flex-col gap-2">
              <h3 class="text-[19px] leading-[26px] font-semibold">{{ kuis.judul }}</h3>
              <p class="font-mono text-[14px] lg:text-[15px] leading-5 tracking-[1px] text-wf-muted">
                {{ keteranganKuis(kuis) }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <span
                v-if="kuis.status"
                class="px-2 py-1 rounded-md border text-[17px] font-semibold tracking-[0.5px]"
                :class="kuis.status === 'terbit' ? 'bg-wf-accent-light border-wf-accent-hover' : 'bg-wf-brand-soft border-wf-brand-border'"
              >
                {{ kuis.status === 'terbit' ? 'Terbit' : 'Draf' }}
              </span>
              <template v-if="milikSendiri(kuis)">
                <button
                  type="button"
                  @click="bukaPassword(kuis)"
                  class="tombol-aksi"
                >
                  Password
                </button>
                <RouterLink :to="`/kuis/${kuis.idKuis}/soal`" class="tombol-aksi">Edit Soal</RouterLink>
                <RouterLink :to="`/kuis/${kuis.idKuis}/edit`" class="tombol-aksi">Edit</RouterLink>
                <button type="button" @click="handleHapus(kuis)" class="tombol-aksi-bahaya">Hapus</button>
              </template>
              <RouterLink v-else :to="`/kuis/${kuis.idKuis}/soal`" class="tombol-aksi">Lihat</RouterLink>
            </div>
          </article>
        </section>
      </template>
    </main>

    <!-- ════════ POP-UP PASSWORD ════════ -->
    <div
      v-if="kuisPassword"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="tutupPassword"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-password"
        class="w-full max-w-[460px] bg-wf-card border border-wf-border-subtle rounded-xl p-6 flex flex-col gap-5 shadow-lg"
      >
        <div class="flex flex-col gap-1">
          <p class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">PASSWORD KUIS</p>
          <h2 id="judul-password" class="text-[22px] leading-[30px] font-semibold">{{ kuisPassword.judul }}</h2>
        </div>

        <template v-if="kuisPassword.pin">
          <div class="flex items-center gap-3">
            <p
              class="flex-1 min-w-0 break-all select-all bg-wf-muted-surface border border-wf-border rounded-md px-4 py-4 text-center font-mono text-[26px] leading-8 font-bold tracking-[3px]"
            >
              {{ kuisPassword.pin }}
            </p>
            <button type="button" @click="salinPassword" class="tombol-aksi shrink-0">
              {{ tersalin ? 'Tersalin ✓' : 'Salin' }}
            </button>
          </div>
          <p class="text-[15px] leading-6 text-wf-secondary">
            Bagikan password ini ke mahasiswa untuk memulai kuis. Password tidak berubah saat kuis disimpan atau
            diedit.
          </p>
        </template>
        <p v-else class="text-[15px] leading-6 text-wf-secondary">
          Kuis ini belum punya password, jadi belum bisa dikerjakan mahasiswa. Klik tombol di bawah untuk membuatnya.
        </p>

        <p v-if="errorPassword" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
          {{ errorPassword }}
        </p>

        <div class="flex flex-wrap justify-end gap-3">
          <button type="button" @click="tutupPassword" class="tombol-aksi">Tutup</button>
          <button
            type="button"
            @click="generatePasswordBaru"
            :disabled="membuatPassword"
            class="rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-5 py-3 text-[17px] leading-6 font-semibold tracking-[0.2px] text-white disabled:opacity-60"
          >
            {{ membuatPassword ? 'MEMBUAT...' : kuisPassword.pin ? 'GENERATE PASSWORD BARU' : 'GENERATE PASSWORD' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>