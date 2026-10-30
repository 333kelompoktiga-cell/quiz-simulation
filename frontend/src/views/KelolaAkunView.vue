<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import { SessionExpiredError } from '../services/auth'
import { ROLE } from '../services/roles'
import { ambilDaftarAkun, buatAkun, hapusAkun, syaratPassword } from '../services/akun'

const router = useRouter()

// Hanya dua role ini yang dikelola lewat /api/account (VALID_ROLES di backend).
const ROLE_DIKELOLA = [ROLE.ADMIN, ROLE.MAHASISWA]

const daftarAkun = ref([])
const memuat = ref(true)
const errorMsg = ref('')
const infoMsg = ref('')
const cari = ref('')
const filterRole = ref('semua')
const AKUN_PER_HALAMAN = 10
const halamanAktif = ref(1)

const akunTersaring = computed(() => {
  const kata = cari.value.trim().toLowerCase()
  return daftarAkun.value.filter(
    (a) =>
      (filterRole.value === 'semua' || a.role === filterRole.value) &&
      (!kata || a.nama.toLowerCase().includes(kata) || a.email.toLowerCase().includes(kata)),
  )
})

const totalHalaman = computed(() => Math.max(1, Math.ceil(akunTersaring.value.length / AKUN_PER_HALAMAN)))

const akunHalamanIni = computed(() => {
  const mulai = (halamanAktif.value - 1) * AKUN_PER_HALAMAN
  return akunTersaring.value.slice(mulai, mulai + AKUN_PER_HALAMAN)
})

const indeksAwalAkun = computed(() =>
  akunTersaring.value.length === 0 ? 0 : (halamanAktif.value - 1) * AKUN_PER_HALAMAN + 1,
)

const indeksAkhirAkun = computed(() =>
  Math.min(halamanAktif.value * AKUN_PER_HALAMAN, akunTersaring.value.length),
)

watch([cari, filterRole], () => {
  halamanAktif.value = 1
})

watch(totalHalaman, (maks) => {
  if (halamanAktif.value > maks) halamanAktif.value = maks
})

function jumlahRole(role) {
  return daftarAkun.value.filter((a) => a.role === role).length
}

