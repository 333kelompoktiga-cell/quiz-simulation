import { supabaseAdmin } from '../config/db.js';
import { generateLearningRoadmap } from './llm/openRouterService.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidValid = (val) => typeof val === 'string' && UUID.test(val);

/**
 * Mengambil dan menyusun data soal salah dari seluruh kuis dalam satu bab,
 * lalu meminta LLM OpenRouter untuk menscope materi dan menyusun roadmap.
 */
export async function generateOrUpdateRoadmapBab(idUser, idBab) {
  if (!uuidValid(idUser) || !uuidValid(idBab)) {
    throw new Error('ID User dan ID Bab harus berupa UUID valid.');
  }

  // 1. Ambil data Bab
  const { data: bab, error: babError } = await supabaseAdmin
    .from('Bab')
    .select('idBab, namaBab, deskripsi, urutanBab')
    .eq('idBab', idBab)
    .single();

  if (babError || !bab) {
    throw new Error('Bab tidak ditemukan.');
  }

  // 2. Ambil seluruh Kuis di bab ini
  const { data: kuisList, error: kuisError } = await supabaseAdmin
    .from('Kuis')
    .select('idKuis, judul, durasi')
    .eq('idBab', idBab);

  if (kuisError) throw new Error(kuisError.message);
  if (!kuisList || kuisList.length === 0) {
    return {
      idBab,
      namaBab: bab.namaBab,
      status: 'belum_ada_kuis',
      ringkasanBab: 'Belum ada kuis yang tersedia pada bab ini.',
      totalKuisBab: 0,
      totalKuisSelesai: 0,
      totalSoalSalah: 0,
      tahapan: [],
    };
  }

  const idKuisList = kuisList.map((k) => k.idKuis);
  const kuisById = new Map(kuisList.map((k) => [k.idKuis, k]));

  // 3. Ambil pengerjaan kuis terbaru untuk setiap kuis milik user
  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from('PengerjaanKuis')
    .select('idPengerjaan, idKuis, attempt, score, skorFuzzy, akurasi, waktuSelesai')
    .eq('idUser', idUser)
    .eq('status', 'selesai')
    .in('idKuis', idKuisList)
    .order('waktuSelesai', { ascending: false });

  if (attemptsError) throw new Error(attemptsError.message);

  // Ambil attempt terbaru per kuis
  const latestAttemptPerKuis = new Map();
  for (const att of attempts || []) {
    if (!latestAttemptPerKuis.has(att.idKuis)) {
      latestAttemptPerKuis.set(att.idKuis, att);
    }
  }

  const completedAttempts = Array.from(latestAttemptPerKuis.values());
  if (completedAttempts.length === 0) {
    return {
      idBab,
      namaBab: bab.namaBab,
      status: 'belum_dikerjakan',
      ringkasanBab: 'Anda belum menyelesaikan kuis pada bab ini. Selesaikan kuis untuk membuka roadmap belajar.',
      totalKuisBab: kuisList.length,
      totalKuisSelesai: 0,
      totalSoalSalah: 0,
      tahapan: [],
    };
  }

  const completedAttemptIds = completedAttempts.map((a) => a.idPengerjaan);

  // 4. Ambil seluruh jawaban dari pengerjaan terbaru kuis-kuis di bab ini
  const { data: allAnswers, error: answersError } = await supabaseAdmin
    .from('JawabanMahasiswa')
    .select(`
      idSoal,
      idOpsi,
      benar,
      isCorrect,
      idPengerjaan,
      soal:Soal (
        idSoal,
        idKuis,
        pertanyaan,
        pembahasan,
        ringkasan,
        difficulty,
        opsi:OpsiJawaban (idOpsi, opsi, isCorrect)
      )
    `)
    .in('idPengerjaan', completedAttemptIds);

  if (answersError) throw new Error(answersError.message);

  // Ambil butir soal yang salah dari seluruh kuis bab ini
  const wrongAnswers = (allAnswers || []).filter((ans) => {
    return ans.benar === false || ans.isCorrect === false || (!ans.benar && !ans.isCorrect);
  });

  // Format butir soal salah untuk prompt LLM
  const wrongQuestionsFormatted = (wrongAnswers || []).map((ans) => {
    const s = ans.soal || {};
    const kuis = kuisById.get(s.idKuis);
    const opsiList = s.opsi || [];
    const dipilih = opsiList.find((o) => o.idOpsi === ans.idOpsi);
    const benar = opsiList.find((o) => o.isCorrect === true);

    return {
      kuisJudul: kuis?.judul || 'Kuis',
      pertanyaan: s.pertanyaan || '',
      pilihanSiswa: dipilih?.opsi || 'Tidak menjawab',
      kunciJawaban: benar?.opsi || '',
      pembahasan: s.pembahasan || '',
      ringkasan: s.ringkasan || '',
    };
  });

  // 5. Panggil LLM OpenRouter untuk menyusun tahapan roadmap
  const roadmapAiResult = await generateLearningRoadmap({
    namaBab: bab.namaBab,
    deskripsiBab: bab.deskripsi,
    wrongQuestions: wrongQuestionsFormatted,
  });

  const status = wrongQuestionsFormatted.length === 0 ? 'sempurna' : 'perlu_penguatan';

  const payload = {
    idBab,
    namaBab: bab.namaBab,
    status,
    ringkasanBab: roadmapAiResult.ringkasanBab,
    totalSoalSalah: wrongQuestionsFormatted.length,
    totalKuisSelesai: completedAttempts.length,
    totalKuisBab: kuisList.length,
    tahapan: roadmapAiResult.tahapan,
    waktuDiupdate: new Date().toISOString(),
  };

  // 6. Simpan atau perbarui di tabel Roadmap Supabase (cache)
  const { data: existingRoadmap } = await supabaseAdmin
    .from('Roadmap')
    .select('idRoadmap')
    .eq('idUser', idUser)
    .eq('idBab', idBab)
    .maybeSingle();

  if (existingRoadmap?.idRoadmap) {
    await supabaseAdmin
      .from('Roadmap')
      .update({
        rekomendasi: JSON.stringify(payload),
        tanggalDibuat: new Date().toISOString(),
      })
      .eq('idRoadmap', existingRoadmap.idRoadmap);
  } else {
    await supabaseAdmin
      .from('Roadmap')
      .insert({
        idUser,
        idBab,
        urutan: 1,
        rekomendasi: JSON.stringify(payload),
      });
  }

  return payload;
}

