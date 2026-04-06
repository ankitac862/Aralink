/**
 * Supabase Edge Function: Resolve Tenant by Email
 *
 * - If tenant exists (by email), return tenant id
 * - If tenant does not exist, invite user and mark profile as invited
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/** Inlined — keep in sync with invite-applicant / invite-tenant. */
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
          return `${u.origin}/invite-auth`;
        } catch {
          continue;
        }
      }
    }
    return 'http://localhost:8081/invite-auth';
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

function normalizeSupabaseRedirectTo(base: string): string {
  const withoutQuery = base.trim().split('?')[0].replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(withoutQuery)) {
    return 'http://localhost:8081/invite-auth';
  }
  try {
    const u = new URL(withoutQuery);
    return `${u.origin}/invite-auth`;
  } catch {
    return 'http://localhost:8081/invite-auth';
  }
}

interface ResolveTenantRequest {
  email: string;
  fullName?: string;
  /** Browser origin (e.g. http://localhost:8081) so invite email matches Metro port */
  redirectBaseUrl?: string;
}

interface ResolveTenantResponse {
  tenantId?: string;
  existed: boolean;
  invited: boolean;
  accountStatus?: string;
  userType?: string;
  error?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const nameFromEmail = (email: string) => {
  const [localPart] = email.split('@');
  return localPart || 'Tenant';
};

const findAuthUserIdByEmail = async (email: string): Promise<string | null> => {
  const perPage = 200;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  return null;
};

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

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as ResolveTenantRequest;
    const inviteAuthBase = resolveInviteAuthRedirectUrl(body.redirectBaseUrl);
    const supabaseRedirectTo = normalizeSupabaseRedirectTo(inviteAuthBase);
    console.log('[resolve-tenant] redirectTo (path only):', supabaseRedirectTo);

    const email = normalizeEmail(body.email || '');
    if (!email || !email.includes('@')) {
      return json({ error: 'Valid email is required' }, 400);
    }

    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_type, account_status')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      return json({ error: profileError.message }, 500);
    }

    if (existingProfile?.id) {
      const response: ResolveTenantResponse = {
        tenantId: existingProfile.id,
        existed: true,
        invited: false,
        accountStatus: existingProfile.account_status,
        userType: existingProfile.user_type,
      };
      return json(response, 200);
    }

    const authUserId = await findAuthUserIdByEmail(email);
    const fullName = body.fullName?.trim() || nameFromEmail(email);

    if (authUserId) {
      const now = new Date().toISOString();
      await supabase.from('profiles').upsert(
        {
          id: authUserId,
          email,
          full_name: fullName,
          user_type: 'tenant',
          account_status: 'active',
          updated_at: now,
        },
        { onConflict: 'id' }
      );
      const response: ResolveTenantResponse = {
        tenantId: authUserId,
        existed: true,
        invited: false,
        accountStatus: 'active',
        userType: 'tenant',
      };
      return json(response, 200);
    }

    const { data: invitedUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: supabaseRedirectTo,
        data: {
          full_name: fullName,
          user_type: 'tenant',
        },
      }
    );

    if (inviteError || !invitedUser?.user) {
      return json({ error: inviteError?.message || 'Invite failed' }, 500);
    }

    const tenantId = invitedUser.user.id;
    const now = new Date().toISOString();

    await supabase.from('profiles').upsert(
      {
        id: tenantId,
        email,
        full_name: fullName,
        user_type: 'tenant',
        account_status: 'invited',
        updated_at: now,
      },
      { onConflict: 'id' }
    );

    const response: ResolveTenantResponse = {
      tenantId,
      existed: false,
      invited: true,
      accountStatus: 'invited',
      userType: 'tenant',
    };
    return json(response, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});
