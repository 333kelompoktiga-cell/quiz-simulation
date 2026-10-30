# Batas percobaan kuis

Jalankan `20261029_maks_percobaan.sql` di Supabase SQL Editor sebelum menjalankan backend baru. Migrasi ini membutuhkan migrasi pengerjaan kuis dan acak soal sebelumnya. Refresh schema cache PostgREST jika fungsi baru belum terbaca.

- `Kuis.maksPercobaan` berupa integer 1–3, default 1, berlaku sama untuk setiap mahasiswa pada kuis itu.
- POST/PUT `/api/kuis` menerima `maksPercobaan` sebagai angka JSON. Nilai di luar 1–3, pecahan, null, dan string ditolak dengan HTTP 400.
- Dosen yang memiliki hak mengelola kuis dapat mengubah batas dari editor kuis, termasuk saat membuat kuis lewat dokumen.
- Satu percobaan terpakai saat pengerjaan baru dibuat. Salah key tidak menghabiskan jatah; refresh melanjutkan pengerjaan aktif tanpa memakai jatah baru.
- Setelah key benar, backend memakai RPC `mulai_pengerjaan_kuis` untuk memeriksa jatah dan membuat pengerjaan secara atomik. RPC hanya dapat dijalankan service_role. Permintaan bersamaan untuk kuis yang sama diserialkan dengan kunci baris kuis.
- Jatah habis menghasilkan HTTP 403, kode `BATAS_PERCOBAAN_TERCAPAI`. Melanjutkan pengerjaan aktif tetap diizinkan meskipun batas diturunkan atau kuis ditutup.
- Riwayat lama tidak dihapus. Seluruh pengerjaan yang sudah ada dihitung terhadap batas baru; default 1 dapat langsung menghabiskan jatah mahasiswa yang sudah pernah mengerjakan.
- Timestamp tetap di `PengerjaanKuis.waktuMulai` dan `waktuSelesai`, diisi database saat mulai dan submit. Tidak ada kolom timestamp tambahan.
- Daftar kuis membawa `jumlahPercobaan`, `sisaPercobaan`, `adaPercobaanAktif`, dan `bisaMengerjakan`. Sisa percobaan tidak termasuk pengerjaan aktif yang sudah dimulai.

## Verifikasi integrasi setelah migrasi

1. Buat kuis dengan batas 1 dan gunakan mahasiswa yang belum pernah mengerjakannya. Key salah tidak membuat pengerjaan; key benar membuat attempt 1 dengan waktu mulai.
2. Refresh saat pengerjaan aktif: ID dan waktu mulai tetap sama. Submit mengisi waktu selesai. Mulai lagi dengan key benar harus ditolak.
3. Naikkan batas menjadi 3: izinkan attempt 2 dan 3, tolak attempt 4. Mahasiswa lain mempunyai jatah sendiri.
4. Kirim dua permintaan mulai bersamaan dengan key benar: keduanya mendapatkan ID pengerjaan aktif yang sama, hanya satu baris baru dibuat.
5. Turunkan batas saat pengerjaan aktif: mahasiswa tetap bisa melanjutkan dan submit, tetapi tidak bisa memulai percobaan baru setelah jatahnya habis.
6. Pastikan mahasiswa/dosen tanpa hak kelola tidak dapat mengubah batas; batas 0, 4, pecahan, null, dan string ditolak.

Tes integrasi ini memerlukan database dengan migrasi terpasang; tes unit yang sudah ada tidak memverifikasi RPC PostgreSQL.
