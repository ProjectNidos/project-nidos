import { audit, requireAdmin } from '@/lib/auth';
import { sessionClient } from '@/lib/supabase';
import { securityEvent } from '@/lib/security';

/** GDPR access/portability: one enquiry as a JSON download. */
export async function GET(_req: Request, ctx: RouteContext<'/admin/leads/[id]/export'>) {
  const user = await requireAdmin();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    await securityEvent('crafted_request', '/admin/leads/…/export');
    return new Response('Not found', { status: 404 });
  }
  const { data, error } = await (await sessionClient()).from('leads').select('*').eq('id', id).maybeSingle();
  if (error || !data) return new Response('Not found', { status: 404 });
  await audit({ action: 'lead_export', actor: user, target: id });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="pieteikums-${id}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
