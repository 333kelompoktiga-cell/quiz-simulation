import {
  evaluateItem,
  evaluateQuiz,
  fuzzifyCorrectness,
  fuzzifyResponseTime,
  fuzzifyDifficulty,
  defuzzifyCentroid,
  normalizeCentroid,
  MIN_CENTROID,
  MAX_CENTROID,
  mapScoreToLevel,
  RULES,
  LINGUISTIC_LEVELS,
  DIFFICULTY_LEVELS,
  TIME_CATEGORIES,
} from './services/fuzzyService.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  }
}

console.log('Running Fuzzy Autograding Service Tests...\n');

// 1. Correctness Fuzzification
{
  const resTrue = fuzzifyCorrectness(true);
  assert(resTrue.Benar === 1.0 && resTrue.Salah === 0.0, 'Boolean true -> Benar: 1, Salah: 0');

  const resFalse = fuzzifyCorrectness(false);
  assert(resFalse.Benar === 0.0 && resFalse.Salah === 1.0, 'Boolean false -> Benar: 0, Salah: 1');

  const resNum1 = fuzzifyCorrectness(1);
  assert(resNum1.Benar === 1.0 && resNum1.Salah === 0.0, 'Number 1 -> Benar: 1, Salah: 0');

  const resNum0 = fuzzifyCorrectness(0);
  assert(resNum0.Benar === 0.0 && resNum0.Salah === 1.0, 'Number 0 -> Benar: 0, Salah: 1');

  const resStrTrue = fuzzifyCorrectness('true');
  assert(resStrTrue.Benar === 1.0 && resStrTrue.Salah === 0.0, 'String "true" -> Benar: 1, Salah: 0');

  const resStrBenar = fuzzifyCorrectness('benar');
  assert(resStrBenar.Benar === 1.0 && resStrBenar.Salah === 0.0, 'String "benar" -> Benar: 1, Salah: 0');
}

// 2. Response Time Fuzzification (target: 60s)
{
  const t5 = fuzzifyResponseTime(5, 60);
  assert(t5.Cepat === 1.0 && t5.Sedang === 0.0 && t5.Lama === 0.0, '5s (<=18s) -> Cepat: 1.0');

  const t18 = fuzzifyResponseTime(18, 60);
  assert(t18.Cepat === 1.0, '18s (0.3*60) -> Cepat: 1.0');

  const t39 = fuzzifyResponseTime(39, 60);
  assert(t39.Sedang === 1.0 && t39.Cepat === 0.0 && t39.Lama === 0.0, '39s (0.65*60) -> Sedang: 1.0');

  const t75 = fuzzifyResponseTime(75, 60);
  assert(t75.Lama === 1.0 && t75.Cepat === 0.0 && t75.Sedang === 0.0, '75s (>=66s) -> Lama: 1.0');

  const t0 = fuzzifyResponseTime(0, 60);
  assert(t0.Cepat === 1.0, '0s -> Cepat: 1.0');

  const tNeg = fuzzifyResponseTime(-10, 60);
  assert(tNeg.Cepat === 1.0, 'Negative time clamped to 0 -> Cepat: 1.0');

  const tInf = fuzzifyResponseTime(9999, 60);
  assert(tInf.Lama === 1.0, 'Very large time -> Lama: 1.0');
}

// 3. Difficulty Fuzzification
{
  const dMudah = fuzzifyDifficulty('Mudah');
  assert(dMudah.Mudah === 1.0 && dMudah.Sedang === 0.0 && dMudah.Sulit === 0.0, 'Difficulty "Mudah" mapped');

  const dSedang = fuzzifyDifficulty('sedang');
  assert(dSedang.Sedang === 1.0 && dSedang.Mudah === 0.0, 'Difficulty "sedang" mapped');

  const dSulit = fuzzifyDifficulty('SULIT');
  assert(dSulit.Sulit === 1.0 && dSulit.Mudah === 0.0, 'Difficulty "SULIT" (uppercase) mapped');

  const dUnknown = fuzzifyDifficulty('xyz');
  assert(dUnknown.Sedang === 1.0, 'Unknown difficulty gracefully defaults to "Sedang"');
}

