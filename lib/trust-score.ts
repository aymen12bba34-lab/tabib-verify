import pool from './db';

export interface ScoreFactors {
  otpVerified: boolean;
  cnomFound: boolean;
  cnomNameMatch: number; // 0-1 ratio
  ninValid: boolean;
  ninWilayaMatch: boolean;
  faceDetected: boolean;
  faceMethod?: string;         // Phase 2C: 'mediapipe_headnod' | 'faceapi_blink'
  nfcMatch: boolean;
  osmClinicFound?: boolean;    // Phase 1A: OSM enrichment
  documentVerified?: boolean;  // Phase 2B: OCR captured
  documentNinMatch?: boolean;  // Phase 2B: NIN on card = NIN declared
  documentNameMatch?: boolean; // Phase 2B: Name on card = CNOM name
}

export interface ScoreResult {
  score: number;
  signals: string[];
}

export function calculateTrustScore(factors: ScoreFactors): number {
  const { score } = calculateTrustScoreDetailed(factors);
  return score;
}

export function calculateTrustScoreDetailed(factors: ScoreFactors): ScoreResult {
  let score = 0;
  const signals: string[] = [];

  if (factors.otpVerified) {
    score += 10;
    signals.push('EMAIL_OTP_VERIFIED');
  }
  if (factors.cnomFound) {
    score += 30;
    signals.push('CNOM_FOUND');
  }
  if (factors.cnomNameMatch >= 0.85) {
    score += 20;
    signals.push('CNOM_NAME_MATCH_HIGH');
  } else if (factors.cnomNameMatch >= 0.60) {
    score += 10;
    signals.push('CNOM_NAME_MATCH_LOW');
  }
  if (factors.ninValid) {
    score += 10;
    signals.push('NIN_VALID');
  }
  if (factors.ninWilayaMatch) {
    score += 10;
    signals.push('NIN_WILAYA_MATCHES_CNOM');
  }
  if (factors.faceDetected) {
    // Phase 2C: MediaPipe head-nod challenge = +15; face-api blink fallback = +10
    if (factors.faceMethod === 'mediapipe_headnod') {
      score += 15;
      signals.push('LIVENESS_MEDIAPIPE');
    } else {
      score += 10;
      signals.push('LIVENESS_FACEAPI');
    }
  }
  if (factors.nfcMatch) {
    score += 20;
    signals.push('NFC_NIN_MATCH');
  }
  // Phase 2B: Document OCR signals
  if (factors.documentVerified) {
    score += 10;
    signals.push('DOCUMENT_CAPTURED');
  }
  if (factors.documentNinMatch) {
    score += 20;
    signals.push('DOCUMENT_NIN_MATCH');
  }
  if (factors.documentNameMatch) {
    score += 10;
    signals.push('DOCUMENT_NAME_MATCH');
  }
  // Phase 1A: +8 bonus if doctor found in OpenStreetMap
  if (factors.osmClinicFound) {
    score += 8;
    signals.push('OSM_CLINIC_FOUND');
  }

  return { score, signals };
}

export function getDecision(score: number): 'verified' | 'pending' | 'rejected' {
  if (score >= 70) return 'verified';
  if (score >= 40) return 'pending';
  return 'rejected';
}

/**
 * Phase 1A — Query OSM cache to check if doctor's name appears
 * near their declared wilaya. Returns true if a matching clinic found.
 */
export async function checkOSMPresence(
  doctorName: string,
  wilayaCode: number
): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT id FROM osm_medical_cache
       WHERE wilaya_code = $2
         AND doctor_name IS NOT NULL
         AND similarity(doctor_name, $1) > 0.3
       ORDER BY similarity(doctor_name, $1) DESC
       LIMIT 1`,
      [doctorName, wilayaCode]
    );
    return result.rows.length > 0;
  } catch {
    // pg_trgm not available or table missing — graceful fallback
    return false;
  }
}
