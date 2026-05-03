/**
 * Phase 1A — OpenStreetMap Overpass API Medical Scraper
 * Scrapes all Algerian medical facilities from OSM (free, no API key)
 * Populates osm_medical_cache table for use in trust score engine
 */

import axios from 'axios';
import { Pool } from 'pg';

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://tabib:tabib@localhost:5432/tabibverify',
});

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// All 58 Algerian wilaya capitals with coordinates and search radius
export const WILAYA_CENTERS = [
  { code: 1,  name: 'Adrar',        lat: 27.8741, lng: -0.2939, radius: 15000 },
  { code: 2,  name: 'Chlef',        lat: 36.1647, lng: 1.3317,  radius: 12000 },
  { code: 3,  name: 'Laghouat',     lat: 33.8000, lng: 2.8667,  radius: 12000 },
  { code: 4,  name: 'Oum El Bouaghi', lat: 35.8833, lng: 7.1167, radius: 10000 },
  { code: 5,  name: 'Batna',        lat: 35.5550, lng: 6.1742,  radius: 15000 },
  { code: 6,  name: 'Béjaïa',       lat: 36.7509, lng: 5.0567,  radius: 12000 },
  { code: 7,  name: 'Biskra',       lat: 34.8500, lng: 5.7333,  radius: 12000 },
  { code: 8,  name: 'Béchar',       lat: 31.6167, lng: -2.2167, radius: 12000 },
  { code: 9,  name: 'Blida',        lat: 36.4700, lng: 2.8200,  radius: 15000 },
  { code: 10, name: 'Bouira',       lat: 36.3731, lng: 3.9003,  radius: 10000 },
  { code: 11, name: 'Tamanrasset',  lat: 22.7850, lng: 5.5228,  radius: 10000 },
  { code: 12, name: 'Tébessa',      lat: 35.4000, lng: 8.1167,  radius: 10000 },
  { code: 13, name: 'Tlemcen',      lat: 34.8828, lng: -1.3167, radius: 15000 },
  { code: 14, name: 'Tiaret',       lat: 35.3711, lng: 1.3178,  radius: 10000 },
  { code: 15, name: 'Tizi Ouzou',   lat: 36.7167, lng: 4.0500,  radius: 12000 },
  { code: 16, name: 'Alger',        lat: 36.7538, lng: 3.0588,  radius: 30000 },
  { code: 17, name: 'Djelfa',       lat: 34.6736, lng: 3.2631,  radius: 10000 },
  { code: 18, name: 'Jijel',        lat: 36.8200, lng: 5.7667,  radius: 10000 },
  { code: 19, name: 'Sétif',        lat: 36.1898, lng: 5.4108,  radius: 15000 },
  { code: 20, name: 'Saïda',        lat: 34.8306, lng: 0.1511,  radius: 10000 },
  { code: 21, name: 'Skikda',       lat: 36.8800, lng: 6.9036,  radius: 10000 },
  { code: 22, name: 'Sidi Bel Abbès', lat: 35.1897, lng: -0.6328, radius: 12000 },
  { code: 23, name: 'Annaba',       lat: 36.9000, lng: 7.7667,  radius: 15000 },
  { code: 24, name: 'Guelma',       lat: 36.4628, lng: 7.4319,  radius: 10000 },
  { code: 25, name: 'Constantine',  lat: 36.3650, lng: 6.6147,  radius: 20000 },
  { code: 26, name: 'Médéa',        lat: 36.2636, lng: 2.7528,  radius: 10000 },
  { code: 27, name: 'Mostaganem',   lat: 35.9311, lng: 0.0892,  radius: 10000 },
  { code: 28, name: "M'Sila",       lat: 35.7058, lng: 4.5411,  radius: 10000 },
  { code: 29, name: 'Mascara',      lat: 35.3961, lng: 0.1408,  radius: 10000 },
  { code: 30, name: 'Ouargla',      lat: 31.9497, lng: 5.3247,  radius: 12000 },
  { code: 31, name: 'Oran',         lat: 35.6969, lng: -0.6331, radius: 25000 },
  { code: 32, name: 'El Bayadh',    lat: 33.6831, lng: 1.0144,  radius: 8000  },
  { code: 33, name: 'Illizi',       lat: 26.4833, lng: 8.4833,  radius: 8000  },
  { code: 34, name: 'Bordj Bou Arréridj', lat: 36.0731, lng: 4.7628, radius: 10000 },
  { code: 35, name: 'Boumerdès',    lat: 36.7667, lng: 3.4667,  radius: 10000 },
  { code: 36, name: 'El Tarf',      lat: 36.7672, lng: 8.3133,  radius: 8000  },
  { code: 37, name: 'Tindouf',      lat: 27.6711, lng: -8.1472, radius: 8000  },
  { code: 38, name: 'Tissemsilt',   lat: 35.6078, lng: 1.8117,  radius: 8000  },
  { code: 39, name: 'El Oued',      lat: 33.3683, lng: 6.8633,  radius: 10000 },
  { code: 40, name: 'Khenchela',    lat: 35.4233, lng: 7.1353,  radius: 8000  },
  { code: 41, name: 'Souk Ahras',   lat: 36.2864, lng: 7.9511,  radius: 8000  },
  { code: 42, name: 'Tipaza',       lat: 36.5892, lng: 2.4472,  radius: 10000 },
  { code: 43, name: 'Mila',         lat: 36.4500, lng: 6.2667,  radius: 8000  },
  { code: 44, name: 'Aïn Defla',    lat: 36.2594, lng: 1.9642,  radius: 8000  },
  { code: 45, name: 'Naâma',        lat: 33.2669, lng: -0.3119, radius: 8000  },
  { code: 46, name: 'Aïn Témouchent', lat: 35.2978, lng: -1.1378, radius: 8000 },
  { code: 47, name: 'Ghardaïa',     lat: 32.4908, lng: 3.6736,  radius: 10000 },
  { code: 48, name: 'Relizane',     lat: 35.7381, lng: 0.5597,  radius: 8000  },
  { code: 49, name: 'Timimoun',     lat: 29.2628, lng: 0.2406,  radius: 6000  },
  { code: 50, name: 'Bordj Badji Mokhtar', lat: 21.3297, lng: 0.9497, radius: 6000 },
  { code: 51, name: 'Ouled Djellal', lat: 34.4178, lng: 5.0706, radius: 6000  },
  { code: 52, name: 'Béni Abbès',   lat: 30.1289, lng: -2.1664, radius: 6000  },
  { code: 53, name: 'In Salah',     lat: 27.1975, lng: 2.4808,  radius: 6000  },
  { code: 54, name: 'In Guezzam',   lat: 19.5700, lng: 5.7694,  radius: 6000  },
  { code: 55, name: 'Touggourt',    lat: 33.0983, lng: 6.0706,  radius: 8000  },
  { code: 56, name: 'Djanet',       lat: 24.5550, lng: 9.4847,  radius: 6000  },
  { code: 57, name: "El M'Ghair",   lat: 33.9528, lng: 5.9258,  radius: 6000  },
  { code: 58, name: 'El Meniaa',    lat: 30.5833, lng: 2.8833,  radius: 6000  },
];