// 4. Exact 18 Mamdani Rules
{
  assert(RULES.length === 18, 'Rule base contains exactly 18 rules');

  const testCases = [
    { rule: 'R1', isCorrect: true, time: 10, diff: 'Mudah', expectedLevel: LINGUISTIC_LEVELS.TINGGI },
    { rule: 'R2', isCorrect: true, time: 10, diff: 'Sedang', expectedLevel: LINGUISTIC_LEVELS.TINGGI },
    { rule: 'R3', isCorrect: true, time: 10, diff: 'Sulit', expectedLevel: LINGUISTIC_LEVELS.TINGGI },
    { rule: 'R4', isCorrect: true, time: 39, diff: 'Mudah', expectedLevel: LINGUISTIC_LEVELS.SEDANG },
    { rule: 'R5', isCorrect: true, time: 39, diff: 'Sedang', expectedLevel: LINGUISTIC_LEVELS.TINGGI },
    { rule: 'R6', isCorrect: true, time: 39, diff: 'Sulit', expectedLevel: LINGUISTIC_LEVELS.TINGGI },
    { rule: 'R7', isCorrect: true, time: 75, diff: 'Mudah', expectedLevel: LINGUISTIC_LEVELS.RENDAH },
    { rule: 'R8', isCorrect: true, time: 75, diff: 'Sedang', expectedLevel: LINGUISTIC_LEVELS.SEDANG },
    { rule: 'R9', isCorrect: true, time: 75, diff: 'Sulit', expectedLevel: LINGUISTIC_LEVELS.TINGGI },
    { rule: 'R10', isCorrect: false, time: 10, diff: 'Mudah', expectedLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH },
    { rule: 'R11', isCorrect: false, time: 10, diff: 'Sedang', expectedLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH },
    { rule: 'R12', isCorrect: false, time: 10, diff: 'Sulit', expectedLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH },
    { rule: 'R13', isCorrect: false, time: 39, diff: 'Mudah', expectedLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH },
    { rule: 'R14', isCorrect: false, time: 39, diff: 'Sedang', expectedLevel: LINGUISTIC_LEVELS.RENDAH },
    { rule: 'R15', isCorrect: false, time: 39, diff: 'Sulit', expectedLevel: LINGUISTIC_LEVELS.RENDAH },
    { rule: 'R16', isCorrect: false, time: 75, diff: 'Mudah', expectedLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH },
    { rule: 'R17', isCorrect: false, time: 75, diff: 'Sedang', expectedLevel: LINGUISTIC_LEVELS.RENDAH },
    { rule: 'R18', isCorrect: false, time: 75, diff: 'Sulit', expectedLevel: LINGUISTIC_LEVELS.RENDAH },
  ];

  for (const tc of testCases) {
    const res = evaluateItem({
      isCorrect: tc.isCorrect,
      responseTime: tc.time,
      difficulty: tc.diff,
      targetTime: 60,
    });
    const firingWeightForExpected = res.firingWeights[tc.expectedLevel];
    assert(
      firingWeightForExpected === 1.0 && res.linguisticLevel === tc.expectedLevel,
      `Rule ${tc.rule} (${tc.isCorrect ? 'Benar' : 'Salah'}, ${tc.diff}, ${tc.time}s) -> Fired 1.0 with Level: ${res.linguisticLevel} (Score: ${res.crispScore})`
    );
  }
}

// 5. Score to Linguistic Level Mapping
{
  assert(mapScoreToLevel(15) === LINGUISTIC_LEVELS.SANGAT_RENDAH, 'Score 15 -> Sangat Rendah');
  assert(mapScoreToLevel(34.9) === LINGUISTIC_LEVELS.SANGAT_RENDAH, 'Score 34.9 -> Sangat Rendah');
  assert(mapScoreToLevel(35.0) === LINGUISTIC_LEVELS.RENDAH, 'Score 35.0 -> Rendah');
  assert(mapScoreToLevel(59.9) === LINGUISTIC_LEVELS.RENDAH, 'Score 59.9 -> Rendah');
  assert(mapScoreToLevel(60.0) === LINGUISTIC_LEVELS.SEDANG, 'Score 60.0 -> Sedang');
  assert(mapScoreToLevel(79.9) === LINGUISTIC_LEVELS.SEDANG, 'Score 79.9 -> Sedang');
  assert(mapScoreToLevel(80.0) === LINGUISTIC_LEVELS.TINGGI, 'Score 80.0 -> Tinggi');
  assert(mapScoreToLevel(95) === LINGUISTIC_LEVELS.TINGGI, 'Score 95.0 -> Tinggi');
}

