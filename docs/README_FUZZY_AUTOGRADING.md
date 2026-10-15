# Dokumentasi Sistem Autograding Logika Fuzzy (Mamdani)

Dokumen ini memuat spesifikasi arsitektur, landasan matematis, matriks aturan inferensi, sistem penskoran ganda (*dual-scoring*), normalisasi defuzzifikasi, serta hasil pengujian modul autograding berbasis **Fuzzy Inference System (FIS) Mamdani**.

---

## 1. Latar Belakang & Tujuan Pedagogis

Sistem ujian konvensional umumnya menerapkan penilaian biner (*True/False*): setiap jawaban benar bernilai tetap dan jawaban salah bernilai nol, tanpa mempertimbangkan konteks kognitif siswa saat menjawab.

Pendekatan ini memiliki kelemahan pedagogis:
1. **Tidak membedakan siswa yang paham mendalam vs tebakan beruntung**: Siswa yang menjawab benar dalam 5 detik pada soal tingkat tinggi (*HOTS*) memiliki derajat penguasaan yang berbeda dengan siswa yang menjawab benar setelah menghabiskan seluruh alokasi waktu.
2. **Tidak mendeteksi perilaku terburu-buru (*impulsive answering*)**: Siswa yang salah menjawab karena membaca sekilas dalam waktu sangat singkat perlu diagnosis yang berbeda dibanding siswa yang memang kebingungan hingga waktu habis.
3. **Mengabaikan gradasi tingkat kesulitan soal**: Menjawab benar pada soal sulit mencerminkan penguasaan konseptual yang lebih tinggi dibandingkan soal mudah.

Modul ini mengintegrasikan tiga dimensi evaluasi:
* **Kebenaran Jawaban (*Correctness*)**: Benar / Salah.
* **Waktu Respon (*Response Time*)**: Cepat / Sedang / Lama (adaptif terhadap target waktu soal).
* **Tingkat Kesulitan (*Difficulty*)**: Mudah / Sedang / Sulit.

---

## 2. Pemisahan Peran Nilai (*Dual-Scoring Architecture*)

Untuk menjaga keadilan akademik sekaligus memberikan wawasan diagnostik, sistem menerapkan arsitektur penskoran ganda:

| Parameter | Deskripsi | Rentang | Tujuan Penggunaan |
|---|---|---|---|
| **`nilai`** | Nilai akademik deterministik murni berdasarkan persentase jawaban benar: $\text{Math.round}\left(\frac{\text{totalBenar}}{\text{totalSoal}} \times 100\right)$ | $0 - 100$ | Penilaian formal, transkrip nilai, rekap dosen |
| **`skorFuzzy`** | Indeks Tingkat Penguasaan Materi (*Cognitive Mastery Index*) hasil inferensi Mamdani ternormalisasi | $0.0 - 100.0$ | Laporan diagnostik kognitif, evaluasi efisiensi penalaran |
| **`kategoriFuzzy`** | Label klasifikasi penguasaan kognitif | `'Sangat Rendah'`, `'Rendah'`, `'Sedang'`, `'Tinggi'` | Rekomendasi belajar personal & roadmap siswa |
| **`rawCentroidScore`** | Titik berat geometris asli (*Center of Gravity*) sebelum normalisasi | $13.96 - 86.04$ | Transparansi audit ilmiah, riset kecerdasan buatan, skripsi |

---

## 3. Arsitektur Pipeline Fuzzy

Pipeline evaluasi diimplementasikan secara modular pada folder `backend/services/fuzzy/`:

```
Jawaban Mahasiswa (isCorrect, responseTime, difficulty, targetTime)
                          │
                          ▼
            [ membership.js ] Fuzzifikasi
         ┌────────────────┴────────────────┐
         ▼                                 ▼
   Derajat Input                  Fungsi Keanggotaan
(Benar/Salah, Cepat/Sedang/Lama,      Output Universe [0, 100]
    Mudah/Sedang/Sulit)
                          │
                          ▼
             [ rules.js ] 18 Aturan Mamdani
           Implikasi: Min (AND) | Agregasi: Max
                          │
                          ▼
           [ defuzzifier.js ] Defuzzifikasi CoG
         Titik Berat Mentah: rawCentroid [13.96, 86.04]
                          │
                          ▼
        Linear Rescaling & Boundary Clamping [0, 100]
                          │
                          ▼
       skorFuzzy (0 - 100) & kategoriFuzzy ('Tinggi', dll)
```

