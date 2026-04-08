/**
 * Supabase Edge Function: Decline Invite
 *
 * POST /functions/v1/decline-invite?token=...
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface InviteActionResponse {
  inviteStatus?: string;
  propertyId?: string;
  error?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const tokenPepper = Deno.env.get('INVITE_TOKEN_PEPPER') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(`${token}${tokenPepper}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData?.user?.id || !authData.user.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), { status: 400 });
    }

    const tokenHash = await hashToken(token);
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: 'Invite not found' }), { status: 404 });
    }

    if (invite.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Invite ${invite.status}` }), { status: 409 });
    }

    if (new Date(invite.expires_at) <= new Date()) {
      await supabase
        .from('invites')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', invite.id);
      return new Response(JSON.stringify({ error: 'Invite expired' }), { status: 410 });
    }

    const authEmail = normalizeEmail(authData.user.email);
    const inviteEmail = normalizeEmail(invite.tenant_email);
    if (authEmail !== inviteEmail) {
      return new Response(JSON.stringify({ error: 'Invite email mismatch' }), { status: 403 });
    }

    const { data: updatedInvite, error: updateError } = await supabase
      .from('invites')
      .update({
        status: 'declined',
        tenant_id: invite.tenant_id || authData.user.id,
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invite.id)
      .select()
      .single();

    if (updateError || !updatedInvite) {
      return new Response(JSON.stringify({ error: 'Failed to decline invite' }), { status: 500 });
    }

    const response: InviteActionResponse = {
      inviteStatus: updatedInvite.status,
      propertyId: invite.property_id,
    };

    return new Response(JSON.stringify(response), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
