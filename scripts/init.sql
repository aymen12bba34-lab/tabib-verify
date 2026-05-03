CREATE TABLE IF NOT EXISTS partners (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  api_key     TEXT NOT NULL UNIQUE,
  webhook_secret TEXT NOT NULL,
  status      TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS cnom_registry (
  cnom_number  TEXT PRIMARY KEY,
  full_name_fr TEXT NOT NULL,
  specialty    TEXT,
  wilaya_code  INT,
  wilaya_name  TEXT,
  status       TEXT DEFAULT 'ACTIVE',
  nin_partial  TEXT
);

CREATE TABLE IF NOT EXISTS verification_sessions (
  id              TEXT PRIMARY KEY,
  partner_id      TEXT REFERENCES partners(id),
  partner_ref     TEXT,
  status          TEXT DEFAULT 'in_progress',
  trust_score     INT DEFAULT 0,
  otp_verified    BOOLEAN DEFAULT false,
  cnom_verified   BOOLEAN DEFAULT false,
  face_verified   BOOLEAN DEFAULT false,
  face_method     TEXT,                        -- 'mediapipe_headnod' | 'faceapi_blink'
  nfc_verified    BOOLEAN DEFAULT false,
  cnom_number     TEXT,
  full_name       TEXT,
  specialty       TEXT,
  wilaya_name     TEXT,
  phone_hash           TEXT,
  input_nin            TEXT,
  document_verified    BOOLEAN DEFAULT false,
  document_nin_match   BOOLEAN DEFAULT false,
  document_name_match  BOOLEAN DEFAULT false,
  document_confidence  FLOAT,
  callback_url    TEXT,
  redirect_url    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes',
  last_cnom_check TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  revocation_reason TEXT
);

CREATE TABLE IF NOT EXISTS osm_medical_cache (
  id              SERIAL PRIMARY KEY,
  osm_id          TEXT UNIQUE NOT NULL,
  raw_name        TEXT,
  doctor_name     TEXT,
  specialty_guess TEXT,
  wilaya_code     INT,
  wilaya_name     TEXT,
  lat             FLOAT,
  lng             FLOAT,
  phone           TEXT,
  amenity_type    TEXT,
  scraped_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_osm_wilaya ON osm_medical_cache(wilaya_code);
CREATE INDEX IF NOT EXISTS idx_osm_doctor ON osm_medical_cache(doctor_name);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_osm_doctor_trgm ON osm_medical_cache USING gin(doctor_name gin_trgm_ops);

-- Seed a demo partner
INSERT INTO partners (id, name, api_key, webhook_secret, status)
VALUES ('doctorme', 'DoctorMe', 'tv_live_doctorme_key_2024', 'whsec_doctorme_secret_32chars!!', 'active')
ON CONFLICT (id) DO NOTHING;
