import { NextRequest, NextResponse } from 'next/server';
import pool from './db';

export interface AuthResult {
  partnerId: string;
  partnerName: string;
}

export async function authenticatePartner(req: NextRequest): Promise<AuthResult | NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.substring(7);
  const result = await pool.query(
    'SELECT id, name FROM partners WHERE api_key = $1 AND status = $2',
    [apiKey, 'active']
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid API key' },
      { status: 401 }
    );
  }

  return { partnerId: result.rows[0].id, partnerName: result.rows[0].name };
}
