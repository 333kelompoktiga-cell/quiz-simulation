import {
  LINGUISTIC_LEVELS,
  DIFFICULTY_LEVELS,
  TIME_CATEGORIES,
  CORRECTNESS_SETS,
} from "./membership.js";

// 18 Mamdani rules matrix
export const RULES = Object.freeze([
  // Benar (R1 - R9)
  {
    id: "R1",
    ifBenar: true,
    time: TIME_CATEGORIES.CEPAT,
    difficulty: DIFFICULTY_LEVELS.MUDAH,
    thenLevel: LINGUISTIC_LEVELS.TINGGI,
  },
  {
    id: "R2",
    ifBenar: true,
    time: TIME_CATEGORIES.CEPAT,
    difficulty: DIFFICULTY_LEVELS.SEDANG,
    thenLevel: LINGUISTIC_LEVELS.TINGGI,
  },
  {
    id: "R3",
    ifBenar: true,
    time: TIME_CATEGORIES.CEPAT,
    difficulty: DIFFICULTY_LEVELS.SULIT,
    thenLevel: LINGUISTIC_LEVELS.TINGGI,
  },
  {
    id: "R4",
    ifBenar: true,
    time: TIME_CATEGORIES.SEDANG,
    difficulty: DIFFICULTY_LEVELS.MUDAH,
    thenLevel: LINGUISTIC_LEVELS.SEDANG,
  },
  {
    id: "R5",
    ifBenar: true,
    time: TIME_CATEGORIES.SEDANG,
    difficulty: DIFFICULTY_LEVELS.SEDANG,
    thenLevel: LINGUISTIC_LEVELS.TINGGI,
  },
  {
    id: "R6",
    ifBenar: true,
    time: TIME_CATEGORIES.SEDANG,
    difficulty: DIFFICULTY_LEVELS.SULIT,
    thenLevel: LINGUISTIC_LEVELS.TINGGI,
  },
  {
    id: "R7",
    ifBenar: true,
    time: TIME_CATEGORIES.LAMA,
    difficulty: DIFFICULTY_LEVELS.MUDAH,
    thenLevel: LINGUISTIC_LEVELS.RENDAH,
  },
  {
    id: "R8",
    ifBenar: true,
    time: TIME_CATEGORIES.LAMA,
    difficulty: DIFFICULTY_LEVELS.SEDANG,
    thenLevel: LINGUISTIC_LEVELS.SEDANG,
  },
  {
    id: "R9",
    ifBenar: true,
    time: TIME_CATEGORIES.LAMA,
    difficulty: DIFFICULTY_LEVELS.SULIT,
    thenLevel: LINGUISTIC_LEVELS.TINGGI,
  },

  // Salah (R10 - R18)
  {
    id: "R10",
    ifBenar: false,
    time: TIME_CATEGORIES.CEPAT,
    difficulty: DIFFICULTY_LEVELS.MUDAH,
    thenLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH,
  },
  {
    id: "R11",
    ifBenar: false,
    time: TIME_CATEGORIES.CEPAT,
    difficulty: DIFFICULTY_LEVELS.SEDANG,
    thenLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH,
  },
  {
    id: "R12",
    ifBenar: false,
    time: TIME_CATEGORIES.CEPAT,
    difficulty: DIFFICULTY_LEVELS.SULIT,
    thenLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH,
  },
  {
    id: "R13",
    ifBenar: false,
    time: TIME_CATEGORIES.SEDANG,
    difficulty: DIFFICULTY_LEVELS.MUDAH,
    thenLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH,
  },
  {
    id: "R14",
    ifBenar: false,
    time: TIME_CATEGORIES.SEDANG,
    difficulty: DIFFICULTY_LEVELS.SEDANG,
    thenLevel: LINGUISTIC_LEVELS.RENDAH,
  },
  {
    id: "R15",
    ifBenar: false,
    time: TIME_CATEGORIES.SEDANG,
    difficulty: DIFFICULTY_LEVELS.SULIT,
    thenLevel: LINGUISTIC_LEVELS.RENDAH,
  },
  {
    id: "R16",
    ifBenar: false,
    time: TIME_CATEGORIES.LAMA,
    difficulty: DIFFICULTY_LEVELS.MUDAH,
    thenLevel: LINGUISTIC_LEVELS.SANGAT_RENDAH,
  },
  {
    id: "R17",
    ifBenar: false,
    time: TIME_CATEGORIES.LAMA,
    difficulty: DIFFICULTY_LEVELS.SEDANG,
    thenLevel: LINGUISTIC_LEVELS.RENDAH,
  },
  {
    id: "R18",
    ifBenar: false,
    time: TIME_CATEGORIES.LAMA,
    difficulty: DIFFICULTY_LEVELS.SULIT,
    thenLevel: LINGUISTIC_LEVELS.RENDAH,
  },
]);

// Evaluates rule firing weights using Min-implication and Max-aggregation
export function evaluateRules(fuzzCorrectness, fuzzTime, fuzzDifficulty) {
  const firingWeights = {
    [LINGUISTIC_LEVELS.SANGAT_RENDAH]: 0.0,
    [LINGUISTIC_LEVELS.RENDAH]: 0.0,
    [LINGUISTIC_LEVELS.SEDANG]: 0.0,
    [LINGUISTIC_LEVELS.TINGGI]: 0.0,
  };

  const activeRules = [];

  for (const rule of RULES) {
    const muCorrect = rule.ifBenar
      ? fuzzCorrectness[CORRECTNESS_SETS.BENAR]
      : fuzzCorrectness[CORRECTNESS_SETS.SALAH];
    const muTime = fuzzTime[rule.time] || 0.0;
    const muDiff = fuzzDifficulty[rule.difficulty] || 0.0;

    const alpha = Math.min(muCorrect, muTime, muDiff);

    if (alpha > 0) {
      activeRules.push({
        id: rule.id,
        ifBenar: rule.ifBenar,
        time: rule.time,
        difficulty: rule.difficulty,
        thenLevel: rule.thenLevel,
        alpha: Number(alpha.toFixed(4)),
      });

      if (alpha > firingWeights[rule.thenLevel]) {
        firingWeights[rule.thenLevel] = alpha;
      }
    }
  }

  return { firingWeights, activeRules };
}
