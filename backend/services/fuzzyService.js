import {
  LINGUISTIC_LEVELS,
  DIFFICULTY_LEVELS,
  TIME_CATEGORIES,
  CORRECTNESS_SETS,
  OUTPUT_MEMBERSHIP_CONFIG,
  triangular,
  trapezoidal,
  getOutputMembership,
  fuzzifyCorrectness,
  fuzzifyResponseTime,
  fuzzifyDifficulty,
} from './fuzzy/membership.js';

import {
  RULES,
  evaluateRules,
} from './fuzzy/rules.js';

import {
  SCORE_THRESHOLDS,
  MIN_CENTROID,
  MAX_CENTROID,
  normalizeCentroid,
  defuzzifyCentroid,
  mapScoreToLevel,
} from './fuzzy/defuzzifier.js';

// Generates pedagogical diagnostic feedback based on accuracy, speed, and difficulty
function generateDiagnosticFeedback({
  kategoriFuzzy,
  akurasi,
  rataRataWaktu,
  distribusiKesulitan,
}) {
  const feedback = [];

  if (kategoriFuzzy === LINGUISTIC_LEVELS.TINGGI) {
    feedback.push('Tingkat pemahaman materi sangat tinggi. Penguasaan konsep solid, akurat, dan efisien dalam manajemen waktu.');
  } else if (kategoriFuzzy === LINGUISTIC_LEVELS.SEDANG) {
    feedback.push('Tingkat pemahaman materi tergolong baik (sedang). Terdapat beberapa konsep yang sudah dikuasai dengan baik.');
  } else if (kategoriFuzzy === LINGUISTIC_LEVELS.RENDAH) {
    feedback.push('Tingkat pemahaman materi masih rendah. Perlu evaluasi pemahaman konsep dasar dan review materi.');
  } else {
    feedback.push('Tingkat pemahaman materi sangat rendah. Disarankan untuk mempelajari kembali modul materi secara menyeluruh.');
  }

  if (akurasi < 50 && rataRataWaktu < 20) {
    feedback.push('Terdeteksi kecenderungan menjawab terburu-buru (impulsive answering). Disarankan membaca soal lebih teliti dan meluangkan waktu menganalisis opsi jawaban.');
  } else if (akurasi >= 80 && rataRataWaktu > 60) {
    feedback.push('Akurasi jawaban sangat baik, namun proses bernalar membutuhkan waktu relatif lama. Latihan soal berkala dapat meningkatkan kecepatan dan kepercayaan diri.');
  }

  const sulitStats = distribusiKesulitan[DIFFICULTY_LEVELS.SULIT];
  const mudahStats = distribusiKesulitan[DIFFICULTY_LEVELS.MUDAH];

  if (sulitStats && sulitStats.total > 0 && sulitStats.akurasi >= 70) {
    feedback.push('Kemampuan pemecahan masalah (problem solving) pada soal tingkat tinggi (HOTS / Sulit) sangat mengesankan.');
  } else if (sulitStats && sulitStats.total > 0 && sulitStats.akurasi < 40 && mudahStats && mudahStats.akurasi >= 70) {
    feedback.push('Konsep dasar telah dipahami dengan baik, namun perlu penguatan pada soal-soal penalaran kompleks dan kasus aplikasi.');
  }

  return feedback.join(' ');
}

