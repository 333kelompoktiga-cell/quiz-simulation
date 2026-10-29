<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import TombolKembali from '../components/TombolKembali.vue'
import { setNotice, SessionExpiredError } from '../services/auth'
import { ambilBab, buatBab, ubahBab } from '../services/bab'
import pencilIcon from '../assets/icons/pencil.svg'

// Figma "Tambah bab - Dokumen". Satu halaman untuk dua keperluan:
// - /bab/tambah    → bab baru
// - /bab/:id/edit  → ubah bab yang sudah ada
const props = defineProps({ id: { type: String, default: null } })

const router = useRouter()
const modeEdit = computed(() => Boolean(props.id))

// Nomor urut bab diisi manual oleh admin (tidak auto-increment).
// Default kosong (null) agar admin sadar harus mengisi sendiri.
const form = ref({ namaBab: '', urutanBab: null, deskripsi: '' })
const memuat = ref(true)
// Kalau data bab gagal dimuat, form disembunyikan supaya isian kosong tidak
// ikut tersimpan menimpa bab yang ada.
const gagalMuat = ref(false)
const menyimpan = ref(false)
const errorMsg = ref('')

function tanganiError(err) {
  if (err instanceof SessionExpiredError) return router.push('/')
  errorMsg.value = err.message
}

onMounted(async () => {
  try {
    if (modeEdit.value) {
      const bab = await ambilBab(props.id)
      form.value = { namaBab: bab.namaBab, urutanBab: bab.urutanBab, deskripsi: bab.deskripsi ?? '' }
    }
    // Mode tambah: biarkan nomor urut kosong, admin isi sendiri.
  } catch (err) {
    gagalMuat.value = modeEdit.value
    tanganiError(err)
  } finally {
    memuat.value = false
  }
})

async function simpan() {
  errorMsg.value = ''
  const f = form.value

  if (!f.namaBab.trim()) {
    errorMsg.value = 'Judul bab wajib diisi.'
    return
  }

  // Nomor bab wajib diisi oleh admin
  if (f.urutanBab === null || f.urutanBab === '' || f.urutanBab === undefined) {
    errorMsg.value = 'Nomor bab wajib diisi.'
    return
  }

  const urutan = Number(f.urutanBab)
  // Aturan yang sama dengan urutanValid() di BabController: minimal 1.
  if (!Number.isInteger(urutan) || urutan < 1) {
    errorMsg.value = 'Nomor bab harus angka bulat minimal 1.'
    return
  }

  menyimpan.value = true
  const data = { namaBab: f.namaBab.trim(), urutanBab: urutan, deskripsi: f.deskripsi.trim() || null }
  try {
    const hasil = modeEdit.value ? await ubahBab(props.id, data) : await buatBab(data)
    setNotice(`Bab "${hasil.namaBab}" berhasil ${modeEdit.value ? 'diperbarui' : 'dibuat'}.`)
    router.push('/bab')
  } catch (err) {
    tanganiError(err)
  } finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-wf-page text-wf-text">
    <AdminHeader />

    <main class="px-4 sm:px-10 lg:px-20 pt-10 pb-14 flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <TombolKembali to="/bab" class="mb-2" />
        <p class="font-mono text-[18px] leading-7 tracking-[1px] text-wf-text">
          <RouterLink to="/bab" class="hover:underline">Bab</RouterLink>
          / {{ modeEdit ? 'EDIT BAB' : 'TAMBAH BAB' }}
        </p>
        <h1 class="text-[28px] leading-9 font-semibold">{{ modeEdit ? 'Edit Bab' : 'Tambah Bab' }}</h1>
        <p class="text-[17px] leading-6 text-wf-secondary">
          Pilih cara membuat bab, lalu lengkapi informasi yang diperlukan untuk materi, tujuan, dan ringkasan.
        </p>
      </div>

      <div class="flex">
        <span
          class="flex items-center gap-2 px-5 py-3 rounded-md bg-wf-brand-soft border-2 border-wf-brand text-[17px] leading-6 font-semibold text-wf-brand"
        >
          <span class="size-[18px] shrink-0"><img :src="pencilIcon" alt="" class="size-full" /></span>
          Input Manual
        </span>
      </div>

      <p v-if="memuat" class="text-wf-muted">Memuat data...</p>

      <p v-else-if="gagalMuat" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
        {{ errorMsg }} <RouterLink to="/bab" class="underline font-semibold">Kembali ke daftar bab</RouterLink>
      </p>

      <form
        v-else
        @submit.prevent="simpan"
        novalidate
        class="bg-wf-card border border-wf-border-subtle rounded-md shadow-sm p-6 flex flex-col gap-5"
      >
        <div class="flex flex-col gap-1">
          <h2 class="text-[22px] leading-[30px] font-semibold">Tulis Bab secara manual</h2>
          <p class="text-[17px] leading-6 text-wf-secondary">
            Tambahkan judul bab, tujuan pembelajaran, ringkasan, dan materi utama untuk bab {{ modeEdit ? 'ini' : 'baru' }}.
          </p>
        </div>

        <div class="flex flex-wrap gap-6">
          <label class="flex flex-col gap-2 w-full sm:w-[360px]">
            <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">JUDUL BAB</span>
            <input
              v-model="form.namaBab"
              type="text"
              placeholder="mis. Ejaan"
              class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
            />
          </label>
          <label class="flex flex-col gap-2 w-full sm:w-[360px]">
            <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">NOMOR BAB <span class="text-red-500">*</span></span>
            <input
              v-model.number="form.urutanBab"
              type="number"
              min="1"
              step="1"
              placeholder="mis. 1"
              class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
            />
            <span class="text-[13px] text-wf-muted">Nomor bab harus unik untuk Anda. Admin lain boleh memakai nomor yang sama.</span>
          </label>
        </div>

        <label class="flex flex-col gap-2">
          <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">RINGKASAN BAB</span>
          <textarea
            v-model="form.deskripsi"
            rows="4"
            placeholder="Bab ini membahas ..."
            class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
          ></textarea>
        </label>

        <p v-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
          {{ errorMsg }}
        </p>

        <div class="flex justify-end gap-4">
          <RouterLink
            to="/bab"
            class="rounded-xl bg-wf-card border border-wf-brand-border px-6 py-4 text-[18px] leading-6 font-semibold tracking-[0.2px] text-wf-brand"
          >
            KEMBALI
          </RouterLink>
          <button
            type="submit"
            :disabled="menyimpan"
            class="rounded-xl bg-wf-accent-hover px-6 py-4 text-[18px] leading-6 font-semibold tracking-[0.2px] text-white disabled:opacity-60"
          >
            {{ menyimpan ? 'MENYIMPAN...' : 'SIMPAN BAB' }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>
