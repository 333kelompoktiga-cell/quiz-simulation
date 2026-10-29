import 'dotenv/config';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model default dari .env, dengan daftar model alternatif jika model utama sibuk/rate-limit
const DEFAULT_MODELS = [
  'liquid/lfm-2.5-2.6b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'thinkingmachines/inkling:free',
  'poolside/laguna-s-2.1:free',
];

/**
 * Membersihkan format output JSON dari LLM jika ada tag markdown ```json
 */
function parseJsonSafe(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Membersihkan nama bab/deskripsi dari kata pengujian, placeholder instruksi, atau kode testing
 */
export function cleanPedagogicalTitle(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text
    .replace(/silahkan\s+hapus.*$/gi, '')
    .replace(/hapus\s+(jika|kalau|ketika|saat).*$/gi, '')
    .replace(/\b(bab\s+testing|bab\s+test|testing|test|dummy|percobaan|contoh|draft|template\s+soal|template|kuis)\b/gi, '')
    .replace(/\b(bab\s*\d*)\b/gi, '')
    .replace(/\b\d+\b/g, '')
    .replace(/[^\w\s\-,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Jika setelah dibersihkan tersisa kata-kata yang bukan nama materi (seperti nama developer/admin)
  if (!cleaned || cleaned.length < 3 || /^(tes|kuis|bab|testing|bagas|admin|soal)$/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

/**
 * Membersihkan teks tahapan dari sisa kata uji coba atau instruksi placeholder
 */
export function sanitizeStageText(text, fallbackText = '') {
  if (!text || typeof text !== 'string') return fallbackText;
  let cleaned = text
    .replace(/silahkan\s+hapus.*$/gi, '')
    .replace(/hapus\s+(jika|kalau|ketika|saat)\s+tidak\s+diperlukan/gi, '')
    .replace(/bab\s+testing/gi, 'Ejaan dan Kaidah Kebahasaan')
    .replace(/testing\s+bagas/gi, 'Ejaan dan Kaidah Kebahasaan')
    .replace(/template\s+soal\s*\d*(\s*dan\s*\d*)?/gi, 'Materi Terkait')
    .replace(/\b123\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = cleaned.replace(/,\s*$/, '').trim();
  return cleaned || fallbackText;
}

/**
 * Deteksi materi/topik pedagogis dari konten soal (pertanyaan, pembahasan, ringkasan, kunci)
 */
function detectQuestionTopic(item, namaBab, deskripsiBab) {
  const qText = (item.pertanyaan || '').toLowerCase();
  const pembText = (item.pembahasan || '').toLowerCase();
  const ringkText = (item.ringkasan || '').toLowerCase();
  const kunciText = (item.kunciJawaban || '').toLowerCase();
  const allText = `${qText} ${pembText} ${ringkText} ${kunciText}`.toLowerCase();

  // 1. Prioritas Utama: Huruf Tebal
  if (
    /huruf tebal|cetak tebal/i.test(qText) ||
    /huruf tebal/i.test(allText) ||
    (/tebal/i.test(qText) && !/tebalnya buku|halaman tebal/i.test(qText))
  ) {
    return {
      kategori: 'huruf_tebal',
      judul: 'Penulisan dan Fungsi Huruf Tebal',
      tujuan: 'Siswa memahami kaidah dan fungsi penulisan huruf tebal untuk menandai judul, bab, atau bagian penting dalam dokumen resmi.',
      contoh: 'penulisan judul dokumen atau bagian khusus yang ditegaskan',
      prioritas: 'Prioritas sedang',
      waktu: '15 menit',
    };
  }

  // 2. Huruf Kapital (nama orang, nama kota/geografi, hari, bulan, gelar, satuan ukuran, awal kalimat)
  if (
    /nama orang|nama kota|nama hari|nama bulan|nama diri|geografi|huruf kapital|kapital|huruf besar|nama jalan|nama gelar|derajat celsius|celsius|diawali dengan huruf kapital|ejaan kapital/i.test(allText)
  ) {
    return {
      kategori: 'huruf_kapital',
      judul: 'Kaidah Penulisan Huruf Kapital',
      tujuan: 'Siswa mampu menerapkan penulisan huruf kapital pada nama orang, kota/geografi, hari, bulan, dan awal kalimat secara tepat sesuai EYD.',
      contoh: 'huruf kapital pada awal kalimat dan nama geografi resmi',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // 3. Kata Berimbuhan & Pembentukan Kata (Morfologi)
  if (
    /kata berimbuhan|penggunaan.*imbuhan|imbuhan pen|imbuhan ter|imbuhan me|berimbuhan|morfologi|awalan|akhiran|konfiks|afiks|penulisan.*serangkai|bentuk.*terikat|pensettingan|memastikan|terkonfigurasi|pengoperasian|pemrogram/i.test(allText)
  ) {
    return {
      kategori: 'kata_berimbuhan',
      judul: 'Kaidah Pembentukan dan Penulisan Kata Berimbuhan',
      tujuan: 'Siswa mampu menerapkan kaidah pembentukan kata berimbuhan dan penulisan bentuk serangkai secara tepat.',
      contoh: 'penulisan imbuhan serangkai seperti memastikan dan terkonfigurasi',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // 4. Kata Baku & Kosakata Serapan (Standar KBBI)
  if (
    /kata.*tidak baku|kata.*baku|baku.*kata|ragam baku|standar kbbi|menurut kbbi|pedoman kbbi|eyd|puebi|kwalitas|ijin|aktifitas|analisa|resiko|apotik|antrian|antri\b|fotocopy|sekedar|praktek|obyek|jadual|efektip|penulisan kata yang (tepat|benar|salah)/i.test(allText)
  ) {
    return {
      kategori: 'kata_baku',
      judul: 'Identifikasi Kata Baku Standar KBBI',
      tujuan: 'Siswa mampu membedakan bentuk kata baku dan tidak baku dari kosakata serapan sesuai pedoman KBBI.',
      contoh: 'kualitas, izin, aktivitas, analisis, dan risiko',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // 5. Kata Depan 'di', 'ke' dan Partikel ('pun', 'per')
  if (
    /kata depan|penulisan kata depan|preposisi|di mana|di sana|ke mana|partikel pun|kata depan.*di|di antara.*kata depan/i.test(allText)
  ) {
    return {
      kategori: 'kata_depan',
      judul: 'Penulisan Kata Depan dan Partikel',
      tujuan: 'Siswa mampu membedakan penulisan kata depan "di" yang dipisah dan imbuhan "di-" yang dirangkai serta penggunaan partikel "pun".',
      contoh: '"di antara" dan "di sekolah" vs "dibaca" dan "dikirim"',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // 6. Tanda Baca
  if (/tanda baca|tanda koma|tanda titik|titik dua|titik koma|tanda hubung|tanda petik|tanda pisah|tanda kurung/i.test(allText)) {
    return {
      kategori: 'tanda_baca',
      judul: 'Penggunaan Tanda Baca dalam Kalimat',
      tujuan: 'Siswa mampu menggunakan tanda baca secara tepat untuk memperjelas struktur dan hubungan antarklausa.',
      contoh: 'penggunaan tanda koma pada perincian dan klausa bertingkat',
      prioritas: 'Prioritas sedang',
      waktu: '15 menit',
    };
  }

  // 7. Kalimat Efektif
  if (/kalimat efektif|kalimat tidak efektif|kehematan|keparalelan|kelogisan|subjek ganda|rancu|pleonasme|struktur kalimat/i.test(allText)) {
    return {
      kategori: 'kalimat_efektif',
      judul: 'Penyusunan Kalimat Efektif',
      tujuan: 'Siswa mampu menyusun kalimat yang hemat, lugas, dan terstruktur secara logis.',
      contoh: 'kesejajaran bentuk kata kerja dan kejelasan subjek',
      prioritas: 'Prioritas sedang',
      waktu: '20 menit',
    };
  }

  // 8. Ide Pokok, Paragraf & Pemahaman Isi Cerita / Teks
  if (/bacalah cerita|bacalah kutipan|bacalah teks|ide pokok|gagasan pokok|gagasan utama|simpulan|paragraf|makna kata|pernyataan yang sesuai|amanat|isi kutipan|informasi tersurat|informasi tersirat/i.test(allText)) {
    return {
      kategori: 'pemahaman_bacaan',
      judul: 'Menemukan Ide Pokok dan Pemahaman Isi Teks',
      tujuan: 'Siswa mampu menentukan gagasan pokok, inti pesan, dan menarik simpulan isi bacaan secara tepat.',
      contoh: 'penentuan kalimat utama pada pola paragraf dan pemahaman alur cerita',
      prioritas: 'Prioritas sedang',
      waktu: '20 menit',
    };
  }

  // 9. Operasi Faktorial, Deret & Bilangan
  if (/faktorial|\\frac|!|deret|barisan bilangan|1\+2\+3/i.test(allText)) {
    return {
      kategori: 'aritmatika_deret',
      judul: 'Operasi Faktorial dan Barisan Bilangan',
      tujuan: 'Siswa mampu menyelesaikan operasi hitung faktorial dan pola deret bilangan dengan langkah sistematis.',
      contoh: '(5! + 6!) / 4! dan penjumlahan deret bilangan',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // 10. PLSV & Matematika Aljabar
  if (/ruas|persamaan|plsv|variabel|aljabar|kesetaraan/i.test(allText)) {
    return {
      kategori: 'aljabar',
      judul: 'Memahami Operasi Kedua Ruas dan Penyelesaian PLSV',
      tujuan: 'Siswa memahami bahwa operasi yang dilakukan pada satu ruas harus menjaga kesetaraan persamaan.',
      contoh: 'x + 5 = 12 dan penyelesaian bertahap PLSV',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // 11. Operasi Bilangan Negatif
  if (/bilangan negatif|negatif|bilangan bulat|aturan tanda/i.test(allText)) {
    return {
      kategori: 'bilangan_negatif',
      judul: 'Operasi Bilangan Bulat Negatif',
      tujuan: 'Siswa mampu melakukan operasi penjumlahan dan pengurangan bilangan negatif secara tepat.',
      contoh: 'x - (-3) = 8 dan aturan tanda positif/negatif',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // 12. Operasi Hitung Aritmatika Umum
  if (/aritmatika|hitung|penjumlahan|perkalian|pembagian/i.test(allText)) {
    return {
      kategori: 'aritmatika',
      judul: 'Operasi Hitung Aritmatika dan Bilangan',
      tujuan: 'Siswa mampu menyelesaikan operasi perhitungan aritmatika secara tepat dan teliti.',
      contoh: 'operasi hitung campuran bertahap',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // 13. Fallback cerdas: Deteksi apakah dominan angka/matematika atau teks bahasa
  const isMath = /[\d+\-*/=^\\(\)]/.test(qText) && !/[a-zA-Z]{5,}/.test(qText);
  if (isMath) {
    return {
      kategori: 'penalaran_hitung',
      judul: 'Penalaran Operasi Hitung dan Logika Matematika',
      tujuan: 'Siswa mampu menyelesaikan perhitungan konsep dasar dan penalaran logika secara terstruktur.',
      contoh: 'penerapan sifat operasi hitung pada pemecahan masalah',
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // Cek apakah ada nama bab resmi yang valid (bukan kata testing/dummy)
  const cleanedBab = cleanPedagogicalTitle(namaBab);
  if (cleanedBab) {
    return {
      kategori: 'umum',
      judul: `Pemahaman Materi ${cleanedBab}`,
      tujuan: `Siswa mampu memahami konsep dan kaidah pokok pada materi ${cleanedBab} secara menyeluruh.`,
      contoh: `penerapan kaidah ${cleanedBab} pada soal kontekstual`,
      prioritas: 'Prioritas tinggi',
      waktu: '15 menit',
    };
  }

  // Fallback standar kebahasaan jika soal berbahasa Indonesia
  return {
    kategori: 'umum_bahasa',
    judul: 'Kaidah Kebahasaan dan Pemahaman Bacaan',
    tujuan: 'Siswa mampu memahami kaidah ejaan, struktur kalimat, dan pesan pokok bacaan secara menyeluruh.',
    contoh: 'analisis kebahasaan pada kalimat dan teks kontekstual',
    prioritas: 'Prioritas tinggi',
    waktu: '15 menit',
  };
}

/**
 * Fallback pedagogis cerdas jika kuota API OpenRouter habis atau jaringan terputus
 */
function createFallbackRoadmap(namaBab, wrongQuestions, deskripsiBab) {
  const displayBab = cleanPedagogicalTitle(namaBab) || 'Pembelajaran';

  if (!wrongQuestions || wrongQuestions.length === 0) {
    return {
      ringkasanBab: `Selamat! Anda telah menguasai seluruh materi pada bab ${displayBab} dengan sangat baik.`,
      tahapan: [
        {
          tahapKe: 1,
          judul: `Pengayaan Materi ${displayBab}`,
          prioritas: 'Pengayaan',
          estimasiWaktu: '15 menit',
          tujuan: `Memperdalam wawasan dan aplikasi lanjutan materi ${displayBab} dalam konteks yang lebih kompleks.`,
          aktivitas: [
            `Pelajari studi kasus dan penerapan tingkat lanjut materi ${displayBab}.`,
            'Tinjau kembali ringkasan materi untuk mempertahankan retensi pemahaman.',
            'Coba latihan tantangan mandiri tingkat lanjut.',
          ],
          kriteriaSelesai: 'Selesai membaca dan memahami materi pengayaan.',
          soalTerkait: [],
        },
      ],
    };
  }

  // Kelompokkan soal salah berdasarkan topik pedagogis nyata (BUKAN judul kuis atau placeholder!)
  const topicMap = new Map();
  for (const item of wrongQuestions) {
    const meta = detectQuestionTopic(item, namaBab, deskripsiBab);
    const key = meta.judul;
    if (!topicMap.has(key)) {
      topicMap.set(key, { ...meta, items: [] });
    }
    topicMap.get(key).items.push(item);
  }

  const clusters = Array.from(topicMap.values());

  // Urutkan materi: Prioritas tinggi terlebih dahulu sebelum prioritas sedang
  clusters.sort((a, b) => {
    if (a.prioritas.includes('tinggi') && !b.prioritas.includes('tinggi')) return -1;
    if (!a.prioritas.includes('tinggi') && b.prioritas.includes('tinggi')) return 1;
    return b.items.length - a.items.length;
  });

  const tahapan = clusters.map((c, idx) => {
    const count = Math.min(Math.max(c.items.length, 3), 5);
    const passing = Math.max(1, Math.ceil(count * 0.7));

    return {
      tahapKe: idx + 1,
      judul: c.judul,
      prioritas: c.prioritas,
      estimasiWaktu: c.waktu,
      tujuan: c.tujuan,
      aktivitas: [
        `Pelajari konsep dan aturan pokok ${c.judul}.`,
        `Amati contoh penerapan yang benar (${c.contoh}).`,
        `Kerjakan ${count} soal latihan penguatan ${c.judul}.`,
      ],
      kriteriaSelesai: `minimal ${passing} dari ${count} soal benar.`,
      soalTerkait: c.items.map((q) => `Soal: "${(q.pertanyaan || '').replace(/\s+/g, ' ').slice(0, 75)}..."`),
    };
  });

  // Tahap terakhir WAJIB: Evaluasi pemahaman
  tahapan.push({
    tahapKe: tahapan.length + 1,
    judul: 'Evaluasi pemahaman',
    prioritas: 'Evaluasi akhir',
    estimasiWaktu: '10 menit',
    tujuan: 'Memastikan siswa mampu menerapkan konsep yang sudah dipelajari.',
    aktivitas: [
      'Kerjakan kuis evaluasi berisi soal latihan baru.',
      'Tinjau kembali pembahasan jawaban yang salah.',
      'Jika belum mencapai target, ulangi materi yang masih lemah.',
    ],
    kriteriaSelesai: 'Target evaluasi: minimal 80/100.',
    soalTerkait: [],
  });

  return {
    ringkasanBab: `Ditemukan ${wrongQuestions.length} butir soal yang belum tepat pada bab ${displayBab}. Roadmap disusun dari materi prasyarat hingga evaluasi akhir.`,
    tahapan,
  };
}

/**
 * Menghasilkan roadmap tahapan belajar dari butir soal salah menggunakan LLM OpenRouter
 */
export async function generateLearningRoadmap({ namaBab, deskripsiBab, wrongQuestions }) {
  const displayBab = cleanPedagogicalTitle(namaBab) || 'Pembelajaran';
  const cleanDeskripsi = cleanPedagogicalTitle(deskripsiBab) || 'Kaidah Ejaan dan Tata Bahasa';

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[OpenRouter] OPENROUTER_API_KEY belum dikonfigurasi, menggunakan fallback generator.');
    return createFallbackRoadmap(namaBab, wrongQuestions, deskripsiBab);
  }

  if (!wrongQuestions || wrongQuestions.length === 0) {
    return createFallbackRoadmap(namaBab, [], deskripsiBab);
  }

  const systemPrompt = `Kamu adalah asisten dosen pakar evaluasi kurikulum dan pedagogi pembelajaran pada sistem e-SIKAP.
Tugasmu adalah menganalisis butir-butir soal yang dijawab SALAH oleh seorang mahasiswa pada Bab: "${displayBab}".
Karakteristik Bab: ${cleanDeskripsi}.

Instruksi Analisis (WAJIB DIIKUTI):
1. Identifikasi learning gap dari butir-butir jawaban yang salah. Kelompokkan soal-soal tersebut ke dalam sub-materi/topik konseptual nyata (misal: "Identifikasi Kata Baku Standar KBBI", "Kaidah Pembentukan Kata Berimbuhan", "Penulisan Kata Depan 'di'", "Kaidah Penulisan Huruf Kapital", "Penulisan dan Fungsi Huruf Tebal", "Operasi Faktorial dan Barisan Bilangan", dsb).
   DILARANG KERAS memuat kata "testing", "template soal", "silahkan hapus", atau placeholder pengujian pada judul maupun isi tahapan!
2. Prioritaskan materi prasyarat sebelum materi lanjutan. Beri label "Prioritas tinggi" untuk materi dasar/prasyarat dan "Prioritas sedang" untuk materi lanjutan.
3. Buat tujuan belajar yang spesifik dan terukur (awali dengan "Siswa mampu..." atau "Siswa memahami...").
4. Berikan aktivitas belajar dan latihan dalam bentuk array poin-poin konkret:
   - Pelajari konsep / aturan ...
   - Amati / pelajari contoh ...
   - Kerjakan N soal latihan ...
5. Tentukan kriteria keberhasilan setiap tahap yang terukur (contoh: "minimal 2 dari 3 soal benar" atau "minimal 4 dari 5 soal benar").
6. Gunakan bahasa sederhana dan jelas untuk mahasiswa.
7. Jangan mengarang hasil jawaban atau mengklaim kemampuan mahasiswa yang tidak didukung data.
8. Tahap terakhir pada roadmap WAJIB berupa tahap penutup:
   - "judul": "Evaluasi pemahaman"
   - "prioritas": "Evaluasi akhir"
   - "estimasiWaktu": "10 menit"
   - "tujuan": "Memastikan siswa mampu menerapkan konsep yang sudah dipelajari."
   - "aktivitas": [
       "Kerjakan kuis evaluasi berisi 5 soal baru.",
       "Tinjau kembali pembahasan jawaban yang salah.",
       "Jika belum mencapai target, ulangi materi yang masih lemah."
     ]
   - "kriteriaSelesai": "Target evaluasi: minimal 80/100."
   - "soalTerkait": []
9. Balas HANYA dengan JSON valid sesuai skema yang ditentukan, tanpa teks pengantar di luar blok JSON.`;

  const userPrompt = `Berikut adalah ${wrongQuestions.length} butir soal yang dijawab salah oleh mahasiswa pada bab "${displayBab}":
${JSON.stringify(
  wrongQuestions.map((q, idx) => ({
    nomor: idx + 1,
    pertanyaan: q.pertanyaan,
    jawabanSiswaSalah: q.pilihanSiswa || 'Tidak menjawab',
    kunciJawabanBenar: q.kunciJawaban || '-',
    pembahasan: q.pembahasan || '-',
  })),
  null,
  2
)}

Susunlah Roadmap Belajar dalam format JSON persis seperti ini:
{
  "ringkasanBab": "string (analisis ringkas performa dan learning gap mahasiswa)",
  "tahapan": [
    {
      "tahapKe": 1,
      "judul": "string (Nama topik/materi spesifik)",
      "prioritas": "string (misal: Prioritas tinggi / Prioritas sedang)",
      "estimasiWaktu": "string (misal: 15 menit / 20 menit)",
      "tujuan": "string (Siswa memahami / mampu ...)",
      "aktivitas": [
        "Pelajari konsep ...",
        "Amati contoh ...",
        "Kerjakan N soal latihan ..."
      ],
      "kriteriaSelesai": "string (misal: minimal 2 dari 3 soal benar)",
      "soalTerkait": ["Soal: ..."]
    }
  ]
}`;

  // Coba model satu per satu tanpa duplikasi
  const models = Array.from(new Set([
    process.env.OPENROUTER_MODEL,
    ...DEFAULT_MODELS,
  ].filter(Boolean)));

  for (const model of models) {
    try {
      console.log(`[OpenRouter] Mengirim permintaan analisis ke model: ${model}`);
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
          'X-Title': 'e-SIKAP Learning Roadmap AI',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(45000), // Timeout 45 detik
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.warn(`[OpenRouter] Gagal pada model ${model} (${res.status}):`, errorData?.error?.message || res.statusText);
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      const parsed = parseJsonSafe(content);

      if (parsed && Array.isArray(parsed.tahapan) && parsed.tahapan.length > 0) {
        console.log(`[OpenRouter] Berhasil menghasilkan roadmap dengan model: ${model}`);
        return {
          ringkasanBab: sanitizeStageText(parsed.ringkasanBab, `Analisis hasil evaluasi belajar bab ${displayBab}.`),
          tahapan: parsed.tahapan.map((t, idx) => {
            const rawJudul = t.judul || `Materi Tahap ${idx + 1}`;
            const cleanJudul = sanitizeStageText(rawJudul, `Materi Penguatan Konsep ${idx + 1}`);
            const rawTujuan = t.tujuan || 'Meningkatkan penguasaan konsep.';
            const cleanTujuan = sanitizeStageText(rawTujuan, 'Meningkatkan penguasaan konsep materi.');

            let rawAkt = [];
            if (Array.isArray(t.aktivitas)) rawAkt = t.aktivitas;
            else if (typeof t.kegiatan === 'string') rawAkt = t.kegiatan.split('·').map((s) => s.trim());
            else rawAkt = ['Pelajari kembali materi yang belum tepat.', 'Amati contoh pembahasan soal.', 'Kerjakan latihan mandiri.'];

            const cleanAkt = rawAkt
              .map((a) => sanitizeStageText(a))
              .filter(Boolean);

            return {
              tahapKe: idx + 1,
              judul: cleanJudul,
              prioritas: t.prioritas || (idx === 0 ? 'Prioritas tinggi' : 'Prioritas sedang'),
              estimasiWaktu: t.estimasiWaktu || '15 menit',
              tujuan: cleanTujuan,
              aktivitas: cleanAkt.length ? cleanAkt : ['Pelajari konsep materi.', 'Amati contoh penerapan.', 'Kerjakan latihan mandiri.'],
              kriteriaSelesai: t.kriteriaSelesai || 'minimal 2 dari 3 soal benar.',
              soalTerkait: Array.isArray(t.soalTerkait) ? t.soalTerkait : [],
            };
          }),
        };
      } else {
        console.warn(`[OpenRouter] Format JSON dari model ${model} tidak sesuai skema:`, content);
      }
    } catch (err) {
      console.warn(`[OpenRouter] Kesalahan jaringan/koneksi saat memanggil ${model}:`, err.message);
    }
  }

  console.warn('[OpenRouter] Seluruh panggilan LLM gagal/terbatas (mis. limit harian tercapai), mengaktifkan fallback generator pedagogis.');
  return createFallbackRoadmap(namaBab, wrongQuestions, deskripsiBab);
}
