<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAvatar, getUser, keluar, saveAvatar } from '../services/auth'
import logoImage from '../assets/logo-esikap.png'
import avatarImage from '../assets/icons/avatar.svg'
import StudentHeader from '../components/StudentHeader.vue'
import AdminHeader from '../components/AdminHeader.vue'
import { ROLE } from '../services/roles'

const router = useRouter()
const user = ref(getUser())
const mahasiswa = user.value?.role === ROLE.MAHASISWA
const avatar = ref(getAvatar() || avatarImage)
const selectedFile = ref(null)
const inputFile = ref(null)
const errorMsg = ref('')
const successMsg = ref('')
const saving = ref(false)
const loggingOut = ref(false)
const MAX_FILE_SIZE = 2 * 1024 * 1024

function pilihFoto(event) {
  const file = event.target.files?.[0]
  errorMsg.value = ''
  successMsg.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMsg.value = 'File harus berupa gambar.'
    event.target.value = ''
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    errorMsg.value = 'Ukuran foto maksimal 2 MB.'
    event.target.value = ''
    return
  }

  selectedFile.value = file
  const reader = new FileReader()
  reader.onload = () => { avatar.value = String(reader.result) }
  reader.onerror = () => { errorMsg.value = 'Foto tidak dapat dibaca. Silakan coba lagi.' }
  reader.readAsDataURL(file)
}

function bukaFilePicker() {
  inputFile.value?.click()
}

function simpanPerubahan() {
  if (!selectedFile.value) {
    errorMsg.value = 'Pilih foto terlebih dahulu.'
    successMsg.value = ''
    return
  }
  saving.value = true
  errorMsg.value = ''
  window.setTimeout(() => {
    saveAvatar(avatar.value)
    saving.value = false
    successMsg.value = 'Perubahan berhasil disimpan.'
    selectedFile.value = null
  }, 250)
}

async function handleLogout() {
  loggingOut.value = true
  await keluar()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <StudentHeader v-if="mahasiswa" />
    <AdminHeader v-else />

    <main
      class="pb-12 pt-8"
      :class="mahasiswa ? 'mx-auto max-w-[1200px] px-6 sm:px-10 lg:px-0' : 'px-4 sm:px-10 lg:px-20'"
    >
      <div class="flex flex-wrap items-center gap-3">
        <RouterLink to="/profil" class="tombol-kembali">
          KEMBALI KE AKUN SAYA
        </RouterLink>
        <span class="text-wf-muted" aria-hidden="true">/</span>
        <span class="font-mono text-xs uppercase tracking-[0.12em] text-wf-secondary">Edit akun / Edit foto</span>
      </div>
      <h1 class="mt-4 text-[26px] font-bold sm:text-[30px]">Edit foto</h1>

      <section class="mt-7 max-w-2xl rounded-md border border-wf-border-subtle bg-wf-card p-6 sm:p-8">
        <div class="flex flex-col items-center text-center">
          <img :src="avatar" alt="Pratinjau foto profil" class="size-36 rounded-full border border-wf-brand-border bg-wf-brand-soft object-cover" />
          <p class="mt-4 text-sm text-wf-secondary">Pilih foto profil baru dengan format JPG, PNG, atau WEBP.</p>
          <p class="mt-1 text-sm text-wf-secondary">Ukuran maksimal 2 MB.</p>
          <input ref="inputFile" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="pilihFoto" />
          <button type="button" class="mt-5 rounded-xl border border-wf-brand-border px-5 py-3 font-semibold text-wf-brand transition hover:bg-wf-brand-soft" @click="bukaFilePicker">
            Pilih foto
          </button>
          <p v-if="selectedFile" class="mt-3 text-sm text-wf-secondary">{{ selectedFile.name }}</p>
        </div>

        <p v-if="errorMsg" role="alert" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-wf-no">{{ errorMsg }}</p>
        <p v-if="successMsg" role="status" class="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-wf-ok">{{ successMsg }}</p>
        <button type="button" :disabled="saving" class="mt-7 w-full rounded-xl bg-wf-accent px-4 py-3 font-bold text-white transition hover:bg-wf-accent-hover disabled:cursor-not-allowed disabled:opacity-60" @click="simpanPerubahan">
          {{ saving ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN' }}
        </button>
      </section>
    </main>
  </div>
</template>
