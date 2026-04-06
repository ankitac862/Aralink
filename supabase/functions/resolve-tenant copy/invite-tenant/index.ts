/**
 * Supabase Edge Function: Invite Tenant to Property
 *
 * POST body:
 * {
 *   "propertyId": "uuid",
 *   "tenantEmail": "tenant@example.com",
 *   "tenantName": "Optional Name"
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

function resolveInviteAuthRedirectUrl(redirectBaseUrl?: string | null): string {
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
    const raw = (Deno.env.get('APP_URL') || Deno.env.get('EXPO_PUBLIC_APP_URL') || 'aralink://invite-auth').trim();
    if (raw.startsWith('aralink://')) {
      return raw.includes('invite-auth') ? raw : 'aralink://invite-auth';
    }
    try {
      const u = new URL(raw);
      if (raw.includes('invite-auth')) return raw.split('#')[0];
      return `${u.origin}/invite-auth`;
    } catch {
      return 'aralink://invite-auth';
    }
  };
  const fromClient = redirectBaseUrl?.trim();
  if (fromClient) {
    try {
      const u = new URL(fromClient.includes('://') ? fromClient : `http://${fromClient}`);
      const origin = u.origin;
      if (isAllowedRedirectOrigin(origin)) {
        return `${origin}/invite-auth`;
      }
    } catch {
      // fall through
    }
  }
  return envFallbackInviteAuthUrl();
}

interface InviteTenantRequest {
  propertyId: string;
  tenantEmail: string;
  tenantName?: string;
  unitId?: string;
  subUnitId?: string;
  expiresInHours?: number;
  autoActivate?: boolean; // Set to true to immediately activate the tenant (for approved applicants)
  rentAmount?: number; // Monthly rent amount
  /** Browser origin (e.g. http://localhost:8081) so invite email matches Metro port */
  redirectBaseUrl?: string;
}

interface InviteTenantResponse {
  inviteId?: string;
  token?: string;
  inviteStatus?: string;
  tenantId?: string | null;
  notificationQueued?: boolean;
  emailQueued?: boolean;
  /** No Auth user → Applicant path (invite). Auth exists → Tenant path (recovery + property link). */
  inviteFlow?: 'applicant' | 'tenant';
  error?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const tokenPepper = Deno.env.get('INVITE_TOKEN_PEPPER') || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

const inviteDeepLink = (token: string) => `aralink://invite?token=${encodeURIComponent(token)}`;

const findAuthUserIdByEmail = async (email: string): Promise<string | null> => {
  // Supabase admin API does not support direct email lookup; scan a few pages.
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

async function sendRecoveryEmailWithRedirect(params: {
  email: string;
  redirectTo: string;
}): Promise<{ ok: boolean; error?: string }> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!anonKey) {
    return { ok: false, error: 'SUPABASE_ANON_KEY is not set' };
  }
  const base = supabaseUrl.replace(/\/+$/, '');
  const recoverUrl = `${base}/auth/v1/recover`;
  const redirectTo = (() => {
    try {
      const u = new URL(params.redirectTo);
      return `${u.origin}/invite-auth`;
    } catch {
      return 'http://localhost:8081/invite-auth';
    }
  })();

  const res = await fetch(recoverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email: params.email, redirect_to: redirectTo }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: text };
  return { ok: true };
}

async function sendRecoveryForApplicant(email: string, redirectTo: string): Promise<boolean> {
  const recover = await sendRecoveryEmailWithRedirect({ email, redirectTo });
  if (recover.ok) return true;
  console.error('recover error:', recover.error);
  // Do not fallback to resetPasswordForEmail here: it may emit root redirect_to links.
  return false;
}

