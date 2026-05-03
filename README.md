# 🩺 TabibVerify DZ

TabibVerify is a state-of-the-art, secure identity verification pipeline built specifically for Algerian medical practitioners. It utilizes an AI-driven, 3-step authentication flow to cross-reference National Identity Cards with the official CNOM (Conseil National de l'Ordre des Médecins) registry.

---

## 🏗️ Architecture Diagram

Here is the high-level architecture of the 3-step verification pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor Doctor
    participant UI as TabibVerify Frontend
    participant API as Verification API (Next.js)
    participant DB as PostgreSQL (Supabase)
    participant AI as Gemini 1.5 Pro (Vision)
    participant Email as Nodemailer (SMTP)

    Note over Doctor,Email: STEP 1: Identity & Web Registry Scraping
    Doctor->>UI: Enters CNOM Number & NIN
    UI->>API: POST /step/identity
    API->>AI: Fetch & Scrape CNOM HTML Registry
    AI-->>API: Extracted JSON (NIN, Name, Specialty, Status)
    API->>DB: Store extracted NIN (for later cross-check)
    API-->>UI: CNOM Verified

    Note over Doctor,Email: STEP 2: Email OTP Authentication
    Doctor->>UI: Enters Professional Email
    UI->>API: POST /step/otp/send
    API->>DB: Store Hash & Expiration
    API->>Email: Send secure 6-digit OTP
    Email-->>Doctor: Receives OTP
    Doctor->>UI: Submits OTP
    UI->>API: POST /step/otp/verify
    API->>DB: Validate Hash
    API-->>UI: OTP Verified

    Note over Doctor,Email: STEP 3 & 4: Vision AI & Cross-Verification
    Doctor->>UI: Uploads National ID Card (Image)
    UI->>API: POST /step/ocr
    API->>AI: Process Image (Base64)
    AI-->>API: JSON (NIN, Full Name, DOB)
    API->>API: CROSS-VERIFICATION (Compare OCR NIN == Scraped NIN)
    alt NIN Matches
        API->>DB: UPDATE status = 'VERIFIED'
        API-->>UI: Identity successfully verified.
    else NIN Mismatch
        API-->>UI: 400 Bad Request: Identity Verification Failed: NIN Mismatch
    end
```

---

## ☁️ Deployment Architecture (Render)

This application is configured for deployment on **Render.com**. The `render.yaml` file defines the infrastructure as code for seamless cloud hosting.

```mermaid
graph TD
    Client([💻 Doctor / User]) <--> |HTTPS| RenderWeb
    
    subgraph Render.com Cloud
        RenderWeb[🌐 Web Service<br/>TabibVerify Next.js]
    end
    
    subgraph External Services
        Supabase[(🐘 Supabase<br/>PostgreSQL DB)]
        Gemini[🧠 Google Gemini<br/>Vision AI / Scraping]
        SMTP[📧 Gmail SMTP<br/>Nodemailer]
    end

    RenderWeb <--> |Prisma / pg| Supabase
    RenderWeb <--> |REST API| Gemini
    RenderWeb --> |SMTP / 465| SMTP
```

To deploy on Render:
1. Connect your GitHub repository to Render.
2. Select **Blueprint** and point it to the `render.yaml` file in this repository.
3. Fill in the required secret environment variables (`DATABASE_URL`, `SMTP_USER`, `SMTP_PASS`, `GEMINI_API_KEY`) when prompted in the Render Dashboard.

---

## 🚀 Key Features

1. **AI-Powered Web Scraping (Gemini 1.5 Pro):** 
   - Dynamically scrapes practitioner details directly from the public HTML registry.
   - Strictly enforces JSON extraction for high accuracy and consistency.

2. **Universal SMTP OTP Delivery (Nodemailer):**
   - Bypasses sandbox limits by utilizing direct SMTP (e.g., Gmail App Passwords).
   - Generates and stores secure, cryptographically random OTPs in PostgreSQL/Redis.

3. **Vision AI Document Processing (Gemini Vision):**
   - No clunky client-side OCR.
   - Extracts National Identification Numbers (NIN), Full Names, and Dates of Birth from physical ID cards seamlessly.

4. **Strict Cross-Verification (Step 4):**
   - The backend guarantees that the NIN printed on the ID card exactly matches the NIN extracted from the official registry.

---

## ⚙️ Environment Variables

To run this project locally, you must provide the following variables in your `.env.local`:

```env
# PostgreSQL Database
DATABASE_URL=postgresql://user:password@localhost:5432/tabibverify

# Email OTP (Nodemailer - Example with Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# AI & OCR (Gemini)
GEMINI_API_KEY=your_gemini_api_key_here
```

## 💻 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
