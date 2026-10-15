Use Case kelar (backend):
Detail endpoint ada di docs/API.md

Super Admin:
1. Melihat List Akun
2. Hapus Akun
3. Menambahkan Akun

All User:
1. Login
2. Reset Password
3. Logout
4. Melihat Akun (GET /api/auth/me)
5. Mengedit Akun: nama & username (PUT /api/auth/me)

Pengguna/Mahasiswa:
1. Melihat Soal (tanpa kunci jawaban & pembahasan, setelah memasukkan PIN kuis)
2. Mengerjakan Kuis: mulai dengan PIN, simpan jawaban, submit (POST /api/pengerjaan)
3. Melihat hasil & pembahasan satu kuis yang sudah dikerjakan, dinilai fuzzy logic (GET /api/pengerjaan/:id, /:id/pembahasan)
4. Mengganti & menghapus foto profil (PUT/DELETE /api/mahasiswa/profil/foto)

Admin:
1. Melihat Bab
2. Menambahkan Bab
3. Mengedit Bab (semua dosen)
4. Menghapus Bab (semua dosen, hanya kalau bab tidak berisi kuis)
5. Melihat Kuis
6. Menambahkan Kuis
7. Mengedit Kuis (hanya dosen pembuat)
8. Menghapus Kuis (hanya dosen pembuat)
9. Melihat Soal
10. Menambahkan Soal
11. Mengedit Soal
12. Menghapus Soal
13. Mengatur PIN Kuis

Yang Belum Kelar (backend):
Pengguna:
2. Melihat Report Mahasiswa: riwayat & statistik semua kuis (hasil per kuis sudah ada, daftar riwayat belum)

Admin:
1. Melihat Report Mahasiswa: rekap nilai mahasiswa yang mengerjakan kuisnya
edit Akun
3. Melihat Report Mahasiswa

Yang harus dibaikin after asist ke ibunya:
1. Hak Akses kuis untuk akun dosen
2. Random urutan soal yang sudah dibuat
