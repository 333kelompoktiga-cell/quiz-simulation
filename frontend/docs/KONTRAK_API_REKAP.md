# Kontrak API Rekap Skor Fuzzy (untuk tim backend)

> **Status (18 Okt 2026):** frontend sudah jadi (menu **Report Nilai**, Figma HA6–HA8), dan ketiga
> endpoint sudah dibuat di `backend/controllers/RekapController.js` + `services/rekapService.js`
> (unit test: `node --test tests/rekap.test.js`). Mohon direview tim backend. Kalau backend yang
> dipakai belum punya endpoint ini, halaman menampilkan "Data rekap belum tersedia".

Halaman frontend:

| Halaman | Route frontend | Endpoint |
|---|---|---|
| HA6 Report Mahasiswa (daftar kuis) | `/rekap` | `GET /api/rekap/kuis` |
| HA7 Rekap satu kuis | `/rekap/kuis/:idKuis` | `GET /api/rekap/kuis/:idKuis` |
| HA8 Detail pengerjaan | `/rekap/pengerjaan/:idPengerjaan` | `GET /api/rekap/pengerjaan/:idPengerjaan` |

Semua respons memakai format `apiResponse.js` yang sudah ada:
`{ status: 'success' | 'error', message, data? }`.

## Aturan umum

- **Middleware:** `verifyLoggedIn`, `verifyAdmin`. Semuanya hanya-baca (GET).
- **Hak akses:** dosen hanya melihat kuis yang `bisaDikelola(kuis, user)` di `utils/aksesKuis.js`,
  yaitu pembuat kuis dan dosen pengelola bersama. Kuis lain: `403`.
- **Skor yang dipakai hanya skor fuzzy** (`PengerjaanKuis.skorFuzzy`, 0–100). Kolom `score` tidak dipakai di rekap.
- **Hanya pengerjaan berstatus `selesai`** yang dihitung.
- **Satu mahasiswa = satu baris**, memakai **percobaan terakhir** (attempt selesai dengan `attempt` terbesar).
  `jumlahPercobaan` = jumlah attempt selesai mahasiswa itu di kuis tersebut.
- **Perlu perhatian** = jumlah mahasiswa dengan `kategoriFuzzy` `Sangat Rendah` (dari percobaan terakhir).
- **Label kategori** sama dengan `services/fuzzy/membership.js`: `Tinggi`, `Sedang`, `Rendah`, `Sangat Rendah`.
- **NIM** = `User.username`.

---

## 1. `GET /api/rekap/kuis`

Daftar kuis yang bisa dikelola dosen yang login, beserta ringkasannya.
Urutan: `terakhirDikerjakan` terbaru dulu, kuis tanpa peserta di akhir.

```json
{
  "status": "success",
  "message": "Berhasil mengambil rekap kuis.",
  "data": [
    {
      "idKuis": "5a44ab47-a51b-40f1-a904-fc3f0ed4f287",
      "judul": "Huruf Kapital",
      "idBab": 1,
      "namaBab": "Ejaan",
      "jumlahSoal": 10,
      "jumlahPeserta": 24,
      "rataRataSkorFuzzy": 67.8,
      "terakhirDikerjakan": "2026-10-12T02:14:00Z"
    },
    {
      "idKuis": "…",
      "judul": "Kata Baku",
      "idBab": 1,
      "namaBab": "Ejaan",
      "jumlahSoal": 8,
      "jumlahPeserta": 0,
      "rataRataSkorFuzzy": null,
      "terakhirDikerjakan": null
    }
  ]
}
```

- `rataRataSkorFuzzy`: rata-rata skor fuzzy percobaan terakhir semua peserta, `null` kalau belum ada peserta.
- `terakhirDikerjakan`: `waktuSelesai` paling baru di kuis itu.

## 2. `GET /api/rekap/kuis/:idKuis`

