import { supabase } from '@/lib/supabase';
import { triggerPushNotification } from '@/lib/sendPushNotification';
import {
  MaintenanceCreatorRole,
  getInitialStatus,
  getCreationActivityMessage,
  TENANT_PERMISSION_ERROR,
} from '@/lib/maintenancePermissions';

// =====================================================
// Types
// =====================================================

export type { MaintenanceCreatorRole };

export interface MaintenanceAttachment {
  uri: string;
  type: string;
  size?: number;
}

export interface MaintenanceActivity {
  id: string;
  timestamp: string;
  message: string;
  actor: 'tenant' | 'landlord' | 'manager' | 'system';
}

export interface MaintenanceRequestInput {
  tenantId: string;
  propertyId: string;
  landlordId: string;
  unitId?: string;
  subUnitId?: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'general';
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  availability: string;
  permissionToEnter: boolean;
  attachments?: MaintenanceAttachment[];
  createdByRole?: MaintenanceCreatorRole;
  createdById?: string;
}

export interface DbMaintenanceRequest {
  id: string;
  tenant_id: string;
  landlord_id: string;
  property_id: string;
  unit_id?: string;
  sub_unit_id?: string;
  category: string;
  title: string;
  description: string;
  urgency: string;
  availability: string;
  permission_to_enter: boolean;
  attachments: MaintenanceAttachment[];
  status: string;
  created_by_role: string;
  created_by_id: string;
  approved_by?: string;
  approved_at?: string;
  assigned_vendor?: string;
  resolution_notes?: string;
  tenant_feedback?: string;
  tenant_feedback_rating?: number;
  expense_id?: string;
  activity: MaintenanceActivity[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

// =====================================================
// Create
// =====================================================

export async function createMaintenanceRequest(
  input: MaintenanceRequestInput
): Promise<{ data: DbMaintenanceRequest | null; error: string | null }> {
  try {
    const createdByRole: MaintenanceCreatorRole = input.createdByRole || 'tenant';
    const createdById = input.createdById || input.tenantId;
    const initialStatus = getInitialStatus(createdByRole);

    const initialActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: getCreationActivityMessage(createdByRole),
      actor: createdByRole === 'tenant' ? 'tenant' : createdByRole,
    };

    const requestData = {
      tenant_id: input.tenantId,
      landlord_id: input.landlordId,
      property_id: input.propertyId,
      unit_id: input.unitId || null,
      sub_unit_id: input.subUnitId || null,
      category: input.category,
      title: input.title,
      description: input.description,
      urgency: input.urgency,
      availability: input.availability,
      permission_to_enter: input.permissionToEnter,
      attachments: input.attachments || [],
      status: initialStatus,
      created_by_role: createdByRole,
      created_by_id: createdById,
      activity: [initialActivity],
    };

    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert(requestData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating maintenance request:', error.code, error.message);
      if (error.code === '42P01') {
        return {
          data: null,
          error: 'Database table not found. Please run the maintenance migration in Supabase.',
        };
      }
      return { data: null, error: error.message || 'Failed to create maintenance request' };
    }

    console.log('✅ Maintenance request created:', data.id);

    // Notifications based on who created the request
    await _notifyOnCreate({
      createdByRole,
      landlordId: input.landlordId,
      tenantId: input.tenantId,
      requestId: data.id,
      propertyId: input.propertyId,
      urgency: input.urgency,
      title: input.title,
    });

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to create maintenance request',
    };
  }
}

async function _notifyOnCreate(params: {
  createdByRole: MaintenanceCreatorRole;
  landlordId: string;
  tenantId: string;
  requestId: string;
  propertyId: string;
  urgency: string;
  title: string;
}) {
  const { createdByRole, landlordId, tenantId, requestId, propertyId, urgency, title } = params;
  const notifData = { requestId, propertyId, urgency };

  try {
    if (createdByRole === 'tenant') {
      // Notify landlord
      await supabase.from('notifications').insert({
        user_id: landlordId,
        type: 'maintenance_request',
        title: 'New Maintenance Request',
        message: `New ${urgency} priority request: ${title}`,
        data: notifData,
        created_at: new Date().toISOString(),
      });
      await triggerPushNotification({
        userId: landlordId,
        title: 'New Maintenance Request',
        body: `New ${urgency} priority request: ${title}`,
        data: { type: 'maintenance_request', ...notifData },
      });
    } else {
      // Landlord or manager created — notify tenant
      await supabase.from('notifications').insert({
        user_id: tenantId,
        type: 'maintenance_request',
        title: 'Maintenance Request Logged',
        message: `A ${urgency} priority maintenance request has been logged for your unit: ${title}`,
        data: notifData,
        created_at: new Date().toISOString(),
      });
      await triggerPushNotification({
        userId: tenantId,
        title: 'Maintenance Request Logged',
        body: `${title} — ${urgency} priority`,
        data: { type: 'maintenance_request', ...notifData },
      });
    }
  } catch (notifErr) {
    console.warn('⚠️ Notification failed (non-fatal):', notifErr);
  }
}

