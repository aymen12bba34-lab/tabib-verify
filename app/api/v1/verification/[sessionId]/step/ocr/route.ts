import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import pool from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  try {
    const session = await pool.query('SELECT * FROM verification_sessions WHERE id = $1', [sessionId]);
    if (session.rows.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Session introuvable' }, { status: 404 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'server_configuration', message: 'GEMINI_API_KEY is missing' },
        { status: 500 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'bad_request', message: 'Invalid JSON' }, { status: 400 });
    }

    const { base64Image } = body;
    if (!base64Image) {
      return NextResponse.json(
        { error: 'bad_request', message: 'base64Image is required' },
        { status: 400 }
      );
    }

    // Strip the data:image/...;base64, prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `
You are an expert OCR and document analysis AI.
I am providing you with an image of a National ID Card.
Your task is to accurately extract the following details and return them STRICTLY as a JSON object.

Look for the following fields:
1. "nin": The "National Identification Number" (NIN / Numéro d'Identification National). Ensure you extract the full 18-digit number exactly as written.
2. "fullName": The person's full name. Combine first name and last name.
3. "dateOfBirth": The date of birth in YYYY-MM-DD format if possible, otherwise exactly as written.
If a field is missing or illegible, set its value to null.

Return ONLY the JSON object using this exact schema, with no markdown formatting or extra text:
{
  "nin": string | null,
  "fullName": string | null,
  "dateOfBirth": string | null
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        }
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '{}';
    const extractedData = JSON.parse(outputText);

    return NextResponse.json({
      success: true,
      extracted: extractedData
    });

  } catch (error) {
    console.error('[VisionOCR] Exception:', error);
    return NextResponse.json(
      { error: 'ocr_failed', message: 'Failed to process image with Vision AI' },
      { status: 500 }
    );
  }
}