// 6. Determinism Test
{
  const itemParams = { isCorrect: true, responseTime: 25, difficulty: 'Sedang', targetTime: 60 };
  const res1 = evaluateItem(itemParams);
  const res2 = evaluateItem(itemParams);
  assert(
    res1.crispScore === res2.crispScore && res1.linguisticLevel === res2.linguisticLevel,
    `Deterministic execution verified: Score 1 = ${res1.crispScore}, Score 2 = ${res2.crispScore}`
  );
}

// 7. Full Quiz Evaluation
{
  const answers = [
    { isCorrect: true, responseTime: 12, difficulty: 'Mudah' },
    { isCorrect: true, responseTime: 35, difficulty: 'Sedang' },
    { isCorrect: true, responseTime: 70, difficulty: 'Sulit' },
    { isCorrect: false, responseTime: 40, difficulty: 'Sedang' },
    { isCorrect: false, responseTime: 15, difficulty: 'Mudah' },
  ];

  const quizResult = evaluateQuiz(answers, 180);

  assert(quizResult.totalSoal === 5, 'Total soal = 5');
  assert(quizResult.totalBenar === 3, 'Total benar = 3');
  assert(quizResult.totalSalah === 2, 'Total salah = 2');
  assert(quizResult.akurasi === 60.0, 'Akurasi = 60.0%');
  assert(quizResult.skorFuzzy > 55 && quizResult.skorFuzzy < 75, `Skor kuis valid (${quizResult.skorFuzzy})`);
  assert(quizResult.kategoriFuzzy === LINGUISTIC_LEVELS.SEDANG, `Kategori kuis: ${quizResult.kategoriFuzzy}`);
  assert(quizResult.detailItems.length === 5, 'Detail items length = 5');
  assert(typeof quizResult.rekomendasi === 'string' && quizResult.rekomendasi.length > 20, 'Rekomendasi diagnostik terbuat');
  assert(quizResult.distribusiKesulitan.Mudah.total === 2, 'Distribusi kesulitan Mudah count = 2');
}

// 8. Quiz Evaluation Edge Cases
{
  const emptyRes = evaluateQuiz([]);
  assert(emptyRes.totalSoal === 0 && emptyRes.skorFuzzy === 0, 'Empty answers array handled gracefully');

  const nullRes = evaluateQuiz(null);
  assert(nullRes.totalSoal === 0, 'Null answers parameter handled gracefully');
}

// 9. Robustness & Extreme Inputs
{
  const itemZero = evaluateItem({ isCorrect: true, responseTime: 0, difficulty: 'Sedang', targetTime: 0 });
  assert(itemZero.crispScore > 0 && itemZero.meta.targetTime === 60, 'Target time 0 falls back to 60s');

  const itemNeg = evaluateItem({ isCorrect: false, responseTime: -30, difficulty: null, targetTime: undefined });
  assert(itemNeg.meta.responseTime === 0 && itemNeg.meta.difficulty === 'Sedang', 'Negative time clamped and null diff defaulted');

  const itemDiffInt = evaluateItem({ isCorrect: true, responseTime: 15, difficulty: 1, targetTime: 60 });
  assert(itemDiffInt.meta.difficulty === 'Mudah' && itemDiffInt.linguisticLevel === LINGUISTIC_LEVELS.TINGGI, 'Integer difficulty (1 = Mudah) supported');

  const messyQuiz = evaluateQuiz([null, { isCorrect: true, responseTime: 20 }, undefined]);
  assert(messyQuiz.totalSoal === 3 && messyQuiz.totalBenar === 1, 'Array with null/undefined items handled safely');
}

