import 'dotenv/config';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model default dari .env, dengan daftar model alternatif jika model utama sibuk/rate-limit
const DEFAULT_MODELS = [
  'liquid/lfm-2.5-2.6b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-26b-a4b-it:free',
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
    // Coba temukan substring JSON { ... }
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
 * Fallback jika API OpenRouter sedang tidak bisa diakses
 */
function createFallbackRoadmap(namaBab, wrongQuestions) {
  if (!wrongQuestions || wrongQuestions.length === 0) {
    return {
      ringkasanBab: `Selamat! Anda telah menguasai seluruh materi pada bab ${namaBab} dengan sangat baik.`,
      tahapan: [
        {
          judul: `Pengayaan Materi ${namaBab}`,
          ringkasan: 'Seluruh soal pada kuis bab ini dijawab dengan benar.',
          tujuan: `Memperdalam wawasan dan aplikasi lanjutan materi ${namaBab} dalam konteks penulisan akademik yang lebih kompleks.`,
          kegiatan: 'Pelajari studi kasus penulisan tingkat lanjut dan pertahankan pemahaman kaidah yang sudah dikuasai.',
          soalTerkait: [],
        },
      ],
    };
  }

  // Kelompokkan berdasarkan ringkasan atau kuis
  const groups = new Map();
  for (const item of wrongQuestions) {
    const topic = item.ringkasan?.trim() || item.kuisJudul || `Materi Pokok ${namaBab}`;
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(item);
  }

  const tahapan = Array.from(groups.entries()).map(([judul, items], idx) => ({
    judul,
    ringkasan: `${items.length} soal terkait materi ini belum tepat pada pengerjaan kuis Anda.`,
    tujuan: `Memahami kembali kaidah dasar materi ${judul} dan mengenali pola soal yang serupa.`,
    kegiatan: `Baca kembali modul ${judul} · telaah pembahasan kunci jawaban · coba latihan mandiri terkait kaidah ini.`,
    soalTerkait: items.map((q, i) => `${q.kuisJudul || 'Kuis'} - Soal: "${q.pertanyaan?.slice(0, 50)}..."`),
  }));

  return {
    ringkasanBab: `Ditemukan ${wrongQuestions.length} butir soal yang perlu diperkuat pada bab ${namaBab}.`,
    tahapan,
  };
}

/**
 * Menghasilkan roadmap tahapan belajar dari butir soal salah menggunakan LLM
 */
export async function generateLearningRoadmap({ namaBab, deskripsiBab, wrongQuestions }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[OpenRouter] OPENROUTER_API_KEY belum dikonfigurasi, menggunakan fallback generator.');
    return createFallbackRoadmap(namaBab, wrongQuestions);
  }

  if (!wrongQuestions || wrongQuestions.length === 0) {
    return createFallbackRoadmap(namaBab, []);
  }

  const systemPrompt = `Kamu adalah asisten dosen pakar evaluasi kurikulum dan pedagogi pembelajaran pada sistem e-SIKAP.
Tugasmu adalah menganalisis butir-butir soal yang dijawab SALAH oleh seorang mahasiswa pada Bab: "${namaBab}".
Karakteristik Bab: ${deskripsiBab || 'Materi pembelajaran Bahasa Indonesia'}.

Instruksi Analisis:
1. Bacalah setiap pertanyaan, jawaban salah yang dipilih mahasiswa, kunci jawaban yang benar, dan pembahasannya.
2. Kelompokkan (scope) soal-soal tersebut ke dalam sub-materi/topik yang relevan (misal: "Penulisan Huruf Tebal", "Penulisan Huruf Kapital", "Penggunaan Tanda Hubung", dsb).
3. Untuk setiap kelompok materi yang salah, buatkan 1 tahapan belajar terstruktur (Tahap 1, Tahap 2, dst.) diurutkan dari prioritas paling mendasar atau paling banyak salah.
4. Setiap tahap WAJIB memiliki field:
   - "judul": Nama topik/materi spesifik yang salah.
   - "ringkasan": Analisis singkat mengapa mahasiswa salah dan bagian mana dari konsep tersebut yang belum dipahami.
   - "tujuan": Tujuan pembelajaran konkret agar tidak mengulangi kesalahan serupa.
   - "kegiatan": Rekomendasi aktivitas belajar nyata (misal: pelajari kaidah aturan X, amati perbandingan contoh A dan B, kerjakan latihan mandiri).
   - "soalTerkait": Array string berisi cuplikan soal atau kuis yang terkait.
5. Sediakan juga field "ringkasanBab": Rangkuman menyeluruh evaluasi belajar mahasiswa pada bab ini (1-2 kalimat).
6. Balas HANYA dengan JSON valid tanpa teks pengantar di luar JSON.`;

  const userPrompt = `Berikut adalah ${wrongQuestions.length} soal yang dijawab salah oleh mahasiswa pada bab "${namaBab}":
${JSON.stringify(
  wrongQuestions.map((q, idx) => ({
    nomor: idx + 1,
    kuis: q.kuisJudul || 'Kuis',
    pertanyaan: q.pertanyaan,
    jawabanSiswaSalah: q.pilihanSiswa || 'Tidak menjawab',
    kunciJawabanBenar: q.kunciJawaban || '-',
    pembahasan: q.pembahasan || '-',
    kategoriAwal: q.ringkasan || '-',
  })),
  null,
  2
)}

Buatkan Roadmap Peta Belajar dalam format JSON:
{
  "ringkasanBab": "string",
  "tahapan": [
    {
      "judul": "string",
      "ringkasan": "string",
      "tujuan": "string",
      "kegiatan": "string",
      "soalTerkait": ["string"]
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
        signal: AbortSignal.timeout(25000), // Timeout 25 detik per model
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.warn(`[OpenRouter] Gagal pada model ${model} (${res.status}):`, errorData?.error?.message || res.statusText);
        continue; // Coba model berikutnya
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      const parsed = parseJsonSafe(content);

      if (parsed && Array.isArray(parsed.tahapan) && parsed.tahapan.length > 0) {
        console.log(`[OpenRouter] Berhasil menghasilkan roadmap dengan model: ${model}`);
        return {
          ringkasanBab: parsed.ringkasanBab || `Analisis hasil evaluasi belajar bab ${namaBab}.`,
          tahapan: parsed.tahapan.map((t, idx) => ({
            tahapKe: idx + 1,
            judul: t.judul || `Materi Tahap ${idx + 1}`,
            ringkasan: t.ringkasan || 'Perlu pendalaman materi.',
            tujuan: t.tujuan || 'Meningkatkan penguasaan konsep.',
            kegiatan: t.kegiatan || 'Pelajari kembali materi dan kerjakan latihan.',
            soalTerkait: Array.isArray(t.soalTerkait) ? t.soalTerkait : [],
          })),
        };
      } else {
        console.warn(`[OpenRouter] Format JSON dari model ${model} tidak sesuai skema:`, content);
      }
    } catch (err) {
      console.warn(`[OpenRouter] Kesalahan jaringan/koneksi saat memanggil ${model}:`, err.message);
    }
  }

  console.warn('[OpenRouter] Seluruh panggilan LLM gagal/terbatas, mengaktifkan fallback generator.');
  return createFallbackRoadmap(namaBab, wrongQuestions);
}

