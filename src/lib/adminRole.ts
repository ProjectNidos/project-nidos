/** Absolute admin session limit: sign in again after this, active or not. */
export const SESSION_MAX_HOURS = 12;

type MaybeUser = { app_metadata?: Record<string, unknown>; last_sign_in_at?: string } | null | undefined;

/** Admin = app_metadata.role 'admin' (settable only with the service key) and a sign-in younger than the limit. */
export function isAdminUser(user: MaybeUser, now = Date.now()): boolean {
  if (user?.app_metadata?.role !== 'admin' || !user.last_sign_in_at) return false;
  const signedIn = Date.parse(user.last_sign_in_at);
  // ponytail: absolute timeout only; add an idle timeout (Supabase Pro "inactivity timeout") if ever needed.
  return Number.isFinite(signedIn) && now - signedIn <= SESSION_MAX_HOURS * 3600e3;
}