// =====================================================
// Fetch
// =====================================================

export async function fetchMaintenanceRequests(
  userId: string,
  userType: 'tenant' | 'landlord' | 'manager'
): Promise<{ data: DbMaintenanceRequest[]; error: string | null }> {
  try {
    let query = supabase.from('maintenance_requests').select('*');

    if (userType === 'tenant') {
      query = query.eq('tenant_id', userId);
    } else {
      // landlord and manager both filter by landlord_id
      query = query.eq('landlord_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching maintenance requests:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : 'Failed to fetch maintenance requests',
    };
  }
}

export async function getMaintenanceRequestById(
  requestId: string
): Promise<{ data: DbMaintenanceRequest | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      console.error('❌ Error fetching maintenance request:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch maintenance request',
    };
  }
}

// =====================================================
// Status update (landlord / manager only)
// =====================================================

export async function updateMaintenanceStatus(
  requestId: string,
  status: string,
  actor: 'tenant' | 'landlord' | 'manager' | 'system' = 'landlord',
  callerRole?: MaintenanceCreatorRole,
  _userId?: string
): Promise<{ success: boolean; error: string | null }> {
  // Hard block at service layer
  if (callerRole === 'tenant') {
    return { success: false, error: TENANT_PERMISSION_ERROR };
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity, tenant_id, landlord_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: 'Request not found' };
    }

    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: `Status updated to ${status.replace(/_/g, ' ')} by ${actor}.`,
      actor,
    };

    const updateData: Record<string, unknown> = {
      status,
      activity: [...(current.activity || []), newActivity],
    };

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('maintenance_requests')
      .update(updateData)
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ Error updating maintenance status:', updateError);
      return { success: false, error: updateError.message };
    }

    // Notify tenant
    try {
      const notifData = { requestId, status };
      await supabase.from('notifications').insert({
        user_id: current.tenant_id,
        type: 'maintenance_status_update',
        title: 'Maintenance Request Updated',
        message: `Your maintenance request status: ${status.replace(/_/g, ' ')}`,
        data: notifData,
        created_at: new Date().toISOString(),
      });
      await triggerPushNotification({
        userId: current.tenant_id,
        title: 'Maintenance Request Updated',
        body: `Status changed to: ${status.replace(/_/g, ' ')}`,
        data: { type: 'maintenance_status_update', ...notifData },
      });
    } catch (notifErr) {
      console.warn('⚠️ Status notification failed (non-fatal):', notifErr);
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update status',
    };
  }
}

// =====================================================
// Vendor assignment (landlord / manager only)
// =====================================================

export async function assignVendor(
  requestId: string,
  vendorName: string,
  callerRole?: MaintenanceCreatorRole
): Promise<{ success: boolean; error: string | null }> {
  if (callerRole === 'tenant') {
    return { success: false, error: TENANT_PERMISSION_ERROR };
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity')
      .eq('id', requestId)
      .single();

    if (fetchError || !current) return { success: false, error: 'Request not found' };

    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: `Vendor assigned: ${vendorName}`,
      actor: callerRole === 'manager' ? 'manager' : 'landlord',
    };

    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        assigned_vendor: vendorName,
        activity: [...(current.activity || []), newActivity],
      })
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to assign vendor',
    };
  }
}

// =====================================================
// Resolution notes (landlord / manager only)
// =====================================================

