/**
 * Supabase Edge Function: Accept Invite
 *
 * POST /functions/v1/accept-invite?token=...
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface InviteActionResponse {
  inviteStatus?: string;
  propertyId?: string;
  tenantId?: string;
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

    // invites.tenant_id holds the auth-user id — this identity check is correct.
    if (invite.tenant_id && invite.tenant_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: 'Invite does not match tenant' }), { status: 403 });
    }
    // Keyed on auth id for the invites row + response contract (unchanged).
    const authTenantId = invite.tenant_id || authData.user.id;

    // tenant_property_links.tenant_id references tenants.id (NOT the auth-user id).
    // Resolve the tenants row by email; create one if it doesn't exist yet.
    let linkTenantId: string;
    const { data: tenantRows } = await supabase
      .from('tenants')
      .select('id')
      .ilike('email', inviteEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (tenantRows?.[0]?.id) {
      linkTenantId = tenantRows[0].id;
    } else {
      const { data: newTenant, error: newTenantError } = await supabase
        .from('tenants')
        .insert({
          user_id: authData.user.id,
          email: inviteEmail,
          first_name: inviteEmail.split('@')[0] || '',
          last_name: '',
          phone: '',
          property_id: invite.property_id,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (newTenantError || !newTenant) {
        return new Response(JSON.stringify({ error: newTenantError?.message || 'Failed to create tenant record' }), { status: 500 });
      }
      linkTenantId = newTenant.id;
    }

    await supabase
      .from('tenant_property_links')
      .upsert(
        {
          tenant_id: linkTenantId,
          property_id: invite.property_id,
          unit_id: invite.unit_id,
          sub_unit_id: invite.sub_unit_id,
          status: 'active',
          created_via: 'landlord_invite',
          created_by_user_id: invite.landlord_id,
          link_start_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,property_id,unit_id,sub_unit_id' }
      );

    const { data: updatedInvite, error: updateError } = await supabase
      .from('invites')
      .update({
        status: 'accepted',
        tenant_id: authTenantId,
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invite.id)
      .select()
      .single();

    if (updateError || !updatedInvite) {
      return new Response(JSON.stringify({ error: 'Failed to accept invite' }), { status: 500 });
    }

    const response: InviteActionResponse = {
      inviteStatus: updatedInvite.status,
      propertyId: invite.property_id,
      tenantId: authTenantId,
    };

    return new Response(JSON.stringify(response), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