function buildOverpassQuery(lat: number, lng: number, radius: number): string {
  return `[out:json][timeout:30];
(
  node["amenity"="doctors"](around:${radius},${lat},${lng});
  node["amenity"="clinic"](around:${radius},${lat},${lng});
  node["amenity"="hospital"](around:${radius},${lat},${lng});
  node["healthcare"="doctor"](around:${radius},${lat},${lng});
  node["healthcare"="clinic"](around:${radius},${lat},${lng});
  way["amenity"="clinic"](around:${radius},${lat},${lng});
  way["amenity"="hospital"](around:${radius},${lat},${lng});
  way["healthcare"="hospital"](around:${radius},${lat},${lng});
);
out body;`;
}

function extractDoctorName(rawName: string): string | null {
  if (!rawName) return null;

  // French patterns: "Dr. Mansouri", "Cabinet Dr Benali", "Clinique Khelifa"
  const frPatterns = [
    /(?:Dr\.?|Docteur\.?|Prof\.?)\s+([A-ZÀ-Ÿa-zà-ÿ][A-ZÀ-Ÿa-zà-ÿ\s\-]+)/i,
    /Cabinet\s+(?:Dr\.?\s+)?([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)/i,
    /Clinique\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)/i,
    /Polyclinique\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)/i,
    /Centre\s+(?:de\s+)?(?:Santé\s+)?([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)/i,
  ];

  for (const pattern of frPatterns) {
    const match = rawName.match(pattern);
    if (match && match[1].length > 2) return match[1].trim();
  }

  // Arabic patterns: "عيادة الدكتور / د."
  const arMatch = rawName.match(/(?:الدكتور|دكتور|د\.)\s*([؀-ۿ\s]+)/);
  if (arMatch) return arMatch[1].trim();

  return rawName.length > 3 ? rawName : null;
}

