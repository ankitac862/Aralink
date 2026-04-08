/**
 * Supabase Edge Function: Get Invite Details
 *
 * GET /functions/v1/get-invite?token=...
 * Optional: tenant_email=... (if no Authorization header)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface InviteDetailsResponse {
  inviteStatus?: string;
  expiresAt?: string;
  /** True when the user has already completed password setup (invite link should not be reused). */
  hasSetPassword?: boolean;
  property?: {
    id: string;
    address1: string;
    address2?: string | null;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  landlord?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
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
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    const tenantEmailParam = url.searchParams.get('tenant_email');

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

    const now = new Date();
    if (invite.status === 'pending' && new Date(invite.expires_at) <= now) {
      await supabase
        .from('invites')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', invite.id);
      return new Response(JSON.stringify({ error: 'Invite expired' }), { status: 410 });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    let authEmail: string | null = null;
    let authUserId: string | null = null;

    if (jwt) {
      const { data: authData } = await supabase.auth.getUser(jwt);
      authEmail = authData?.user?.email?.toLowerCase() || null;
      authUserId = authData?.user?.id || null;
    }

    if (invite.tenant_id && authUserId && invite.tenant_id !== authUserId) {
      return new Response(JSON.stringify({ error: 'Invite does not match tenant' }), { status: 403 });
    }

    const expectedEmail = normalizeEmail(invite.tenant_email);
    const providedEmail = authEmail || (tenantEmailParam ? normalizeEmail(tenantEmailParam) : null);
    if (!providedEmail) {
      return new Response(JSON.stringify({ error: 'tenant_email is required to validate invite' }), {
        status: 400,
      });
    }
    if (expectedEmail !== providedEmail) {
      return new Response(JSON.stringify({ error: 'Invite email mismatch' }), { status: 403 });
    }

    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, address1, address2, city, state, zip_code, country, user_id')
      .eq('id', invite.property_id)
      .single();

    if (propertyError || !property) {
      return new Response(JSON.stringify({ error: 'Property not found' }), { status: 404 });
    }

    if (property.user_id !== invite.landlord_id) {
      return new Response(JSON.stringify({ error: 'Invite property mismatch' }), { status: 409 });
    }

    const { data: landlord } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', invite.landlord_id)
      .single();

    const { data: tenantProfile } = await supabase
      .from('profiles')
      .select('has_set_password')
      .eq('email', expectedEmail)
      .maybeSingle();

    const response: InviteDetailsResponse = {
      inviteStatus: invite.status,
      expiresAt: invite.expires_at,
      hasSetPassword: tenantProfile?.has_set_password === true,
      property: {
        id: property.id,
        address1: property.address1,
        address2: property.address2,
        city: property.city,
        state: property.state,
        zipCode: property.zip_code,
        country: property.country,
      },
      landlord: landlord
        ? {
            id: landlord.id,
            name: landlord.full_name,
            email: landlord.email,
          }
        : undefined,
    };

    return new Response(JSON.stringify(response), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
