import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://tabib:tabib@localhost:5432/tabibverify',
  });

  const seedPath = path.join(__dirname, '..', 'data', 'cnom-seed.json');
  const records = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  console.log(`Seeding ${records.length} CNOM records...`);

  for (const r of records) {
    await pool.query(
      `INSERT INTO cnom_registry (cnom_number, full_name_fr, specialty, wilaya_code, wilaya_name, status, nin_partial)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (cnom_number) DO NOTHING`,
      [r.cnom_number, r.full_name_fr, r.specialty, r.wilaya_code, r.wilaya_name, r.status, r.nin_partial]
    );
  }

  console.log('Seeding complete.');
  await pool.end();
}

seed().catch(console.error);
