<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import TombolKembali from '../components/TombolKembali.vue'
import KuisBukanMilik from '../components/KuisBukanMilik.vue'
import { setNotice, SessionExpiredError } from '../services/auth'
import {
  TINGKAT_KESULITAN,
  EndpointBelumAdaError,
  hurufOpsi,
  ambilDaftarBab,
  ambilKuis,
  buatKuis,
  ubahKuis,
  ambilSoalKuis,
  simpanSoalKuis,
  importSoalPdf,
} from '../services/kuis'
import pencilIcon from '../assets/icons/pencil.svg'
import fileIcon from '../assets/icons/file.svg'
import fileUpIcon from '../assets/icons/file-up.svg'
import downloadIcon from '../assets/icons/arrow-down-to-line.svg'
import trashIcon from '../assets/icons/trash-2.svg'
import radioCheckedIcon from '../assets/icons/radio-checked.svg'

// Satu halaman untuk dua keperluan:
// - /kuis/tambah      → membuat kuis baru beserta soalnya
// - /kuis/:id/soal    → mengedit soal kuis yang sudah ada
const props = defineProps({ id: { type: String, default: null } })

const route = useRoute()
const router = useRouter()

const MAKS_OPSI = 6
const MIN_OPSI = 2

// Template dokumen soal (Google Docs) untuk tab Dokumen, dibuka di tab baru.
const TEMPLATE_SOAL_URL = 'https://docs.google.com/document/d/13dNI81pmQpRn92Dh8pAzdO_tHg7cyWenxu30-0bTR-A/edit?pli=1&tab=t.0'

// Aturan acak soal, sama dengan backend/utils/acakSoal.js. Urutan soal selalu diacak;
// "acak soal" (menampilkan sebagian) hanya bisa dipakai kalau ada minimal 20 soal,
// minimal 10 ditampilkan, dan selalu ada minimal 10 soal cadangan.
const MIN_SOAL_ACAK = 20
const MIN_TAMPIL = 10
const MIN_CADANGAN = 10

const modeEdit = computed(() => Boolean(props.id))
const bisaAcak = computed(() => daftarSoal.value.length >= MIN_SOAL_ACAK)
const maksTampil = computed(() => daftarSoal.value.length - MIN_CADANGAN)
const acakAktif = computed(() => bisaAcak.value && info.value.acakSoal)
const metode = ref('manual')

const daftarBab = ref([])
const info = ref({ judul: '', idBab: null, deskripsi: '', durasi: 30, acakSoal: false, jumlahTampil: MIN_TAMPIL })
const daftarSoal = ref([soalKosong()])
const indeksAktif = ref(0)

const memuat = ref(true)
const menyimpan = ref(false)
const menyimpanSoal = ref(false)
const errorMsg = ref('')
const infoMsg = ref('')
const sudahCobaSimpan = ref(false)
const kuisLain = ref(null)

// Kalau kuis sudah terbuat tapi soalnya gagal tersimpan, percobaan
// berikutnya cukup memperbarui kuis itu, bukan membuat kuis kembar.
const idKuisTersimpan = ref(props.id)

function soalKosong() {
  return {
    pertanyaan: '',
    opsi: ['', '', '', '', ''],
    kunci: null,
    difficulty: 'Sedang',
    targetTime: 60,
    pembahasan: '',
    ringkasan: '',
  }
}

const soal = computed(() => daftarSoal.value[indeksAktif.value])
const namaBabAktif = computed(
  () => daftarBab.value.find((b) => b.idBab === info.value.idBab)?.namaBab ?? '',
)

const idBabAsal = ref(null)
const namaBabAsal = computed(() => daftarBab.value.find((b) => b.idBab === idBabAsal.value)?.namaBab ?? '')
const tautanKembali = computed(() => (idBabAsal.value ? `/bab/${idBabAsal.value}/kuis` : '/bab'))

// ── Pratinjau teks ──
function intisari(teks) {
  return (teks ?? '').replace(/\s+/g, ' ').trim()
}

// ── Validasi ──
function isSoalKosong(s) {
  if (!s || typeof s !== 'object') return true
  const pertanyaanKosong = typeof s.pertanyaan !== 'string' || !s.pertanyaan.trim()
  const opsiKosong = !Array.isArray(s.opsi) || s.opsi.every((o) => typeof o !== 'string' || !o.trim())
  const pembahasanKosong = typeof s.pembahasan !== 'string' || !s.pembahasan.trim()
  return pertanyaanKosong && opsiKosong && s.kunci === null && pembahasanKosong
}

function masalahSoal(s) {
  if (!s || typeof s !== 'object') return 'data soal tidak valid'
  if (typeof s.pertanyaan !== 'string' || !s.pertanyaan.trim()) return 'pertanyaan masih kosong'
  if (!Array.isArray(s.opsi) || s.opsi.length < MIN_OPSI) return `minimal ${MIN_OPSI} opsi jawaban`
  if (s.opsi.some((o) => typeof o !== 'string' || !o.trim())) return 'ada opsi jawaban yang kosong'
  if (s.kunci === null) return 'jawaban benar belum dipilih'
  return null
}

function validasiInfoKuis() {
  if (!info.value.judul.trim()) {
    errorMsg.value = 'Nama kuis wajib diisi.'
    return false
  }
  if (!info.value.idBab) {
    errorMsg.value = 'Pilih bab untuk kuis ini.'
    return false
  }
  if (!Number.isInteger(info.value.durasi) || info.value.durasi <= 0) {
    errorMsg.value = 'Durasi kuis harus bilangan bulat lebih dari 0 menit.'
    return false
  }
  return true
}

