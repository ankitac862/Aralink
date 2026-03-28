/**
 * Web path where Supabase Auth must redirect after invite / recovery / magic link.
 * Must match Authentication → Redirect URLs and Edge Function redirect_to.
 */
export const INVITE_AUTH_PATH = '/invite-auth';

export function buildWebInviteAuthUrl(origin: string): string {
  const base = origin.trim().replace(/\/+$/, '');
  try {
    const u = new URL(base.includes('://') ? base : `https://${base}`);
    return `${u.origin}${INVITE_AUTH_PATH}`;
  } catch {
    return `${base}${INVITE_AUTH_PATH}`;
  }
}
