import { supabaseAdmin } from '../config/db.js';
import { successResponse, errorResponse } from '../models/apiResponse.js';
import { evaluateQuiz } from '../services/fuzzyService.js';
import { samaPassword } from '../utils/passwordKuis.js';
import { generateOrUpdateRoadmapBab } from '../services/roadmapService.js';
import { pilihSoalPengerjaan, soalMilikPengerjaan } from '../utils/acakSoal.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOAL_SELECT =
  'idSoal, idKuis, urutan, pertanyaan, difficulty, targetTime, pembahasan, ringkasan, opsi:OpsiJawaban(idOpsi, opsi, isCorrect)';
const DIFFICULTY_LABEL = { 1: 'Mudah', 2: 'Sedang', 3: 'Sulit' };

const uuidValid = (value) => typeof value === 'string' && UUID.test(value);
const idInvalid = (res) => res.status(400).json(errorResponse({ message: 'ID harus berupa UUID yang valid.' }));
const dbError = (res, error, fallback) =>
  res.status(500).json(errorResponse({ message: error?.message || fallback }));

function difficultyLabel(value) {
  return DIFFICULTY_LABEL[value] || (['Mudah', 'Sedang', 'Sulit'].includes(value) ? value : 'Sedang');
}

async function getOwnedAttempt(idPengerjaan, idUser) {
  const { data, error } = await supabaseAdmin
    .from('PengerjaanKuis')
    .select('idPengerjaan, idUser, idKuis, attempt, status, urutanSoal, soalTerakhir, waktuMulai, waktuSelesai, score, skorFuzzy, kategoriFuzzy, totalSoal, totalBenar, totalSalah, akurasi, rataRataWaktu, durasiPengerjaan, rekomendasi, distribusiTingkat, distribusiKesulitan, hasilDetail')
    .eq('idPengerjaan', idPengerjaan)
    .eq('idUser', idUser)
    .maybeSingle();

  return { data, error };
}

async function getQuizQuestions(idKuis) {
  const { data, error } = await supabaseAdmin
    .from('Soal')
    .select(SOAL_SELECT)
    .eq('idKuis', idKuis)
    .order('urutan', { ascending: true, nullsFirst: false })
    .order('idSoal', { ascending: true });

  return { data, error };
}

// Soal yang dikerjakan pada satu percobaan: hasil acakan yang disimpan saat percobaan dimulai.
async function getAttemptQuestions(attempt) {
  const { data, error } = await getQuizQuestions(attempt.idKuis);
  if (error) return { data: null, error };
  return { data: soalMilikPengerjaan(attempt, data), error: null };
}

async function validateAndSaveAnswers(res, attempt, answers) {
  if (!Array.isArray(answers)) {
    res.status(400).json(errorResponse({ message: 'Body harus memuat array jawaban.' }));
    return null;
  }
  if (answers.length > 500) {
    res.status(400).json(errorResponse({ message: 'Jumlah jawaban melebihi batas.' }));
    return null;
  }
  if (answers.length === 0) return 0;

  const questionsResult = await getAttemptQuestions(attempt);
  if (questionsResult.error) {
    dbError(res, questionsResult.error, 'Gagal memeriksa soal kuis.');
    return null;
  }
  const questionById = new Map(questionsResult.data.map((question) => [question.idSoal, question]));
  const questionIds = new Set();
  for (const answer of answers) {
    if (!uuidValid(answer?.idSoal) || !questionById.has(answer.idSoal)) {
      res.status(400).json(errorResponse({ message: 'Jawaban memuat soal yang bukan bagian dari pengerjaan ini.' }));
      return null;
    }
    if (questionIds.has(answer.idSoal)) {
      res.status(400).json(errorResponse({ message: 'Setiap soal hanya boleh memiliki satu jawaban.' }));
      return null;
    }
    questionIds.add(answer.idSoal);
    if (!uuidValid(answer.idOpsi)) {
      res.status(400).json(errorResponse({ message: 'Setiap jawaban harus memilih opsi yang valid.' }));
      return null;
    }
    const responseTime = Number(answer.waktuPengerjaan ?? answer.responseTime);
    if (!Number.isFinite(responseTime) || responseTime < 0 || responseTime > 86400) {
      res.status(400).json(errorResponse({ message: 'Waktu pengerjaan harus berupa angka dari 0 sampai 86400 detik.' }));
      return null;
    }
  }

  const optionIds = answers.map((answer) => answer.idOpsi);
  const { data: options, error: optionsError } = await supabaseAdmin
    .from('OpsiJawaban')
    .select('idOpsi, idSoal')
    .in('idOpsi', optionIds);
  if (optionsError) {
    dbError(res, optionsError, 'Gagal memvalidasi opsi jawaban.');
    return null;
  }
  const optionById = new Map(options.map((option) => [option.idOpsi, option]));
  if (answers.some((answer) => optionById.get(answer.idOpsi)?.idSoal !== answer.idSoal)) {
    res.status(400).json(errorResponse({ message: 'Opsi jawaban tidak sesuai dengan soal yang dipilih.' }));
    return null;
  }

  const rows = answers.map((answer) => {
    const responseTime = Number(answer.waktuPengerjaan ?? answer.responseTime);
    return {
      idPengerjaan: attempt.idPengerjaan,
      idSoal: answer.idSoal,
      idOpsi: answer.idOpsi,
      benar: false,
      waktujawab: Math.round(responseTime),
      isCorrect: false,
      responseTime,
      skorFuzzy: 0,
      kategoriFuzzy: 'Belum dievaluasi',
    };
  });
  if (rows.length) {
    const { error } = await supabaseAdmin
      .from('JawabanMahasiswa')
      .upsert(rows, { onConflict: 'idPengerjaan,idSoal' });
    if (error) {
      dbError(res, error, 'Gagal menyimpan jawaban.');
      return null;
    }
  }
  return rows.length;
}

