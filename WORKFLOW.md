# TabibVerify — Complete Workflow Documentation

> A doctor identity verification pipeline for Algerian healthcare platforms.
> Integrates OTP authentication, CNOM registry lookup, CNIBE OCR scanning, face liveness, and NFC verification.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Actor Roles](#3-actor-roles)
4. [Step-by-Step Workflow](#4-step-by-step-workflow)
   - [Step 0 — Partner Requests a Session](#step-0--partner-requests-a-session)
   - [Step 1 — Email OTP Verification](#step-1--email-otp-verification)
   - [Step 2 — CNOM Identity Verification](#step-2--cnom-identity-verification)
   - [Step 3 — CNIBE Document Scan (OCR)](#step-3--cnibe-document-scan-ocr)
   - [Step 4 — Face Liveness Check](#step-4--face-liveness-check)
   - [Step 5 — NFC Card Read](#step-5--nfc-card-read)
   - [Step 6 — Final Result & Webhook](#step-6--final-result--webhook)
5. [Trust Score Calculation](#5-trust-score-calculation)
6. [API Reference](#6-api-reference)
7. [Environment Variables](#7-environment-variables)
8. [Database Schema](#8-database-schema)
9. [Local Development Guide](#9-local-development-guide)

---

## 1. System Overview

**TabibVerify** is a multi-step identity verification service designed for **Algerian medical platforms** (e.g. DoctorMe, Tabib.dz). It allows a partner platform to verify that a doctor is:

- ✅ **Real** — their email is reachable
- ✅ **Registered** — their CNOM number exists in the national registry
- ✅ **The right person** — their ID card matches their registry entry
- ✅ **Present** — their face matches their ID photo (liveness)
- ✅ **Authentic** — their NFC chip reads correctly (optional)

The system produces a **trust score (0–100)** and a final `verified / pending / rejected` status, sent to the partner via webhook.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Partner Platform                        │
│              (DoctorMe, Tabib.dz, etc.)                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ POST /api/v1/verification/start
                        │ Authorization: Bearer {API_KEY}
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      TabibVerify API                        │
│              (Next.js App Router — Vercel)                  │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Redis  │  │ Supabase │  │  Resend  │  │ Tesseract  │  │
│  │  Cache  │  │ Postgres │  │  Email   │  │  OCR (JS)  │  │
│  └─────────┘  └──────────┘  └──────────┘  └────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ verification_url
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Doctor's Browser                           │
│          /verify/{sessionId}  (multi-step UI)               │
│                                                             │
│   OTP → CNOM → CNIBE Scan → Face → NFC → Result            │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL) |
| Caching / Rate Limiting | Upstash Redis (REST, serverless-compatible) |
| Email OTP | Resend API |
| OCR | Tesseract.js (runs in browser, no server needed) |
| Hosting | Vercel |

---

## 3. Actor Roles

| Actor | Role |
|---|---|
| **Partner Platform** | A healthcare app that needs to verify a doctor. Calls the API with an API key to start a session. Receives the result via webhook. |
| **Doctor (User)** | Completes the verification steps in their browser. |
| **TabibVerify System** | Orchestrates the verification pipeline, stores results, calculates trust score. |
| **CNOM Registry** | National Council of Medicine (Conseil National de l'Ordre des Médecins) database. Stores all registered Algerian doctors. |

---

## 4. Step-by-Step Workflow

### Step 0 — Partner Requests a Session

**Who:** Partner platform (automated, server-to-server)

**What happens:**
1. Partner sends a `POST` request to `/api/v1/verification/start` with their API key
2. TabibVerify validates the API key against the `partners` table
3. A new `verification_sessions` row is created with status `in_progress`
4. A unique `verification_url` is returned (expires in 30 minutes)
5. Partner sends this URL to the doctor (via email, SMS, or in-app link)

**Request:**
```http
POST /api/v1/verification/start
Authorization: Bearer tv_live_doctorme_key_2024
Content-Type: application/json

{
  "partner_doctor_id": "DOC-789",
  "callback_url": "https://partner.com/webhook/verify",
  "redirect_url": "https://partner.com/profile"
}
```

**Response:**
```json
{
  "session_id": "sess_5882a1e62c1c",
  "verification_url": "https://tabibverify.com/verify/sess_5882a1e62c1c",
  "expires_at": "2026-05-03T07:30:00.000Z"
}
```

**Rate limit:** 10 requests per minute per API key.

---

### Step 1 — Email OTP Verification

**Who:** Doctor (in browser)

**Page:** `/verify/{sessionId}` → first tab shown is OTP

**What happens:**
1. Doctor enters their professional email address
2. TabibVerify sends a 6-digit OTP via **Resend** (valid for 10 minutes)
3. Doctor enters the OTP code
4. Server verifies the OTP from Redis cache
5. Email is recorded in session; doctor proceeds to next step

**API calls:**
```
POST /api/v1/verification/{sessionId}/step/otp/send     → sends email
POST /api/v1/verification/{sessionId}/step/otp/verify   → checks code
```

**OTP storage:** Stored in **Redis** as `otp:{sessionId}` with a 10-minute TTL.

**Trust score contribution:** +5 points (email ownership confirmed)

---

### Step 2 — CNOM Identity Verification

**Who:** Doctor (in browser)

**What happens:**
1. Doctor enters their **CNOM registration number** (e.g. `12-0001`)
2. Server queries the `cnom_registry` table in Supabase
3. If found, the doctor's full name, specialty, and wilaya are returned
4. Session is updated with `cnom_verified = true` and `full_name`
5. Doctor proceeds to document scan

**API call:**
```
POST /api/v1/verification/{sessionId}/step/identity
Body: { "cnom_number": "12-0001" }
```

**CNOM Registry format:** `{wilaya_code}-{sequence}` (e.g. `16-0042` = Algiers, doctor #42)

**What if not found?**
- Returns `{ error: "not_found" }` — doctor cannot proceed without a valid CNOM number.

**Trust score contribution:** +25 points (officially registered doctor confirmed)

---

### Step 3 — CNIBE Document Scan (OCR)

**Who:** Doctor (in browser, using camera)

**CNIBE** = Carte Nationale d'Identité Biométrique (Algerian biometric ID card)

**What happens:**
1. Doctor clicks "Scanner ma CNIBE" — browser requests camera permission
2. Camera activates (prefers rear camera on phones, front camera on laptops)
3. Doctor holds their CNIBE card inside the alignment frame
4. Doctor clicks "Capturer" — a frame is captured from the video stream
5. **Tesseract.js** (OCR engine) runs entirely in the browser:
   - Loads French + Arabic language models
   - Recognizes text on the captured image
   - Extracts **NIN** (18-digit National Identification Number) using regex
   - Extracts **Name** (from "Nom:" / "Prénom:" / Arabic equivalents)
6. Extracted data is sent to the server
7. Server cross-checks:
   - NIN first 10 digits vs. NIN stored in session from CNOM step
   - Extracted name vs. CNOM registry name (fuzzy match, threshold 65%)
8. Result stored in session: `document_verified`, `document_nin_match`, `document_name_match`

**API call:**
```
POST /api/v1/verification/{sessionId}/step/document
Body: {
  "extracted_nin": "199512163602145678",
  "extracted_name": "BENALI Ahmed",
  "ocr_confidence": 0.82
}
```

**Confidence levels:**
| Confidence | Meaning |
|---|---|
| ≥ 0.80 | NIN found and readable — ✅ high quality scan |
| 0.30–0.79 | Partial read — ⚠️ manual review required |
| < 0.30 | No useful data extracted — ❌ retry |

**Trust score contribution:** +35 points if NIN matches, +10 if name matches

> **Privacy note:** OCR runs entirely in the browser. The raw card image is **never uploaded** to any server. Only the extracted text (NIN partial, name) is sent.

---

### Step 4 — Face Liveness Check

**Who:** Doctor (in browser)

**What happens:**
1. Doctor is prompted to look at the camera
2. A series of face captures are taken
3. Liveness is checked (blink / smile / head turn prompt)
4. Result sent to server

**API call:**
```
POST /api/v1/verification/{sessionId}/step/face
Body: { "liveness_passed": true, "match_score": 0.91 }
```

**Trust score contribution:** +25 points if liveness passed

---

### Step 5 — NFC Card Read

**Who:** Doctor (on supported mobile device)

**What happens:**
1. Doctor taps their CNIBE card to the back of their phone
2. NFC reader reads the biometric chip data
3. Data is compared with OCR-extracted NIN

**API call:**
```
POST /api/v1/verification/{sessionId}/step/nfc
Body: { "nfc_read": true, "nin_match": true, "skipped": false }
```

> **Note:** NFC is optional. On desktops or unsupported devices, the doctor can skip this step. Skipping reduces the trust score slightly.

**Trust score contribution:** +5 points if NFC read successful and NIN matches

---

### Step 6 — Final Result & Webhook

**What happens:**
1. After NFC step, server calculates the final **trust score**
2. Status is set to `verified`, `pending`, or `rejected`
3. Result page is shown to the doctor
4. A **webhook** is sent to the partner's `callback_url` with the full result
5. Doctor is redirected to the partner's `redirect_url` (if provided)

**Webhook payload:**
```json
{
  "event": "verification.completed",
  "session_id": "sess_5882a1e62c1c",
  "partner_doctor_id": "DOC-789",
  "status": "verified",
  "trust_score": 90,
  "full_name": "Dr. Ahmed Benali",
  "cnom_number": "16-0042",
  "timestamp": "2026-05-03T07:45:00.000Z"
}
```

**Status thresholds:**
| Trust Score | Status |
|---|---|
| ≥ 75 | `verified` ✅ |
| 40–74 | `pending` ⚠️ (manual review) |
| < 40 | `rejected` ❌ |

---

## 5. Trust Score Calculation

| Step | Max Points | Condition |
|---|---|---|
| Email OTP verified | 5 | Email ownership confirmed |
| CNOM registry match | 25 | Doctor found in national registry |
| CNIBE NIN match | 35 | OCR NIN matches session NIN |
| CNIBE name match | 10 | OCR name fuzzy-matches CNOM name |
| Face liveness | 25 | Liveness check passed |
| NFC chip read | 5 | NFC read and NIN matches |
| **Total** | **105** | (capped at 100) |

---

## 6. API Reference

### Authentication
All partner API calls require:
```
Authorization: Bearer {API_KEY}
```
API keys are stored hashed in the `partners` table.

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/verification/start` | Create a new verification session |
| `POST` | `/api/v1/verification/{id}/step/otp/send` | Send OTP email |
| `POST` | `/api/v1/verification/{id}/step/otp/verify` | Verify OTP code |
| `POST` | `/api/v1/verification/{id}/step/identity` | Check CNOM number |
| `POST` | `/api/v1/verification/{id}/step/document` | Submit OCR results |
| `POST` | `/api/v1/verification/{id}/step/face` | Submit face liveness |
| `POST` | `/api/v1/verification/{id}/step/nfc` | Submit NFC result |
| `GET` | `/api/v1/internal/session-status` | Check session status |
| `POST` | `/api/v1/admin/login` | Admin dashboard login |

### Rate Limits
| Endpoint | Limit |
|---|---|
| `/verification/start` | 10 req/min per API key |
| `/otp/send` | 3 req/10min per session |
| `/admin/login` | 5 req/min per IP |

---

## 7. Environment Variables

Create a `.env.local` file in the project root:

```env
# Database — Supabase PostgreSQL
DATABASE_URL=postgresql://postgres.{project_ref}:{password}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres

# Redis — Upstash (optional in dev, uses in-memory fallback)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# Email OTP — Resend
RESEND_API_KEY=re_xxxxxxxxxxxx

# Security
WEBHOOK_SECRET=your_32_char_webhook_secret
API_KEY_SALT=your_salt_here
ADMIN_SECRET=your_admin_password
CRON_SECRET=your_cron_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 8. Database Schema

### `partners`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | Partner company name |
| `api_key_hash` | TEXT | SHA-256 hashed API key |
| `callback_url` | TEXT | Default webhook URL |
| `active` | BOOLEAN | Whether partner is active |

### `cnom_registry`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `cnom_number` | TEXT | e.g. `16-0042` |
| `full_name` | TEXT | Doctor's full name |
| `specialty` | TEXT | Medical specialty |
| `wilaya` | TEXT | Province name |
| `status` | TEXT | `active`, `suspended`, `revoked` |
| `nin_partial` | TEXT | First 10 digits of NIN |

### `verification_sessions`
| Column | Type | Description |
|---|---|---|
| `id` | TEXT | Session ID (e.g. `sess_abc123`) |
| `partner_id` | UUID | FK to partners |
| `partner_doctor_id` | TEXT | Partner's internal doctor ID |
| `status` | TEXT | `in_progress`, `verified`, `pending`, `rejected` |
| `trust_score` | INTEGER | 0–100 |
| `email` | TEXT | Doctor's verified email |
| `cnom_number` | TEXT | Verified CNOM number |
| `full_name` | TEXT | Name from CNOM registry |
| `cnom_verified` | BOOLEAN | CNOM step passed |
| `document_verified` | BOOLEAN | CNIBE scan attempted |
| `document_nin_match` | BOOLEAN | NIN matched |
| `document_name_match` | BOOLEAN | Name matched |
| `document_confidence` | FLOAT | OCR confidence score |
| `face_verified` | BOOLEAN | Liveness passed |
| `nfc_verified` | BOOLEAN | NFC read successful |
| `callback_url` | TEXT | Webhook URL |
| `redirect_url` | TEXT | Post-completion redirect |
| `expires_at` | TIMESTAMP | Session expiry (30 min) |
| `created_at` | TIMESTAMP | Creation time |

---

## 9. Local Development Guide

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)
- A Resend account (free tier: 100 emails/day)

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd tabib-verify
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase and Resend credentials

# 3. Run the dev server
npm run dev
# Server runs at http://localhost:3000
```

### Getting a Test Verification Link

```bash
node -e "
const http = require('http');
const data = JSON.stringify({
  partner_doctor_id: 'DOC-789',
  callback_url: 'https://example.com/webhook'
});
const req = http.request({
  hostname: 'localhost', port: 3000,
  path: '/api/v1/verification/start',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer tv_live_doctorme_key_2024',
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log(body));
});
req.write(data); req.end();
"
```

Copy the `verification_url` from the output and open it in your browser.

### Test CNOM Numbers (seeded in DB)

| CNOM Number | Doctor Name | Specialty |
|---|---|---|
| `16-0001` | Dr. Ahmed Benali | Cardiologie |
| `16-0002` | Dr. Fatima Boudiaf | Pédiatrie |
| `16-0003` | Dr. Karim Meziane | Neurologie |
| `09-0001` | Dr. Nadia Hamidi | Gynécologie |
| `31-0001` | Dr. Omar Tlemceni | Chirurgie |

### Admin Dashboard
Access at: `http://localhost:3000/admin`
Password: value of `ADMIN_SECRET` in `.env.local`

### Camera Test Page
Access at: `http://localhost:3000/camera-test`
Use this to verify your camera works before testing the CNIBE step.

---

*TabibVerify — Built for the Algerian healthcare ecosystem.*