export async function addResolutionNotes(
  requestId: string,
  notes: string,
  callerRole?: MaintenanceCreatorRole
): Promise<{ success: boolean; error: string | null }> {
  if (callerRole === 'tenant') {
    return { success: false, error: TENANT_PERMISSION_ERROR };
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity')
      .eq('id', requestId)
      .single();

    if (fetchError || !current) return { success: false, error: 'Request not found' };

    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: 'Resolution notes updated.',
      actor: callerRole === 'manager' ? 'manager' : 'landlord',
    };

    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        resolution_notes: notes,
        activity: [...(current.activity || []), newActivity],
      })
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add resolution notes',
    };
  }
}

// =====================================================
// Tenant feedback (tenant only, after resolved)
// =====================================================

export async function submitTenantFeedback(
  requestId: string,
  feedback: string,
  rating: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: current, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !current) return { success: false, error: 'Request not found' };
    if (current.status !== 'resolved') {
      return { success: false, error: 'Feedback can only be submitted for resolved requests.' };
    }

    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: `Tenant submitted feedback (${rating}/5 stars).`,
      actor: 'tenant',
    };

    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        tenant_feedback: feedback,
        tenant_feedback_rating: rating,
        activity: [...(current.activity || []), newActivity],
      })
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit feedback',
    };
  }
}

// =====================================================
// Expense linking
// =====================================================

export async function linkExpenseToRequest(
  requestId: string,
  expenseId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: current, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity')
      .eq('id', requestId)
      .single();

    if (fetchError || !current) return { success: false, error: 'Request not found' };

    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: 'Expense/invoice linked.',
      actor: 'landlord',
    };

    const { error } = await supabase
      .from('maintenance_requests')
      .update({
        expense_id: expenseId,
        activity: [...(current.activity || []), newActivity],
      })
      .eq('id', requestId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to link expense',
    };
  }
}

// =====================================================
// Attachment upload — signed URLs (private bucket)
// =====================================================

/**
 * Upload a maintenance attachment.
 *
 * React Native does not support fetch(uri).blob() for local file URIs in a
 * way that Supabase storage can serialize over the network. Instead we read
 * the file as a Base64 string via expo-file-system, decode it into a
 * Uint8Array, and upload the raw bytes — which works reliably on both iOS
 * and Android.
 */
export async function uploadMaintenanceAttachment(
  file: { uri: string; type: string; name: string },
  requestId: string
): Promise<{ url: string | null; signedUrl: string | null; path: string | null; error: string | null }> {
  try {
    // Import the legacy namespace which exposes readAsStringAsync + EncodingType
    const FileSystem = await import('expo-file-system/legacy');

    // Read local file as Base64
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Decode Base64 → Uint8Array (works in React Native's Hermes/JSC runtime)
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const path = `${requestId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('maintenance-attachments')
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return { url: null, signedUrl: null, path: null, error: uploadError.message };
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from('maintenance-attachments')
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7-day signed URL

    if (signedError) {
      return { url: null, signedUrl: null, path, error: signedError.message };
    }

    return { url: path, signedUrl: signedData.signedUrl, path, error: null };
  } catch (err) {
    console.error('❌ uploadMaintenanceAttachment error:', err);
    return {
      url: null,
      signedUrl: null,
      path: null,
      error: err instanceof Error ? err.message : 'Failed to upload attachment',
    };
  }
}

/** Refresh a signed URL for an existing attachment path */
export async function getSignedAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('maintenance-attachments')
    .createSignedUrl(path, 60 * 60 * 24); // 24 hours

  if (error) return null;
  return data.signedUrl;
}

// =====================================================
// Stats (landlord dashboard)
// =====================================================

export async function getMaintenanceStats(landlordId: string): Promise<{
  totalRequests: number;
  newRequests: number;
  inProgressRequests: number;
  resolvedRequests: number;
  emergencyRequests: number;
}> {
  const empty = {
    totalRequests: 0,
    newRequests: 0,
    inProgressRequests: 0,
    resolvedRequests: 0,
    emergencyRequests: 0,
  };

  try {
    const { data, error } = await supabase.rpc('get_landlord_maintenance_stats', {
      landlord_uuid: landlordId,
    });

    if (error) {
      console.error('❌ Error fetching maintenance stats:', error);
      return empty;
    }

    const s = data?.[0] || {};
    return {
      totalRequests: Number(s.total_requests || 0),
      newRequests: Number(s.new_requests || 0),
      inProgressRequests: Number(s.in_progress_requests || 0),
      resolvedRequests: Number(s.resolved_requests || 0),
      emergencyRequests: Number(s.emergency_requests || 0),
    };
  } catch {
    return empty;
  }
}
