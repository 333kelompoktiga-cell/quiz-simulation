# Backend

Dokumentasi semua endpoint: **[docs/API.md](../docs/API.md)**

## Menjalankan

1. Salin `.env.example` menjadi `.env`, lalu isi kunci Supabase.
2. `npm install`
3. `npm run dev`, server jalan di `http://localhost:3000`

Migrasi database ada di `docs/` dan `docs/migrations/`. Database Supabase dipakai bersama
satu tim, jadi tiap migrasi cukup dijalankan **sekali oleh satu orang** di SQL Editor.

## Membuat akun untuk tes

Cara paling mudah: login sebagai Super Admin, lalu `POST /api/account` (lihat docs/API.md).

Kalau belum ada Super Admin sama sekali:

1. Supabase → Authentication → Users → Add user → Create new user.
   Isi email dan password, **centang "Auto Confirm User"**, lalu salin User UID-nya.
2. Buka SQL Editor, jalankan:

```sql
INSERT INTO public."User" ("idUser", nama, username, role)
VALUES ('UID-YANG-DISALIN', 'Nama Penguji', 'username', 'Super Admin');
```

Nilai `role` harus persis salah satu dari: `'Super Admin'`, `'Admin'` (dosen), `'Mahasiswa'`.

## Reset password

1. `POST /api/auth/forgot-password` dengan `{ "email": "..." }`
2. Buka tautan di email, lalu isi password baru di halaman yang muncul
3. Login dengan password baru
