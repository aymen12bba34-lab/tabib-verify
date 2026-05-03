import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { html } = await req.json();

    if (!html) {
      return NextResponse.json(
        { error: 'bad_request', message: 'HTML content is required' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'server_configuration', message: 'GEMINI_API_KEY is missing' },
        { status: 500 }
      );
    }

    // Prompt enforcing the STRICT schema and JSON format
    const prompt = `
You are an expert web scraping and backend logic AI.
I am providing you with raw HTML scraped from a professional registry.
Your task is to accurately extract the practitioner's details and return them STRICTLY as a JSON object.

Look for the following fields:
1. "fullName": The practitioner's full name.
2. "cnom": The CNOM registration number.
3. "nin": The National Identification Number (NIN / Numéro d'Identification National).
4. "specialty": The medical specialty.
5. "status": The current registration status.
If a field is missing, set its value to null.

Return ONLY the JSON object using this exact schema, with no markdown formatting or extra text:
{
  "fullName": string | null,
  "cnom": string | null,
  "nin": string | null,
  "specialty": string | null,
  "status": string | null
}

HTML Content:
${html}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: prompt,
      config: {
        // Enforce JSON output for structure
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '{}';
    const extractedData = JSON.parse(outputText);

    return NextResponse.json(extractedData);

  } catch (error) {
    console.error('[ExtractPractitioner] Exception:', error);
    return NextResponse.json(
      { error: 'extraction_failed', message: 'Failed to extract practitioner data from HTML' },
      { status: 500 }
    );
  }
}
