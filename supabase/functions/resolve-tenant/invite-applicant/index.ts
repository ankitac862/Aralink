/**
 * Invite Applicant — uses Supabase Auth only for email links (no hand-built magic URLs).
 *
 * - New users: `auth.admin.inviteUserByEmail` (primary) → email uses {{ .ConfirmationURL }} from dashboard template.
 * - Existing users: POST /auth/v1/recover with anon key → same `redirect_to`.
 *
 * POST body: { propertyId, applicantEmail, redirectBaseUrl? }
 *
 * Hosted Dashboard (required):
 * - Authentication → URL Configuration → Redirect URLs MUST include the exact path you use, e.g.
 *   `http://localhost:8081/invite-auth` and/or `http://localhost:8081/**`.
 *   If `redirect_to` is rejected, GoTrue embeds **Site URL only** (`http://localhost:8081/`) in emails — you will
 *   see `redirect_to=http://localhost:8081/` in verify links.
 * - Email templates: invite + recovery use **{{ .ConfirmationURL }}** (default).
 * - Secrets: SUPABASE_ANON_KEY, optional SET_PASSWORD_REDIRECT_URL.
 * - Optional: `INVITE_REDIRECT_APPEND_QUERY=true` appends `?token=&email=` to `redirect_to` (only if your
 *   Redirect URLs allow that full URL; otherwise leave unset — session-based password flow still works).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SET_PASSWORD_PATH = '/invite-auth';

/** Inlined (Supabase deploy bundles single entry per function). */
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
        } catch {
          continue;
        }
      }
    }
    return `http://localhost:8081${SET_PASSWORD_PATH}`;
  };

  const fromClient = redirectBaseUrl?.trim();
  if (fromClient) {
    try {
      const u = new URL(fromClient.includes('://') ? fromClient : `http://${fromClient}`);
      const origin = u.origin;
      if (isAllowedRedirectOrigin(origin)) {
        return `${origin}${SET_PASSWORD_PATH}`;
      }
    } catch {
      // fall through
    }
  }
  return envFallbackInviteAuthUrl();
}

/** Final redirect_to for invite + recovery (must be allowlisted in Supabase Dashboard). */
function resolveRedirectToForSupabaseEmail(inviteBase: string): string {
  const explicit = (
    Deno.env.get('SET_PASSWORD_REDIRECT_URL') ||
    Deno.env.get('INVITE_AUTH_REDIRECT_URL') ||
    ''
  ).trim();
  if (explicit && /^https?:\/\//i.test(explicit)) {
    try {
      const noFrag = explicit.split('#')[0].split('?')[0].replace(/\/+$/, '');
      const u = new URL(noFrag);
      return `${u.origin}${SET_PASSWORD_PATH}`;
    } catch {
      // fall through
    }
  }

  const withoutQuery = inviteBase.trim().split('?')[0].replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(withoutQuery)) {
    return `http://localhost:8081${SET_PASSWORD_PATH}`;
  }
  try {
    const u = new URL(withoutQuery);
    return `${u.origin}${SET_PASSWORD_PATH}`;
  } catch {
    return `http://localhost:8081${SET_PASSWORD_PATH}`;
  }
}

/** Canonical https? URL ending in `/invite-auth` before GoTrue. */
function normalizeRedirectToSetPassword(redirectTo: string): string {
  const t = redirectTo.trim();
  if (!t) return `http://localhost:8081${SET_PASSWORD_PATH}`;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return `http://localhost:8081${SET_PASSWORD_PATH}`;
    }
    return `${u.origin}${SET_PASSWORD_PATH}`;
  } catch {
    return `http://localhost:8081${SET_PASSWORD_PATH}`;
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
  /** Browser origin (e.g. http://localhost:8081) so invite email matches Metro port */
  redirectBaseUrl?: string;
}

