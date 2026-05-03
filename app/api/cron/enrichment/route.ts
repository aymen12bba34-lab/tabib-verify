import { NextRequest, NextResponse } from 'next/server';

// Placeholder — full OSM enrichment is run manually via npm run scrape:osm
// Vercel calls this weekly (Sunday 3 AM) via vercel.json crons.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-vercel-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // TODO: trigger lightweight OSM re-scrape for top wilayas
  return NextResponse.json({ success: true, message: 'Enrichment cron placeholder — run scrape:osm manually for full data.' });
}