function detectSpecialty(text: string): string {
  if (!text) return 'Médecine Générale';
  const t = text.toLowerCase();
  if (t.includes('cardio'))                     return 'Cardiologie';
  if (t.includes('pédiat') || t.includes('pediat') || t.includes('enfant')) return 'Pédiatrie';
  if (t.includes('gynéco') || t.includes('gyneco') || t.includes('maternit')) return 'Gynécologie';
  if (t.includes('dermat'))                     return 'Dermatologie';
  if (t.includes('ophtalmo') || t.includes('oculist')) return 'Ophtalmologie';
  if (t.includes('ortho'))                      return 'Orthopédie';
  if (t.includes('neuro'))                      return 'Neurologie';
  if (t.includes('pneumo') || t.includes('pulmo')) return 'Pneumologie';
  if (t.includes('psych'))                      return 'Psychiatrie';
  if (t.includes('rhumato'))                    return 'Rhumatologie';
  if (t.includes('urgence') || t.includes('urgency')) return "Médecine d'Urgence";
  if (t.includes('chirurgi') || t.includes('surgery')) return 'Chirurgie Générale';
  if (t.includes('dentiste') || t.includes('stomatol')) return 'Dentisterie';
  if (t.includes('urolog'))                     return 'Urologie';
  if (t.includes('endocrin'))                   return 'Endocrinologie';
  if (t.includes('gastro'))                     return 'Gastroentérologie';
  return 'Médecine Générale';
}

export async function scrapeOSMWilaya(wilaya: typeof WILAYA_CENTERS[0]) {
  const query = buildOverpassQuery(wilaya.lat, wilaya.lng, wilaya.radius);

  const response = await axios.get(OVERPASS_URL, {
    params: { data: query },
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'TabibVerify-DZ/1.0 (medical data enrichment; research)',
    },
    timeout: 45000,
  });

  const elements: any[] = response.data.elements || [];
  const records: any[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const rawName =
      tags['name:fr'] || tags.name || tags['name:ar'] || tags['name:en'] || '';

    if (!rawName || rawName.length < 3) continue;

    const doctorName = extractDoctorName(rawName);
    const specialty  = detectSpecialty(
      tags.healthcare_speciality || tags.speciality || tags.specialty || rawName
    );

    records.push({
      osm_id:          String(el.id),
      raw_name:        rawName,
      doctor_name:     doctorName,
      specialty_guess: specialty,
      wilaya_code:     wilaya.code,
      wilaya_name:     wilaya.name,
      lat:             el.lat ?? null,
      lng:             el.lon ?? null,
      phone:           tags.phone || tags['contact:phone'] || null,
      amenity_type:    tags.amenity || tags.healthcare || 'clinic',
    });
  }

  // Upsert into DB
  for (const r of records) {
    await db.query(
      `INSERT INTO osm_medical_cache
         (osm_id, raw_name, doctor_name, specialty_guess, wilaya_code, wilaya_name, lat, lng, phone, amenity_type, scraped_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (osm_id) DO UPDATE SET
         doctor_name   = EXCLUDED.doctor_name,
         specialty_guess = EXCLUDED.specialty_guess,
         scraped_at    = NOW()`,
      [r.osm_id, r.raw_name, r.doctor_name, r.specialty_guess,
       r.wilaya_code, r.wilaya_name, r.lat, r.lng, r.phone, r.amenity_type]
    );
  }

  return records.length;
}

// Main — run all wilayas or just a subset
async function main() {
  const targetWilayaCode = process.env.WILAYA_CODE
    ? parseInt(process.env.WILAYA_CODE)
    : null;

  const targets = targetWilayaCode
    ? WILAYA_CENTERS.filter(w => w.code === targetWilayaCode)
    : WILAYA_CENTERS;

  console.log(`[OSM Scraper] Starting — ${targets.length} wilaya(s) to scrape`);

  let totalRecords = 0;

  for (const wilaya of targets) {
    process.stdout.write(`  → ${wilaya.name.padEnd(20)}`);
    try {
      const count = await scrapeOSMWilaya(wilaya);
      totalRecords += count;
      console.log(`${count} records`);
    } catch (err: any) {
      console.log(`FAILED (${err.message})`);
    }
    // Polite delay — Overpass asks for 1 req/2s minimum
    if (targets.length > 1) await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n[OSM Scraper] Done. Total: ${totalRecords} records inserted/updated.`);
  await db.end();
}

main().catch(err => {
  console.error('[OSM Scraper] Fatal:', err.message);
  process.exit(1);
});