function buatPayloadKuis(jumlahSoalValid) {
  const bolehAcak = jumlahSoalValid >= MIN_SOAL_ACAK && info.value.acakSoal
  return {
    judul: info.value.judul.trim(),
    idBab: info.value.idBab,
    deskripsi: info.value.deskripsi.trim() || null,
    durasi: info.value.durasi,
    // Di bawah 20 soal opsi acak soal dimatikan; urutan soal tetap diacak oleh backend.
    acakSoal: bolehAcak,
    jumlahTampil: bolehAcak ? info.value.jumlahTampil : null,
  }
}

const jumlahLengkap = computed(() => daftarSoal.value.filter((s) => !masalahSoal(s)).length)

function kelasNomor(i) {
  if (i === indeksAktif.value) return 'bg-wf-brand-soft border-2 border-wf-brand text-wf-brand'
  if (sudahCobaSimpan.value && masalahSoal(daftarSoal.value[i])) return 'bg-red-50 border border-wf-no text-wf-no'
  if (!masalahSoal(daftarSoal.value[i])) return 'bg-wf-card border border-wf-brand-border text-wf-secondary'
  return 'bg-wf-card border border-wf-border text-wf-secondary'
}

// ── Navigasi & Tambah Soal (simpan ke Supabase sebagai Draf) ──
function pindahKe(i) {
  indeksAktif.value = i
}

async function tambahSoal() {
  if (menyimpan.value || menyimpanSoal.value) return
  errorMsg.value = ''
  infoMsg.value = ''
  sudahCobaSimpan.value = true

  if (!validasiInfoKuis()) return

  const akhirKosong =
    daftarSoal.value.length > 1 && isSoalKosong(daftarSoal.value[daftarSoal.value.length - 1])
  const daftarDicek =
    akhirKosong && indeksAktif.value < daftarSoal.value.length - 1
      ? daftarSoal.value.slice(0, -1)
      : daftarSoal.value

  const indeksSalah = daftarDicek.findIndex((s) => masalahSoal(s))
  if (indeksSalah !== -1) {
    indeksAktif.value = indeksSalah
    errorMsg.value = `Soal ${indeksSalah + 1}: ${masalahSoal(daftarDicek[indeksSalah])}. Lengkapi soal sebelum menambah soal baru.`
    return
  }

  menyimpanSoal.value = true
  const dataKuis = buatPayloadKuis(daftarDicek.length)

  try {
    // Buat kuis sebagai Draf (pin: null) jika belum ada di Supabase, atau perbarui info kuis.
    if (idKuisTersimpan.value) {
      await ubahKuis(idKuisTersimpan.value, dataKuis)
    } else {
      const kuis = await buatKuis(dataKuis)
      idKuisTersimpan.value = kuis.idKuis
    }

    // Simpan soal yang sudah diisi ke Supabase
    await simpanSoalKuis(idKuisTersimpan.value, daftarDicek)

    const jumlahTersimpan = daftarDicek.length
    if (!akhirKosong) {
      daftarSoal.value.push(soalKosong())
    }
    indeksAktif.value = daftarSoal.value.length - 1
    sudahCobaSimpan.value = false
    snapshotAwal.value = snapshot()
    infoMsg.value = `${jumlahTersimpan} soal berhasil disimpan ke database (status: Draf). Klik "SIMPAN SOAL" jika semua soal sudah selesai untuk generate password dan menerbitkan kuis.`
  } catch (err) {
    tanganiError(err)
  } finally {
    menyimpanSoal.value = false
  }
}

function selanjutnya() {
  if (indeksAktif.value === daftarSoal.value.length - 1) tambahSoal()
  else indeksAktif.value += 1
}

async function hapusSoalAktif() {
  if (daftarSoal.value.length === 1 || menyimpan.value || menyimpanSoal.value) return
  if (!window.confirm(`Hapus soal ${indeksAktif.value + 1}?`)) return
  daftarSoal.value.splice(indeksAktif.value, 1)
  indeksAktif.value = Math.min(indeksAktif.value, daftarSoal.value.length - 1)

  if (idKuisTersimpan.value) {
    const soalValid = daftarSoal.value.filter((s) => !masalahSoal(s))
    if (soalValid.length > 0) {
      try {
        await simpanSoalKuis(idKuisTersimpan.value, soalValid)
        snapshotAwal.value = snapshot()
      } catch (err) {
        tanganiError(err)
      }
    }
  }
}

// ── Opsi jawaban ──
function tambahOpsi() {
  if (soal.value.opsi.length < MAKS_OPSI) soal.value.opsi.push('')
}

function hapusOpsi(i) {
  const s = soal.value
  if (s.opsi.length <= MIN_OPSI) return
  s.opsi.splice(i, 1)
  if (s.kunci === i) s.kunci = null
  else if (s.kunci !== null && s.kunci > i) s.kunci -= 1
}

// ── Perubahan belum tersimpan ──
const snapshotAwal = ref('')
const bersih = ref(false)

function snapshot() {
  return JSON.stringify({ info: info.value, soal: daftarSoal.value })
}

const adaPerubahan = computed(() => !bersih.value && snapshot() !== snapshotAwal.value)

onBeforeRouteLeave(() => {
  if (adaPerubahan.value && !window.confirm('Perubahan belum disimpan. Tetap keluar?')) return false
})

function cegahTutupTab(e) {
  if (adaPerubahan.value) e.preventDefault()
}

