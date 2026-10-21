<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ambilDosenPengelola, ubahAksesKuis } from '../services/kuis'
import { SessionExpiredError } from '../services/auth'
import { useRouter } from 'vue-router'

const props = defineProps({ kuis: { type: Object, required: true } })
const emit = defineEmits(['tutup', 'tersimpan'])
const router = useRouter()
const mode = ref(props.kuis.aksesKelola || 'pribadi')
const pilihan = ref([...(props.kuis.dosenPengelola || [])])
const dosen = ref([])
const memuat = ref(true)
const menyimpan = ref(false)
const errorMsg = ref('')

function tanganiError(err) {
  if (err instanceof SessionExpiredError) router.push('/')
  else errorMsg.value = err.message
}
function tutup() { if (!menyimpan.value) emit('tutup') }
function keyboard(e) { if (e.key === 'Escape') tutup() }
onMounted(async () => {
  window.addEventListener('keydown', keyboard)
  try {
    dosen.value = (await ambilDosenPengelola()).filter((d) => d.idUser !== props.kuis.idUser)
  } catch (err) { tanganiError(err) }
  finally { memuat.value = false }
})
onBeforeUnmount(() => window.removeEventListener('keydown', keyboard))

async function simpan() {
  menyimpan.value = true
  errorMsg.value = ''
  try {
    const hasil = await ubahAksesKuis(props.kuis.idKuis, {
      aksesKelola: mode.value,
      dosenPengelola: mode.value === 'tertentu' ? pilihan.value : [],
    })
    emit('tersimpan', hasil)
  } catch (err) { tanganiError(err) }
  finally { menyimpan.value = false }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="tutup">
    <form role="dialog" aria-modal="true" aria-labelledby="judul-hak-akses"
      class="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-wf-card p-6 shadow-lg flex flex-col gap-5"
      @submit.prevent="simpan">
      <h2 id="judul-hak-akses" class="text-[22px] font-semibold">Hak Akses — {{ kuis.judul }}</h2>
      <p class="text-wf-secondary">Pengelola dapat mengedit kuis, soal, dan password. Hanya pemilik yang dapat mengatur akses dan menghapus kuis.</p>
      <fieldset :disabled="menyimpan" class="flex flex-col gap-3">
        <legend class="font-semibold mb-3">Siapa yang boleh mengelola?</legend>
        <label class="flex gap-3 items-center"><input v-model="mode" type="radio" value="pribadi" name="akses" /> Hanya saya</label>
        <label class="flex gap-3 items-center"><input v-model="mode" type="radio" value="semua" name="akses" /> Semua dosen (termasuk akun dosen baru)</label>
        <label class="flex gap-3 items-center"><input v-model="mode" type="radio" value="tertentu" name="akses" /> Dosen tertentu</label>
      </fieldset>
      <fieldset v-if="mode === 'tertentu'" :disabled="menyimpan" class="border border-wf-border rounded-md p-3 flex flex-col gap-3 max-h-64 overflow-y-auto">
        <legend class="px-1">Pilih dosen</legend>
        <p v-if="memuat">Memuat daftar dosen...</p>
        <p v-else-if="!dosen.length">Tidak ada dosen lain yang tersedia.</p>
        <label v-for="d in dosen" :key="d.idUser" class="flex items-center gap-3">
          <input v-model="pilihan" type="checkbox" :value="d.idUser" />
          <span>{{ d.nama }} <span class="text-wf-secondary">(@{{ d.username }})</span></span>
        </label>
      </fieldset>
      <p v-if="errorMsg" role="alert" class="text-red-700">{{ errorMsg }}</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="tombol-aksi" :disabled="menyimpan" @click="tutup">Batal</button>
        <button type="submit" class="tombol-aksi" :disabled="menyimpan || (mode === 'tertentu' && (memuat || !pilihan.length))">
          {{ menyimpan ? 'Menyimpan...' : 'Simpan akses' }}
        </button>
      </div>
    </form>
  </div>
</template>