export const mulaiPengerjaan = async (req, res) => {
  try {
    const { idKuis, pin } = req.body ?? {};
    if (!uuidValid(idKuis)) return idInvalid(res);

    const { data: kuisDb, error: kuisError } = await supabaseAdmin
      .from('Kuis')
      .select('idKuis, judul, durasi, maksPercobaan, pin, acakSoal, jumlahTampil, bab:Bab(namaBab, urutanBab)')
      .eq('idKuis', idKuis)
      .maybeSingle();
    if (kuisError) return dbError(res, kuisError, 'Gagal memeriksa kuis.');
    if (!kuisDb) return res.status(404).json(errorResponse({ message: 'Kuis tidak ditemukan.' }));
    // PIN dipisah supaya tidak ikut terkirim ke mahasiswa di respons
    const { pin: pinKuis, acakSoal, jumlahTampil, bab, ...kuisFields } = kuisDb;
    const kuis = {
      ...kuisFields,
      namaBab: bab?.namaBab ?? null,
      urutanBab: bab?.urutanBab ?? null,
    };

    const { data: questions, error: questionsError } = await getQuizQuestions(idKuis);
    if (questionsError) return dbError(res, questionsError, 'Gagal memuat soal kuis.');
    if (!questions?.length) {
      return res.status(409).json(errorResponse({ message: 'Kuis belum memiliki soal yang terhubung.' }));
    }
    if (questions.some((question) =>
      question.opsi?.length < 2 || question.opsi.filter((option) => option.isCorrect === true).length !== 1
    )) {
      return res.status(409).json(errorResponse({ message: 'Setiap soal harus memiliki minimal dua opsi dan tepat satu kunci jawaban.' }));
    }

    let { data: attempt, error: attemptError } = await supabaseAdmin
      .from('PengerjaanKuis')
      .select('idPengerjaan, attempt, status, urutanSoal, soalTerakhir, waktuMulai')
      .eq('idUser', req.currentUser.id)
      .eq('idKuis', idKuis)
      .eq('status', 'berlangsung')
      .order('waktuMulai', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (attemptError) return dbError(res, attemptError, 'Gagal memeriksa pengerjaan aktif.');

    // PIN hanya diminta saat membuat attempt baru. Attempt yang masih berlangsung sudah
    // pernah lolos PIN, jadi bisa dilanjutkan (mis. setelah refresh) tanpa memasukkan ulang.
    if (!attempt) {
      if (pinKuis === null) {
        return res.status(403).json(errorResponse({
          message: 'Kuis ini belum dibuka oleh dosen.',
          code: 'KUIS_BELUM_DIBUKA',
        }));
      }
      if (pin === undefined || pin === null || pin === '') {
        return res.status(403).json(errorResponse({
          message: 'Masukkan PIN kuis dari dosen untuk memulai.',
          code: 'PIN_DIBUTUHKAN',
        }));
      }
      if (!samaPassword(pin, pinKuis)) {
        res.locals.pinSalah = true; // dihitung oleh batasPinKuis
        return res.status(403).json(errorResponse({ message: 'PIN kuis salah.', code: 'PIN_SALAH' }));
      }

      const { data: created, error: insertError } = await supabaseAdmin
        .rpc('mulai_pengerjaan_kuis', {
          p_id_user: req.currentUser.id,
          p_id_kuis: idKuis,
          p_urutan_soal: pilihSoalPengerjaan({ acakSoal, jumlahTampil }, questions),
        })
        .select('idPengerjaan, attempt, status, urutanSoal, soalTerakhir, waktuMulai')
        .single();
      if (insertError?.code === 'P0001') {
        return res.status(403).json(errorResponse({
          message: 'Jatah percobaan kuis Anda sudah habis.',
          code: 'BATAS_PERCOBAAN_TERCAPAI',
        }));
      }
      if (insertError) return dbError(res, insertError, 'Gagal memulai pengerjaan kuis.');
      attempt = created;
    }

    let attemptQuestions = soalMilikPengerjaan(attempt, questions);
    // Semua soal hasil acakan sudah diganti dosen saat percobaan masih berlangsung: acak ulang.
    if (!attemptQuestions.length) {
      const urutanSoal = pilihSoalPengerjaan({ acakSoal, jumlahTampil }, questions);
      const { error: ulangError } = await supabaseAdmin
        .from('PengerjaanKuis')
        .update({ urutanSoal })
        .eq('idPengerjaan', attempt.idPengerjaan);
      if (ulangError) return dbError(res, ulangError, 'Gagal menyiapkan soal pengerjaan.');
      attempt = { ...attempt, urutanSoal };
      attemptQuestions = soalMilikPengerjaan(attempt, questions);
    }

    const { data: savedAnswers, error: savedAnswersError } = await supabaseAdmin
      .from('JawabanMahasiswa')
      .select('idSoal, idOpsi, responseTime')
      .eq('idPengerjaan', attempt.idPengerjaan);
    if (savedAnswersError) return dbError(res, savedAnswersError, 'Gagal memuat jawaban tersimpan.');

    const { urutanSoal: _urutan, ...pengerjaan } = attempt;
    const safeQuestions = attemptQuestions.map((question, index) => ({
      idSoal: question.idSoal,
      urutan: index + 1,
      pertanyaan: question.pertanyaan,
      difficulty: difficultyLabel(question.difficulty),
      targetTime: question.targetTime,
      opsi: (question.opsi || []).map(({ idOpsi, opsi: text }) => ({ idOpsi, opsi: text })),
    }));
    return res.json(successResponse({
      message: 'Pengerjaan kuis siap.',
      data: {
        pengerjaan,
        kuis,
        soal: safeQuestions,
        jawaban: savedAnswers || [],
      },
    }));
  } catch (error) {
    return dbError(res, error, 'Gagal memulai pengerjaan kuis.');
  }
};

export const simpanJawaban = async (req, res) => {
  try {
    const { idPengerjaan } = req.params;
    if (!uuidValid(idPengerjaan)) return idInvalid(res);

    const { data: attempt, error } = await getOwnedAttempt(idPengerjaan, req.currentUser.id);
    if (error) return dbError(res, error, 'Gagal memeriksa pengerjaan.');
    if (!attempt) return res.status(404).json(errorResponse({ message: 'Pengerjaan tidak ditemukan.' }));
    if (attempt.status !== 'berlangsung') {
      return res.status(409).json(errorResponse({ message: 'Pengerjaan sudah selesai dan tidak dapat diubah.' }));
    }

    const soalTerakhir = req.body?.soalTerakhir;
    if (soalTerakhir !== undefined) {
      const { data: questions, error: questionsError } = await getAttemptQuestions(attempt);
      if (questionsError) return dbError(res, questionsError, 'Gagal memeriksa posisi soal.');
      if (!uuidValid(soalTerakhir) || !questions.some((question) => question.idSoal === soalTerakhir)) {
        return res.status(400).json(errorResponse({ message: 'soalTerakhir harus ID soal dalam pengerjaan ini.' }));
      }
    }
    const saved = await validateAndSaveAnswers(res, attempt, req.body?.jawaban ?? []);
    if (saved === null) return undefined;
    if (soalTerakhir !== undefined) {
      const { data: updated, error: progressError } = await supabaseAdmin.from('PengerjaanKuis')
        .update({ soalTerakhir }).eq('idPengerjaan', idPengerjaan).eq('status', 'berlangsung').select('idPengerjaan').maybeSingle();
      if (progressError) return dbError(res, progressError, 'Gagal menyimpan posisi soal.');
      if (!updated) return res.status(409).json(errorResponse({ message: 'Pengerjaan sudah selesai.' }));
    }
    return res.json(successResponse({
      message: 'Jawaban tersimpan.',
      data: { idPengerjaan, jumlahJawabanTersimpan: saved },
    }));
  } catch (error) {
    return dbError(res, error, 'Gagal menyimpan jawaban.');
  }
};

export const submitPengerjaan = async (req, res) => {
  try {
    const { idPengerjaan } = req.params;
    if (!uuidValid(idPengerjaan)) return idInvalid(res);

    const { data: attempt, error: attemptError } = await getOwnedAttempt(idPengerjaan, req.currentUser.id);
    if (attemptError) return dbError(res, attemptError, 'Gagal memeriksa pengerjaan.');
    if (!attempt) return res.status(404).json(errorResponse({ message: 'Pengerjaan tidak ditemukan.' }));
    if (attempt.status === 'selesai') {
      return res.json(successResponse({ message: 'Hasil pengerjaan.', data: resultResponse(attempt) }));
    }

    if (req.body?.jawaban !== undefined) {
      const saved = await validateAndSaveAnswers(res, attempt, req.body.jawaban);
      if (saved === null) return undefined;
    }

    const [{ data: kuis, error: kuisError }, { data: questions, error: questionsError }] = await Promise.all([
      supabaseAdmin.from('Kuis').select('idKuis, idBab, judul, durasi').eq('idKuis', attempt.idKuis).maybeSingle(),
      getAttemptQuestions(attempt),
    ]);
    if (kuisError) return dbError(res, kuisError, 'Gagal memuat kuis.');
    if (questionsError) return dbError(res, questionsError, 'Gagal memuat soal kuis.');
    if (!kuis || !questions?.length) {
      return res.status(409).json(errorResponse({ message: 'Kuis atau soal tidak lagi tersedia.' }));
    }

    const { data: savedAnswers, error: answersError } = await supabaseAdmin
      .from('JawabanMahasiswa')
      .select('idSoal, idOpsi, responseTime')
      .eq('idPengerjaan', idPengerjaan);
    if (answersError) return dbError(res, answersError, 'Gagal mengambil jawaban.');
    const answerByQuestion = new Map((savedAnswers || []).map((answer) => [answer.idSoal, answer]));

    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(attempt.waktuMulai).getTime()) / 1000));
    const limitSeconds = Math.max(1, Number(kuis.durasi) || 30) * 60;
    const durationSeconds = Math.min(elapsed, limitSeconds);
    const fuzzyInput = questions.map((question) => {
      const answer = answerByQuestion.get(question.idSoal);
      const selectedOption = question.opsi?.find((option) => option.idOpsi === answer?.idOpsi);
      const targetTime = Number(question.targetTime) > 0 ? Number(question.targetTime) : 60;
      const responseTime = answer
        ? Math.min(Math.max(0, Number(answer.responseTime) || 0), limitSeconds)
        : targetTime;
      return {
        soalId: question.idSoal,
        idSoal: question.idSoal,
        idOpsi: answer?.idOpsi || null,
        isCorrect: selectedOption?.isCorrect === true,
        responseTime,
        difficulty: difficultyLabel(question.difficulty),
        targetTime,
      };
    });

    const result = evaluateQuiz(fuzzyInput, durationSeconds);
    const answerRows = questions.map((question, index) => {
      const item = result.detailItems[index];
      const answer = answerByQuestion.get(question.idSoal);
      return {
        idSoal: question.idSoal,
        idOpsi: answer?.idOpsi || null,
        benar: item.meta.isCorrect,
        responseTime: item.meta.responseTime,
        skorFuzzy: item.crispScore,
        kategoriFuzzy: item.linguisticLevel,
      };
    });

    const { error: finalizeError } = await supabaseAdmin.rpc('finalize_pengerjaan_kuis', {
      p_id_pengerjaan: idPengerjaan,
      p_id_user: req.currentUser.id,
      p_result: { ...result, totalWaktuPengerjaan: durationSeconds },
      p_answers: answerRows,
    });
    if (finalizeError) {
      const { data: latest } = await getOwnedAttempt(idPengerjaan, req.currentUser.id);
      if (latest?.status === 'selesai') {
        return res.json(successResponse({ message: 'Hasil pengerjaan.', data: resultResponse(latest) }));
      }
      return dbError(res, finalizeError, 'Gagal menyimpan hasil pengerjaan.');
    }

    const nilai = questions.length > 0
      ? Math.round((result.totalBenar / questions.length) * 100)
      : 0;

    // Perbarui peta belajar bab terkait di latar belakang menggunakan AI
    if (kuis?.idBab) {
      generateOrUpdateRoadmapBab(req.currentUser.id, kuis.idBab).catch((err) => {
        console.error('[PengerjaanController] Gagal memperbarui roadmap bab latar belakang:', err.message);
      });
    }

    return res.json(successResponse({
      message: 'Kuis berhasil dikirim dan dinilai.',
      data: {
        idPengerjaan,
        idKuis: attempt.idKuis,
        status: 'selesai',
        waktuPengerjaan: durationSeconds,
        ...result,
        nilai,
      },
    }));
  } catch (error) {
    return dbError(res, error, 'Gagal mengirim pengerjaan kuis.');
  }
};

