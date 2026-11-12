import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../../performance report/node_modules/puppeteer');
import { extractTextFromBuffer, parseSoal } from '../services/soalExtractor.js';

const uploadDir = 'C:/Users/USER/.gemini/antigravity/brain/9acf2a35-67eb-45a9-b661-135750fb184f/.user_uploaded/';

const soalList = [
  {
    nomor: 1,
    imageFile: 'media_1794414899489_210751f2.png',
    pertanyaan: "Diberikan persamaan pecahan berlanjut (continued fraction) pada gambar berikut. Jika A, B, C, dan D adalah bilangan bulat positif, tentukan nilai dari A + B + C + D.",
    opsi: [
      "A. 8",
      "B. 9",
      "C. 10",
      "D. 11",
      "E. 12"
    ],
    kunci: "C",
    tingkat: "Sedang",
    pembahasan: "Ubah pecahan 43/30 ke dalam bentuk pecahan berlanjut secara bertahap:\n1. 43/30 = 1 + 13/30, sehingga A = 1.\n2. 30/13 = 2 + 4/13, sehingga B = 2.\n3. 13/4 = 3 + 1/4, sehingga C = 3.\n4. 4/1 = 4, sehingga D = 4.\nMaka nilai A + B + C + D = 1 + 2 + 3 + 4 = 10."
  },
  {
    nomor: 2,
    imageFile: 'media_1794414899510_50398aed.jpg',
    pertanyaan: "Tentukan nilai x yang memenuhi persamaan aljabar pecahan pada gambar berikut:",
    opsi: [
      "A. 2025",
      "B. 2026",
      "C. 2027",
      "D. 2028",
      "E. 2029"
    ],
    kunci: "D",
    tingkat: "Sedang",
    pembahasan: "Kurangkan angka 1 pada setiap suku pecahan di ruas kiri (karena 1 + 1 + 1 = 3):\n((x − 6)/2022 − 1) + ((x − 5)/2023 − 1) + ((x − 4)/2024 − 1) = 0\n(x − 2028)/2022 + (x − 2028)/2023 + (x − 2028)/2024 = 0\nFaktorkan suku sejenis:\n(x − 2028)(1/2022 + 1/2023 + 1/2024) = 0\nKarena nilai dalam kurung kedua bernilai positif (> 0), maka x − 2028 = 0, sehingga didapatkan nilai x = 2028."
  },
  {
    nomor: 3,
    imageFile: 'media_1794414899498_1230fd2e.png',
    pertanyaan: "Diketahui nilai x + 1/x = 3. Tentukan nilai dari x³ + 1/x³.",
    opsi: [
      "A. 18",
      "B. 21",
      "C. 24",
      "D. 27",
      "E. 36"
    ],
    kunci: "A",
    tingkat: "Mudah",
    pembahasan: "Gunakan identitas pemangkatan tiga suku (a + b)³ = a³ + b³ + 3ab(a + b).\nDengan memisalkan a = x dan b = 1/x:\n(x + 1/x)³ = x³ + 1/x³ + 3(x · 1/x)(x + 1/x)\n3³ = x³ + 1/x³ + 3(1)(3)\n27 = x³ + 1/x³ + 9\nx³ + 1/x³ = 27 − 9 = 18."
  },
  {
    nomor: 4,
    imageFile: 'media_1794414899498_a3fc6ff3.png',
    pertanyaan: "Tentukan hasil penyederhanaan dari pecahan berlanjut bertingkat pada gambar berikut:",
    opsi: [
      "A. 5/8",
      "B. 8/13",
      "C. 13/8",
      "D. 5/13",
      "E. 8/21"
    ],
    kunci: "B",
    tingkat: "Sedang",
    pembahasan: "Selesaikan operasi pecahan dari tingkat paling bawah ke atas secara bertahap:\n1. 1 + 1 = 2\n2. 1 + 1/2 = 3/2\n3. 1 + 1/(3/2) = 1 + 2/3 = 5/3\n4. 1 + 1/(5/3) = 1 + 3/5 = 8/5\n5. 1 + 1/(8/5) = 1 + 5/8 = 13/8\n6. 1 / (13/8) = 8/13.\nNilai pecahan ini bersesuaian dengan rasio bilangan Fibonacci F₆/F₇ = 8/13."
  },
  {
    nomor: 5,
    imageFile: 'media_1794414899520_e84a5ef1.jpg',
    pertanyaan: "Jika diketahui abc = 1, maka tentukan nilai dari ekspresi pecahan aljabar pada gambar berikut:",
    opsi: [
      "A. 2022",
      "B. 2023",
      "C. 2024",
      "D. 2025",
      "E. 2026"
    ],
    kunci: "D",
    tingkat: "Sulit",
    pembahasan: "Faktorkan angka 2024 dari tiga suku pertama:\nS = 1/(1 + a + ab) + 1/(1 + b + bc) + 1/(1 + c + ac)\n- Suku 1: 1/(1 + a + ab)\n- Suku 2: Kalikan pembilang dan penyebut dengan a:\n  a / [a(1 + b + bc)] = a / (a + ab + abc) = a / (a + ab + 1) = a / (1 + a + ab)\n- Suku 3: Kalikan pembilang dan penyebut dengan ab:\n  ab / [ab(1 + c + ac)] = ab / (ab + abc + a²bc) = ab / (ab + 1 + a·1) = ab / (1 + a + ab)\nJumlah ketiga suku: S = (1 + a + ab)/(1 + a + ab) = 1.\nMaka total nilai ekspresi: 2024(1) + 1 = 2024 + 1 = 2025."
  },
  {
    nomor: 6,
    imageFile: 'media_1794414899498_36666143.png',
    pertanyaan: "Tentukan nilai x yang memenuhi persamaan eksponen berikut: 8ˣ + 2ˣ = 130.",
    opsi: [
      "A. 2",
      "B. ²log 5",
      "C. ²log 3",
      "D. ⁵log 2",
      "E. 3"
    ],
    kunci: "B",
    tingkat: "Sedang",
    pembahasan: "Ingat bahwa 8ˣ = (2³)ˣ = (2ˣ)³.\nMisalkan u = 2ˣ (dengan syarat u > 0):\nu³ + u = 130\nu³ + u − 130 = 0\nUntuk u = 5, didapatkan 5³ + 5 = 125 + 5 = 130 (memenuhi persamaan).\nFaktorisasi menghasilkan (u − 5)(u² + 5u + 26) = 0.\nFaktor kuadrat memiliki diskriminan D = 5² − 4(1)(26) = 25 − 104 = −79 < 0 (tidak ada solusi riil).\nSehingga satu-satunya akar riil adalah u = 5.\nKarena u = 2ˣ = 5, maka x = ²log 5."
  },
  {
    nomor: 7,
    imageFile: 'media_1794414899504_6316147b.png',
    pertanyaan: "Jika diketahui:\nx + y = 4\nx² + y² = 10\nMaka nilai dari x⁴ + y⁴ adalah...",
    opsi: [
      "A. 68",
      "B. 82",
      "C. 100",
      "D. 116",
      "E. 124"
    ],
    kunci: "B",
    tingkat: "Sedang",
    pembahasan: "Langkah penyelesaian:\n1. Kuadratkan persamaan pertama: (x + y)² = x² + y² + 2xy\n   4² = 10 + 2xy ⇒ 16 = 10 + 2xy ⇒ 2xy = 6 ⇒ xy = 3.\n2. Kuadratkan nilai x² + y²: (x² + y²)² = x⁴ + y⁴ + 2(xy)²\n   10² = x⁴ + y⁴ + 2(3²)\n   100 = x⁴ + y⁴ + 2(9)\n   100 = x⁴ + y⁴ + 18\n   x⁴ + y⁴ = 100 − 18 = 82."
  },
  {
    nomor: 8,
    imageFile: 'media_1794414899504_0c242fd1.png',
    pertanyaan: "If x is a positive number such that:\n(x² + 2x + 1) / (x² + 6x + 9) = 36/49\nwhat is the value of x?",
    opsi: [
      "A. 7",
      "B. 9",
      "C. 11",
      "D. 13",
      "E. 15"
    ],
    kunci: "C",
    tingkat: "Mudah",
    pembahasan: "Faktorkan bentuk kuadrat sempurna pada pembilang dan penyebut:\nx² + 2x + 1 = (x + 1)²\nx² + 6x + 9 = (x + 3)²\nSehingga persamaannya menjadi:\n((x + 1)/(x + 3))² = (6/7)²\nKarena x merupakan bilangan positif (x > 0), maka (x + 1)/(x + 3) = 6/7.\nLakukan perkalian silang:\n7(x + 1) = 6(x + 3)\n7x + 7 = 6x + 18\n7x − 6x = 18 − 7\nx = 11."
  },
  {
    nomor: 9,
    imageFile: 'media_1794414899522_7f20cc05.jpg',
    pertanyaan: "Misalkan diketahui sistem persamaan eksponen berantai berikut:\n3ᵃ = 4       6ᵈ = 7\n4ᵇ = 5       7ᵉ = 8\n5ᶜ = 6       8ᶠ = 9\nBerapakah hasil kali dari abcdef ?",
    opsi: [
      "A. 1",
      "B. 2",
      "C. 3",
      "D. 4",
      "E. 6"
    ],
    kunci: "B",
    tingkat: "Sedang",
    pembahasan: "Lakukan substitusi eksponensial secara berurutan:\n1. 3ᵃ = 4\n2. (3ᵃ)ᵇ = 4ᵇ = 5 ⇒ 3ᵃᵇ = 5\n3. (3ᵃᵇ)ᶜ = 5ᶜ = 6 ⇒ 3ᵃᵇᶜ = 6\n4. (3ᵃᵇᶜ)ᵈ = 6ᵈ = 7 ⇒ 3ᵃᵇᶜᵈ = 7\n5. (3ᵃᵇᶜᵈ)ᵉ = 7ᵉ = 8 ⇒ 3ᵃᵇᶜᵈᵉ = 8\n6. (3ᵃᵇᶜᵈᵉ)ᶠ = 8ᶠ = 9 ⇒ 3ᵃᵇᶜᵈᵉᶠ = 9\nKarena 9 = 3², diperoleh persamaan: 3ᵃᵇᶜᵈᵉᶠ = 3².\nSehingga nilai hasil kali abcdef = 2."
  },
  {
    nomor: 10,
    imageFile: 'media_1794414899495_1602faee.png',
    pertanyaan: "Jika diketahui a³ − a − 1 = 0, maka tentukan nilai dari bentuk polinomial berikut:\na⁴ + a³ − a² − 2a + 9 = ...",
    opsi: [
      "A. 7",
      "B. 8",
      "C. 9",
      "D. 10",
      "E. 11"
    ],
    kunci: "D",
    tingkat: "Sulit",
    pembahasan: "Dari persamaan a³ − a − 1 = 0, diperoleh hubungan a³ − a = 1.\nLakukan pembagian polinomial (a⁴ + a³ − a² − 2a + 9) oleh (a³ − a − 1):\na⁴ + a³ − a² − 2a + 9 = (a + 1)(a³ − a − 1) + 10.\nKarena nilai a³ − a − 1 = 0, maka:\n= (a + 1)(0) + 10 = 0 + 10 = 10."
  }
];

