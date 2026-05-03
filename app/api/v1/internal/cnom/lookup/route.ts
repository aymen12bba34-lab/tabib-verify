import { NextRequest, NextResponse } from 'next/server';
import { lookupCNOM } from '@/lib/cnom';

export async function GET(req: NextRequest) {
  const cnomNumber = req.nextUrl.searchParams.get('cnom_number');
  if (!cnomNumber) {
    return NextResponse.json({ error: 'bad_request', message: 'cnom_number query param required' }, { status: 400 });
  }

  const record = await lookupCNOM(cnomNumber);
  if (!record) {
    return NextResponse.json({ error: 'not_found', message: 'CNOM number not found' }, { status: 404 });
  }

  return NextResponse.json({
    cnom_number: record.cnom_number,
    full_name_fr: record.full_name_fr,
    specialty: record.specialty,
    wilaya_name: record.wilaya_name,
    status: record.status,
  });
}