// ── Muat data ──
function tanganiError(err) {
  if (err instanceof SessionExpiredError) {
    bersih.value = true
    router.push('/')
    return
  }
  errorMsg.value = err.message
}

onMounted(async () => {
  window.addEventListener('beforeunload', cegahTutupTab)
  try {
    daftarBab.value = await ambilDaftarBab()

    if (modeEdit.value) {
      const kuis = await ambilKuis(props.id)
      idBabAsal.value = kuis.idBab
      if (kuis.bisaDikelola === false) {
        kuisLain.value = kuis
        return
      }
      info.value = {
        judul: kuis.judul,
        idBab: kuis.idBab,
        deskripsi: kuis.deskripsi ?? '',
        durasi: kuis.durasi ?? 30,
        acakSoal: kuis.acakSoal === true,
        jumlahTampil: kuis.jumlahTampil ?? MIN_TAMPIL,
      }

      try {
        const soalLama = await ambilSoalKuis(props.id)
        if (soalLama.length) {
          daftarSoal.value = soalLama
        }
      } catch (err) {
        if (!(err instanceof EndpointBelumAdaError)) throw err
        infoMsg.value = 'Soal lama belum bisa dimuat karena endpoint soal belum tersedia di backend.'
      }
    } else {
      const dariQuery = daftarBab.value.find((b) => String(b.idBab) === route.query.idBab)
      info.value.idBab = (dariQuery ?? daftarBab.value[0])?.idBab ?? null
      idBabAsal.value = dariQuery?.idBab ?? null
    }
  } catch (err) {
    tanganiError(err)
  } finally {
    snapshotAwal.value = snapshot()
    memuat.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', cegahTutupTab)
  if (urlBerkas.value) URL.revokeObjectURL(urlBerkas.value)
})

// ── Simpan Soal & Terbitkan Kuis (Input Manual) ──
async function simpan() {
  if (menyimpan.value || menyimpanSoal.value) return
  errorMsg.value = ''
  infoMsg.value = ''
  sudahCobaSimpan.value = true

  if (!validasiInfoKuis()) return

  // Jika soal paling akhir masih kosong sepenuhnya (misal setelah klik + Tambah Soal lalu langsung klik Simpan Soal),
  // abaikan soal kosong terakhir tersebut selama sudah ada minimal 1 soal sebelumnya.
  const abaikanAkhirKosong =
    daftarSoal.value.length > 1 && isSoalKosong(daftarSoal.value[daftarSoal.value.length - 1])
  const dataSoal = abaikanAkhirKosong ? daftarSoal.value.slice(0, -1) : daftarSoal.value

  const indeksSalah = dataSoal.findIndex((s) => masalahSoal(s))
  if (indeksSalah !== -1) {
    indeksAktif.value = indeksSalah
    errorMsg.value = `Soal ${indeksSalah + 1}: ${masalahSoal(dataSoal[indeksSalah])}.`
    return
  }

  const bisaAcakFinal = dataSoal.length >= MIN_SOAL_ACAK
  const acakFinal = bisaAcakFinal && info.value.acakSoal
  const maksTampilFinal = dataSoal.length - MIN_CADANGAN
  const tampil = info.value.jumlahTampil
  if (acakFinal && (!Number.isInteger(tampil) || tampil < MIN_TAMPIL || tampil > maksTampilFinal)) {
    errorMsg.value = `Jumlah soal yang ditampilkan harus ${MIN_TAMPIL} sampai ${maksTampilFinal} (minimal ${MIN_CADANGAN} soal cadangan).`
    return
  }

  menyimpan.value = true
  const dataKuis = buatPayloadKuis(dataSoal.length)

  try {
    if (!idKuisTersimpan.value) {
      const kuis = await buatKuis(dataKuis)
      idKuisTersimpan.value = kuis.idKuis
    }

    await simpanSoalKuis(idKuisTersimpan.value, dataSoal)

    // Generate password (pin) sehingga kuis berstatus Terbit (published)
    const kuisTerbit = await ubahKuis(idKuisTersimpan.value, {
      ...dataKuis,
      publish: true,
    })

    bersih.value = true
    const infoPin = kuisTerbit?.pin ? ` Password kuis: ${kuisTerbit.pin}.` : ''
    setNotice(`Kuis "${dataKuis.judul}" berhasil disimpan dan diterbitkan dengan ${dataSoal.length} soal.${infoPin}`)
    router.push(`/bab/${dataKuis.idBab}/kuis`)
  } catch (err) {
    if (err instanceof EndpointBelumAdaError) {
      errorMsg.value =
        'Info kuis sudah tersimpan, tetapi soalnya belum: endpoint soal belum tersedia di backend. ' +
        'Jangan tutup halaman ini kalau soalnya ingin dipertahankan.'
    } else {
      tanganiError(err)
    }
  } finally {
    menyimpan.value = false
  }
}

function batal() {
  router.push(tautanKembali.value)
}

// ── Tab Dokumen ──
// Memanggil POST /api/soal/import-pdf (hanya PDF, maks 50 MB, sesuai backend).

const TIPE_DOKUMEN = ['pdf']
const MAKS_UKURAN = 50 * 1024 * 1024

const berkas = ref(null)
const urlBerkas = ref('')
const errorBerkas = ref('')
const sedangSeret = ref(false)
const inputBerkas = ref(null)

// Rentang halaman PDF yang berisi soal (di extract_soal.js: 55 sampai 103)
const halamanAwal = ref(1)
const halamanAkhir = ref(1)
// Laporan dari backend: { message, total, berhasil: [], gagal: [] }
const hasilImpor = ref(null)

function ekstensi(nama) {
  return nama.split('.').pop().toLowerCase()
}

function formatUkuran(byte) {
  return `${(byte / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`
}

function pilihBerkas(file) {
  errorBerkas.value = ''
  if (!file) return
  if (!TIPE_DOKUMEN.includes(ekstensi(file.name))) {
    errorBerkas.value = 'Format berkas harus PDF.'
    return
  }
  if (file.size > MAKS_UKURAN) {
    errorBerkas.value = 'Ukuran berkas maksimal 50 MB.'
    return
  }
  if (urlBerkas.value) URL.revokeObjectURL(urlBerkas.value)
  berkas.value = file
  urlBerkas.value = URL.createObjectURL(file)
}

function saatDrop(e) {
  sedangSeret.value = false
  pilihBerkas(e.dataTransfer.files[0])
}

function hapusBerkas() {
  if (urlBerkas.value) URL.revokeObjectURL(urlBerkas.value)
  berkas.value = null
  urlBerkas.value = ''
  hasilImpor.value = null
  if (inputBerkas.value) inputBerkas.value.value = ''
}

function lanjutKeKelola() {
  bersih.value = true
  router.push(`/bab/${info.value.idBab}/kuis`)
}

async function simpanDokumen() {
  errorMsg.value = ''
  hasilImpor.value = null

  if (!info.value.judul.trim()) {
    errorMsg.value = 'Nama kuis wajib diisi.'
    return
  }
  if (!info.value.idBab) {
    errorMsg.value = 'Pilih bab untuk kuis ini.'
    return
  }
  if (!Number.isInteger(info.value.durasi) || info.value.durasi <= 0) {
    errorMsg.value = 'Durasi kuis harus bilangan bulat lebih dari 0 menit.'
    return
  }
  if (!berkas.value) {
    errorMsg.value = 'Pilih berkas PDF terlebih dahulu.'
    return
  }
  if (
    !Number.isInteger(halamanAwal.value) ||
    !Number.isInteger(halamanAkhir.value) ||
    halamanAwal.value < 1 ||
    halamanAkhir.value < halamanAwal.value
  ) {
    errorMsg.value = 'Rentang halaman tidak valid.'
    return
  }

  menyimpan.value = true
  try {
    // 1) Buat kuis dulu supaya punya idKuis (backend butuh idKuis untuk menyimpan soal).
    //    Kalau impor gagal lalu dicoba lagi, kuis yang sama dipakai, bukan dibuat kembar.
    if (!idKuisTersimpan.value) {
      const kuis = await buatKuis({
        judul: info.value.judul.trim(),
        idBab: info.value.idBab,
        deskripsi: null,
        durasi: info.value.durasi,
      })
      idKuisTersimpan.value = kuis.idKuis
    }

    // 2) Kirim PDF + rentang halaman ke backend. Backend yang mengekstrak dan menyimpan soal.
    const hasil = await importSoalPdf({
      file: berkas.value,
      idKuis: idKuisTersimpan.value,
      startPage: halamanAwal.value,
      endPage: halamanAkhir.value,
    })
    hasilImpor.value = hasil

    if (hasil.berhasil?.length > 0) {
      // 3) Generate password (pin) sehingga kuis berstatus Terbit (published)
      const kuisTerbit = await ubahKuis(idKuisTersimpan.value, {
        judul: info.value.judul.trim(),
        idBab: info.value.idBab,
        durasi: info.value.durasi,
        publish: true,
      })

      if (!hasil.gagal?.length) {
        // Semua soal berhasil → langsung pindah halaman
        bersih.value = true
        const infoPin = kuisTerbit?.pin ? ` Password kuis: ${kuisTerbit.pin}.` : ''
        setNotice(`Kuis "${info.value.judul.trim()}" berhasil diterbitkan dengan ${hasil.berhasil.length} soal.${infoPin}`)
        router.push(`/bab/${info.value.idBab}/kuis`)
      }
    } else {
      errorMsg.value = hasil.message
    }
    // Kalau sebagian gagal: tetap di halaman, daftar soal gagal ditampilkan di bawah.
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
      <!-- Judul halaman -->
      <div class="flex flex-col gap-2">
        <TombolKembali :to="tautanKembali" class="mb-2" />
        <p class="font-mono text-[18px] leading-7 tracking-[1px] text-wf-text">
          <RouterLink to="/bab" class="hover:underline">Bab</RouterLink>
          <template v-if="namaBabAsal">
            / <RouterLink :to="tautanKembali" class="hover:underline uppercase">{{ namaBabAsal }}</RouterLink>
          </template>
          / {{ modeEdit ? 'EDIT SOAL' : 'TAMBAH KUIS' }}
        </p>
        <h1 class="text-[28px] leading-9 font-semibold">{{ modeEdit ? 'Edit Soal' : 'Tambah Kuis' }}</h1>
        <p class="text-[17px] leading-6 text-wf-secondary">
          {{
            modeEdit
              ? 'Ubah pertanyaan, pilihan jawaban, jawaban benar, dan pembahasan.'
              : 'Pilih cara membuat kuis, sesuaikan dengan kebutuhan.'
          }}
        </p>
      </div>

      <!-- Metode pembuatan -->
      <div v-if="!modeEdit" class="flex flex-wrap gap-3" role="tablist" aria-label="Metode pembuatan">
        <button
          v-for="tab in [
            { nilai: 'manual', label: 'Input Manual', ikon: pencilIcon },
            { nilai: 'dokumen', label: 'Dokumen', ikon: fileIcon },
          ]"
          :key="tab.nilai"
          type="button"
          role="tab"
          :aria-selected="metode === tab.nilai"
          @click="metode = tab.nilai"
          class="flex items-center gap-2 px-5 py-3 rounded-md text-[17px] leading-6"
          :class="
            metode === tab.nilai
              ? 'bg-wf-brand-soft border-2 border-wf-brand text-wf-brand font-semibold'
              : 'bg-wf-card border border-wf-border text-wf-secondary'
          "
        >
          <span class="size-[18px] shrink-0"><img :src="tab.ikon" alt="" class="size-full" /></span>
          {{ tab.label }}
        </button>
      </div>

      <p v-if="memuat" class="text-wf-muted">Memuat data...</p>

      <!-- ════════ INPUT MANUAL ════════ -->
      <section
        v-else-if="metode === 'manual'"
        class="bg-wf-card border border-wf-border-subtle rounded-xl p-5 lg:p-7 flex flex-col gap-6"
      >
        <p v-if="!modeEdit" class="-mt-1 text-[14px] leading-normal text-wf-secondary">
          Tambahkan pertanyaan, pilihan jawaban, jawaban benar, dan pembahasan.
          Rumus matematika dibatasi $ ... $ (inline) atau $$ ... $$ (blok); ketik
          <code>\frac</code> untuk pecahan.
        </p>

        <!-- Baris judul -->
        <div class="flex flex-wrap items-end gap-4">
          <div class="flex-1 min-w-[260px] flex flex-col gap-1">
            <p class="text-[15px] leading-5 font-semibold tracking-[1px] uppercase min-h-7">
              {{ namaBabAktif }}
            </p>
            <div class="flex flex-wrap gap-4">
              <div class="flex flex-col gap-2 w-full sm:w-[360px]">
                <span class="font-mono font-bold text-[16px] lg:text-[18px] leading-5 tracking-[1px] text-wf-muted">NAMA KUIS</span>
                <input
                  v-model="info.judul"
                  type="text"
                  placeholder="masukkan nama kuis"
                  class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
                />
              </div>
              <label class="flex flex-col gap-2 w-full sm:w-[260px]">
                <span class="font-mono font-bold text-[16px] lg:text-[18px] leading-5 tracking-[1px] text-wf-muted">BAB</span>
                <select
                  v-model="info.idBab"
                  class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
                >
                  <option :value="null" disabled>Pilih bab</option>
                  <option v-for="bab in daftarBab" :key="bab.idBab" :value="bab.idBab">{{ bab.namaBab }}</option>
                </select>
              </label>
            </div>
          </div>

          <div class="flex gap-4">
            <button
              type="button"
              @click="batal"
              class="rounded-xl bg-wf-no border border-wf-no-border px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-white"
            >
              BATAL
            </button>
            <button
              type="button"
              @click="simpan"
              :disabled="menyimpan || menyimpanSoal"
              class="rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-6 py-4 text-[20px] lg:text-[22px] leading-7 font-semibold tracking-[0.2px] text-white disabled:opacity-60 min-w-[190px]"
            >
              {{ menyimpan ? 'MENYIMPAN...' : 'SIMPAN SOAL' }}
            </button>
          </div>
        </div>

        <p v-if="infoMsg" role="status" class="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-[15px] text-amber-800">
          {{ infoMsg }}
        </p>
        <p v-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
          {{ errorMsg }}
        </p>

        <div class="flex flex-col lg:flex-row gap-6 items-start">
          <!-- Kolom kiri: isi soal -->
          <div class="flex-1 min-w-0 w-full flex flex-col gap-5">
            <div class="flex items-center gap-3">
              <p class="flex-1 text-[17px] lg:text-[19px] leading-5 font-semibold tracking-[1px]">
                PENGISIAN SOAL {{ indeksAktif + 1 }}
              </p>
              <span class="bg-wf-brand-soft border border-wf-brand-border rounded-md px-2 py-1 text-[17px] lg:text-[19px] leading-[22px] font-semibold tracking-[0.5px]">
                Pilihan ganda
              </span>
            </div>

            <div class="flex flex-col gap-2">
              <span class="text-[16px] lg:text-[18px] leading-5 font-semibold tracking-[1px] text-wf-muted">
                PERTANYAAN
              </span>
              <textarea
                v-model="soal.pertanyaan"
                rows="4"
                placeholder="Tulis pertanyaan di sini."
                class="w-full field-sizing-content min-h-32 resize-y bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
              ></textarea>

              <label class="flex flex-col gap-2 w-full sm:w-[360px] mt-1">
                <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">DURASI (MENIT)</span>
                <input
                  v-model.number="info.durasi"
                  type="number"
                  min="1"
                  step="1"
                  class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
                />
                <span class="text-[13px] text-wf-muted">Lama pengerjaan seluruh kuis, berlaku untuk semua soal.</span>
              </label>

              <div class="flex flex-col gap-2 mt-1">
                <label
                  class="flex items-center gap-3 self-start"
                  :class="bisaAcak ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'"
                >
                  <input
                    v-model="info.acakSoal"
                    type="checkbox"
                    :disabled="!bisaAcak"
                    class="size-5 accent-wf-brand"
                  />
                  <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">ACAK SOAL</span>
                </label>

                <label v-if="acakAktif" class="flex flex-col gap-2 w-full sm:w-[360px]">
                  <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">JUMLAH SOAL DITAMPILKAN</span>
                  <input
                    v-model.number="info.jumlahTampil"
                    type="number"
                    :min="MIN_TAMPIL"
                    :max="maksTampil"
                    step="1"
                    class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
                  />
                </label>

                <span class="text-[13px] text-wf-muted">
                  <template v-if="!bisaAcak">
                    Acak soal butuh minimal {{ MIN_SOAL_ACAK }} soal (sekarang {{ daftarSoal.length }}).
                    Semua soal ditampilkan, urutannya tetap diacak untuk tiap mahasiswa.
                  </template>
                  <template v-else-if="acakAktif">
                    Tiap mahasiswa mendapat {{ info.jumlahTampil || 0 }} soal acak dari {{ daftarSoal.length }} soal
                    (boleh {{ MIN_TAMPIL }}–{{ maksTampil }}, minimal {{ MIN_CADANGAN }} cadangan). Urutannya juga diacak.
                  </template>
                  <template v-else>
                    Semua {{ daftarSoal.length }} soal ditampilkan, urutannya diacak untuk tiap mahasiswa.
                    Nyalakan untuk menampilkan sebagian soal secara acak.
                  </template>
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                @click="pindahKe(indeksAktif - 1)"
                :disabled="indeksAktif === 0"
                class="shrink-0 whitespace-nowrap rounded-xl border px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 text-[14px] sm:text-[16px] lg:text-[19px] leading-[26px] font-semibold tracking-[0.2px] disabled:bg-wf-muted-surface disabled:border-wf-border-subtle disabled:text-wf-muted bg-wf-card border-wf-brand-border text-wf-brand"
              >
                SEBELUMNYA
              </button>
              <p class="flex-1 min-w-0 whitespace-nowrap text-center text-[14px] sm:text-[16px] lg:text-[19px] leading-[26px] text-wf-secondary">
                <span class="sm:hidden">{{ indeksAktif + 1 }}/{{ daftarSoal.length }}</span>
                <span class="hidden sm:inline">Soal {{ indeksAktif + 1 }} dari {{ daftarSoal.length }}</span>
              </p>
              <button
                type="button"
                @click="selanjutnya"
                :disabled="menyimpan || menyimpanSoal"
                class="shrink-0 whitespace-nowrap rounded-xl bg-wf-card border border-wf-brand-border px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 text-[14px] sm:text-[16px] lg:text-[19px] leading-[26px] font-semibold tracking-[0.2px] text-wf-brand disabled:opacity-60"
              >
                {{
                  indeksAktif === daftarSoal.length - 1
                    ? menyimpanSoal
                      ? 'MENYIMPAN...'
                      : '+ TAMBAH SOAL'
                    : 'SELANJUTNYA'
                }}
              </button>
            </div>

            <div class="flex items-center gap-3 font-semibold">
              <p class="flex-1 text-[15px] leading-5 tracking-[1px] text-wf-muted">OPSI JAWABAN</p>
              <button
                type="button"
                @click="tambahOpsi"
                :disabled="soal.opsi.length >= MAKS_OPSI"
                class="tombol-aksi"
              >
                + Tambah opsi
              </button>
            </div>

            <ul class="flex flex-col gap-3">
              <li v-for="(_, i) in soal.opsi" :key="i" class="flex items-start gap-3">
                <span class="size-12 shrink-0 flex items-center justify-center bg-wf-muted-surface border border-wf-border rounded-md text-[19px] font-semibold">
                  {{ hurufOpsi(i) }}
                </span>
                <div class="flex-1 min-w-0">
                  <textarea
                    v-model="soal.opsi[i]"
                    rows="1"
                    :aria-label="`Opsi ${hurufOpsi(i)}`"
                    :placeholder="`Isi opsi ${hurufOpsi(i)}`"
                    class="block w-full field-sizing-content min-h-12 resize-none bg-wf-card border border-wf-border rounded-md px-4 py-3 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
                  ></textarea>
                </div>
                <button
                  type="button"
                  @click="hapusOpsi(i)"
                  :disabled="soal.opsi.length <= MIN_OPSI"
                  :aria-label="`Hapus opsi ${hurufOpsi(i)}`"
                  class="mt-2.5 text-[19px] font-semibold text-wf-no disabled:text-wf-border px-1"
                >
                  ✕
                </button>
              </li>
            </ul>

            <div class="flex flex-col gap-2">
              <span class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-muted">PEMBAHASAN</span>
              <textarea
                v-model="soal.pembahasan"
                rows="4"
                placeholder="Jelaskan mengapa jawaban tersebut benar."
                class="w-full field-sizing-content min-h-32 resize-y bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
              ></textarea>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                @click="tambahSoal"
                :disabled="menyimpan || menyimpanSoal"
                class="rounded-xl bg-wf-brand-soft border border-wf-brand-border hover:bg-wf-brand hover:text-white px-4 lg:px-5 py-3 text-[16px] lg:text-[19px] leading-[26px] font-semibold tracking-[0.2px] text-wf-brand transition disabled:opacity-60"
              >
                {{ menyimpanSoal ? 'MENYIMPAN SOAL...' : '+ TAMBAH SOAL' }}
              </button>
              <button
                v-if="daftarSoal.length > 1"
                type="button"
                @click="hapusSoalAktif"
                :disabled="menyimpan || menyimpanSoal"
                class="rounded-xl bg-wf-card border border-wf-no-border hover:bg-red-50 px-4 lg:px-5 py-3 text-[16px] lg:text-[19px] leading-[26px] font-semibold tracking-[0.2px] text-wf-no transition disabled:opacity-60"
              >
                HAPUS SOAL {{ indeksAktif + 1 }}
              </button>
            </div>
          </div>

          <!-- Kolom kanan -->
          <aside class="w-full lg:w-[320px] shrink-0 flex flex-col gap-5">
            <div class="bg-wf-card border border-wf-border-subtle rounded-xl p-5 flex flex-col gap-3">
              <p class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-muted">NAVIGASI SOAL</p>
              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="(_, i) in daftarSoal"
                  :key="i"
                  type="button"
                  @click="pindahKe(i)"
                  :aria-current="i === indeksAktif ? 'step' : undefined"
                  :aria-label="`Soal ${i + 1}`"
                  class="h-12 rounded-md text-[19px] font-semibold"
                  :class="kelasNomor(i)"
                >
                  {{ i + 1 }}
                </button>
                <button
                  type="button"
                  @click="tambahSoal"
                  :disabled="menyimpan || menyimpanSoal"
                  aria-label="Tambah soal"
                  class="h-12 rounded-md border border-dashed border-wf-brand-border text-[19px] font-semibold text-wf-brand disabled:opacity-60"
                >
                  +
                </button>
              </div>
              <p class="text-[15px] lg:text-[17px] leading-6 text-wf-muted">
                {{ daftarSoal.length }} soal · {{ jumlahLengkap }} lengkap
              </p>
            </div>

            <div class="bg-wf-card border border-wf-border-subtle rounded-xl p-5 flex flex-col gap-3">
              <p class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-muted">PENGATURAN SOAL</p>
              <label for="kesulitan" class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-secondary">
                TINGKAT KESULITAN
              </label>
              <select
                id="kesulitan"
                v-model="soal.difficulty"
                class="bg-wf-card border border-wf-border rounded-md px-4 py-3 text-[17px] lg:text-[19px] leading-[26px] focus:outline-none focus:ring-2 focus:ring-wf-brand"
              >
                <option v-for="t in TINGKAT_KESULITAN" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>

            <fieldset class="min-w-0 bg-wf-card border border-wf-border-subtle rounded-xl p-5 flex flex-col gap-3">
              <legend class="sr-only">Jawaban yang benar</legend>
              <p class="text-[15px] leading-5 font-semibold tracking-[1px] text-wf-muted">JAWABAN YANG BENAR</p>
              <p class="text-[15px] lg:text-[17px] leading-6 text-wf-secondary">Pilih satu opsi sebagai jawaban benar.</p>
              <label
                v-for="(teks, i) in soal.opsi"
                :key="i"
                class="flex items-start gap-2.5 px-3.5 py-3 rounded-md cursor-pointer"
                :class="soal.kunci === i ? 'bg-wf-brand-soft border-2 border-wf-brand' : 'bg-wf-card border border-wf-border-subtle'"
              >
                <input
                  v-model="soal.kunci"
                  type="radio"
                  name="kunci"
                  :value="i"
                  :aria-label="`Opsi ${hurufOpsi(i)} benar`"
                  class="sr-only"
                />
                <span class="size-5 shrink-0 mt-0.5">
                  <img v-if="soal.kunci === i" :src="radioCheckedIcon" alt="" class="size-full" />
                  <span v-else class="block size-full rounded-full border border-wf-border"></span>
                </span>
                <span class="text-[19px] leading-[26px] font-semibold">{{ hurufOpsi(i) }}</span>
                <span
                  class="flex-1 min-w-0 break-words text-[15px] lg:text-[17px] leading-6"
                  :class="soal.kunci === i ? 'text-wf-text' : 'text-wf-muted'"
                >
                  {{ intisari(teks) || '(kosong)' }}
                </span>
              </label>
            </fieldset>
          </aside>
        </div>
      </section>

      <!-- ════════ DOKUMEN ════════ -->
      <section
        v-else
        class="bg-wf-card border border-wf-border-subtle rounded-md shadow-sm p-6 flex flex-col gap-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex-1 min-w-[260px] flex flex-col gap-1">
            <h2 class="text-[22px] leading-[30px] font-semibold">Unggah dokumen kuis</h2>
            <p class="text-[17px] leading-6 text-wf-secondary">
              Lampirkan PDF berisi soal, kunci jawaban, dan pembahasan. Soal diekstrak otomatis dari rentang halaman yang dipilih.
              Pakai template soal supaya isinya terbaca dengan benar.
            </p>
          </div>
          <a :href="TEMPLATE_SOAL_URL" target="_blank" rel="noopener noreferrer" class="tombol-aksi shrink-0">
            <!-- Ikon external-link dari Lucide, warnanya mengikuti teks -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-4 shrink-0"
              aria-hidden="true"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
            Template soal
            <span class="sr-only">(buka di tab baru)</span>
          </a>
        </div>

        <p v-if="errorMsg" role="alert" class="rounded-md bg-red-50 border border-wf-no-border px-4 py-3 text-[15px] text-wf-no-text">
          {{ errorMsg }}
        </p>

        <div class="flex flex-wrap gap-4">
          <label class="flex flex-col gap-2 flex-1 min-w-[260px]">
            <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">NAMA KUIS</span>
            <input
              v-model="info.judul"
              type="text"
              placeholder="mis. Huruf Kapital"
              class="border border-wf-border rounded-md p-4 text-[17px] leading-6 placeholder:text-wf-muted focus:outline-none focus:ring-2 focus:ring-wf-brand"
            />
          </label>
          <label class="flex flex-col gap-2 w-full sm:w-[260px]">
            <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">BAB</span>
            <select
              v-model="info.idBab"
              class="bg-wf-card border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
            >
              <option :value="null" disabled>Pilih bab</option>
              <option v-for="bab in daftarBab" :key="bab.idBab" :value="bab.idBab">{{ bab.namaBab }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-2 w-full sm:w-[160px]">
            <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">DURASI (MENIT)</span>
            <input
              v-model.number="info.durasi"
              type="number"
              min="1"
              step="1"
              class="border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
            />
          </label>
        </div>

        <div class="flex flex-col gap-2">
          <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">DOKUMEN PDF</span>
          <label
            @dragover.prevent="sedangSeret = true"
            @dragleave="sedangSeret = false"
            @drop.prevent="saatDrop"
            class="flex flex-col items-center gap-2 p-7 rounded-md border border-dashed cursor-pointer text-center"
            :class="sedangSeret ? 'bg-wf-brand-soft border-wf-brand' : 'bg-wf-muted-surface border-wf-border'"
          >
            <input
              ref="inputBerkas"
              type="file"
              accept=".pdf,application/pdf"
              class="sr-only"
              @change="pilihBerkas($event.target.files[0])"
            />
            <span class="size-7"><img :src="fileUpIcon" alt="" class="size-full" /></span>
            <span class="text-[17px] leading-6 text-wf-secondary">Seret berkas ke sini atau klik untuk memilih</span>
            <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-muted">PDF · maksimal 50 MB</span>
          </label>
          <p v-if="errorBerkas" role="alert" class="text-[15px] text-wf-no">{{ errorBerkas }}</p>
        </div>

        <div v-if="berkas" class="flex items-center gap-4 p-4 border border-wf-border rounded-md">
          <span class="size-12 shrink-0 flex items-center justify-center bg-wf-brand-soft rounded-md text-[13px] font-bold text-wf-brand uppercase">
            {{ ekstensi(berkas.name) }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[17px] leading-6 font-semibold truncate">{{ berkas.name }}</p>
            <p class="text-[15px] leading-6 text-wf-muted">{{ formatUkuran(berkas.size) }}</p>
          </div>
          <div class="flex gap-3">
            <a
              :href="urlBerkas"
              :download="berkas.name"
              class="flex flex-col gap-1.5 px-3 py-2 border border-wf-border rounded-md text-[15px] text-wf-brand"
            >
              <span class="size-4"><img :src="downloadIcon" alt="" class="size-full" /></span>
              Unduh
            </a>
            <button
              type="button"
              @click="hapusBerkas"
              class="flex flex-col items-start gap-1.5 px-3 py-2 border border-wf-border rounded-md text-[15px] text-wf-secondary"
            >
              <span class="size-4"><img :src="trashIcon" alt="" class="size-full" /></span>
              Hapus
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-4">
          <label class="flex flex-col gap-2 w-full sm:w-[200px]">
            <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">HALAMAN AWAL</span>
            <input
              v-model.number="halamanAwal"
              type="number"
              min="1"
              step="1"
              class="border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
            />
          </label>
          <label class="flex flex-col gap-2 w-full sm:w-[200px]">
            <span class="font-mono text-[15px] leading-5 tracking-[1px] text-wf-secondary">HALAMAN AKHIR</span>
            <input
              v-model.number="halamanAkhir"
              type="number"
              min="1"
              step="1"
              class="border border-wf-border rounded-md p-4 text-[17px] leading-6 focus:outline-none focus:ring-2 focus:ring-wf-brand"
            />
          </label>
          <p class="self-end text-[13px] text-wf-muted pb-4">
            Isi rentang halaman yang memuat blok "Nomor Soal", "Soal", "Kunci Jawaban", dan "Pembahasan".
          </p>
        </div>

        <!-- Laporan hasil impor dari backend -->
        <div v-if="hasilImpor" class="rounded-md border border-wf-border p-4 flex flex-col gap-2">
          <p class="text-[17px] font-semibold">{{ hasilImpor.message }}</p>
          <ul v-if="hasilImpor.gagal?.length" class="text-[15px] text-wf-no-text list-disc pl-5">
            <li v-for="g in hasilImpor.gagal" :key="g.nomor">Soal {{ g.nomor }}: {{ g.alasan }}</li>
          </ul>
          <button
            v-if="hasilImpor.berhasil?.length"
            type="button"
            class="self-start underline font-semibold text-wf-brand"
            @click="lanjutKeKelola"
          >
            Lanjut ke Kelola Kuis
          </button>
        </div>

        <div class="h-px bg-wf-border-subtle"></div>

        <div class="flex justify-end gap-4">
          <button
            type="button"
            @click="batal"
            class="rounded-xl bg-wf-card border border-wf-brand-border px-6 py-4 text-[18px] leading-6 font-semibold tracking-[0.2px] text-wf-brand"
          >
            BATAL
          </button>
          <button
            type="button"
            @click="simpanDokumen"
            :disabled="menyimpan || !berkas"
            class="rounded-xl bg-wf-accent hover:bg-wf-accent-hover px-6 py-4 text-[18px] leading-6 font-semibold tracking-[0.2px] text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[190px]"
          >
            {{ menyimpan ? 'MENGEKSTRAK...' : 'SIMPAN SOAL' }}
          </button>
        </div>
      </section>
    </main>
  </div>
</template>