function resultResponse(attempt) {
  return {
    idPengerjaan: attempt.idPengerjaan,
    idKuis: attempt.idKuis,
    status: attempt.status,
    waktuMulai: attempt.waktuMulai,
    waktuSelesai: attempt.waktuSelesai,
    nilai: Math.round(Number(attempt.score ?? attempt.akurasi) || 0),
    waktuPengerjaan: attempt.durasiPengerjaan,
    skorFuzzy: attempt.skorFuzzy,
    kategoriFuzzy: attempt.kategoriFuzzy,
    totalSoal: attempt.totalSoal,
    totalBenar: attempt.totalBenar,
    totalSalah: attempt.totalSalah,
    akurasi: attempt.akurasi,
    rataRataWaktu: attempt.rataRataWaktu,
    rekomendasi: attempt.rekomendasi,
    distribusiTingkat: attempt.distribusiTingkat,
    distribusiKesulitan: attempt.distribusiKesulitan,
    detailItems: attempt.hasilDetail,
  };
}

export const getPengerjaan = async (req, res) => {
  try {
    const { idPengerjaan } = req.params;
    if (!uuidValid(idPengerjaan)) return idInvalid(res);

    const { data: attempt, error } = await getOwnedAttempt(idPengerjaan, req.currentUser.id);
    if (error) return dbError(res, error, 'Gagal mengambil hasil pengerjaan.');
    if (!attempt) return res.status(404).json(errorResponse({ message: 'Pengerjaan tidak ditemukan.' }));
    if (attempt.status !== 'selesai') {
      return res.status(409).json(errorResponse({ message: 'Pengerjaan belum selesai.' }));
    }

    return res.json(successResponse({ message: 'Hasil pengerjaan.', data: resultResponse(attempt) }));
  } catch (error) {
    return dbError(res, error, 'Gagal mengambil hasil pengerjaan.');
  }
};

