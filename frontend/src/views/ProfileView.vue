<script setup>
import { ref, onMounted } from 'vue'
import { ambilProfilSaya } from '../services/profile'
import { useRouter } from 'vue-router'
import { getAvatar, getUser, keluar } from '../services/auth'
import logoImage from '../assets/logo-esikap.png'
import avatarImage from '../assets/icons/avatar.svg'
import StudentHeader from '../components/StudentHeader.vue'
import AdminHeader from '../components/AdminHeader.vue'
import { ROLE } from '../services/roles'

const router = useRouter()
const user = ref(getUser())
const avatar = ref(getAvatar() || avatarImage)
const loggingOut = ref(false)

// Halaman ini dipakai semua role. Admin dan Super Admin tetap melihat navbar
// mereka sendiri, dan username mereka bukan NIM.
const mahasiswa = user.value?.role === ROLE.MAHASISWA

const bergabung = ref('-')
const terakhirMasuk = ref('-')

function formatWaktu(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

onMounted(async () => {
  try {
    const data = await ambilProfilSaya()
    bergabung.value = formatWaktu(data.bergabung)
    terakhirMasuk.value = formatWaktu(data.terakhirMasuk)
  } catch {
    // Kalau gagal, tetap tampil "-"; data akun lain tidak terganggu.
  }
})

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
      class="pb-12 pt-10"
      :class="mahasiswa ? 'mx-auto max-w-[1200px] px-6 sm:px-10 lg:px-0' : 'px-4 sm:px-10 lg:px-20'"
    >
      <h1 class="text-[28px] font-bold sm:text-[30px]">Akun saya</h1>

      <div class="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_286px]">
        <section class="rounded-md border border-wf-border-subtle bg-wf-card px-6 py-7 sm:px-7">
          <h2 class="font-mono text-[17px] uppercase tracking-[0.12em] text-wf-secondary">Data akun</h2>
          <div class="mt-6">
            <div class="account-row">
              <span>Nama lengkap</span>
              <strong>{{ user?.nama || '-' }}</strong>
            </div>
            <div class="account-row">
              <span>{{ mahasiswa ? 'NIM' : 'Username' }}</span>
              <strong>{{ user?.username || '-' }}</strong>
            </div>
            <div class="account-row">
              <span>Email</span>
              <strong>{{ user?.email || '-' }}</strong>
            </div>
            <div class="account-row">
              <span>Role</span>
              <strong>{{ user?.role || 'Mahasiswa' }}</strong>
            </div>
            <div class="account-row">
              <span>Bergabung</span>
              <strong>{{ bergabung }}</strong>
            </div>
            <div class="account-row border-b-0">
              <span>Terakhir masuk</span>
              <strong>{{ terakhirMasuk }}</strong>
            </div>
          </div>
        </section>

        <aside class="flex min-h-[260px] flex-col items-center justify-center rounded-md border border-wf-border-subtle bg-wf-card px-6 py-7 text-center">
          <img :src="avatar" alt="" class="size-20 rounded-full object-cover" />
          <RouterLink to="/profil/edit-foto" class="tombol-aksi mt-4">
            Edit Foto
          </RouterLink>
          <h2 class="mt-4 text-[20px] font-bold">{{ user?.nama || 'Mahasiswa' }}</h2>
          <span class="mt-4 rounded-md border border-wf-brand-border px-2 py-1 text-[17px] font-semibold text-wf-secondary">
            {{ user?.role || 'Pengguna' }}
          </span>
        </aside>
      </div>
    </main>
  </div>
</template>

<style scoped>
.account-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 1.25rem;
  border-top: 1px solid #e2e0ec;
  padding-block: 1rem;
  font-size: 16px;
}

.account-row span {
  font-family: "Roboto Mono", ui-monospace, monospace;
  letter-spacing: 0.08em;
  color: #6b6780;
}

.account-row strong {
  font-weight: 400;
  color: #1b1930;
}

@media (min-width: 640px) {
  .account-row {
    grid-template-columns: 210px minmax(0, 1fr);
    font-size: 18px;
  }
}
</style>