/** GoTrue rejects many `redirect_to` values → falls back to Site URL only. Prefer path-only `…/invite-auth`. */
function redirectToForGoTrue(invitePageBase: string, token: string, email: string): string {
  const raw = invitePageBase.trim().split('#')[0].split('?')[0];
  if (raw.startsWith('aralink://')) {
    const sep = raw.includes('?') ? '&' : '?';
    return `${raw}${sep}token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  }
  const appendQuery = Deno.env.get('INVITE_REDIRECT_APPEND_QUERY') === 'true';
  try {
    const u = new URL(raw.includes('://') ? raw : `http://${raw}`);
    const pathOnly = `${u.origin}/invite-auth`;
    if (appendQuery) {
      return `${pathOnly}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    }
    return pathOnly;
  } catch {
    return 'http://localhost:8081/invite-auth';
  }
}

serve(async (req) => {
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

    const body = (await req.json()) as InviteTenantRequest;
    const appUrl = resolveInviteAuthRedirectUrl(body.redirectBaseUrl);

    const propertyId = body.propertyId;
    const tenantEmail = normalizeEmail(body.tenantEmail || '');
    const tenantName = body.tenantName?.trim() || '';
    const unitId = body.unitId || null;
    const subUnitId = body.subUnitId || null;
    const autoActivate = body.autoActivate || false;
    const rentAmount = body.rentAmount || null;
    const expiresInHours =
      body.expiresInHours && body.expiresInHours > 0 ? body.expiresInHours : 168; // 7 days

    if (!propertyId || !tenantEmail || !tenantEmail.includes('@')) {
      return json({ error: 'propertyId and valid tenantEmail are required' }, 400);
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, user_id')
      .eq('id', propertyId)
      .single();

    if (propertyError || !property) {
      return json({ error: 'Property not found' }, 404);
    }

    if (property.user_id !== authData.user.id) {
      return json({ error: 'Forbidden' }, 403);
    }

    // Ensure landlord has a profile (required for foreign key)
    await supabase.from('profiles').upsert(
      {
        id: authData.user.id,
        email: authData.user.email,
        full_name: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0],
        user_type: 'landlord',
        account_status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, user_type, account_status')
      .eq('email', tenantEmail)
      .maybeSingle();

    if (profileError) {
      return json({ error: profileError.message }, 500);
    }

    /** Step 1: Supabase Auth decides Applicant vs Tenant (not only profiles). */
    const authUserId = await findAuthUserIdByEmail(tenantEmail);

    let tenantId: string | null = existingProfile?.id ?? authUserId;
    const token = generateToken();
    const tokenHash = await hashToken(token);
    let emailSent = false;
    let inviteFlow: 'applicant' | 'tenant';
    const redirectToAuth = redirectToForGoTrue(appUrl, token, tenantEmail);
    console.log('[invite-tenant] redirect_to for GoTrue:', redirectToAuth);

    if (authUserId === null) {
      // APPLICANT: no Auth user → inviteUserByEmail (dashboard template {{ .ConfirmationURL }})
      inviteFlow = 'applicant';
      const { data: invitedUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        tenantEmail,
        {
          redirectTo: redirectToAuth,
          data: {
            full_name: tenantName || tenantEmail.split('@')[0],
            user_type: 'tenant',
          },
        }
      );

      if (inviteError || !invitedUser?.user) {
        const errorMsg = inviteError?.message || String(inviteError || '');
        const alreadyRegistered = errorMsg.toLowerCase().includes('already');

        if (!alreadyRegistered) {
          console.error('Unexpected invite error:', inviteError);
          return json({ error: errorMsg || 'Invite failed' }, 500);
        }

        tenantId = await findAuthUserIdByEmail(tenantEmail);
        if (!tenantId) {
          return json({ error: 'User could not be created or found. Try again.' }, 500);
        }
        emailSent = await sendRecoveryForApplicant(tenantEmail, redirectToAuth);
        inviteFlow = 'tenant';
      } else {
        tenantId = invitedUser.user.id;
        emailSent = true;
      }

      const { error: upsertError } = await supabase.from('profiles').upsert(
        {
          id: tenantId!,
          email: tenantEmail,
          full_name: tenantName || tenantEmail.split('@')[0],
          user_type: 'tenant',
          account_status: 'invited',
          has_set_password: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (upsertError) return json({ error: upsertError.message }, 500);

      const { error: applicantError } = await supabase.from('applicants').insert({
        landlord_id: authData.user.id,
        property_id: propertyId,
        first_name: tenantName || tenantEmail.split('@')[0],
        last_name: '',
        email: tenantEmail,
        unit_id: unitId,
        sub_unit_id: subUnitId,
        status: 'invited',
        invited_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (applicantError) console.error('Error creating applicant:', applicantError);
    } else {
      // TENANT: Auth user exists → do not call inviteUserByEmail; link property + recovery email
      inviteFlow = 'tenant';
      tenantId = authUserId;

      emailSent = await sendRecoveryForApplicant(tenantEmail, redirectToAuth);
      if (!emailSent) {
        return json(
          { error: 'Could not send email for existing user. Check SUPABASE_ANON_KEY and redirect URLs.' },
          500,
        );
      }

      const { error: profileUpsertError } = await supabase.from('profiles').upsert(
        {
          id: tenantId,
          email: tenantEmail,
          full_name: tenantName || tenantEmail.split('@')[0],
          user_type: 'tenant',
          account_status: existingProfile?.account_status || 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (profileUpsertError) {
        console.error('Profile upsert error:', profileUpsertError);
        return json({ error: profileUpsertError.message }, 500);
      }

      const linkStatus = autoActivate ? 'active' : 'pending_invite';
      const { error: linkError } = await supabase
        .from('tenant_property_links')
        .upsert(
          {
            tenant_id: tenantId,
            property_id: propertyId,
            unit_id: unitId,
            sub_unit_id: subUnitId,
            status: linkStatus,
            rent_amount: rentAmount,
            created_via: 'landlord_invite',
            created_by_user_id: authData.user.id,
            link_start_date: autoActivate ? new Date().toISOString().split('T')[0] : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,property_id,unit_id,sub_unit_id' }
        );

      if (linkError) {
        console.error('Error creating tenant-property link:', linkError);
        return json({ error: linkError.message }, 500);
      }
    }

    // Expire existing pending invites
    const { data: existingInvite, error: existingInviteError } = await supabase
      .from('invites')
      .select('id')
      .eq('tenant_email', tenantEmail)
      .eq('property_id', propertyId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInviteError) {
      return json({ error: existingInviteError.message }, 500);
    }

    const now = new Date();
    if (existingInvite?.id) {
      await supabase
        .from('invites')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', existingInvite.id);
    }

    // Create new invite
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        token_hash: tokenHash,
        property_id: propertyId,
        landlord_id: authData.user.id,
        tenant_id: tenantId,
        tenant_email: tenantEmail,
        unit_id: unitId,
        sub_unit_id: subUnitId,
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

    // Best-effort notification insert (do not fail invite on notification error)
    let notificationCreated = false;
    if (existingProfile || tenantId) {
      try {
        console.log('Creating notification for user:', existingProfile?.id || tenantId);

        // Different notification based on whether tenant is auto-activated
        const notificationTitle = autoActivate
          ? 'You have been assigned to a property'
          : 'You have been invited to a property';
        const notificationMessage = autoActivate
          ? 'You can now view your property details and submit maintenance requests.'
          : 'Open the invite to review the property details.';

        const { data: notification, error: notifError } = await supabase.from('notifications').insert({
          user_id: existingProfile?.id || tenantId,
          type: autoActivate ? 'property_assigned' : 'invite',
          title: notificationTitle,
          message: notificationMessage,
          data: { token, inviteId: invite.id, propertyId, unitId, subUnitId, landlordId: authData.user.id },
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
        // Ignore notification failures
      }
    }

    const response: InviteTenantResponse = {
      inviteId: invite.id,
      token,
      inviteStatus: 'pending',
      tenantId: tenantId || null,
      notificationQueued: notificationCreated,
      emailQueued: emailSent,
      inviteFlow,
    };

    return json(response, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
