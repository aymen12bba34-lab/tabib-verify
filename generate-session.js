const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

async function run() {
  const fs = require('fs');
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envFile.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim();
  const pool = new Pool({ connectionString: dbUrl });
  const sessionId = 'sess_' + uuidv4().replace(/-/g, '').substring(0, 12);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  
  // Get a valid partner ID
  const partnerRes = await pool.query('SELECT id FROM partners LIMIT 1');
  if (partnerRes.rows.length === 0) {
     // create one if none exists
     await pool.query("INSERT INTO partners (id, name, api_key, status) VALUES ('test-partner', 'Test', 'test-key', 'active')");
  }
  const partnerId = partnerRes.rows.length > 0 ? partnerRes.rows[0].id : 'test-partner';

  await pool.query(
    'INSERT INTO verification_sessions (id, partner_id, partner_ref, callback_url, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [sessionId, partnerId, 'test-doc-123', 'http://localhost:3000/api/callback', expiresAt]
  );
  
  console.log('\n================================================');
  console.log('SUCCESS! TEST THIS URL IN YOUR BROWSER:');
  console.log(`http://localhost:3000/verify/${sessionId}`);
  console.log('================================================\n');
  await pool.end();
}

run().catch(console.error);