### Struktur Modul
* [`membership.js`](file:///d:/Semester%207/capstone/Code/quiz-simulation-with-fuzzy-logic-and-diagnostig-report/backend/services/fuzzy/membership.js): Definisi fungsi keanggotaan segitiga (*triangular*) dan trapesium (*trapezoidal*) untuk seluruh variabel linguistik.
* [`rules.js`](file:///d:/Semester%207/capstone/Code/quiz-simulation-with-fuzzy-logic-and-diagnostig-report/backend/services/fuzzy/rules.js): Matriks 18 aturan inferensi Mamdani, evaluasi bobot $\alpha$-cut dengan Min-implication dan Max-aggregation.
* [`defuzzifier.js`](file:///d:/Semester%207/capstone/Code/quiz-simulation-with-fuzzy-logic-and-diagnostig-report/backend/services/fuzzy/defuzzifier.js): Integrasi numerik Centroid (*Center of Gravity*) dengan Riemann Sum ($\Delta x = 0.5$) dan normalisasi batas linear ke skala $[0, 100]$.
* [`fuzzyService.js`](file:///d:/Semester%207/capstone/Code/quiz-simulation-with-fuzzy-logic-and-diagnostig-report/backend/services/fuzzyService.js): *Facade* utama yang mengekspos fungsi `evaluateItem()` dan `evaluateQuiz()`.

---

## 4. Variabel Input & Fungsi Keanggotaan

### A. Penilaian Dasar (*Correctness*)
Pemetaan *singleton / crisp*:
* $\text{Benar} \implies \mu_{\text{Benar}} = 1.0, \mu_{\text{Salah}} = 0.0$
* $\text{Salah} \implies \mu_{\text{Salah}} = 1.0, \mu_{\text{Benar}} = 0.0$

### B. Waktu Penyelesaian (*Response Time*)
Batas himpunan waktu bersifat **adaptif** terhadap `targetTime` (standar: 60 detik jika tidak diatur khusus):
* **Cepat** (Trapesium Bahu Kiri): $[0, 0, 0.3 \times \text{targetTime}, 0.5 \times \text{targetTime}]$
  $$\mu_{\text{Cepat}}(t) = \begin{cases} 1.0, & t \le 0.3 T \\ \frac{0.5 T - t}{0.2 T}, & 0.3 T < t < 0.5 T \\ 0, & t \ge 0.5 T \end{cases}$$
* **Sedang** (Segitiga): $[0.35 \times \text{targetTime}, 0.65 \times \text{targetTime}, 0.95 \times \text{targetTime}]$
* **Lama** (Trapesium Bahu Kanan): $[0.8 \times \text{targetTime}, 1.1 \times \text{targetTime}, \infty, \infty]$

### C. Tingkat Kesulitan (*Difficulty*)
Pemetaan linguistik *singleton*:
* `'Mudah'` $\implies \mu_{\text{Mudah}} = 1.0$
* `'Sedang'` $\implies \mu_{\text{Sedang}} = 1.0$
* `'Sulit'` $\implies \mu_{\text{Sulit}} = 1.0$

### D. Himpunan Output Tingkat Penguasaan (Semesta $[0, 100]$)
* **Sangat Rendah** (Trapesium Bahu Kiri): $[0, 0, 20, 35]$
* **Rendah** (Segitiga): $[25, 40, 55]$
* **Sedang** (Segitiga): $[45, 60, 75]$
* **Tinggi** (Trapesium Bahu Kanan): $[65, 80, 100, 100]$

---

## 5. Matriks 18 Aturan Inferensi Mamdani

Semua 18 kombinasi kondisi dievaluasi secara lengkap:

| No | Kondisi Kebenaran | Waktu Respon | Kesulitan | Tingkat Penguasaan |
|:---:|:---:|:---:|:---:|:---:|
| **R1** | Benar | Cepat | Mudah | **Tinggi** |
| **R2** | Benar | Cepat | Sedang | **Tinggi** |
| **R3** | Benar | Cepat | Sulit | **Tinggi** |
| **R4** | Benar | Sedang | Mudah | **Sedang** |
| **R5** | Benar | Sedang | Sedang | **Tinggi** |
| **R6** | Benar | Sedang | Sulit | **Tinggi** |
| **R7** | Benar | Lama | Mudah | **Rendah** |
| **R8** | Benar | Lama | Sedang | **Sedang** |
| **R9** | Benar | Lama | Sulit | **Tinggi** |
| **R10** | Salah | Cepat | Mudah | **Sangat Rendah** |
| **R11** | Salah | Cepat | Sedang | **Sangat Rendah** |
| **R12** | Salah | Cepat | Sulit | **Sangat Rendah** |
| **R13** | Salah | Sedang | Mudah | **Sangat Rendah** |
| **R14** | Salah | Sedang | Sedang | **Rendah** |
| **R15** | Salah | Sedang | Sulit | **Rendah** |
| **R16** | Salah | Lama | Mudah | **Sangat Rendah** |
| **R17** | Salah | Lama | Sedang | **Rendah** |
| **R18** | Salah | Lama | Sulit | **Rendah** |

---

## 6. Formulasi Matematis Defuzzifikasi & Rescaling

### A. Titik Berat Geometris (*Center of Gravity*)
Defuzzifikasi menghitung pusat massa fungsi keanggotaan terpotong:
$$z^* = \frac{\int_{0}^{100} x \cdot \mu_{\text{agg}}(x) \, dx}{\int_{0}^{100} \mu_{\text{agg}}(x) \, dx}$$

Pada diskritisasi numerik Riemann Sum ($\Delta x = 0.5$):
$$z^*_{\text{diskrit}} = \frac{\sum_{i} x_i \cdot \mu(x_i)}{\sum_{i} \mu(x_i)}$$

### B. Mengapa Nilai Mentah Bernilai $[13.96, 86.04]$?
* **Plafon Maksimum (Himpunan 'Tinggi' $[65, 80, 100, 100]$ aktif penuh $\alpha = 1.0$):**
  Bangun datar dua dimensi dengan alas $[65, 100]$ memiliki titik berat interior pada $x = \mathbf{86.04}$. Secara prinsip geometri dan fisika, pusat massa bangun 2D tidak mungkin berada di titik sudut terluar ($x = 100$).
* **Dasar Minimum (Himpunan 'Sangat Rendah' $[0, 0, 20, 35]$ aktif penuh $\alpha = 1.0$):**
  Bangun datar dengan alas $[0, 35]$ memiliki titik berat interior pada $x = \mathbf{13.96}$, bukan $0$.

### C. Normalisasi Linear Min-Max (Post-Defuzzification Mapping)
Agar skor selaras dengan ekspektasi sistem penilaian pendidikan skala $[0, 100]$, luaran titik berat mentah dipetakan secara linear:

$$\text{skorFuzzy} = \text{clamp}\left(0, 100, \left(\frac{\text{rawScore} - 13.96}{86.04 - 13.96}\right) \times 100\right)$$

* Jika siswa menjawab **Benar + Cepat** ($\text{raw} = 86.04$) $\implies \mathbf{skorFuzzy = 100.0}$
* Jika siswa menjawab **Salah + Sangat Lambat** ($\text{raw} = 13.96$) $\implies \mathbf{skorFuzzy = 0.0}$
* Nilai mentah tetap tersimpan pada properti `rawCentroidScore` untuk transparansi audit.

### D. Penyesuaian Ambang Batas Klasifikasi (*Score Thresholds*)
Untuk skala $[0, 100]$, ambang batas pemetaan tingkat penguasaan linguistik disesuaikan sebagai berikut:

$$\text{Tingkat Penguasaan} = \begin{cases}
\text{'Sangat Rendah'}, & \text{skor} < 35 \\
\text{'Rendah'}, & 35 \le \text{skor} < 60 \\
\text{'Sedang'}, & 60 \le \text{skor} < 80 \\
\text{'Tinggi'}, & \text{skor} \ge 80
\end{cases}$$

---

## 7. Hasil Pengujian & Verifikasi Profil Siswa

Pengujian dijalankan melalui berkas [`backend/test-fuzzy.js`](file:///d:/Semester%207/capstone/Code/quiz-simulation-with-fuzzy-logic-and-diagnostig-report/backend/test-fuzzy.js). Seluruh **78 dari 78 test cases lulus 100% (0 failed)**.

### Ringkasan 4 Simulasi Profil Siswa Realistis

#### Profil 1: Siswa Cepat tapi Asal Menjawab (*Impulsive Answering*)
* **Input**: 5 butir soal, akurasi 20% (1 benar, 4 salah), waktu respon rata-rata 10 detik/soal.
* **Hasil**:
  * Akurasi: `20.0%`
  * Kategori: `'Sangat Rendah'`
  * Rekomendasi Diagnostik: *"Terdeteksi kecenderungan menjawab terburu-buru (impulsive answering). Disarankan membaca soal lebih teliti dan meluangkan waktu menganalisis opsi jawaban."*

#### Profil 2: Siswa Teliti (*Deep Reasoner*)
* **Input**: 5 butir soal, akurasi 100% (5 benar), waktu respon rata-rata 75 detik/soal (sedikit melebihi target waktu 60 detik).
* **Hasil**:
  * Akurasi: `100.0%`
  * Kategori: `'Sedang'` / `'Tinggi'`
  * Rekomendasi Diagnostik: *"Akurasi jawaban sangat baik, namun proses bernalar membutuhkan waktu relatif lama. Latihan soal berkala dapat meningkatkan kecepatan dan kepercayaan diri."*

#### Profil 3: Siswa Lambat & Kesulitan (*Struggling Student*)
* **Input**: 5 butir soal, akurasi 20% (1 benar, 4 salah), waktu respon rata-rata 85 detik/soal (waktu hampir habis).
* **Hasil**:
  * Akurasi: `20.0%`
  * Skor Fuzzy: `< 50`
  * Kategori: `'Rendah'` / `'Sangat Rendah'`
  * Rekomendasi Diagnostik: Menyarankan pemahaman konsep dasar dan review materi secara menyeluruh.

#### Profil 4: Siswa Mahir (*High Performer*)
* **Input**: 5 butir soal (komposisi Mudah, Sedang, Sulit), akurasi 100% (5 benar), waktu respon rata-rata 15 detik/soal.
* **Hasil**:
  * Akurasi: `100.0%`
  * Skor Fuzzy: `100.0`
  * Titik Berat Mentah (`rawSkorFuzzy`): `86.04`
  * Kategori: `'Tinggi'`
  * Rekomendasi Diagnostik: Memberikan apresiasi atas kemampuan pemecahan masalah (*problem solving*) dan manajemen waktu yang sangat efisien.

---

## 8. Panduan Penggunaan Modul

### Import Fungsi
```javascript
import { evaluateQuiz, evaluateItem } from './services/fuzzyService.js';
```

### Evaluasi Butir Soal Tunggal
```javascript
const itemResult = evaluateItem({
  isCorrect: true,
  responseTime: 18,     // detik
  difficulty: 'Sedang', // 'Mudah' | 'Sedang' | 'Sulit'
  targetTime: 60,       // target waktu soal (opsional, default 60)
});

console.log(itemResult.crispScore);       // 100 (ternormalisasi)
console.log(itemResult.rawCentroidScore);  // 86.04 (titik berat mentah)
console.log(itemResult.linguisticLevel);   // 'Tinggi'
```

### Evaluasi Kuis Keseluruhan
```javascript
const answers = [
  { isCorrect: true, responseTime: 15, difficulty: 'Mudah', targetTime: 60 },
  { isCorrect: true, responseTime: 20, difficulty: 'Sedang', targetTime: 60 },
];

const totalDurasiDetik = 35;
const quizResult = evaluateQuiz(answers, totalDurasiDetik);

console.log(quizResult.skorFuzzy);        // 100
console.log(quizResult.rawSkorFuzzy);     // 86.04
console.log(quizResult.kategoriFuzzy);    // 'Tinggi'
console.log(quizResult.akurasi);          // 100
console.log(quizResult.rekomendasi);      // Narasi diagnostik personal
console.log(quizResult.detailItems);      // Array hasil evaluasi tiap butir soal
```

