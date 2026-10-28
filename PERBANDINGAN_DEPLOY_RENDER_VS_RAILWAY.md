# Perbandingan Deployment Backend: Render ($7/Bulan) vs Railway ($5/Bulan)
**Proyek:** Quiz Simulation with Fuzzy Logic and Diagnostic Report (Capstone)  
**Teknologi:** Node.js (Express.js), Supabase (PostgreSQL & Auth), OpenRouter AI  
**Skala Target:** 3 – 30 Pengguna Aktif (Mahasiswa, Dosen, Super Admin)

---

## 1. Ringkasan Eksekutif (TL;DR)

| Fitur / Parameter | Render Starter ($7 / bulan) | Railway Hobby ($5 / bulan) |
| :--- | :--- | :--- |
| **Model Penetapan Harga** | **Biaya Tetap (*Flat Fee*)** | **Kredit Berbasis Pemakaian (*Usage-Based*)** |
| **Sistem Tagihan** | Pasti $7/bulan tanpa risiko tagihan membengkak | Saldo kredit $5/bulan; kelebihan pemakaian ditagih per-detik |
| **Spesifikasi Sumber Daya** | Terkunci di **0.5 vCPU & 512 MB RAM** | **Dinamis** (bisa *burst* hingga 8 vCPU & 8 GB RAM) |
| **Kondisi Server (24/7)** | **Always-On** (Tidak tidur, tanpa *cold start*) | **Always-On** (Tidak tidur, tanpa *cold start*) |
| **Cakupan Layanan (Multi-Service)** | Dikenakan biaya **per service** ($7/service) | **Pool kredit $5** dibagi ke semua service di proyek |
| **Alokasi Bandwidth (Egress)** | 5 GB gratis / bulan (kelebihan $0.15 / GB) | $0.05 / GB (dipotong dari saldo kredit $5) |
| **Antarmuka Pengguna (UI/DX)** | Bersih, standar list dashboard | Sangat modern, visual canvas interaktif, deploy sangat cepat |

---

## 2. Analisis Model Penetapan Harga & Cara Kerja

### A. Render Starter ($7 / Bulan) — *Predictable Flat Subscription*
* **Mekanisme:** Anda menyewa sebuah *container* dengan alokasi tetap (0.5 vCPU dan 512 MB RAM) seharga $7 per bulan.
* **Keuntungan:** 
  * Biaya bulanan **100% dapat diprediksi**. Sekalipun backend menerima ribuan request atau CPU bekerja terus-menerus, tagihan Anda tetap $7 (selama pemakaian bandwidth di bawah 5 GB).
* **Kelemahan:**
  * Biaya dihitung **per instance/service**. Jika Anda membuat service baru (misal *background worker* atau backend kedua), Anda harus membayar tambahan $7 per service.

### B. Railway Hobby ($5 / Bulan) — *Usage-Based Credit Pool*
* **Mekanisme:** Anda membayar langganan dasar $5/bulan dan langsung mendapatkan **saldo pemakaian (*usage credit*) senilai $5** untuk bulan tersebut.
* Penggunaan dihitung per-detik berdasarkan konsumsi riil:
  * **RAM:** ~$10 per GB / bulan ($0.00000386 per GB-detik)
  * **CPU:** ~$20 per vCPU / bulan ($0.00000772 per vCPU-detik)
  * **Bandwidth Keluar (Egress):** $0.05 per GB
* **Keuntungan:**
  * Kredit $5 berlaku untuk **satu proyek utuh**. Anda dapat menjalankan backend Express, frontend, bot, atau Redis dalam satu workspace dan semuanya memotong dari kuota $5 yang sama.
* **Kelemahan:**
  * Tagihan bisa melebihi $5 jika penggunaan resource melebihi nilai kredit. Namun, Railway menyediakan fitur **Usage Limits** (*spending limit*) untuk membatasi tagihan maksimal agar kartu tidak terkena biaya tak terduga.

---

## 3. Analisis Riil untuk Proyek Capstone Ini

### Karakteristik Beban Aplikasi:
1. **Pemisahan Database & Auth (Offloaded to Supabase):**
   * Operasi berat seperti hashing password, verifikasi token JWT, query database relasional, dan transaksi data pengerjaan diproses oleh server Supabase.
   * Backend Express hanya bertindak sebagai *router*, validasi payload, dan orkestrator.