// Evaluates a single quiz item using Mamdani fuzzy inference
export function evaluateItem({
  isCorrect,
  responseTime,
  difficulty,
  targetTime = 60,
  stepSize = 0.5,
} = {}) {
  const fuzzCorrectness = fuzzifyCorrectness(isCorrect);
  const fuzzTime = fuzzifyResponseTime(responseTime, targetTime);
  const fuzzDiff = fuzzifyDifficulty(difficulty);

  const { firingWeights, activeRules } = evaluateRules(fuzzCorrectness, fuzzTime, fuzzDiff);

  const isCorrectBool = fuzzCorrectness[CORRECTNESS_SETS.BENAR] === 1.0;
  const rawScore = defuzzifyCentroid(firingWeights, stepSize, isCorrectBool);
  const rawCentroidScore = Number(rawScore.toFixed(2));
  const crispScore = normalizeCentroid(rawScore);
  const linguisticLevel = mapScoreToLevel(crispScore);

  return {
    crispScore,
    rawCentroidScore,
    linguisticLevel,
    firingWeights: {
      [LINGUISTIC_LEVELS.SANGAT_RENDAH]: Number((firingWeights[LINGUISTIC_LEVELS.SANGAT_RENDAH] || 0).toFixed(4)),
      [LINGUISTIC_LEVELS.RENDAH]: Number((firingWeights[LINGUISTIC_LEVELS.RENDAH] || 0).toFixed(4)),
      [LINGUISTIC_LEVELS.SEDANG]: Number((firingWeights[LINGUISTIC_LEVELS.SEDANG] || 0).toFixed(4)),
      [LINGUISTIC_LEVELS.TINGGI]: Number((firingWeights[LINGUISTIC_LEVELS.TINGGI] || 0).toFixed(4)),
    },
    activeRules,
    fuzzifiedInputs: {
      correctness: fuzzCorrectness,
      responseTime: fuzzTime,
      difficulty: {
        [DIFFICULTY_LEVELS.MUDAH]: fuzzDiff[DIFFICULTY_LEVELS.MUDAH],
        [DIFFICULTY_LEVELS.SEDANG]: fuzzDiff[DIFFICULTY_LEVELS.SEDANG],
        [DIFFICULTY_LEVELS.SULIT]: fuzzDiff[DIFFICULTY_LEVELS.SULIT],
      },
    },
    meta: {
      isCorrect: isCorrectBool,
      responseTime: Math.max(0, Number(responseTime) || 0),
      difficulty: fuzzDiff.normalizedDifficulty,
      targetTime: Number(targetTime) > 0 ? Number(targetTime) : 60,
    },
  };
}