function getImageBase64(filename) {
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File gambar tidak ditemukan: ${filePath}`);
    return '';
  }
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  const b64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

function generateHTML() {
  const tabelHtml = soalList.map((s) => {
    const dataUri = getImageBase64(s.imageFile);
    const imageTag = dataUri
      ? `<div class="gambar-wrapper"><img src="${dataUri}" alt="Rumus Soal ${s.nomor}" class="gambar-rumus" /></div>`
      : '';

    return `
    <div class="soal-block">
      <div class="soal-header">Nomor Soal ${s.nomor}</div>
      <table class="tabel-soal">
        <tr>
          <td class="kolom-label">Pertanyaan</td>
          <td class="kolom-isi">
            <div class="teks-pertanyaan">${s.pertanyaan.replace(/\n/g, '<br/>')}</div>
            ${imageTag}
          </td>
        </tr>
        <tr>
          <td class="kolom-label">Opsi Jawaban</td>
          <td class="kolom-isi">${s.opsi.join('<br/>')}</td>
        </tr>
        <tr>
          <td class="kolom-label">Kunci Jawaban</td>
          <td class="kolom-isi">${s.kunci}</td>
        </tr>
        <tr>
          <td class="kolom-label">Tingkat Kesulitan</td>
          <td class="kolom-isi">${s.tingkat}</td>
        </tr>
        <tr>
          <td class="kolom-label">Pembahasan</td>
          <td class="kolom-isi">${s.pembahasan.replace(/\n/g, '<br/>')}</td>
        </tr>
      </table>
    </div>
  `;
  }).join('\n');

  return `<!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="UTF-8">
    <title>Template Upload Soal e-Kuis</title>
    <style>
      @page {
        size: A4;
        margin: 18mm 14mm 18mm 14mm;
      }
      body {
        font-family: Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.45;
        color: #111;
      }
      h1 {
        text-align: center;
        font-size: 14pt;
        font-weight: bold;
        margin-bottom: 6px;
        text-transform: uppercase;
        color: #1e293b;
      }
      .subtitle {
        text-align: center;
        font-size: 9.5pt;
        color: #64748b;
        margin-bottom: 20px;
      }
      .soal-block {
        margin-bottom: 18px;
        page-break-inside: avoid;
      }
      .soal-header {
        font-weight: bold;
        font-size: 10.5pt;
        margin-bottom: 4px;
        color: #1e293b;
      }
      table.tabel-soal {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
      }
      table.tabel-soal td {
        border: 1px solid #777;
        padding: 6px 9px;
        vertical-align: top;
      }
      td.kolom-label {
        width: 24%;
        font-weight: bold;
        background-color: #f3f4f6;
        color: #1f2937;
      }
      td.kolom-isi {
        width: 76%;
      }
      .teks-pertanyaan {
        margin-bottom: 6px;
        font-weight: 500;
      }
      .gambar-wrapper {
        margin: 6px 0;
        text-align: left;
      }
      .gambar-rumus {
        max-height: 130px;
        max-width: 440px;
        object-fit: contain;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        display: block;
      }
    </style>
  </head>
  <body>
    <h1>Template Upload Soal e-Kuis</h1>
    <div class="subtitle">Format Template 1 — Matematika Dasar & Aljabar (Dengan Gambar & Notasi Pangkat Matematika)</div>
    ${tabelHtml}
  </body>
  </html>`;
}

async function main() {
  const html = generateHTML();
  const htmlPath = path.resolve('./docs/soal_matematika_template1.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log('Menjalankan Puppeteer untuk mencetak PDF dengan visual rumus...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfPath = path.resolve('./docs/soal_matematika_template1.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
  });
  await browser.close();
  console.log(`PDF berhasil dibuat: ${pdfPath}`);

  // Salin ke Desktop, Downloads, dan Brain Artifacts agar user mudah membuka
  const targetCopies = [
    'C:/Users/USER/Desktop/soal_matematika_template1.pdf',
    'C:/Users/USER/Downloads/soal_matematika_template1.pdf',
    'C:/Users/USER/.gemini/antigravity/brain/9acf2a35-67eb-45a9-b661-135750fb184f/soal_matematika_template1.pdf'
  ];

  for (const dest of targetCopies) {
    try {
      fs.copyFileSync(pdfPath, dest);
      console.log(`Disalin ke: ${dest}`);
    } catch (err) {
      console.warn(`Gagal menyalin ke ${dest}:`, err.message);
    }
  }

  // Uji parse dengan soalExtractor sistem
  console.log('\n--- MENGUJI EKSTRAKSI DENGAN SOAL EXTRACTOR SISTEM ---');
  const buffer = fs.readFileSync(pdfPath);
  const rawText = await extractTextFromBuffer(buffer, 1, 10);
  const hasil = parseSoal(rawText);

  console.log(`Jumlah soal terdeteksi: ${hasil.length}`);
  hasil.forEach((s) => {
    console.log(`[Soal ${s.nomor}] Kunci: ${s.kunci_jawaban} | Tingkat: ${s.difficulty} | Opsi: ${s.opsi_jawaban.length}`);
    console.log(`   Pertanyaan: ${s.pertanyaan.slice(0, 65)}...`);
  });

  if (hasil.length === 10 && hasil.every(s => s.kunci_jawaban && s.opsi_jawaban.length === 5)) {
    console.log('\nSEMUA 10 SOAL BERHASIL DIEKSTRAK DENGAN VISUAL GAMBAR + NOTASI PANGKAT (100% SUKSES)!');
  } else {
    console.log('\nAda soal yang belum terdeteksi sempurna.');
  }
}

main().catch(console.error);
