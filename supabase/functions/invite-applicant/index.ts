/**
 * Invite Applicant — uses Supabase Auth only for email links (no hand-built magic URLs).
 *
 * Flow:
 * 1. Try inviteUserByEmail (creates user + sends invite email).
 * 2. If that fails, look up existing auth user by email.
 * 3. If still no user, createUser without email (silent account creation).
 * 4. Optionally send recovery email — non-fatal if it fails.
 * 5. Always create invite + applicant records and return 200.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SET_PASSWORD_PATH = '/invite-auth';
const SITE_URL = (Deno.env.get('SITE_URL') || 'http://localhost:3000').replace(/\/+$/, '');

function resolveSetPasswordRedirectUrl(redirectBaseUrl?: string | null): string {
  const isAllowedRedirectOrigin = (origin: string): boolean => {
    try {
      const u = new URL(origin);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      const h = u.hostname;
      if (h === 'localhost' || h === '127.0.0.1' || h === '10.0.2.2') return true;
      const oct = h.split('.').map((p) => parseInt(p, 10));
      if (oct.length === 4 && oct.every((n) => Number.isFinite(n))) {
        const [a, b] = oct;
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
      }
      const env = (Deno.env.get('APP_URL') || Deno.env.get('EXPO_PUBLIC_APP_URL') || '').trim();
      if (!env || env.startsWith('aralink://')) return false;
      const normalized = env.startsWith('http') ? env : `https://${env}`;
      const allowedOrigin = new URL(normalized).origin;
      return u.origin === allowedOrigin;
    } catch {
      return false;
    }
  };

  const envFallbackInviteAuthUrl = (): string => {
    const candidates = [
      Deno.env.get('WEB_INVITE_REDIRECT_URL'),
      Deno.env.get('APP_URL'),
      Deno.env.get('EXPO_PUBLIC_APP_URL'),
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    for (const rawIn of candidates) {
      const raw = rawIn.trim();
      if (raw.startsWith('aralink://')) {
        if (raw.includes('invite-auth')) return raw;
        continue;
      }
      if (raw.startsWith('http')) {
        try {
          if (raw.includes('invite-auth')) return raw.split('#')[0];
          const u = new URL(raw);
          return `${u.origin}${SET_PASSWORD_PATH}`;
        } catch { continue; }
      }
    }
    return `${SITE_URL}${SET_PASSWORD_PATH}`;
  };

  const fromClient = redirectBaseUrl?.trim();
  if (fromClient) {
    try {
      const u = new URL(fromClient.includes('://') ? fromClient : `http://${fromClient}`);
      if (isAllowedRedirectOrigin(u.origin)) return `${u.origin}${SET_PASSWORD_PATH}`;
    } catch { /* fall through */ }
  }
  return envFallbackInviteAuthUrl();
}

function resolveRedirectToForSupabaseEmail(inviteBase: string): string {
  const explicit = (Deno.env.get('SET_PASSWORD_REDIRECT_URL') || Deno.env.get('INVITE_AUTH_REDIRECT_URL') || '').trim();
  if (explicit && /^https?:\/\//i.test(explicit)) {
    try {
      const u = new URL(explicit.split('#')[0].split('?')[0].replace(/\/+$/, ''));
      return `${u.origin}${SET_PASSWORD_PATH}`;
    } catch { /* fall through */ }
  }
  const withoutQuery = inviteBase.trim().split('?')[0].replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(withoutQuery)) return `${SITE_URL}${SET_PASSWORD_PATH}`;
  try {
    return `${new URL(withoutQuery).origin}${SET_PASSWORD_PATH}`;
  } catch {
    return `${SITE_URL}${SET_PASSWORD_PATH}`;
  }
}

function normalizeRedirectToSetPassword(redirectTo: string): string {
  const t = redirectTo.trim();
  if (!t) return `${SITE_URL}${SET_PASSWORD_PATH}`;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return `${SITE_URL}${SET_PASSWORD_PATH}`;
    return `${u.origin}${SET_PASSWORD_PATH}`;
  } catch {
    return `${SITE_URL}${SET_PASSWORD_PATH}`;
  }
}

interface InviteApplicantRequest {
  propertyId: string;
  applicantEmail: string;
  applicantName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  unitId?: string;
  subUnitId?: string;
  expiresInHours?: number;
  redirectBaseUrl?: string;
}

