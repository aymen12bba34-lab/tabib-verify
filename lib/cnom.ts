import pool from './db';

export interface CNOMRecord {
  cnom_number: string;
  full_name_fr: string;
  specialty: string;
  wilaya_code: number;
  wilaya_name: string;
  status: string;
  nin_partial: string;
}

export async function lookupCNOM(cnomNumber: string): Promise<CNOMRecord | null> {
  const result = await pool.query(
    'SELECT * FROM cnom_registry WHERE cnom_number = $1',
    [cnomNumber]
  );
  return result.rows[0] || null;
}

export function fuzzyNameMatch(input: string, record: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).sort().join(' ');
  const a = normalize(input);
  const b = normalize(record);

  if (a === b) return 1.0;

  const aWords = a.split(' ');
  const bWords = b.split(' ');
  let matches = 0;
  for (const word of aWords) {
    if (bWords.some(bw => bw === word || levenshtein(word, bw) <= 1)) {
      matches++;
    }
  }
  return matches / Math.max(aWords.length, bWords.length);
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}
