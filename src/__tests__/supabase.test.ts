import { describe, it, expect, vi } from 'vitest';

describe('Supabase clients without settings', () => {
  it('fail like an unreachable database instead of throwing', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    const { serviceClient, publicClient } = await import('@/lib/supabase');
    expect((await serviceClient().from('leads').insert({ name: 'x' })).error).toBeTruthy();
    expect((await publicClient().from('site_texts').select('key')).error).toBeTruthy();
    vi.unstubAllEnvs();
  });
});