interface InviteApplicantResponse {
  inviteId?: string;
  token?: string;
  inviteStatus?: string;
  applicantId?: string | null;
  notificationQueued?: boolean;
  emailQueued?: boolean;
  /** Auth absent → Applicant (inviteUserByEmail). Auth present → Tenant (recovery / magic link). */
  inviteFlow?: 'applicant' | 'tenant';
  /** Which Supabase email was triggered: new user invite vs existing-user recovery. */
  authEmailKind?: 'invite' | 'recovery';
  /** Echo: redirect_to sent to GoTrue (invite + recover). */
  redirectTo?: string;
  error?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const tokenPepper = Deno.env.get('INVITE_TOKEN_PEPPER') || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const generateToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(`${token}${tokenPepper}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const findAuthUserIdByEmail = async (email: string): Promise<string | null> => {
  const perPage = 200;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) {
      return null;
    }
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) {
      return match.id;
    }
    if (data.users.length < perPage) {
      break;
    }
  }
  return null;
};

/**
 * Password recovery emails must use the **public** `/auth/v1/recover` endpoint with the **anon** key.
 * `supabase.auth.resetPasswordForEmail` on a **service-role** client often omits or loses `redirect_to`,
 * so the emailed link falls back to Site URL only (no /invite-auth path).
 *
 * Ref: GoTrue POST /recover body: { email, redirect_to }
 */
async function sendRecoveryEmailWithRedirect(params: {
  email: string;
  redirectTo: string;
}): Promise<{ ok: boolean; error?: string }> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!anonKey) {
    return {
      ok: false,
      error:
        'SUPABASE_ANON_KEY is not set in Edge Function secrets (required so recovery emails honor redirect_to)',
    };
  }

  const base = supabaseUrl.replace(/\/+$/, '');
  const recoverUrl = `${base}/auth/v1/recover`;

  const redirectTo = (() => {
    try {
      const u = new URL(params.redirectTo);
      return `${u.origin}${SET_PASSWORD_PATH}`;
    } catch {
      return `http://localhost:8081${SET_PASSWORD_PATH}`;
    }
  })();

  const res = await fetch(recoverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      email: params.email,
      redirect_to: redirectTo,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { error_description?: string; msg?: string; message?: string };
      msg = j.error_description || j.msg || j.message || text;
    } catch {
      // keep text
    }
    return { ok: false, error: msg || `recover failed (${res.status})` };
  }

  return { ok: true };
}