2. **Kalkulasi Fuzzy Logic Sangat Ringan:**
   * Algoritma fuzzy logic (fuzzifikasi, evaluasi rules, defuzzifikasi centroid) diimplementasikan secara matematis murni.
   * Eksekusi defuzzifikasi centroid hanya membutuhkan sekitar 200 iterasi diskritisasi di memory, selesai dalam waktu **< 1 milidetik** per pengerjaan kuis.
3. **Kebutuhan RAM & CPU Backend:**
   * Memory footprint Node.js Express pada proyek ini hanya berkisar antara **60 MB – 120 MB** RAM saat aktif.

### Simulasi Biaya & Performa:

#### Di Render ($7 / Bulan):
* Server standby 24 jam dengan RAM 512 MB dan 0.5 CPU.
* Kapasitas 512 MB RAM sangat longgar untuk backend Anda yang hanya butuh ~100 MB.
* Tagihan tetap $7 per bulan, aman tanpa pemantauan berkala.

#### Di Railway ($5 / Bulan):
* Karena backend Anda sangat efisien (konsumsi RAM rata-rata hanya ~80 MB):
  * **Biaya RAM 80 MB (24/7 sebulan):** ~$0.80
  * **Biaya CPU (idle + burst sesekali):** ~$0.50 – $1.20
  * **Biaya Egress Bandwidth (30 user):** < $0.10
* **Total estimasi pemakaian riil:** Hanya sekitar **$1.50 – $2.50 per bulan**.
* **Kesimpulan:** Kredit $5 di Railway **tidak akan habis** untuk menjalankan backend proyek ini selama 24/7, dan Anda tidak akan terkena biaya tambahan selama batas penggunaan (*usage limit*) dikunci di $5.

---

## 4. Kelebihan & Kekurangan

### Render Starter ($7)
* **Kelebihan:**
  * Tidak ada kecemasan tagihan melonjak (*zero billing anxiety*).
  * Setup sangat mudah dan stabil.
  * Dukungan native health check yang baik (`/health`).
* **Kekurangan:**
  * Harga sedikit lebih mahal ($7 vs $5).
  * Spesifikasi CPU terkunci kaku di 0.5 vCPU.

### Railway Hobby ($5)
* **Kelebihan:**
  * Biaya lebih murah ($5/bulan).
  * Spesifikasi fleksibel: saat 30 mahasiswa men-submit kuis bersamaan, Railway bisa memberikan dorongan (*burst*) CPU instan lebih dari 0.5 vCPU tanpa hambatan.
  * Tampilan dashboard visual modern, log streaming sangat cepat, dan integrasi monorepo sangat mudah.
* **Kekurangan:**
  * Pengguna harus memasang *spending limit* manual agar merasa aman dari overage.

---

## 5. Rekomendasi Pemilihan

| Fase Proyek | Rekomendasi Platform | Alasan |
| :--- | :--- | :--- |
| **Tahap Development & Testing Sekarang** | **Render Free Tier ($0)** | Gratis tanpa biaya. Walaupun ada *cold start* (tidur setelah 15 menit), fungsi backend, auth, dan database sudah bisa diuji 100%. |
| **Tahap Ujian / Sidang / Demo Penguji (Opsi Paling Hemat)** | **Railway Hobby ($5)** | Biaya terendah, performa burst tinggi saat banyak user login bersamaan, dan kredit $5 sangat mencukupi kebutuhan backend ini. |
| **Tahap Ujian / Sidang / Demo Penguji (Opsi Paling Tenang)** | **Render Starter ($7)** | Pilihan tepat jika Anda tidak ingin repot mengurus meteran kredit dan menginginkan kepastian biaya flat $7 per bulan. |

---

## 6. Lampiran: Catatan Konfigurasi Deployment Backend

Bagi deployment di **Render**, pastikan parameter berikut terpasang dengan benar:
* **Root Directory:** `backend` *(Wajib diisi karena file proyek berada di subfolder backend)*
* **Build Command:** `npm install`
* **Start Command:** `npm start` *(atau `node server.js`)*
* **Health Check Path:** `/health`
* **Environment Variables Penting:**
  * `TRUST_PROXY`: `1` *(Wajib agar Express membaca IP asli dari reverse proxy Render)*
  * `NODE_ENV`: `production`
  * `SUPABASE_URL`: URL project Supabase Anda
  * `SUPABASE_ANON_KEY`: Anon public key Supabase
  * `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key Supabase
  * `BACKEND_URL`: `https://<nama-service>.onrender.com`
  * `FRONTEND_URLS`: Domain frontend yang diizinkan CORS (pisahkan koma jika lebih dari satu)