export const getPembahasan = async (req, res) => {
  try {
    const { idPengerjaan } = req.params;
    if (!uuidValid(idPengerjaan)) return idInvalid(res);

    const { data: attempt, error: attemptError } = await getOwnedAttempt(idPengerjaan, req.currentUser.id);
    if (attemptError) return dbError(res, attemptError, 'Gagal memeriksa pengerjaan.');
    if (!attempt) return res.status(404).json(errorResponse({ message: 'Pengerjaan tidak ditemukan.' }));
    if (attempt.status !== 'selesai') {
      return res.status(403).json(errorResponse({ message: 'Pembahasan tersedia setelah kuis selesai.' }));
    }

    const [{ data: questions, error: questionsError }, { data: answers, error: answersError }] = await Promise.all([
      getAttemptQuestions(attempt),
      supabaseAdmin.from('JawabanMahasiswa')
        .select('idSoal, idOpsi, benar, responseTime, skorFuzzy, kategoriFuzzy')
        .eq('idPengerjaan', idPengerjaan),
    ]);
    if (questionsError) return dbError(res, questionsError, 'Gagal memuat soal pembahasan.');
    if (answersError) return dbError(res, answersError, 'Gagal memuat jawaban pembahasan.');

    const answerByQuestion = new Map((answers || []).map((answer) => [answer.idSoal, answer]));
    const pembahasan = (questions || []).map((question, index) => {
      const answer = answerByQuestion.get(question.idSoal);
      return {
        nomorSoal: index + 1,
        idSoal: question.idSoal,
        pertanyaan: question.pertanyaan,
        difficulty: difficultyLabel(question.difficulty),
        opsi: (question.opsi || []).map(({ idOpsi, opsi, isCorrect }) => ({
          idOpsi,
          opsi,
          isCorrect: isCorrect === true,
          dipilih: answer?.idOpsi === idOpsi,
        })),
        benar: answer?.benar === true,
        responseTime: Number(answer?.responseTime) || 0,
        skorFuzzy: Number(answer?.skorFuzzy) || 0,
        pembahasan: question.pembahasan,
        ringkasan: question.ringkasan,
      };
    });

    return res.json(successResponse({ message: 'Pembahasan pengerjaan.', data: pembahasan }));
  } catch (error) {
    return dbError(res, error, 'Gagal mengambil pembahasan.');
  }
};
