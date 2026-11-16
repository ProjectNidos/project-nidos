import { publicClient } from '@/lib/supabase';

/** Liveness for Railway and uptime monitoring. `?deep=1` also checks the database. */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('deep') !== '1') return Response.json({ status: 'ok' });
  const { error } = await publicClient().from('site_texts').select('key', { head: true, count: 'exact' });
  return Response.json({ status: error ? 'degraded' : 'ok', database: !error }, { status: error ? 503 : 200 });
}
