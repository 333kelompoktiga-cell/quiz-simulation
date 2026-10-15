<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import TombolKembali from '../components/TombolKembali.vue'
import KuisBukanMilik from '../components/KuisBukanMilik.vue'
import { setNotice, SessionExpiredError } from '../services/auth'
import { ambilDaftarBab, ambilKuis, ubahKuis } from '../services/kuis'

// Figma "Edit kuis": ubah info kuis (nama, bab, deskripsi). Durasi dan soal diubah
// lewat halaman Edit Soal (EditorKuisView).
// Nama kuis dan deskripsi = teks biasa, tanpa persamaan matematika.
const props = defineProps({ id: { type: String, required: true } })

const router = useRouter()

const daftarBab = ref([])
const form = ref({ judul: '', idBab: null, deskripsi: '' })
const memuat = ref(true)
const gagalMuat = ref(false)
const menyimpan = ref(false)
const errorMsg = ref('')
// Terisi kalau kuis ini dibuat dosen lain: halaman berganti jadi pemberitahuan.
const kuisLain = ref(null)

const namaBab = computed(() => daftarBab.value.find((b) => b.idBab === form.value.idBab)?.namaBab ?? '')

// Bab asal kuis sebelum diubah: tujuan breadcrumb dan tombol Batal.
const idBabAsal = ref(null)
const namaBabAsal = computed(() => daftarBab.value.find((b) => b.idBab === idBabAsal.value)?.namaBab ?? '')
const tautanKembali = computed(() => (idBabAsal.value ? `/bab/${idBabAsal.value}/kuis` : '/bab'))

function tanganiError(err) {
  if (err instanceof SessionExpiredError) return router.push('/')
  errorMsg.value = err.message
}

onMounted(async () => {
  try {
    const [bab, kuis] = await Promise.all([ambilDaftarBab(), ambilKuis(props.id)])
    daftarBab.value = bab
    form.value = {
      judul: kuis.judul,
      idBab: kuis.idBab,
      deskripsi: kuis.deskripsi ?? '',
    }
    idBabAsal.value = kuis.idBab
    if (kuis.bisaDikelola === false) kuisLain.value = kuis
  } catch (err) {
    gagalMuat.value = true
    tanganiError(err)
  } finally {
    memuat.value = false
  }
})

async function simpan() {
  errorMsg.value = ''
  const f = form.value
  if (!f.judul.trim()) {
    errorMsg.value = 'Nama kuis wajib diisi.'
    return
  }

  menyimpan.value = true
  try {
    // Durasi sengaja tidak dikirim: diubah lewat halaman Edit Soal. updateKuis
    // hanya mengubah field yang dikirim, jadi durasi yang ada tetap utuh.
    const hasil = await ubahKuis(props.id, {
      judul: f.judul.trim(),
      idBab: f.idBab,
      deskripsi: f.deskripsi.trim() || null,
    })
    setNotice(`Kuis "${hasil.judul}" berhasil diperbarui.`)
    // Ke Kelola Kuis bab tujuan; kalau kuis dipindah bab, ikut ke bab baru.
    router.push(`/bab/${f.idBab}/kuis`)
  } catch (err) {
    tanganiError(err)
  } finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <KuisBukanMilik v-if="kuisLain" :kuis="kuisLain" :nama-bab="namaBabAsal" />
  <div v-else class="min-h-screen bg-wf-page text-wf-text">
    <AdminHeader />

    <main class="px-4 sm:px-10 lg:px-20 pt-10 pb-14 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <TombolKembali :to="tautanKembali" class="mb-2" />
        <p class="font-mono text-[18px] leading-7 tracking-[1px] text-wf-text">
          <RouterLink to="/bab" class="hover:underline">Bab</RouterLink>
          <template v-if="namaBabAsal">
            / <RouterLink :to="tautanKembali" class="hover:underline uppercase">{{ namaBabAsal }}</RouterLink>
          </template>
          / EDIT KUIS
        </p>
        <h1 class="text-[28px] leading-9 font-semibold">Edit Kuis</h1>
        <p class="text-[17px] leading-6 text-wf-secondary">
          Ubah nama dan bab kuis. Untuk mengubah durasi dan soal, pakai tombol Edit Soal di daftar kuis.
        </p>
      </div>

      <p v-if="memuat" class="text-wf-muted">Memuat data...</p>

      <p v-else-if="gagalMuat" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
        {{ errorMsg }} <RouterLink to="/bab" class="underline font-semibold">Kembali ke daftar bab</RouterLink>
      </p>

      <form
        v-else
        @submit.prevent="simpan"
        novalidate
        class="bg-wf-card border border-wf-border-subtle rounded-xl p-5 lg:p-7 flex flex-col gap-6"
      >
        <p class="text-[15px] leading-5 font-semibold tracking-[1px] uppercase min-h-5">{{ namaBab }}</p>

        <div class="flex flex-wrap gap-4">
          <label class="flex flex-col gap-2 w-full sm:w-[360px]">
            <span class="font-mono font-bold text-[16px] lg:text-[18px] leading-5 tracking-[1px] text-wf-muted">NAMA KUIS</span>
            <input
              v-model="form.judul"
              type="text"
              placeholder="masukkan nama kuis"
              class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
            />
          </label>
          <label class="flex flex-col gap-2 w-full sm:w-[260px]">
            <span class="font-mono font-bold text-[16px] lg:text-[18px] leading-5 tracking-[1px] text-wf-muted">BAB</span>
            <select
              v-model="form.idBab"
              class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
            >
              <option v-for="bab in daftarBab" :key="bab.idBab" :value="bab.idBab">{{ bab.namaBab }}</option>
            </select>
          </label>
        </div>

        <!-- Tidak ada di Figma, tapi sebelumnya bisa diubah lewat pop-up edit. -->
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">DESKRIPSI (OPSIONAL)</span>
          <textarea
            v-model="form.deskripsi"
            rows="4"
            placeholder="Tulis deskripsi kuis."
            class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
          ></textarea>
        </label>

        <p v-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
          {{ errorMsg }}
        </p>

        <div class="flex flex-wrap gap-4">
          <RouterLink
            :to="tautanKembali"
            class="rounded-xl bg-wf-no border border-wf-no-border px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-white"
          >
            BATAL
          </RouterLink>
          <button
            type="submit"
            :disabled="menyimpan"
            class="rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-white disabled:opacity-60 min-w-[190px]"
          >
            {{ menyimpan ? 'MENYIMPAN...' : 'SIMPAN KUIS' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>