function urutkan(list) {
  return [...list].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

function tanganiError(err) {
  if (err instanceof SessionExpiredError) {
    router.push('/')
    return
  }
  errorMsg.value = err.message
}

async function muat() {
  memuat.value = true
  errorMsg.value = ''
  try {
    daftarAkun.value = urutkan(await ambilDaftarAkun())
  } catch (err) {
    tanganiError(err)
  } finally {
    memuat.value = false
  }
}

onMounted(muat)

// ── Tambah akun ──

const formulir = ref(null)
const lihatPassword = ref(false)
const menyimpan = ref(false)
const errorForm = ref('')

const syarat = computed(() => syaratPassword(formulir.value?.password ?? ''))

function bukaTambah() {
  errorForm.value = ''
  lihatPassword.value = false
  formulir.value = { nama: '', email: '', role: ROLE.MAHASISWA, password: '' }
}

async function simpanFormulir() {
  const f = formulir.value
  if (!f.nama.trim() || !f.email.trim()) {
    errorForm.value = 'Nama dan email wajib diisi.'
    return
  }
  if (syarat.value.some((s) => !s.ok)) {
    errorForm.value = 'Password belum memenuhi semua syarat.'
    return
  }

  menyimpan.value = true
  errorForm.value = ''
  infoMsg.value = ''
  try {
    const akun = await buatAkun({
      nama: f.nama.trim(),
      email: f.email.trim(),
      role: f.role,
      password: f.password,
    })
    daftarAkun.value = urutkan([...daftarAkun.value, akun])
    infoMsg.value = `Akun "${akun.nama}" (${akun.role}) berhasil dibuat. Pengguna bisa langsung login.`
    formulir.value = null
  } catch (err) {
    if (err instanceof SessionExpiredError) return router.push('/')
    errorForm.value = err.message
  } finally {
    menyimpan.value = false
  }
}

// ── Hapus akun ──

async function handleHapus(akun) {
  if (!window.confirm(`Hapus akun "${akun.nama}" (${akun.email})? Tindakan ini tidak bisa dibatalkan.`)) return

  errorMsg.value = ''
  infoMsg.value = ''
  try {
    infoMsg.value = await hapusAkun(akun.id)
    daftarAkun.value = daftarAkun.value.filter((a) => a.id !== akun.id)
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
        <h1 class="text-[28px] leading-9 font-semibold">Kelola Akun</h1>
        <p class="text-[17px] lg:text-[19px] leading-[26px] text-wf-secondary">
          Tambah dan hapus akun admin (guru) serta mahasiswa. Akun yang sedang login tidak bisa dihapus.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-4 lg:gap-6">
        <input
          v-model="cari"
          type="search"
          placeholder="Cari nama atau email"
          aria-label="Cari nama atau email"
          class="flex-1 min-w-[240px] bg-wf-card border border-wf-border rounded-md p-4 text-[17px] lg:text-[19px] leading-[26px] placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
        />

        <div class="flex items-center gap-3" role="group" aria-label="Filter role">
          <button
            v-for="opsi in [
              { nilai: 'semua', label: 'Semua akun' },
              ...ROLE_DIKELOLA.map((r) => ({ nilai: r, label: r })),
            ]"
            :key="opsi.nilai"
            type="button"
            @click="filterRole = opsi.nilai"
            :aria-pressed="filterRole === opsi.nilai"
            class="px-2 py-1 rounded-md border text-[17px] font-semibold tracking-[0.5px]"
            :class="
              filterRole === opsi.nilai
                ? 'bg-wf-ok border-wf-brand-border text-white'
                : 'bg-wf-brand-soft border-wf-brand-border text-wf-text'
            "
          >
            {{ opsi.label }}
          </button>
        </div>

        <button
          type="button"
          @click="bukaTambah"
          class="ml-auto rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-white transition"
        >
          + TAMBAH AKUN
        </button>
      </div>

      <p v-if="infoMsg" role="status" class="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-[15px] text-green-800">
        {{ infoMsg }}
      </p>
      <p v-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
        {{ errorMsg }}
      </p>

      <p v-if="memuat" class="text-wf-muted">Memuat daftar akun...</p>

      <div
        v-else-if="!errorMsg && daftarAkun.length === 0"
        class="bg-wf-card border border-dashed border-wf-border rounded-md px-6 py-10 text-center text-wf-secondary"
      >
        <p class="text-[19px] font-semibold text-wf-text">Belum ada akun</p>
        <p class="mt-1 text-[15px]">Klik <b>+ TAMBAH AKUN</b> untuk membuat akun admin atau mahasiswa.</p>
      </div>

      <p v-else-if="!errorMsg && akunTersaring.length === 0" class="text-wf-muted">
        Tidak ada akun yang cocok dengan pencarian.
      </p>

      <section v-else-if="akunTersaring.length" class="flex flex-col gap-4">
        <div class="flex items-center justify-between font-mono">
          <h2 class="text-[17px] leading-6 tracking-[0.6px] text-wf-secondary">AKUN</h2>
          <p class="text-[15px] leading-5 tracking-[1px] text-wf-muted">
            {{ jumlahRole(ROLE.ADMIN) }} admin · {{ jumlahRole(ROLE.MAHASISWA) }} mahasiswa
          </p>
        </div>

        <article
          v-for="akun in akunHalamanIni"
          :key="akun.id"
          class="bg-wf-card border border-wf-border-subtle rounded-md px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-3"
        >
          <div class="flex-1 min-w-[240px] flex flex-col gap-2">
            <h3 class="text-[19px] leading-[26px] font-semibold">{{ akun.nama }}</h3>
            <p class="font-mono text-[14px] lg:text-[15px] leading-5 tracking-[1px] text-wf-muted break-all">
              {{ akun.email }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3 text-[17px] leading-6">
            <span
              class="px-2 py-1 rounded-md border font-semibold tracking-[0.5px]"
              :class="akun.role === ROLE.ADMIN ? 'bg-wf-accent-light border-wf-accent-hover' : 'bg-wf-brand-soft border-wf-brand-border'"
            >
              {{ akun.role }}
            </span>
            <button type="button" @click="handleHapus(akun)" class="tombol-aksi-bahaya">Hapus</button>
          </div>
        </article>

        <!-- Navigasi halaman (tampil jika akun lebih dari 10) -->
        <nav
          v-if="akunTersaring.length > AKUN_PER_HALAMAN"
          aria-label="Navigasi halaman akun"
          class="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-wf-border-subtle pt-4"
        >
          <p class="font-mono text-[14px] text-wf-secondary">
            Menampilkan {{ indeksAwalAkun }}–{{ indeksAkhirAkun }} dari {{ akunTersaring.length }} akun · Halaman {{ halamanAktif }} dari {{ totalHalaman }}
          </p>
          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="halamanAktif <= 1"
              @click="halamanAktif--"
              class="rounded-xl border border-wf-brand-border bg-wf-card px-4 py-2.5 text-[16px] font-semibold text-wf-brand hover:bg-wf-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              :disabled="halamanAktif >= totalHalaman"
              @click="halamanAktif++"
              class="rounded-xl border border-wf-brand-border bg-wf-card px-4 py-2.5 text-[16px] font-semibold text-wf-brand hover:bg-wf-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </nav>
      </section>
    </main>

    <!-- Dialog tambah akun -->
    <div
      v-if="formulir"
      class="fixed inset-0 z-20 bg-black/40 overflow-y-auto p-4 flex"
      @click.self="formulir = null"
    >
      <form
        @submit.prevent="simpanFormulir"
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-dialog-akun"
        class="m-auto w-full max-w-lg bg-wf-card rounded-xl p-6 flex flex-col gap-4 shadow-xl"
        novalidate
      >
        <h2 id="judul-dialog-akun" class="text-[22px] leading-[30px] font-semibold">Tambah Akun</h2>

        <label class="flex flex-col gap-2">
          <span class="font-mono text-[15px] tracking-[1px] text-wf-secondary">NAMA</span>
          <input
            v-model="formulir.nama"
            type="text"
            autocomplete="off"
            class="border border-wf-border rounded-md px-4 py-3 text-[17px] focus:outline-none focus:ring-2 focus:ring-wf-brand"
          />
        </label>

        <label class="flex flex-col gap-2">
          <span class="font-mono text-[15px] tracking-[1px] text-wf-secondary">EMAIL</span>
          <input
            v-model="formulir.email"
            type="email"
            autocomplete="off"
            placeholder="nama@student.itk.ac.id"
            class="border border-wf-border rounded-md px-4 py-3 text-[17px] placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
          />
          <span class="text-[13px] text-wf-muted">Username dibuat otomatis dari bagian sebelum @.</span>
        </label>

        <fieldset class="flex flex-col gap-2">
          <legend class="font-mono text-[15px] tracking-[1px] text-wf-secondary mb-2">ROLE</legend>
          <div class="flex gap-3">
            <label
              v-for="role in ROLE_DIKELOLA"
              :key="role"
              class="flex-1 flex items-center gap-2 px-4 py-3 rounded-md cursor-pointer text-[17px]"
              :class="formulir.role === role ? 'bg-wf-brand-soft border-2 border-wf-brand font-semibold' : 'border border-wf-border'"
            >
              <input v-model="formulir.role" type="radio" name="role" :value="role" class="accent-wf-brand" />
              {{ role }}
            </label>
          </div>
        </fieldset>

        <label class="flex flex-col gap-2">
          <span class="font-mono text-[15px] tracking-[1px] text-wf-secondary">PASSWORD AWAL</span>
          <div class="relative">
            <input
              v-model="formulir.password"
              :type="lihatPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="w-full border border-wf-border rounded-md pl-4 pr-20 py-3 text-[17px] focus:outline-none focus:ring-2 focus:ring-wf-brand"
            />
            <button
              type="button"
              @click="lihatPassword = !lihatPassword"
              :aria-label="lihatPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              class="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-wf-brand"
            >
              {{ lihatPassword ? 'SEMBUNYI' : 'LIHAT' }}
            </button>
          </div>
          <ul class="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            <li v-for="s in syarat" :key="s.label" :class="s.ok ? 'text-wf-ok' : 'text-wf-muted'">
              {{ s.ok ? '✓' : '•' }} {{ s.label }}
            </li>
          </ul>
        </label>

        <p v-if="errorForm" role="alert" class="text-[15px] text-wf-no">{{ errorForm }}</p>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            @click="formulir = null"
            class="rounded-xl border border-wf-brand-border px-5 py-3 font-semibold text-wf-brand"
          >
            BATAL
          </button>
          <button
            type="submit"
            :disabled="menyimpan"
            class="rounded-xl bg-wf-accent-hover px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {{ menyimpan ? 'MENYIMPAN...' : 'BUAT AKUN' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