/**
 * Mengambil roadmap bab milik mahasiswa. Jika belum pernah digenerate,
 * sistem akan langsung menggeneratenya.
 */
export async function getRoadmapByBab(idUser, idBab) {
  if (!uuidValid(idUser) || !uuidValid(idBab)) {
    throw new Error('ID User dan ID Bab harus berupa UUID valid.');
  }

  const { data: cached, error } = await supabaseAdmin
    .from('Roadmap')
    .select('idRoadmap, rekomendasi, tanggalDibuat')
    .eq('idUser', idUser)
    .eq('idBab', idBab)
    .maybeSingle();

  if (!error && cached?.rekomendasi) {
    try {
      const parsed = JSON.parse(cached.rekomendasi);
      const isTainted = /silahkan\s+hapus|bab\s+testing|template\s+soal|\b123\b|pemahaman\s+kaidah\s+bab/i.test(JSON.stringify(parsed));
      if (!isTainted && Array.isArray(parsed?.tahapan)) {
        return parsed;
      }
      console.log(`[roadmapService] Cache roadmap bab ${idBab} terdeteksi mengandung teks uji coba/placeholder, memperbarui secara otomatis...`);
    } catch {
      // Jika parsing gagal, generate ulang di bawah
    }
  }

  // Jika belum ada di cache, generate baru
  return await generateOrUpdateRoadmapBab(idUser, idBab);
}

/**
 * Mengambil ringkasan peta belajar seluruh bab untuk ditampilkan di halaman /peta-belajar
 */
export async function getAllRoadmapsForUser(idUser) {
  if (!uuidValid(idUser)) throw new Error('ID User tidak valid.');

  // 1. Ambil semua Bab
  const { data: babs, error: babError } = await supabaseAdmin
    .from('Bab')
    .select('idBab, namaBab, deskripsi, urutanBab')
    .order('urutanBab', { ascending: true });

  if (babError) throw new Error(babError.message);

  // 2. Ambil semua Kuis
  const { data: allQuizzes, error: quizError } = await supabaseAdmin
    .from('Kuis')
    .select('idKuis, idBab, pin');

  if (quizError) throw new Error(quizError.message);

  // 3. Ambil pengerjaan selesai milik user
  const { data: attempts, error: attError } = await supabaseAdmin
    .from('PengerjaanKuis')
    .select('idKuis, status, skorFuzzy, waktuSelesai')
    .eq('idUser', idUser)
    .eq('status', 'selesai');

  if (attError) throw new Error(attError.message);

  // Ambil cache Roadmap yang sudah ada
  const { data: cachedRoadmaps } = await supabaseAdmin
    .from('Roadmap')
    .select('idBab, rekomendasi, tanggalDibuat')
    .eq('idUser', idUser);

  const roadmapMap = new Map();
  for (const r of cachedRoadmaps || []) {
    try {
      roadmapMap.set(r.idBab, JSON.parse(r.rekomendasi));
    } catch {
      // ignore
    }
  }

  const completedQuizIds = new Set((attempts || []).map((a) => a.idKuis));

  const list = (babs || []).map((bab) => {
    const kuisBab = (allQuizzes || []).filter((q) => q.idBab === bab.idBab);
    const kuisDibuka = kuisBab.filter((q) => q.pin !== null);
    const selesaiCount = kuisBab.filter((q) => completedQuizIds.has(q.idKuis)).length;

    const cached = roadmapMap.get(bab.idBab);
    const terkunci = selesaiCount === 0;

    let status = 'terkunci';
    let ringkasan = 'Kerjakan kuis pada bab ini untuk membuka peta belajar.';

    if (!terkunci) {
      if (cached) {
        status = cached.status === 'sempurna' ? 'sempurna' : 'roadmap';
        ringkasan = cached.ringkasanBab || `${selesaiCount} kuis telah selesai dianalisis.`;
      } else {
        status = 'roadmap';
        ringkasan = `${selesaiCount} kuis selesai. Roadmap siap digenerate.`;
      }
    } else if (kuisDibuka.length === 0) {
      ringkasan = 'Kuis bab ini belum dibuka oleh dosen.';
    }

    return {
      idBab: bab.idBab,
      namaBab: bab.namaBab,
      deskripsi: bab.deskripsi,
      status, // 'terkunci' | 'roadmap' | 'sempurna'
      ringkasan,
      totalKuis: kuisBab.length,
      selesaiCount,
      totalSoalSalah: cached?.totalSoalSalah ?? null,
      jumlahTahap: cached?.tahapan?.length ?? 0,
      terakhirDiupdate: cached?.waktuDiupdate ?? null,
    };
  });

  return list;
}

