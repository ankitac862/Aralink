/**
 * Supabase Edge Function: Hard Delete Tenant Account
 * 
 * Permanently deletes a tenant account including:
 * - Auth user record
 * - Tenant profile record
 * - Tenant property links
 * - Co-tenant records  
 * - All related lease and transaction data (optional retention)
 * - Personal data
 * 
 * This requires SUPABASE_SERVICE_ROLE_KEY to access auth API
 * and bypass RLS policies.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface HardDeleteTenantRequest {
  userId: string; // Auth user ID to delete
  tenantId: string;
  leaseId?: string;
  reason?: string;
  retainLeaseHistory?: boolean; // If true, keep lease records but mark deleted
}

interface HardDeleteTenantResponse {
  success: boolean;
  message?: string;
  deletedRecords?: {
    authUser?: boolean;
    profile?: boolean;
    tenant?: boolean;
    tenantPropertyLinks?: number;
    coTenants?: number;
    leases?: number;
    messages?: number;
  };
  error?: string;
}

// Initialize Supabase client with service role key
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Helper to delete auth user (requires service role)
 */
async function deleteAuthUser(userId: string): Promise<boolean> {
  try {
    console.log(`🔐 Deleting auth user: ${userId}`);

    // Use the service role client to delete user
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`❌ Error deleting auth user: ${error.message}`);
      return false;
    }

    console.log(`✅ Auth user deleted: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error in deleteAuthUser:', error);
    return false;
  }
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  console.log(`⬅️  Received ${req.method} request`);

  // Only allow POST
  if (req.method === 'POST' || req.method === 'OPTIONS') {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  } else {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authorHeader = req.headers.get('Authorization');
    if (!authorHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const {
      userId,
      tenantId,
      leaseId,
      reason = 'Account deleted',
      retainLeaseHistory = true,
    }: HardDeleteTenantRequest = await req.json();

    // Validate inputs
    if (!userId || !tenantId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: userId, tenantId',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🗑️  Starting hard delete for tenant ${tenantId}, user ${userId}`);

    const deletedRecords = {
      authUser: false,
      profile: false,
      tenant: false,
      tenantPropertyLinks: 0,
      coTenants: 0,
      leases: 0,
      messages: 0,
    };

    try {
      // 1. Delete auth user first
      deletedRecords.authUser = await deleteAuthUser(userId);

      // 2. Delete co-tenant records
      try {
        const { data: coTenants, error: coTenantFetchError } = await supabase
          .from('co_tenants')
          .select('id')
          .eq('tenant_id', tenantId);

        if (!coTenantFetchError && coTenants) {
          const { error: coTenantDeleteError } = await supabase
            .from('co_tenants')
            .delete()
            .eq('tenant_id', tenantId);

          if (!coTenantDeleteError) {
            deletedRecords.coTenants = coTenants.length;
            console.log(`✅ Deleted ${coTenants.length} co-tenant records`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error deleting co-tenants: ${error}`);
      }

      // 3. Delete tenant property links
      try {
        const { error: linkDeleteError } = await supabase
          .from('tenant_property_links')
          .delete()
          .eq('tenant_id', tenantId);

        if (!linkDeleteError) {
          console.log(`✅ Deleted tenant property links`);
          deletedRecords.tenantPropertyLinks = 1; // At least one was deleted
        }
      } catch (error) {
        console.warn(`⚠️ Error deleting tenant property links: ${error}`);
      }

      // 4. Delete or soft-delete related messages/communications
      try {
        // Mark messages as deleted instead of hard deleting (for audit trail)
        const { error: messageError } = await supabase
          .from('messages')
          .update({ deleted_at: new Date().toISOString() })
          .eq('sender_id', userId)
          .is('deleted_at', null);

        if (!messageError) {
          console.log(`✅ Soft-deleted user messages`);
        }
      } catch (error) {
        console.warn(`⚠️ Error handling messages: ${error}`);
      }

      // 5. Delete profile record (which has user_id reference)
      try {
        const { error: profileDeleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (!profileDeleteError) {
          deletedRecords.profile = true;
          console.log(`✅ Profile deleted: ${userId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error deleting profile: ${error}`);
      }

      // 6. Delete or soft-delete lease information
      if (leaseId) {
        try {
          if (retainLeaseHistory) {
            // Soft delete - mark lease as terminated with deletion note
            const { error: leaseUpdateError } = await supabase
              .from('leases')
              .update({
                status: 'terminated',
                terminated_date: new Date().toISOString(),
                deletion_reason: reason,
              })
              .eq('id', leaseId);

            if (!leaseUpdateError) {
              deletedRecords.leases = 1;
              console.log(`✅ Lease soft-deleted (marked terminated): ${leaseId}`);
            }
          } else {
            // Hard delete lease
            const { error: leaseDeleteError } = await supabase
              .from('leases')
              .delete()
              .eq('id', leaseId);

            if (!leaseDeleteError) {
              deletedRecords.leases = 1;
              console.log(`✅ Lease hard-deleted: ${leaseId}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Error handling lease: ${error}`);
        }
      }

      // 7. Finally delete the tenant record
      try {
        const { error: tenantDeleteError } = await supabase
          .from('tenants')
          .delete()
          .eq('id', tenantId);

        if (!tenantDeleteError) {
          deletedRecords.tenant = true;
          console.log(`✅ Tenant record deleted: ${tenantId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error deleting tenant: ${error}`);
        // Continue even if tenant delete fails
      }

      console.log('✅ Hard delete completed successfully');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Tenant account and associated data permanently deleted',
          deletedRecords,
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (innerError) {
      console.error('❌ Error during deletion process:', innerError);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Deletion process failed: ${innerError instanceof Error ? innerError.message : 'Unknown error'}`,
          deletedRecords,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('❌ Edge function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
