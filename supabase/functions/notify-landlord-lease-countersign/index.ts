/**
 * Supabase Edge Function: Notify Landlord (Lease Countersign Pending)
 *
 * Purpose:
 * - Called after a tenant/user signs/upload completes.
 * - Resolves the real landlord from `properties.user_id` (not the lease creator/manager).
 * - Inserts a notification for the landlord so their dashboard/lease-detail shows the pending countersign UI.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface NotifyRequest {
  leaseId: string;
  tenantNames?: string[];
}

interface NotifyResponse {
  success: boolean;
  error?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Identify caller (tenant) so we can avoid arbitrary notification spam.
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    const callerUserId = authData?.user?.id;

    if (authErr || !callerUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as NotifyRequest;
    const { leaseId, tenantNames = [] } = body;

    if (!leaseId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing leaseId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1) Load lease: property_id + tenant_id + status
    const { data: lease, error: leaseErr } = await supabase
      .from('leases')
      .select('id, property_id, tenant_id, status')
      .eq('id', leaseId)
      .maybeSingle();

    if (leaseErr || !lease) {
      return new Response(
        JSON.stringify({ success: false, error: leaseErr?.message || 'Lease not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2) Verify caller is the tenant who signed (tenant_id should be set by conversion flow).
    // If tenant_id isn't set yet, we still avoid spamming by checking status.
    if (lease.status !== 'signed') {
      return new Response(
        JSON.stringify({ success: false, error: 'Lease is not in signed state' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (lease.tenant_id && lease.tenant_id !== callerUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Caller is not the signing tenant' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3) Resolve real landlord from properties.user_id (this is what we want to notify)
    const { data: property, error: propErr } = await supabase
      .from('properties')
      .select('id, user_id')
      .eq('id', lease.property_id)
      .maybeSingle();

    const landlordUserId = property?.user_id;
    if (propErr || !landlordUserId) {
      return new Response(
        JSON.stringify({ success: false, error: propErr?.message || 'Landlord not found for property' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantLabel = tenantNames.filter(Boolean).join(', ') || 'Tenant';

    // 4) Insert notification for landlord only
    const { error: insertErr } = await supabase
      .from('notifications')
      .insert({
        user_id: landlordUserId,
        type: 'lease',
        title: 'Pending Landlord Signature',
        message: `${tenantLabel} has signed. Please review and countersign the lease.`,
        data: {
          leaseId,
          action: 'view_lease',
        },
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (insertErr) {
      return new Response(
        JSON.stringify({ success: false, error: insertErr.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Push notification to landlord
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          userId: landlordUserId,
          title: 'Pending Landlord Signature',
          body: `${tenantLabel} has signed. Please review and countersign the lease.`,
          data: { type: 'lease', leaseId },
        }),
      });
      console.log('✅ Push notification sent to landlord');
    } catch (pushErr) {
      console.error('⚠️ Push notification failed (non-fatal):', pushErr);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

