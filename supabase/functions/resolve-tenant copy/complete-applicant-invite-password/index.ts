/**
 * Complete applicant invite: set password using service role after validating invite token.
 * Enables repeat opens until password is set (Supabase magic links are one-time).
 *
 * POST JSON:
 * { "token": string, "email": string, "password": string }
 * OR (session from magic link, token optional):
 * { "password": string } with Authorization: Bearer <user_jwt>
 *
 * When token+email: validates invites row + email; rejects if profiles.has_set_password.
 * When JWT only: updates password for current user if has_set_password is false and pending invite exists OR account_status invited.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(`${token}${tokenPepper}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!tokenPepper) {
    return json({ error: 'INVITE_TOKEN_PEPPER not set' }, 500);
  }

  try {
    const body = (await req.json()) as {
      token?: string;
      email?: string;
      password?: string;
    };

    const password = body.password?.trim() || '';
    const token = body.token?.trim();
    const emailParam = body.email ? normalizeEmail(body.email) : '';

    if (!password || password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    let userId: string | null = null;
    let inviteId: string | null = null;

    if (token && emailParam) {
      const tokenHash = await hashToken(token);
      const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (inviteError || !invite) {
        return json({ error: 'Invite not found' }, 404);
      }

      if (normalizeEmail(invite.tenant_email) !== emailParam) {
        return json({ error: 'Invite email mismatch' }, 403);
      }

      const now = new Date();
      if (invite.status !== 'pending') {
        return json({ error: 'This link is expired or already used' }, 410);
      }
      if (new Date(invite.expires_at) <= now) {
        await supabase
          .from('invites')
          .update({ status: 'expired', updated_at: now.toISOString() })
          .eq('id', invite.id);
        return json({ error: 'This link is expired or already used' }, 410);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, has_set_password, email')
        .eq('email', emailParam)
        .maybeSingle();

      if (profile?.has_set_password === true) {
        return json({ error: 'This link is expired or already used' }, 410);
      }

      userId = invite.tenant_id || profile?.id || null;
      if (!userId) {
        userId = await findAuthUserIdByEmail(emailParam);
      }
      if (!userId) {
        return json({ error: 'User account not found for this invite' }, 404);
      }

      inviteId = invite.id;
    } else if (jwt) {
      const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
      if (authError || !authData?.user?.id || !authData.user.email) {
        return json({ error: 'Unauthorized' }, 401);
      }

      userId = authData.user.id;
      const email = normalizeEmail(authData.user.email);

      const { data: profile } = await supabase
        .from('profiles')
        .select('has_set_password, account_status')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.has_set_password === true) {
        return json({ error: 'This link is expired or already used' }, 410);
      }

      const { data: pendingInvite } = await supabase
        .from('invites')
        .select('id, status, expires_at')
        .eq('tenant_email', email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pendingInvite || new Date(pendingInvite.expires_at) <= new Date()) {
        return json(
          { error: 'No active invitation found. Ask your landlord for a new invite.' },
          400
        );
      }
      inviteId = pendingInvite.id;
    } else {
      return json({ error: 'token and email, or an authenticated session, are required' }, 400);
    }

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateAuthError) {
      console.error('admin.updateUserById failed:', updateAuthError);
      return json({ error: updateAuthError.message || 'Failed to set password' }, 500);
    }

    const nowIso = new Date().toISOString();

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ has_set_password: true, account_status: 'active', updated_at: nowIso })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('profiles update failed:', profileUpdateError);
      return json({ error: 'Failed to update profile' }, 500);
    }

    if (inviteId) {
      await supabase
        .from('invites')
        .update({ status: 'accepted', updated_at: nowIso })
        .eq('id', inviteId);

      await supabase
        .from('applicants')
        .update({ status: 'pending', updated_at: nowIso })
        .eq('invite_id', inviteId)
        .eq('status', 'invited');
    }

    return json({ ok: true, userId }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  return null;
}