// 10. Realistic Student Profiles
{
  // Profil 1: Siswa Cepat tapi Asal Menjawab (Akurasi Rendah, Waktu Sangat Singkat)
  const profilCepatAsal = evaluateQuiz([
    { isCorrect: false, responseTime: 8, difficulty: 'Mudah' },
    { isCorrect: false, responseTime: 10, difficulty: 'Sedang' },
    { isCorrect: false, responseTime: 12, difficulty: 'Sulit' },
    { isCorrect: false, responseTime: 9, difficulty: 'Sedang' },
    { isCorrect: true, responseTime: 11, difficulty: 'Mudah' },
  ], 50);

  assert(profilCepatAsal.akurasi === 20.0, 'Profil 1: Akurasi rendah (20%)');
  assert(profilCepatAsal.kategoriFuzzy === LINGUISTIC_LEVELS.SANGAT_RENDAH, 'Profil 1: Kategori Sangat Rendah');
  assert(profilCepatAsal.rekomendasi.includes('impulsive answering'), 'Profil 1: Peringatan terburu-buru terdeteksi');

  // Profil 2: Siswa Teliti (Akurasi Tinggi, Waktu Sedikit di Atas Target)
  const profilTeliti = evaluateQuiz([
    { isCorrect: true, responseTime: 70, difficulty: 'Mudah' },
    { isCorrect: true, responseTime: 75, difficulty: 'Sedang' },
    { isCorrect: true, responseTime: 85, difficulty: 'Sulit' },
    { isCorrect: true, responseTime: 68, difficulty: 'Sedang' },
    { isCorrect: true, responseTime: 80, difficulty: 'Sulit' },
  ], 378);

  assert(profilTeliti.akurasi === 100.0, 'Profil 2: Akurasi sempurna (100%)');
  assert(profilTeliti.kategoriFuzzy === LINGUISTIC_LEVELS.SEDANG || profilTeliti.kategoriFuzzy === LINGUISTIC_LEVELS.TINGGI, 'Profil 2: Kategori Sedang/Tinggi');
  assert(profilTeliti.rekomendasi.includes('relatif lama'), 'Profil 2: Catatan waktu bernalar terdeteksi');

  // Profil 3: Siswa Lambat & Kesulitan (Akurasi Rendah, Waktu Habis)
  const profilLambatKesulitan = evaluateQuiz([
    { isCorrect: false, responseTime: 85, difficulty: 'Mudah' },
    { isCorrect: false, responseTime: 90, difficulty: 'Sedang' },
    { isCorrect: false, responseTime: 80, difficulty: 'Sulit' },
    { isCorrect: true, responseTime: 75, difficulty: 'Sedang' },
    { isCorrect: false, responseTime: 95, difficulty: 'Sulit' },
  ], 425);

  assert(profilLambatKesulitan.akurasi === 20.0, 'Profil 3: Akurasi rendah (20%)');
  assert(profilLambatKesulitan.kategoriFuzzy === LINGUISTIC_LEVELS.RENDAH || profilLambatKesulitan.kategoriFuzzy === LINGUISTIC_LEVELS.SANGAT_RENDAH, 'Profil 3: Kategori Rendah/Sangat Rendah');
  assert(profilLambatKesulitan.skorFuzzy < 50, 'Profil 3: Skor fuzzy rendah (<50)');

  // Profil 4: Siswa Mahir (Akurasi Sempurna, Waktu Cepat)
  const profilMahir = evaluateQuiz([
    { isCorrect: true, responseTime: 12, difficulty: 'Mudah' },
    { isCorrect: true, responseTime: 15, difficulty: 'Sedang' },
    { isCorrect: true, responseTime: 18, difficulty: 'Sulit' },
    { isCorrect: true, responseTime: 14, difficulty: 'Sedang' },
    { isCorrect: true, responseTime: 16, difficulty: 'Sulit' },
  ], 75);

  assert(profilMahir.akurasi === 100.0, 'Profil 4: Akurasi sempurna (100%)');
  assert(profilMahir.kategoriFuzzy === LINGUISTIC_LEVELS.TINGGI, 'Profil 4: Kategori Tinggi');
  assert(profilMahir.skorFuzzy === 100.0, `Profil 4: Skor fuzzy sempurna (100): ${profilMahir.skorFuzzy}`);
  assert(profilMahir.rawSkorFuzzy === 86.04, `Profil 4: Raw centroid score terlacak (86.04): ${profilMahir.rawSkorFuzzy}`);
  assert(profilMahir.rekomendasi.includes('sangat mengesankan') || profilMahir.rekomendasi.includes('sangat tinggi'), 'Profil 4: Rekomendasi apresiasi tinggi');
}

// 11. Normalization & Audit Trail
{
  assert(normalizeCentroid(MAX_CENTROID) === 100.0, 'Max centroid 86.04 maps to 100.0');
  assert(normalizeCentroid(MIN_CENTROID) === 0.0, 'Min centroid 13.96 maps to 0.0');
  const singleItem = evaluateItem({ isCorrect: true, responseTime: 10, difficulty: 'Mudah' });
  assert(singleItem.crispScore === 100.0, 'Single item perfect score normalized to 100.0');
  assert(singleItem.rawCentroidScore === 86.04, 'Single item raw centroid preserved at 86.04');
}

console.log(`\nSummary: ${passedTests} passed, ${failedTests} failed`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