interface InviteApplicantResponse {
  inviteId?: string;
  token?: string;
  inviteStatus?: string;
  applicantId?: string | null;
  notificationQueued?: boolean;
  emailQueued?: boolean;
  inviteFlow?: 'applicant' | 'tenant';
  authEmailKind?: 'invite' | 'recovery' | 'none';
  redirectTo?: string;
  error?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const tokenPepper = Deno.env.get('INVITE_TOKEN_PEPPER') || '';

if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const generateToken = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return base64Url(b); };

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(`${token}${tokenPepper}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const findAuthUserIdByEmail = async (email: string): Promise<string | null> => {
  const perPage = 200;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  return null;
};

async function sendRecoveryEmailWithRedirect(email: string, redirectTo: string): Promise<boolean> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!anonKey) { console.warn('[invite-applicant] SUPABASE_ANON_KEY not set — skipping recovery email'); return false; }
  const base = supabaseUrl.replace(/\/+$/, '');
  let rt = `${SITE_URL}${SET_PASSWORD_PATH}`;
  try { const u = new URL(redirectTo); rt = `${u.origin}${SET_PASSWORD_PATH}`; } catch { /* keep default */ }
  const res = await fetch(`${base}/auth/v1/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify({ email, redirect_to: rt }),
  });
  if (!res.ok) { console.warn('[invite-applicant] recovery email failed:', await res.text()); return false; }
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!tokenPepper) return json({ error: 'INVITE_TOKEN_PEPPER not set' }, 500);

    const authHeader = req.headers.get('Authorization') || '';
    const { data: authData, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !authData?.user?.id) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json()) as InviteApplicantRequest;
    const propertyId = body.propertyId;
    const applicantEmail = normalizeEmail(body.applicantEmail || '');
    const firstName = body.firstName?.trim() || '';
    const lastName = body.lastName?.trim() || '';
    const phone = body.phone?.trim() || '';
    const unitId = body.unitId?.trim() || '';
    const subUnitId = body.subUnitId?.trim() || '';
    const applicantName = body.applicantName?.trim() || `${firstName} ${lastName}`.trim();
    const expiresInHours = body.expiresInHours && body.expiresInHours > 0 ? body.expiresInHours : 168;

    if (!propertyId || !applicantEmail || !applicantEmail.includes('@'))
      return json({ error: 'propertyId and valid applicantEmail are required' }, 400);

    const inviteAuthBase = resolveSetPasswordRedirectUrl(body.redirectBaseUrl);

    const { data: property, error: propertyError } = await supabase
      .from('properties').select('id, user_id, address1, address2, city, state, zip_code')
      .eq('id', propertyId).single();
    if (propertyError || !property) return json({ error: 'Property not found' }, 404);
    if (property.user_id !== authData.user.id) return json({ error: 'Forbidden' }, 403);

    const { data: existingProfile } = await supabase
      .from('profiles').select('id, email, user_type, account_status, has_set_password')
      .eq('email', applicantEmail).maybeSingle();

    const authUserId = await findAuthUserIdByEmail(applicantEmail);

    const token = generateToken();
    const tokenHash = await hashToken(token);
    const inviteAuthPathOnly = normalizeRedirectToSetPassword(resolveRedirectToForSupabaseEmail(inviteAuthBase));
    const appendQuery = Deno.env.get('INVITE_REDIRECT_APPEND_QUERY') === 'true';
    const supabaseRedirectTo = appendQuery
      ? `${inviteAuthPathOnly}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(applicantEmail)}`
      : inviteAuthPathOnly;

    const userMeta = { full_name: applicantName || applicantEmail.split('@')[0], user_type: 'tenant' };

    let applicantId: string | null = existingProfile?.id ?? authUserId;
    let emailSent = false;
    let authEmailKind: 'invite' | 'recovery' | 'none' = 'none';
    let inviteFlow: 'applicant' | 'tenant';

    if (authUserId === null) {
      // ── NEW USER PATH ──────────────────────────────────────────────────────
      inviteFlow = 'applicant';
      const { data: adminInvited, error: adminInviteError } = await supabase.auth.admin.inviteUserByEmail(
        applicantEmail, { redirectTo: supabaseRedirectTo, data: userMeta }
      );

      if (adminInviteError || !adminInvited?.user) {
        const errorMsg = adminInviteError?.message || String(adminInviteError || '');
        console.warn('[invite-applicant] inviteUserByEmail failed:', errorMsg, '— falling back to createUser');

        // Check if user was silently created despite the error
        let fallbackId = await findAuthUserIdByEmail(applicantEmail);

        if (!fallbackId) {
          // createUser does NOT send any email — silent account creation
          const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: applicantEmail,
            email_confirm: false,
            user_metadata: userMeta,
          });
          if (createErr || !created?.user) {
            console.error('[invite-applicant] createUser also failed:', createErr?.message);
            return json({ error: 'Could not create applicant account. Please try again.' }, 500);
          }
          fallbackId = created.user.id;
          console.log('[invite-applicant] createUser succeeded (no email sent):', fallbackId);
        }

        applicantId = fallbackId;
        inviteFlow = 'tenant';
        // Best-effort recovery email now that we have the user
        emailSent = await sendRecoveryEmailWithRedirect(applicantEmail, supabaseRedirectTo);
        authEmailKind = emailSent ? 'recovery' : 'none';
      } else {
        applicantId = adminInvited.user.id;
        emailSent = true;
        authEmailKind = 'invite';
      }

      await supabase.from('profiles').upsert(
        { id: applicantId!, email: applicantEmail, full_name: applicantName || applicantEmail.split('@')[0],
          user_type: 'tenant', account_status: 'invited', has_set_password: false, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    } else {
      // ── EXISTING USER PATH ────────────────────────────────────────────────
      inviteFlow = 'tenant';
      applicantId = authUserId;
      emailSent = await sendRecoveryEmailWithRedirect(applicantEmail, supabaseRedirectTo);
      authEmailKind = emailSent ? 'recovery' : 'none';
      if (!emailSent) console.warn('[invite-applicant] Recovery email failed for existing user — in-app notification only.');

      await supabase.from('profiles').upsert(
        { id: applicantId, email: applicantEmail, full_name: applicantName || applicantEmail.split('@')[0],
          user_type: 'tenant',
          account_status: existingProfile?.account_status === 'invited' ? 'invited' : (existingProfile?.account_status || 'active'),
          has_set_password: existingProfile?.has_set_password ?? false, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    }

    // ── CREATE INVITE + APPLICANT RECORDS (always runs) ─────────────────────
    const now = new Date();
    await supabase.from('invites')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('tenant_email', applicantEmail).eq('property_id', propertyId).eq('status', 'pending');

    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
    const { data: invite, error: inviteError } = await supabase.from('invites').insert({
      token_hash: tokenHash, property_id: propertyId, landlord_id: authData.user.id,
      tenant_id: applicantId, tenant_email: applicantEmail, unit_id: unitId || null,
      sub_unit_id: subUnitId || null, status: 'pending',
      expires_at: expiresAt.toISOString(), created_at: now.toISOString(), updated_at: now.toISOString(),
    }).select().single();

    if (inviteError || !invite) return json({ error: inviteError?.message || 'Failed to create invite' }, 500);

    const { error: applicantRecordError } = await supabase.from('applicants').insert({
      landlord_id: authData.user.id, property_id: propertyId,
      first_name: firstName || applicantEmail.split('@')[0], last_name: lastName || '',
      email: applicantEmail, phone: phone || null, unit_id: unitId || null, sub_unit_id: subUnitId || null,
      status: 'invited', invite_id: invite.id,
      invited_at: now.toISOString(), created_at: now.toISOString(), updated_at: now.toISOString(),
    });
    if (applicantRecordError) console.error('Error creating applicant record:', applicantRecordError);

    let notificationCreated = false;
    if (applicantId) {
      try {
        const propertyAddress = [property.address1, property.address2, property.city, property.state, property.zip_code]
          .filter(Boolean).join(', ');
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: applicantId, type: 'invite',
          title: 'You have been invited to apply for a property',
          message: 'Open the invite to review the property details and start your application.',
          data: { token, inviteId: invite.id, propertyId, propertyAddress, unitId: unitId || null,
            subUnitId: subUnitId || null, landlordId: authData.user.id },
          created_at: now.toISOString(),
        });
        if (notifError) console.error('Notification error:', notifError);
        else notificationCreated = true;
      } catch (err) { console.error('Failed to create notification:', err); }
    }

    return json({
      inviteId: invite.id, token, inviteStatus: 'pending', applicantId: applicantId || null,
      notificationQueued: notificationCreated, emailQueued: emailSent,
      inviteFlow, authEmailKind, redirectTo: supabaseRedirectTo,
    } as InviteApplicantResponse, 200);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