async function sendRecoveryForApplicant(
  applicantEmail: string,
  redirectTo: string,
): Promise<boolean> {
  const recover = await sendRecoveryEmailWithRedirect({ email: applicantEmail, redirectTo });
  if (recover.ok) {
    console.log('[invite-applicant] recover OK, redirect_to:', redirectTo);
    return true;
  }
  console.error('[invite-applicant] recover error:', recover.error);
  // Do not fallback to resetPasswordForEmail here: it may emit links with root redirect_to.
  // Failing fast keeps behavior predictable and surfaces config issues.
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!tokenPepper) {
      return json({ error: 'INVITE_TOKEN_PEPPER not set' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData?.user?.id) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as InviteApplicantRequest;
    const propertyId = body.propertyId;
    const applicantEmail = normalizeEmail(body.applicantEmail || '');
    const firstName = body.firstName?.trim() || '';
    const lastName = body.lastName?.trim() || '';
    const phone = body.phone?.trim() || '';
    const unitId = body.unitId?.trim() || '';
    const subUnitId = body.subUnitId?.trim() || '';
    const applicantName = body.applicantName?.trim() || `${firstName} ${lastName}`.trim();
    const expiresInHours =
      body.expiresInHours && body.expiresInHours > 0 ? body.expiresInHours : 168;

    if (!propertyId || !applicantEmail || !applicantEmail.includes('@')) {
      return json({ error: 'propertyId and valid applicantEmail are required' }, 400);
    }

    const inviteAuthBase = resolveSetPasswordRedirectUrl(body.redirectBaseUrl);

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, user_id, address1, address2, city, state, zip_code')
      .eq('id', propertyId)
      .single();

    if (propertyError || !property) {
      return json({ error: 'Property not found' }, 404);
    }

    if (property.user_id !== authData.user.id) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, user_type, account_status, has_set_password')
      .eq('email', applicantEmail)
      .maybeSingle();

    if (profileError) {
      return json({ error: profileError.message }, 500);
    }

    /** Step 1: branch on Supabase Auth (not only profiles). */
    const authUserId = await findAuthUserIdByEmail(applicantEmail);

    const token = generateToken();
    const tokenHash = await hashToken(token);

    const inviteAuthPathOnly = normalizeRedirectToSetPassword(
      resolveRedirectToForSupabaseEmail(inviteAuthBase),
    );
    // Query string often fails hosted Redirect URL matching → GoTrue falls back to Site URL only.
    // Default: path-only `…/invite-auth` (add exact URL in Dashboard). Opt-in: INVITE_REDIRECT_APPEND_QUERY=true.
    const appendQuery = Deno.env.get('INVITE_REDIRECT_APPEND_QUERY') === 'true';
    const supabaseRedirectTo = appendQuery
      ? `${inviteAuthPathOnly}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(applicantEmail)}`
      : inviteAuthPathOnly;
    console.log('[invite-applicant] redirect_to for GoTrue:', supabaseRedirectTo, { appendQuery });

    const userMeta = {
      full_name: applicantName || applicantEmail.split('@')[0],
      user_type: 'tenant',
    };

    let applicantId: string | null = existingProfile?.id ?? authUserId;
    let emailSent = false;
    let authEmailKind: 'invite' | 'recovery' | undefined;
    let inviteFlow: 'applicant' | 'tenant';

    if (authUserId === null) {
      // APPLICANT: no Auth user → inviteUserByEmail (Supabase email template uses {{ .ConfirmationURL }})
      inviteFlow = 'applicant';
      const { data: adminInvited, error: adminInviteError } = await supabase.auth.admin.inviteUserByEmail(
        applicantEmail,
        {
          redirectTo: supabaseRedirectTo,
          data: userMeta,
        },
      );

      if (adminInviteError || !adminInvited?.user) {
        const errorMsg = adminInviteError?.message || String(adminInviteError || '');
        const alreadyRegistered = errorMsg.toLowerCase().includes('already');

        if (!alreadyRegistered) {
          console.error('Unexpected invite error:', adminInviteError);
          return json({ error: errorMsg || 'Invite failed' }, 500);
        }

        applicantId = await findAuthUserIdByEmail(applicantEmail);
        if (!applicantId) {
          return json({ error: 'User could not be created or found. Try again.' }, 500);
        }
        authEmailKind = 'recovery';
        emailSent = await sendRecoveryForApplicant(applicantEmail, supabaseRedirectTo);
        inviteFlow = 'tenant';
      } else {
        applicantId = adminInvited.user.id;
        emailSent = true;
        authEmailKind = 'invite';
      }

      await supabase.from('profiles').upsert(
        {
          id: applicantId!,
          email: applicantEmail,
          full_name: applicantName || applicantEmail.split('@')[0],
          user_type: 'tenant',
          account_status: 'invited',
          has_set_password: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    } else {
      // TENANT: Auth user already exists → do not create a duplicate; recovery email to same redirectTo
      inviteFlow = 'tenant';
      applicantId = authUserId;
      authEmailKind = 'recovery';
      emailSent = await sendRecoveryForApplicant(applicantEmail, supabaseRedirectTo);
      if (!emailSent) {
        return json(
          { error: 'Could not send invite email for existing user. Check SUPABASE_ANON_KEY and redirect URLs.' },
          500,
        );
      }

      await supabase.from('profiles').upsert(
        {
          id: applicantId,
          email: applicantEmail,
          full_name: applicantName || applicantEmail.split('@')[0],
          user_type: 'tenant',
          account_status: existingProfile?.account_status === 'invited'
            ? 'invited'
            : (existingProfile?.account_status || 'active'),
          has_set_password: existingProfile?.has_set_password ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    }

    if (!emailSent) {
      return json({ error: 'Could not send invite email. Please try again in a minute.' }, 500);
    }

    const now = new Date();
    await supabase
      .from('invites')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('tenant_email', applicantEmail)
      .eq('property_id', propertyId)
      .eq('status', 'pending');

    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        token_hash: tokenHash,
        property_id: propertyId,
        landlord_id: authData.user.id,
        tenant_id: applicantId,
        tenant_email: applicantEmail,
        unit_id: unitId || null,
        sub_unit_id: subUnitId || null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (inviteError || !invite) {
      return json({ error: inviteError?.message || 'Failed to create invite' }, 500);
    }

    const { data: applicantRecord, error: applicantRecordError } = await supabase
      .from('applicants')
      .insert({
        landlord_id: authData.user.id,
        property_id: propertyId,
        first_name: firstName || applicantEmail.split('@')[0],
        last_name: lastName || '',
        email: applicantEmail,
        phone: phone || null,
        unit_id: unitId || null,
        sub_unit_id: subUnitId || null,
        status: 'invited',
        invite_id: invite.id,
        invited_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (applicantRecordError) {
      console.error('Error creating applicant record:', applicantRecordError);
    } else {
      console.log('✅ Applicant record created:', applicantRecord?.id);
    }

    let notificationCreated = false;
    if (applicantId) {
      try {
        const propertyAddress = [
          property.address1,
          property.address2,
          property.city,
          property.state,
          property.zip_code,
        ]
          .filter(Boolean)
          .join(', ');

        const { data: notification, error: notifError } = await supabase.from('notifications').insert({
          user_id: applicantId,
          type: 'invite',
          title: 'You have been invited to apply for a property',
          message: 'Open the invite to review the property details and start your application.',
          data: {
            token,
            inviteId: invite.id,
            propertyId,
            propertyAddress,
            unitId: unitId || null,
            subUnitId: subUnitId || null,
            landlordId: authData.user.id,
          },
          created_at: now.toISOString(),
        }).select();

        if (notifError) {
          console.error('Notification insert error:', notifError);
        } else {
          console.log('Notification created successfully:', notification);
          notificationCreated = true;
        }
      } catch (err) {
        console.error('Failed to create notification:', err);
      }
    }

    const response: InviteApplicantResponse = {
      inviteId: invite.id,
      token,
      inviteStatus: 'pending',
      applicantId: applicantId || null,
      notificationQueued: notificationCreated,
      emailQueued: !notificationCreated,
      inviteFlow,
      authEmailKind,
      redirectTo: supabaseRedirectTo,
    };

    return json(response, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
