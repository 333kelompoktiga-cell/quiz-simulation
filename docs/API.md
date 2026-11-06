# Dokumentasi API Backend

Rangkuman semua endpoint backend, ditulis dari kode yang berjalan. Kalau ada yang tidak
cocok dengan perilaku server, yang benar adalah kodenya. Kabari tim backend supaya
dokumen ini diperbaiki.

- **Base URL lokal:** `http://localhost:3000/api`
- **Format body:** JSON (`Content-Type: application/json`), kecuali upload foto (form-data)
- Semua ID berupa **UUID**.

## Daftar isi

1. [Aturan umum](#1-aturan-umum)
2. [Auth](#2-auth--apiauth)
3. [Akun (Super Admin)](#3-akun-super-admin--apiaccount)
4. [Bab](#4-bab--apibab)
5. [Kuis](#5-kuis--apikuis)
6. [Soal](#6-soal)
7. [Pengerjaan kuis (Mahasiswa)](#7-pengerjaan-kuis-mahasiswa--apipengerjaan)
8. [Foto profil (Mahasiswa)](#8-foto-profil-mahasiswa--apimahasiswa)

---

## 1. Aturan umum

### Bentuk respons

Semua respons memakai bentuk yang sama:

```json
{ "status": "success", "message": "Berhasil mengambil daftar bab.", "data": { } }
```

```json
{ "status": "error", "message": "Kuis tidak ditemukan." }
```

`data` tidak ada kalau tidak ada yang dikembalikan, misalnya pada hapus. Beberapa error
membawa `code` supaya frontend tidak perlu mencocokkan teks pesan, misalnya `PIN_SALAH`.

### Login dan token

Endpoint bertanda 🔒 butuh header:

```
Authorization: Bearer <token>
```

`token` didapat dari login dan berlaku sekitar **60 menit**. Perbarui sebelum habis
dengan `POST /auth/refresh`.

### Role

| Role | Nilai di `user.role` | Keterangan |
|---|---|---|
| Super Admin | `"Super Admin"` | Mengelola akun |
| Dosen | `"Admin"` | Mengelola bab, kuis, soal |
| Mahasiswa | `"Mahasiswa"` | Mengerjakan kuis |

Super Admin **tidak** bisa memakai endpoint khusus dosen.

### Error yang bisa muncul di semua endpoint 🔒

| Status | Pesan | Arti |
|---|---|---|
| 401 | Token akses tidak ditemukan. | Header `Authorization` tidak dikirim |
| 401 | Token tidak valid atau sudah kedaluwarsa. | Perlu refresh atau login ulang |
| 401 | Sesi tidak aktif. Silakan login terlebih dahulu. | Sudah logout, atau akun login di perangkat lain |
| 403 | Hanya admin (guru) / mahasiswa yang dapat ... | Role tidak sesuai |
| 404 | Profil pengguna tidak ditemukan. | Akun auth ada, tapi profil di tabel `User` tidak ada |

**Satu akun hanya bisa aktif di satu perangkat.** Login di perangkat lain membuat sesi
lama mendapat 401 "Sesi tidak aktif".

---

## 2. Auth — `/api/auth`

### `POST /auth/login`

```json
{ "email": "11231001@student.itk.ac.id", "password": "Rahasia#123" }
```

Respons 200:

```json
{
  "token": "eyJ...",
  "refresh_token": "abc...",
  "expires_at": 1767000000,
  "previous_session_ended": false,
  "user": {
    "id_user": "uuid",
    "email": "11231001@student.itk.ac.id",
    "nama": "Budi Santoso",
    "username": "11231001",
    "nickname": "11231001",
    "role": "Mahasiswa",
    "foto_profil": "https://.../foto-profil/uuid/1759.jpg"
  }
}
```

- `previous_session_ended: true` berarti ada sesi di perangkat lain yang baru saja diputus.
- `foto_profil` bernilai `null` kalau belum punya foto.

| Status | Arti |
|---|---|
| 400 | Email atau password kosong |
| 401 | Email atau password salah |
| 404 | Profil tidak ditemukan, hubungi admin |
| 429 | Terlalu banyak percobaan gagal: 30 per IP atau 8 per email dalam 15 menit |

### `POST /auth/refresh`

```json
{ "refresh_token": "abc..." }
```

Respons 200: `{ "token", "refresh_token", "expires_at" }`. **Simpan kedua token yang baru.**
401 berarti sesi sudah berakhir, arahkan ke login.

### `POST /auth/logout`

Kirim header `Authorization`. Tanpa body. Selalu 200, termasuk kalau sesinya memang sudah
tidak aktif.

### `GET /auth/me` 🔒

Untuk mengecek sesi saat halaman dimuat. Respons: `{ "user": { ...sama seperti login } }`.

### `PUT /auth/me` 🔒

Mengubah nama dan username sendiri. Semua role.

```json
{ "nama": "Budi Santoso", "username": "budi.s" }
```

- `username`: 3–30 karakter, hanya huruf, angka, `.`, `_`, `-`.
- 409 kalau username sudah dipakai orang lain.
- Respons: `{ "user": {...} }`, **tanpa** `foto_profil`. Ambil ulang lewat `GET /auth/me`
  kalau perlu.

### Reset password

| Endpoint | Keterangan |
|---|---|
| `POST /auth/forgot-password` `{ "email" }` | Mengirim email tautan reset. Maks 3 kali per jam per email (429) |
| `GET /auth/reset-password-page` | Halaman HTML yang dibuka dari tautan di email, dilayani backend |
| `POST /auth/reset-password` | Dipanggil dari halaman di atas, bukan dari frontend |

Frontend cukup memanggil `forgot-password`. Sisanya ditangani halaman dari backend.
Password baru minimal 8 karakter, wajib ada huruf besar, huruf kecil, angka, dan simbol
`@ # $ ! _ -`.

> Respons 429 dari `forgot-password` karena batas email Supabase berbentuk
> `{ "success": false, "code": "over_email_send_rate_limit", "message": "..." }`,
> **bukan** bentuk standar `status/message`.

---

## 3. Akun (Super Admin) — `/api/account`

Semua 🔒 **khusus Super Admin**.

### `GET /account`

Daftar akun Dosen dan Mahasiswa (Super Admin tidak ikut).

```json
[{ "id": "uuid", "nama": "Budi Santoso", "email": "budi@...", "role": "Mahasiswa" }]
```

### `POST /account`

```json
{ "nama": "Budi Santoso", "email": "budi@student.itk.ac.id", "role": "Mahasiswa", "password": "Rahasia#123" }
```

- `role`: `"Admin"` atau `"Mahasiswa"`, persis dengan huruf besarnya.
- `username` dibuat otomatis dari bagian email sebelum `@`.
- Password mengikuti aturan reset password di atas.
- Respons 201: `{ "id", "nama", "email", "role" }`. Akun langsung bisa dipakai login.

### `DELETE /account/:id`

| Status | Arti |
|---|---|
| 400 | Mencoba menghapus akun sendiri |
| 403 | Akun Super Admin tidak bisa dihapus |
| 404 | Akun tidak ditemukan |
| 409 | Akun sedang online, tunggu sampai logout |

Bab dan kuis buatan dosen yang dihapus **tetap ada**, tanpa pemilik, dan bisa dikelola
dosen mana pun.

---

## 4. Bab — `/api/bab`

**Bab dipakai bersama semua dosen.** Satu bab bisa berisi kuis dari banyak dosen.

| Method | URL | Siapa |
|---|---|---|
| GET | `/bab` | 🔒 Semua role |
| GET | `/bab/:id` | 🔒 Semua role |
| POST | `/bab` | 🔒 Dosen |
| PUT | `/bab/:id` | 🔒 Dosen mana pun |
| DELETE | `/bab/:id` | 🔒 Dosen mana pun, asal bab sudah kosong |

### Objek bab

```json
{
  "idBab": "uuid",
  "namaBab": "Ejaan",
  "deskripsi": "Materi ejaan bahasa Indonesia",
  "urutanBab": 1,
  "dibuatOleh": "uuid-dosen",
  "tanggalDibuat": "2026-10-01T03:00:00+00:00",
  "tanggalDiupdate": "2026-10-01T03:00:00+00:00"
}
```

`GET /bab` diurutkan berdasarkan `urutanBab`. `dibuatOleh` hanya catatan siapa yang
membuat (bisa `null`), **tidak** membatasi siapa yang boleh mengubah.

### `POST /bab` dan `PUT /bab/:id`

```json
{ "namaBab": "Ejaan", "deskripsi": "...", "urutanBab": 1 }
```

- `POST`: `namaBab` wajib. `deskripsi` dan `urutanBab` opsional (default `0`).
- `PUT`: kirim field yang mau diubah saja.
- `urutanBab` harus angka bulat ≥ 0, **bukan** teks `"1"`.

| Status | Arti |
|---|---|
| 400 | Nama kosong atau `urutanBab` tidak valid |
| 404 | Bab tidak ditemukan |
| 409 | Nama bab sudah ada. Tidak membedakan huruf besar/kecil: `"Ejaan"` = `"ejaan "` |

### `DELETE /bab/:id`

| Status | Arti |
|---|---|
| 409 | `Bab "Ejaan" masih berisi 2 kuis. Hapus semua kuisnya terlebih dahulu.` |
| 409 | Bab masih dipakai hasil analisis mahasiswa |

---

## 5. Kuis — `/api/kuis`

**Kuis milik dosen pembuatnya.** Hanya pembuatnya yang bisa mengubah, menghapus, dan
mengelola soalnya. Kalau akun pembuat sudah dihapus, dosen mana pun bisa mengelolanya.

| Method | URL | Siapa |
|---|---|---|
| GET | `/kuis` atau `/kuis?idBab=uuid` | 🔒 Semua role |
| GET | `/kuis/:id` | 🔒 Semua role |
| POST | `/kuis` | 🔒 Dosen |
| PUT | `/kuis/:id` | 🔒 Dosen pembuat |
| DELETE | `/kuis/:id` | 🔒 Dosen pembuat |

### Objek kuis

```json
{
  "idKuis": "uuid",
  "idUser": "uuid-dosen",
  "idBab": "uuid-bab",
  "judul": "Kuis 1",
  "deskripsi": "Latihan ejaan dasar",
  "durasi": 30,
  "tanggalDibuat": "2026-10-01T03:00:00+00:00",
  "namaPembuat": "Dosen A",
  "adaPin": true,
  "bisaDikelola": true,
  "pin": "0420",
  "jumlahSoal": 10
}
```

| Field | Keterangan |
|---|---|
| `durasi` | Menit. Default 30 |
| `namaPembuat` | Nama dosen pembuat, `null` kalau akunnya sudah dihapus. Tampilkan misalnya "Kuis 1 – Dosen A" |
| `adaPin` | `false` = kuis belum dibuka, mahasiswa belum bisa mengerjakan |
| `bisaDikelola` | `true` kalau yang login boleh edit/hapus kuis ini. Kalau `false`, sembunyikan tombol Edit, Hapus, dan Edit Soal |
| `pin` | **Hanya ada** kalau `bisaDikelola: true`. Mahasiswa dan dosen lain tidak menerima field ini |
| `jumlahSoal` | Hanya ada di `GET /kuis` (daftar) |

### `POST /kuis` dan `PUT /kuis/:id`

```json
{ "idBab": "uuid-bab", "judul": "Kuis 1", "deskripsi": "...", "durasi": 30, "pin": "0420" }
```

- `POST`: `idBab` dan `judul` wajib, sisanya opsional.
- `PUT`: kirim field yang mau diubah saja.
- `pin`: **teks** berisi 4–8 digit (`"0420"`, bukan `420`, supaya angka 0 di depan tidak hilang).
  - Tidak dikirim saat membuat: kuis tersimpan tapi belum bisa dikerjakan mahasiswa.
  - `"pin": null` saat update: kuis ditutup, mahasiswa tidak bisa memulai attempt baru.
- `durasi`: angka bulat > 0.

| Status | Arti |
|---|---|
| 400 | Field tidak valid, atau `idBab` tidak ditemukan |
| 403 | Kuis milik dosen lain |
| 404 | Kuis tidak ditemukan |

---

## 6. Soal

Semua endpoint soal **khusus dosen**. Mahasiswa mendapat soal (tanpa kunci jawaban) lewat
[`POST /pengerjaan`](#post-pengerjaan) setelah memasukkan PIN.

### Objek soal

```json
{
  "idSoal": "uuid",
  "idKuis": "uuid-kuis",
  "urutan": 1,
  "pertanyaan": "Manakah kalimat berikut yang efektif?",
  "difficulty": "Mudah",
  "targetTime": 30,
  "poin": null,
  "pembahasan": "\"Hadirin\" sudah bermakna jamak ...",
  "ringkasan": null,
  "opsi": [
    { "idOpsi": "uuid", "opsi": "A. Para hadirin dimohon berdiri.", "isCorrect": false },
    { "idOpsi": "uuid", "opsi": "B. Hadirin dimohon berdiri.", "isCorrect": true }
  ]
}
```

- `difficulty`: `"Mudah"`, `"Sedang"`, `"Sulit"`, atau `null` untuk soal lama. **Isi selalu**,
  karena dipakai penilaian fuzzy. Soal tanpa `difficulty` dinilai sebagai "Sedang".
- `targetTime`: detik, default 60. Dipakai penilaian fuzzy untuk menilai cepat/lambat.
- `opsi` diurutkan berdasarkan teksnya, jadi awali dengan label `A.`, `B.`, dst.

### Body soal (dipakai semua endpoint tulis)

```json
{
  "pertanyaan": "Manakah kalimat berikut yang efektif?",
  "difficulty": "Mudah",
  "targetTime": 30,
  "poin": null,
  "pembahasan": "...",
  "ringkasan": null,
  "opsi": [
    { "opsi": "A. Para hadirin dimohon berdiri.", "isCorrect": false },
    { "opsi": "B. Hadirin dimohon berdiri.", "isCorrect": true }
  ]
}
```

| Field | Aturan |
|---|---|
| `pertanyaan` | Wajib, tidak boleh kosong |
| `difficulty` | Wajib: `Mudah` / `Sedang` / `Sulit` |
| `targetTime` | Opsional, angka bulat ≥ 1 |
| `poin` | Opsional, angka bulat ≥ 0 atau `null` |
| `pembahasan`, `ringkasan` | Opsional, teks atau `null` |
| `opsi` | Wajib, 2–6 opsi, **tepat satu** `isCorrect: true` |

### A. Soal per kuis (dipakai editor soal)

| Method | URL | Keterangan |
|---|---|---|
| GET | `/kuis/:idKuis/soal` | 🔒 Dosen. Semua soal kuis, urut sesuai `urutan` |
| PUT | `/kuis/:idKuis/soal` | 🔒 Dosen pembuat kuis. **Mengganti seluruh soal** kuis |

```json
{ "soal": [ { ...body soal... }, { ...body soal... } ] }
```

- Urutan array menjadi `urutan` soal.
- Semua soal lama dihapus dan diganti dalam satu transaksi. Kalau ada yang gagal, soal lama tetap utuh.
- Error validasi menyebut nomor soalnya: `"Soal 3: Harus ada tepat satu opsi jawaban yang benar."`
- 409 kalau soal kuis ini sudah pernah dikerjakan mahasiswa.

### B. Soal satuan — `/api/soal`

| Method | URL | Keterangan |
|---|---|---|
| GET | `/soal` atau `/soal?idKuis=uuid` | 🔒 Dosen |
| GET | `/soal/:id` | 🔒 Dosen |
| POST | `/soal` | 🔒 Dosen. Body soal + `idKuis` (opsional; tanpa `idKuis` = bank soal) |
| PUT | `/soal/:id` | 🔒 Dosen pembuat kuis. Kirim field yang diubah saja; `opsi` mengganti semua opsi |
| DELETE | `/soal/:id` | 🔒 Dosen pembuat kuis |

| Status | Arti |
|---|---|
| 403 | Soal milik kuis dosen lain |
| 409 | Soal atau opsinya sudah pernah dijawab mahasiswa, tidak bisa dihapus/diganti |

---

## 7. Pengerjaan kuis (Mahasiswa) — `/api/pengerjaan`

Semua 🔒 **khusus Mahasiswa**. Alur:

```
POST /pengerjaan (+PIN)  →  PUT /:id/jawaban (autosave, opsional)  →  POST /:id/submit
                                                                         ↓
                                         GET /:id (hasil)  ·  GET /:id/pembahasan
```

### `POST /pengerjaan`

Memulai attempt baru, atau melanjutkan attempt yang masih `berlangsung`.

```json
{ "idKuis": "uuid-kuis", "pin": "0420" }
```

**PIN hanya dibutuhkan untuk attempt baru.** Melanjutkan attempt (misalnya setelah refresh)
tidak perlu PIN. Alur yang disarankan:

1. Panggil **tanpa** `pin`.
2. Kalau balasannya `code: "PIN_DIBUTUHKAN"`, tampilkan isian PIN.
3. Panggil ulang **dengan** `pin`.

Respons 200:

```json
{
  "pengerjaan": { "idPengerjaan": "uuid", "attempt": 1, "status": "berlangsung", "waktuMulai": "2026-10-06T02:00:00+00:00" },
  "kuis": { "idKuis": "uuid", "judul": "Kuis Kalimat Efektif", "durasi": 30 },
  "soal": [
    {
      "idSoal": "uuid", "urutan": 1, "pertanyaan": "...", "difficulty": "Mudah", "targetTime": 30,
      "opsi": [ { "idOpsi": "uuid", "opsi": "A. ..." } ]
    }
  ],
  "jawaban": [ { "idSoal": "uuid", "idOpsi": "uuid", "responseTime": 18 } ]
}
```

- `soal` **tidak** berisi kunci jawaban maupun pembahasan.
- `jawaban` berisi jawaban yang sudah tersimpan, untuk memulihkan pilihan setelah refresh.

| Status | `code` | Arti |
|---|---|---|
| 400 | | `idKuis` bukan UUID |
| 403 | `PIN_DIBUTUHKAN` | Kirim ulang dengan `pin` |
| 403 | `PIN_SALAH` | PIN tidak cocok |
| 403 | `KUIS_BELUM_DIBUKA` | Dosen belum mengisi PIN |
| 404 | | Kuis tidak ditemukan |
| 409 | | Kuis belum punya soal, atau ada soal tanpa tepat satu kunci |
| 429 | | 10 PIN salah dalam 15 menit. Tunggu 15 menit |

### `PUT /pengerjaan/:idPengerjaan/jawaban`

Autosave jawaban, opsional. Boleh dipanggil berkali-kali; jawaban untuk soal yang sama ditimpa.

```json
{ "jawaban": [ { "idSoal": "uuid", "idOpsi": "uuid", "waktuPengerjaan": 18 } ] }
```

- `waktuPengerjaan`: detik yang dihabiskan di soal itu (0–86400).
- **Jangan** kirim status benar/salah. Backend menilai sendiri dari kunci di database.
- Respons: `{ "idPengerjaan", "jumlahJawabanTersimpan" }`. 409 kalau attempt sudah selesai.

### `POST /pengerjaan/:idPengerjaan/submit`

Body sama seperti simpan jawaban; `jawaban` boleh tidak dikirim kalau sudah di-autosave.
**Soal yang tidak dijawab dihitung salah.** Hasil dinilai dengan fuzzy logic dan tersimpan.

Respons 200:

```json
{
  "idPengerjaan": "uuid",
  "idKuis": "uuid",
  "status": "selesai",
  "nilai": 70,
  "waktuPengerjaan": 412,
  "skorFuzzy": 62.77,
  "kategoriFuzzy": "Sedang",
  "totalSoal": 10,
  "totalBenar": 7,
  "totalSalah": 3,
  "akurasi": 70,
  "rataRataWaktu": 41.2,
  "rekomendasi": "Tingkat pemahaman materi tergolong baik (sedang). ...",
  "distribusiTingkat": { "Sangat Rendah": 0, "Rendah": 3, "Sedang": 2, "Tinggi": 5 },
  "distribusiKesulitan": {
    "Mudah": { "total": 4, "benar": 4, "akurasi": 100, "rataRataSkor": 80.1 },
    "Sedang": { "total": 3, "benar": 3, "akurasi": 100, "rataRataSkor": 65.2 },
    "Sulit": { "total": 3, "benar": 0, "akurasi": 0, "rataRataSkor": 30.5 }
  },
  "detailItems": [ { "nomorSoal": 1, "soalId": "uuid", "crispScore": 86.04, "linguisticLevel": "Tinggi" } ]
}
```

- `nilai` = `akurasi` = persentase jawaban benar (0–100).
- `kategoriFuzzy`: `Sangat Rendah` / `Rendah` / `Sedang` / `Tinggi`. `Tinggi` adalah yang tertinggi.
- `waktuPengerjaan`: detik, dihitung server dari `waktuMulai`, maksimal `durasi` kuis.
- Submit ulang attempt yang sudah selesai mengembalikan hasil yang sama, tidak menilai ulang.
- Rincian `detailItems` dan rumusnya ada di [KONTRAK_INTEGRASI_FUZZY.md](KONTRAK_INTEGRASI_FUZZY.md).

### `GET /pengerjaan/:idPengerjaan`

Hasil attempt yang sudah selesai, dengan bentuk seperti respons submit. Hanya milik
mahasiswa yang login. 409 kalau belum selesai.

### `GET /pengerjaan/:idPengerjaan/pembahasan`

Hanya setelah attempt selesai (403 kalau belum).

```json
[
  {
    "nomorSoal": 1,
    "idSoal": "uuid",
    "pertanyaan": "...",
    "difficulty": "Mudah",
    "opsi": [ { "idOpsi": "uuid", "opsi": "A. ...", "isCorrect": false, "dipilih": true } ],
    "benar": false,
    "responseTime": 18,
    "skorFuzzy": 35.2,
    "pembahasan": "...",
    "ringkasan": null
  }
]
```

---

## 8. Foto profil (Mahasiswa) — `/api/mahasiswa`

Semua 🔒 **khusus Mahasiswa**.

### `PUT /mahasiswa/profil/foto`

Body **`multipart/form-data`** dengan field `foto` bertipe **file**. Jangan isi header
`Content-Type` sendiri; biarkan browser (`FormData`) yang mengisinya.

```js
const form = new FormData();
form.append('foto', fileInput.files[0]);
fetch(`${API}/mahasiswa/profil/foto`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
```

- JPG, PNG, atau WEBP, maksimal **2 MB**. Jenis file dicek dari isinya, bukan dari ekstensi.
- Respons: `{ "foto_profil": "https://..." }`. URL berubah setiap upload.

| Status | Pesan |
|---|---|
| 400 | `Body harus berupa multipart/form-data ...` |
| 400 | `Field "foto" terkirim sebagai teks, bukan file ...` |
| 400 | `Ukuran foto maksimal 2 MB.` |
| 400 | `Format foto harus JPG, PNG, atau WEBP.` |

### `DELETE /mahasiswa/profil/foto`

Menghapus foto, kembali ke avatar default. 404 kalau belum punya foto.
