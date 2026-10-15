import {
  LINGUISTIC_LEVELS,
  getOutputMembership,
} from './membership.js';

export const MIN_CENTROID = 13.96;
export const MAX_CENTROID = 86.04;

export const SCORE_THRESHOLDS = Object.freeze({
  SANGAT_RENDAH_MAX: 35, // Score < 35
  RENDAH_MAX: 60,        // 35 <= Score < 60
  SEDANG_MAX: 80,        // 60 <= Score < 80
  // Score >= 80 -> 'Tinggi'
});

export function normalizeCentroid(rawScore) {
  const raw = Number(rawScore);
  if (!Number.isFinite(raw)) return 0.0;
  const roundedRaw = Number(raw.toFixed(2));
  const clampedRaw = Math.min(MAX_CENTROID, Math.max(MIN_CENTROID, roundedRaw));
  const normalized = ((clampedRaw - MIN_CENTROID) / (MAX_CENTROID - MIN_CENTROID)) * 100;
  return Number(Math.min(100, Math.max(0, normalized)).toFixed(2));
}

/**
 * Defuzzifikasi menggunakan metode Centroid / Center of Gravity (CoG)
 * Mengintegrasikan fungsi agregasi pada semesta [0, 100] dengan step sampling.
 * 
 * Formula: Score = sum(x * mu_agg(x)) / sum(mu_agg(x))
 * 
 * @param {object} firingWeights - { 'Sangat Rendah': w1, 'Rendah': w2, 'Sedang': w3, 'Tinggi': w4 }
 * @param {number} [stepSize=0.5] - Langkah diskritisasi semesta pembicaraan
 * @param {boolean} [isCorrectFallback=true] - Fallback jika penyebut 0
 * @returns {number} Nilai crisp score [0, 100]
 */
export function defuzzifyCentroid(firingWeights, stepSize = 0.5, isCorrectFallback = true) {
  let numerator = 0.0;
  let denominator = 0.0;

  const minX = 0;
  const maxX = 100;
  const validStep = stepSize > 0 && stepSize <= 5 ? stepSize : 0.5;

  const levels = [
    LINGUISTIC_LEVELS.SANGAT_RENDAH,
    LINGUISTIC_LEVELS.RENDAH,
    LINGUISTIC_LEVELS.SEDANG,
    LINGUISTIC_LEVELS.TINGGI,
  ];

  for (let x = minX; x <= maxX; x += validStep) {
    let muAggX = 0.0;

    for (const lvl of levels) {
      const w = firingWeights[lvl] || 0.0;
      if (w > 0) {
        const muOut = getOutputMembership(x, lvl);
        const clipped = Math.min(w, muOut);
        if (clipped > muAggX) {
          muAggX = clipped;
        }
      }
    }

    numerator += x * muAggX;
    denominator += muAggX;
  }

  // Graceful fallback jika total area penyebut 0
  if (denominator === 0) {
    return isCorrectFallback ? 50.0 : 0.0;
  }

  const centroid = numerator / denominator;
  return Math.min(100, Math.max(0, centroid));
}

/**
 * Pemetaan skor crisp numerik ke label tingkat penguasaan linguistik
 * - Score < 35: 'Sangat Rendah'
 * - 35 <= Score < 55: 'Rendah'
 * - 55 <= Score < 75: 'Sedang'
 * - Score >= 75: 'Tinggi'
 * 
 * @param {number} score - Skor kontinu [0, 100]
 * @returns {string} Label linguistik
 */
export function mapScoreToLevel(score) {
  const s = Number(score);
  if (!Number.isFinite(s) || s < SCORE_THRESHOLDS.SANGAT_RENDAH_MAX) {
    return LINGUISTIC_LEVELS.SANGAT_RENDAH;
  }
  if (s < SCORE_THRESHOLDS.RENDAH_MAX) {
    return LINGUISTIC_LEVELS.RENDAH;
  }
  if (s < SCORE_THRESHOLDS.SEDANG_MAX) {
    return LINGUISTIC_LEVELS.SEDANG;
  }
  return LINGUISTIC_LEVELS.TINGGI;
}

