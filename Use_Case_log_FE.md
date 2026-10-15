# Use Case Log Frontend

Penanda halaman frontend yang sudah dibuat, berdasarkan daftar use case di `Use_Case_log.md`.
Pembagian "kelar" dan "belum kelar" tetap mengikuti `Use_Case_log.md`. Kolom **Status FE** menunjukkan kondisi halaman di frontend (branch `frontend`, per 8 Oktober 2026).

Keterangan Status FE:
- **Selesai**: halaman sudah ada dan tersambung ke backend.
- **Sebagian**: halaman sudah ada, tapi sebagian data masih contoh atau belum tersimpan ke server.
- **Belum**: halaman belum dibuat.

## Use Case kelar

### Super Admin

| No | Use Case | Status FE | Halaman | Dikerjakan | Catatan |
|---|---|---|---|---|---|
| 1 | Melihat List Akun | Selesai | `/akun` (Kelola Akun) | Ojan | |
| 2 | Hapus Akun | Selesai | `/akun`, tombol Hapus | Ojan | |
| 3 | Menambahkan Akun | Selesai | `/akun`, tombol + Tambah Akun | Ojan | |

### All User

| No | Use Case | Status FE | Halaman | Dikerjakan | Catatan |
|---|---|---|---|---|---|
| 1 | Login | Selesai | `/` (Login) | Ojan | |
| 2 | Reset Password | Selesai | `/`, tombol Lupa Password. Halaman ganti password dari backend | Ojan | |
| 3 | Logout | Selesai | Ikon keluar di header admin, menu profil mahasiswa | Ojan (admin), Anitya (mahasiswa) | |
| 4 | Melihat Akun (GET /api/auth/me) | Sebagian | `/profil` (mahasiswa) | Anitya | Admin dan Super Admin belum punya halaman akun, baru nama di header |
| 5 | Mengedit Akun: nama & username (PUT /api/auth/me) | Belum | - | - | Fungsi `updateProfile` sudah ada di `services/auth.js`, belum dipakai halaman mana pun |

### Pengguna/Mahasiswa

| No | Use Case | Status FE | Halaman | Dikerjakan | Catatan |
|---|---|---|---|---|---|
| 1 | Melihat Soal (tanpa kunci jawaban & pembahasan, setelah memasukkan PIN kuis) | Selesai | `/latihan/:id` (daftar kuis per bab), `/kuis/:id/kerjakan` (pop-up PIN) | Anitya | Kartu kuis menampilkan nama dosen pembuat (Ojan) |
| 2 | Mengerjakan Kuis: mulai dengan PIN, simpan jawaban, submit (POST /api/pengerjaan) | Selesai | `/kuis/:id/kerjakan` | Anitya | |
| 3 | Melihat hasil & pembahasan satu kuis yang sudah dikerjakan, dinilai fuzzy logic | Selesai | `/kuis/:id/hasil`, `/kuis/:id/diagnostik` | Anitya | Halaman `/kuis/:id/pembahasan` masih membaca hasil dari browser dan memanggil `GET /kuis/:id/soal` yang khusus dosen |
| 4 | Mengganti & menghapus foto profil | Sebagian | `/profil/edit-foto` | Anitya | Foto masih disimpan di browser, belum dikirim ke endpoint foto profil |

### Admin

| No | Use Case | Status FE | Halaman | Dikerjakan | Catatan |
|---|---|---|---|---|---|
| 1 | Melihat Bab | Selesai | `/bab` (Kelola Bab) | Ojan | Kartu bab bisa diklik, menampilkan jumlah kuis dan nama pembuat |
| 2 | Menambahkan Bab | Selesai | `/bab/tambah` | Ojan | |
| 3 | Mengedit Bab (semua dosen) | Selesai | `/bab/:id/edit` | Ojan | |
| 4 | Menghapus Bab (semua dosen, hanya kalau bab tidak berisi kuis) | Selesai | `/bab`, tombol Hapus | Ojan | |
| 5 | Melihat Kuis | Selesai | `/bab/:id/kuis` (klik kartu bab) | Ojan | Menampilkan nama dosen pembuat tiap kuis |
| 6 | Menambahkan Kuis | Selesai | `/kuis/tambah` | Ojan | |
| 7 | Mengedit Kuis (hanya dosen pembuat) | Selesai | `/kuis/:id/edit` | Ojan | Kuis dosen lain hanya bisa dilihat, muncul halaman "Kuis ini milik ..." |
| 8 | Menghapus Kuis (hanya dosen pembuat) | Selesai | `/bab/:id/kuis`, tombol Hapus | Ojan | Tombol Hapus hanya muncul di kuis sendiri |
| 9 | Melihat Soal | Selesai | `/kuis/:id/soal` (Edit Soal) | Ojan | |
| 10 | Menambahkan Soal | Selesai | `/kuis/tambah`, `/kuis/:id/soal` | Ojan | |
| 11 | Mengedit Soal | Selesai | `/kuis/:id/soal` | Ojan | |
| 12 | Menghapus Soal | Selesai | `/kuis/:id/soal`, tombol Hapus Soal | Ojan | |
| 13 | Mengatur PIN Kuis | Selesai | `/bab/:id/kuis`, tombol Password | Ojan | Pop-up untuk melihat, menyalin, dan membuat password kuis |

## Yang Belum Kelar

### Pengguna

| No | Use Case | Status FE | Halaman | Dikerjakan | Catatan |
|---|---|---|---|---|---|
| 1 | Melihat Roadmap | Sebagian | `/peta-belajar`, `/peta-belajar/:id/roadmap` | Anitya | Tahap roadmap disusun di frontend dari hasil kuis terakhir, endpoint roadmap belum ada |
| 2 | Melihat Report Mahasiswa: riwayat & statistik semua kuis | Sebagian | `/statistik` | Anitya | Daftar bab dari backend, nilai masih data contoh karena endpoint riwayat belum ada |

### Admin

| No | Use Case | Status FE | Halaman | Dikerjakan | Catatan |
|---|---|---|---|---|---|
| 1 | Melihat Report Mahasiswa: rekap nilai mahasiswa yang mengerjakan kuisnya | Belum | - | - | Menu Rekap di header admin masih teks (wireframe HA5 Rekap nilai) |

## Halaman pendukung

| Halaman | Isi | Dikerjakan |
|---|---|---|
| `/dashboard` | Latihan: daftar bab untuk mahasiswa | Anitya |
| Header admin dan mahasiswa | Navigasi, logo, nama pengguna, tombol keluar | Ojan (admin), Anitya (mahasiswa) |
| Tombol Kembali dan breadcrumb | Tombol kembali di halaman admin, breadcrumb 18px di halaman admin dan mahasiswa | Ojan |