// Evaluates complete quiz submission and calculates aggregate metrics
export function evaluateQuiz(answersArray, totalDurationSeconds = null, options = {}) {
  if (!Array.isArray(answersArray) || answersArray.length === 0) {
    return {
      skorFuzzy: 0.0,
      rawSkorFuzzy: 0.0,
      kategoriFuzzy: LINGUISTIC_LEVELS.SANGAT_RENDAH,
      totalSoal: 0,
      totalBenar: 0,
      totalSalah: 0,
      akurasi: 0.0,
      rataRataWaktu: 0.0,
      totalWaktuPengerjaan: totalDurationSeconds ? Math.max(0, Number(totalDurationSeconds)) : 0.0,
      distribusiTingkat: {
        [LINGUISTIC_LEVELS.SANGAT_RENDAH]: 0,
        [LINGUISTIC_LEVELS.RENDAH]: 0,
        [LINGUISTIC_LEVELS.SEDANG]: 0,
        [LINGUISTIC_LEVELS.TINGGI]: 0,
      },
      distribusiKesulitan: {
        [DIFFICULTY_LEVELS.MUDAH]: { total: 0, benar: 0, akurasi: 0, rataRataSkor: 0 },
        [DIFFICULTY_LEVELS.SEDANG]: { total: 0, benar: 0, akurasi: 0, rataRataSkor: 0 },
        [DIFFICULTY_LEVELS.SULIT]: { total: 0, benar: 0, akurasi: 0, rataRataSkor: 0 },
      },
      rekomendasi: 'Tidak ada data jawaban untuk dievaluasi.',
      detailItems: [],
    };
  }

  const stepSize = options.stepSize || 0.5;
  let totalScoreSum = 0;
  let rawScoreSum = 0;
  let totalBenarCount = 0;
  let accumulatedItemTime = 0;

  const distribusiTingkat = {
    [LINGUISTIC_LEVELS.SANGAT_RENDAH]: 0,
    [LINGUISTIC_LEVELS.RENDAH]: 0,
    [LINGUISTIC_LEVELS.SEDANG]: 0,
    [LINGUISTIC_LEVELS.TINGGI]: 0,
  };

  const difficultyBuckets = {
    [DIFFICULTY_LEVELS.MUDAH]: { total: 0, benar: 0, scoreSum: 0 },
    [DIFFICULTY_LEVELS.SEDANG]: { total: 0, benar: 0, scoreSum: 0 },
    [DIFFICULTY_LEVELS.SULIT]: { total: 0, benar: 0, scoreSum: 0 },
  };

  const detailItems = answersArray.map((ans, idx) => {
    const item = ans || {};
    const isCorrect = item.isCorrect !== undefined ? item.isCorrect : item.benar;
    const responseTime = item.responseTime !== undefined
      ? item.responseTime
      : (item.waktu !== undefined ? item.waktu : item.waktuPengerjaan);
    const difficulty = item.difficulty !== undefined
      ? item.difficulty
      : (item.kesulitan !== undefined ? item.kesulitan : item.tingkatKesulitan);
    const targetTime = item.targetTime !== undefined
      ? item.targetTime
      : (item.targetWaktu !== undefined ? item.targetWaktu : 60);

    const evaluated = evaluateItem({
      isCorrect,
      responseTime,
      difficulty,
      targetTime,
      stepSize,
    });

    totalScoreSum += evaluated.crispScore;
    rawScoreSum += evaluated.rawCentroidScore;
    if (evaluated.meta.isCorrect) {
      totalBenarCount += 1;
    }
    accumulatedItemTime += evaluated.meta.responseTime;
    distribusiTingkat[evaluated.linguisticLevel] = (distribusiTingkat[evaluated.linguisticLevel] || 0) + 1;

    const diffKey = evaluated.meta.difficulty;
    if (difficultyBuckets[diffKey]) {
      difficultyBuckets[diffKey].total += 1;
      if (evaluated.meta.isCorrect) difficultyBuckets[diffKey].benar += 1;
      difficultyBuckets[diffKey].scoreSum += evaluated.crispScore;
    }

    return {
      nomorSoal: idx + 1,
      soalId: item.soalId || item.id || null,
      ...evaluated,
    };
  });

  const totalSoal = detailItems.length;
  const totalSalahCount = totalSoal - totalBenarCount;
  const akurasi = Number(((totalBenarCount / totalSoal) * 100).toFixed(2));
  const avgCrispScore = Number((totalScoreSum / totalSoal).toFixed(2));
  const avgRawScore = Number((rawScoreSum / totalSoal).toFixed(2));
  const rataRataWaktu = Number((accumulatedItemTime / totalSoal).toFixed(2));
  const totalWaktuPengerjaan = totalDurationSeconds !== null && Number.isFinite(Number(totalDurationSeconds))
    ? Number(totalDurationSeconds)
    : accumulatedItemTime;

  const distribusiKesulitan = {};
  for (const [key, b] of Object.entries(difficultyBuckets)) {
    distribusiKesulitan[key] = {
      total: b.total,
      benar: b.benar,
      akurasi: b.total > 0 ? Number(((b.benar / b.total) * 100).toFixed(2)) : 0,
      rataRataSkor: b.total > 0 ? Number((b.scoreSum / b.total).toFixed(2)) : 0,
    };
  }

  const kategoriFuzzy = mapScoreToLevel(avgCrispScore);

  const rekomendasi = generateDiagnosticFeedback({
    skorFuzzy: avgCrispScore,
    kategoriFuzzy,
    akurasi,
    rataRataWaktu,
    totalSoal,
    distribusiKesulitan,
  });

  return {
    skorFuzzy: avgCrispScore,
    rawSkorFuzzy: avgRawScore,
    kategoriFuzzy,
    totalSoal,
    totalBenar: totalBenarCount,
    totalSalah: totalSalahCount,
    akurasi,
    rataRataWaktu,
    totalWaktuPengerjaan,
    distribusiTingkat,
    distribusiKesulitan,
    rekomendasi,
    detailItems,
  };
}

export {
  LINGUISTIC_LEVELS,
  DIFFICULTY_LEVELS,
  TIME_CATEGORIES,
  CORRECTNESS_SETS,
  OUTPUT_MEMBERSHIP_CONFIG,
  triangular,
  trapezoidal,
  getOutputMembership,
  fuzzifyCorrectness,
  fuzzifyResponseTime,
  fuzzifyDifficulty,
  RULES,
  evaluateRules,
  SCORE_THRESHOLDS,
  MIN_CENTROID,
  MAX_CENTROID,
  normalizeCentroid,
  defuzzifyCentroid,
  mapScoreToLevel,
};

export default {
  evaluateItem,
  evaluateQuiz,
  fuzzifyCorrectness,
  fuzzifyResponseTime,
  fuzzifyDifficulty,
  triangular,
  trapezoidal,
  getOutputMembership,
  RULES,
  evaluateRules,
  defuzzifyCentroid,
  normalizeCentroid,
  mapScoreToLevel,
  LINGUISTIC_LEVELS,
  DIFFICULTY_LEVELS,
  TIME_CATEGORIES,
  CORRECTNESS_SETS,
  OUTPUT_MEMBERSHIP_CONFIG,
  SCORE_THRESHOLDS,
  MIN_CENTROID,
  MAX_CENTROID,
};
