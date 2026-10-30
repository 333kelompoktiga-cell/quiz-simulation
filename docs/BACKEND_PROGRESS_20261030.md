# Backend: filter superadmin, lanjut kuis, satu sesi login

Jalankan `20261030_backend_superadmin_sesi_progress.sql` di SQL Editor Supabase setelah migrasi 20261029 dan sebelum deploy backend. Migrasi belum diterapkan otomatis. Sesi login lama tanpa sessionId ditutup sekali, sehingga pengguna perlu login ulang. Fungsi SQL hanya dapat dipanggil service_role.

## Filter dan pagination

Path mengikuti route yang sudah ada. Semua respons daftar tetap memakai `data` array. Khusus superadmin ditambahkan `pagination: { page, limit, total, totalPages }` di level teratas.

- GET daftar bab: `?search=aljabar&dibuatOleh=<uuid>&page=1&limit=10`. search mencari namaBab.
- GET daftar kuis: `?search=latihan&idBab=<uuid>&idUser=<uuid>&page=1&limit=10`. search mencari judul; idUser adalah dosen pembuat.
- GET daftar akun: `?search=andi&role=Mahasiswa&page=1&limit=10`. search mencari nama, username, atau email; role yang diterima Admin dan Mahasiswa.

page default 1, limit default 10. Permintaan limit lebih besar dibatasi 10; angka nol, negatif, pecahan, atau bukan angka ditolak 400. Total dihitung setelah filter. Daftar bab dan kuis untuk role selain superadmin tetap memakai perilaku tanpa pagination.

## Melanjutkan pengerjaan

POST pengerjaan dengan `{ "idKuis": "<uuid>" }` melanjutkan attempt berlangsung tanpa PIN. PIN tetap wajib untuk percobaan baru. Respons berisi soal sesuai urutan tersimpan, jawaban tersimpan, waktuMulai asli, dan `pengerjaan.soalTerakhir` (null jika belum disimpan).

PUT `/:idPengerjaan/jawaban` menerima tambahan `soalTerakhir` berupa UUID soal dalam attempt itu. Contoh `{ "soalTerakhir": "<uuid>", "jawaban": [] }`. Field jawaban boleh tidak dikirim untuk hanya menyimpan posisi. Hanya pemilik attempt berlangsung yang dapat menyimpan. Posisi tersedia kembali melalui POST pengerjaan. Daftar kuis juga menyediakan `idPengerjaanAktif` dan `adaPercobaanAktif`.

Bagian frontend: memanggil penyimpanan saat berpindah soal, memuat attempt aktif saat kembali, lalu menavigasi ke soalTerakhir. Backend tidak mengatur URL/browser atau mengalihkan halaman. Progres yang belum dikirim ke server tidak dapat dipulihkan.

## Satu perangkat

Login baru saat akun punya sesi aktif ditolak HTTP 409 dengan code AKUN_SEDANG_LOGIN. Perangkat lama tetap aktif dan harus logout dahulu. Tab ditutup tidak dianggap logout. Refresh token mempertahankan session_id sehingga tidak membutuhkan login ulang. Middleware dan refresh memeriksa session_id yang terdaftar, bukan sekadar status aktif akun. Logout token lama tidak boleh menutup sesi perangkat baru. Reset password tetap menjadi jalur pemulihan jika perangkat lama tidak bisa diakses.

Pembatasan memakai identitas sesi autentikasi, bukan fingerprint perangkat fisik. Sesi/token yang sengaja disalin ke perangkat lain tetap identitas yang sama.