```json
{
  "status": "success",
  "message": "Berhasil mengambil rekap kuis.",
  "data": {
    "kuis": {
      "idKuis": "5a44ab47-…",
      "judul": "Huruf Kapital",
      "idBab": 1,
      "namaBab": "Ejaan",
      "durasi": 30,
      "jumlahSoal": 10,
      "adaPin": true
    },
    "ringkasan": {
      "jumlahPeserta": 24,
      "rataRataSkorFuzzy": 67.8,
      "jumlahSangatRendah": 3
    },
    "sebaranKategori": { "Tinggi": 8, "Sedang": 7, "Rendah": 6, "Sangat Rendah": 3 },
    "soalPalingBanyakSalah": [
      {
        "idSoal": 41,
        "nomor": 4,
        "pertanyaan": "Huruf kapital pada nama gelar",
        "persenBenar": 29.2,
        "rataRataWaktu": 41.3,
        "jumlahMenjawab": 24
      }
    ],
    "mahasiswa": [
      {
        "idUser": "b2f1…",
        "nama": "Siti Amalia",
        "nim": "11231044",
        "idPengerjaan": "9c1e…",
        "attempt": 1,
        "jumlahPercobaan": 1,
        "skorFuzzy": 84.2,
        "kategoriFuzzy": "Tinggi",
        "totalBenar": 9,
        "totalSoal": 10,
        "waktuSelesai": "2026-10-12T02:14:00Z"
      }
    ]
  }
}
```

- `sebaranKategori`: jumlah mahasiswa per kategori (percobaan terakhir). Keempat kunci selalu ada, boleh `0`.
- `soalPalingBanyakSalah`: dihitung dari `PengerjaanKuis.hasilDetail` pada percobaan terakhir yang
  `selesai` tiap mahasiswa (`meta.isCorrect` untuk benar/salah, `meta.responseTime` untuk waktu),
  diurutkan dari `persenBenar` terkecil. Cukup kirim 5 teratas; frontend menampilkan 3.
  `nomor` = urutan soal di kuis (bukan urutan acak saat dikerjakan). `rataRataWaktu` dalam detik.
  `jumlahMenjawab` = banyaknya mahasiswa yang mendapat soal itu. Soal yang sudah dihapus dari kuis tidak ditampilkan.
- `mahasiswa`: urutan bebas (frontend mengurutkan sendiri berdasarkan skor atau nama).
- Kuis tanpa peserta: `jumlahPeserta: 0`, `rataRataSkorFuzzy: null`, `mahasiswa: []`.
- Error: `404` kuis tidak ada, `403` bukan pengelola kuis.

## 3. `GET /api/rekap/pengerjaan/:idPengerjaan`

Detail satu percobaan, untuk halaman HA8.

```json
{
  "status": "success",
  "message": "Berhasil mengambil detail pengerjaan.",
  "data": {
    "idPengerjaan": "9c1e…",
    "attempt": 1,
    "jumlahPercobaan": 1,
    "waktuMulai": "2026-10-12T02:06:00Z",
    "waktuSelesai": "2026-10-12T02:14:00Z",
    "waktuPengerjaan": 480,
    "skorFuzzy": 38.4,
    "kategoriFuzzy": "Rendah",
    "totalBenar": 5,
    "totalSoal": 10,
    "rekomendasi": "Terdeteksi kecenderungan menjawab terburu-buru…",
    "mahasiswa": { "idUser": "b2f1…", "nama": "Rizky Ananda", "nim": "11231012" },
    "kuis": { "idKuis": "5a44ab47-…", "judul": "Huruf Kapital", "namaBab": "Ejaan" },
    "soal": [
      {
        "nomor": 4,
        "idSoal": 41,
        "pertanyaan": "Huruf kapital pada nama gelar",
        "isCorrect": false,
        "responseTime": 3,
        "targetTime": 60,
        "difficulty": "Sulit",
        "skorFuzzy": 14.0,
        "kategoriFuzzy": "Sangat Rendah"
      }
    ]
  }
}
```

- `waktuPengerjaan` = `PengerjaanKuis.durasiPengerjaan` (detik, dari mulai sampai submit, maksimal durasi kuis).
- `soal` diambil dari `PengerjaanKuis.hasilDetail` + teks `Soal.pertanyaan`:
  `isCorrect`, `responseTime`, `targetTime`, `difficulty` dari `meta`, `skorFuzzy` dari `crispScore`,
  `kategoriFuzzy` dari `linguisticLevel`. Urutkan berdasarkan `nomor`.
- Penanda "terburu-buru" dan "ragu" dihitung di frontend dari `responseTime` dan `targetTime`
  (batas himpunan Cepat ≤ 30% dan Lama ≥ 110% di `fuzzifyResponseTime`), jadi tidak perlu dikirim.
- Error: `404` pengerjaan tidak ada atau belum `selesai`, `403` bukan pengelola kuisnya.
