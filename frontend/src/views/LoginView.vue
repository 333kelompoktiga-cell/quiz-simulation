<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { login, requestPasswordReset, saveSession, setNotice, takeNotice, halamanAwal } from '../services/auth'
// Foto latar sama dengan halaman reset password (backend/templates/background-itk.jpg.jpeg).
import bgImage from '../assets/background-itk.jpg'
import logoImage from '../assets/logo-esikap.png'

const router = useRouter()
const email = ref('')
const password = ref('')
const lihatPassword = ref(false)
const loading = ref(false)
const mengirimReset = ref(false)
const errorMsg = ref('')
const infoMsg = ref('')

// Pesan titipan halaman lain, mis. saat sesi dicabut perangkat lain
// atau saat backend tidak bisa dihubungi.
onMounted(() => {
  infoMsg.value = takeNotice() || ''
})

async function handleSubmit() {
  errorMsg.value = ''
  infoMsg.value = ''
  loading.value = true

  try {
    const data = await login(email.value, password.value)
    saveSession(data)

    if (data.previous_session_ended) {
      setNotice('Sesi akun Anda di perangkat lain sudah diakhiri otomatis.')
    }

    router.push(halamanAwal(data.user))
  } catch (err) {
    errorMsg.value = err.message
    password.value = ''
  } finally {
    loading.value = false
  }
}

async function handleForgotPassword() {
  errorMsg.value = ''
  infoMsg.value = ''

  if (!email.value.trim()) {
    errorMsg.value = 'Isi email dulu sebelum minta reset password.'
    return
  }

  mengirimReset.value = true
  try {
    const body = await requestPasswordReset(email.value)
    infoMsg.value = body.message
  } catch (err) {
    errorMsg.value = err.message
  } finally {
    mengirimReset.value = false
  }
}
</script>

<template>
  <main
    class="min-h-screen w-full flex items-center justify-center bg-cover bg-center relative px-4 py-10"
    :style="{ backgroundImage: `url(${bgImage})` }"
  >

    <div class="relative z-10 w-full max-w-md">
      <img :src="logoImage" alt="eSikap" width="125" height="40" fetchpriority="high" class="mx-auto mb-6 h-10 w-[125px] object-contain" />

      <div class="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8">
        <p class="text-xs font-semibold tracking-widest text-gray-600 uppercase">Masuk</p>
        <h1 class="text-2xl font-semibold text-gray-900 mt-1 mb-6">Halo, Selamat Datang!</h1>

        <form @submit.prevent="handleSubmit" class="space-y-4" novalidate>
          <div>
            <label
              for="email"
              class="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1"
            >
              Email
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              name="email"
              autocomplete="username"
              autofocus
              required
              :disabled="loading"
              placeholder="pengguna@student.itk.ac.id"
              class="w-full rounded-lg bg-gray-100 border border-transparent px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white disabled:opacity-60 transition"
            />
          </div>

          <div>
            <label
              for="password"
              class="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1"
            >
              Password
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="lihatPassword ? 'text' : 'password'"
                name="password"
                autocomplete="current-password"
                required
                :disabled="loading"
                class="w-full rounded-lg bg-gray-100 border border-transparent pl-4 pr-16 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white disabled:opacity-60 transition"
              />
              <button
                type="button"
                @click="lihatPassword = !lihatPassword"
                :aria-label="lihatPassword ? 'Sembunyi password' : 'Lihat password'"
                class="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-purple-700 hover:text-purple-900"
              >
                {{ lihatPassword ? 'SEMBUNYI' : 'LIHAT' }}
              </button>
            </div>
          </div>

          <p v-if="infoMsg" role="status" class="text-sm text-green-700">{{ infoMsg }}</p>
          <p v-if="errorMsg" role="alert" class="text-sm text-red-600">{{ errorMsg }}</p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded-lg bg-purple-700 hover:bg-purple-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm tracking-wide transition"
          >
            {{ loading ? 'MEMPROSES...' : 'MASUK' }}
          </button>
        </form>

        <button
          type="button"
          @click="handleForgotPassword"
          :disabled="mengirimReset || loading"
          class="mt-4 w-full rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-left px-4 py-3 transition"
        >
          <p class="text-xs font-semibold text-gray-700">
            {{ mengirimReset ? 'MENGIRIM...' : 'LUPA PASSWORD?' }}
          </p>
          <p class="text-xs text-gray-600 mt-0.5">Klik untuk kirim tautan reset ke email Anda</p>
        </button>
      </div>

      <!-- Tanpa lapisan gelap, bayangan tipis menjaga teks putih tetap terbaca di foto terang. -->
      <p class="text-center text-xs text-white mt-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
        &copy; {{ new Date().getFullYear() }} Quiz Simulation
      </p>
    </div>
  </main>
</template>
