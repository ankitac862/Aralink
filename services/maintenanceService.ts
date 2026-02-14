import { supabase } from '@/lib/supabase';

// Types for maintenance requests
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
  availability: string; // ISO timestamp
  permissionToEnter: boolean;
  attachments?: MaintenanceAttachment[];
}

export interface MaintenanceAttachment {
  uri: string;
  type: string;
  size?: number;
}

export interface MaintenanceActivity {
  id: string;
  timestamp: string;
  message: string;
  actor: 'tenant' | 'landlord' | 'system';
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
  assigned_vendor?: string;
  resolution_notes?: string;
  expense_id?: string;
  activity: MaintenanceActivity[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

/**
 * Create a new maintenance request
 */
export async function createMaintenanceRequest(
  input: MaintenanceRequestInput
): Promise<{ data: DbMaintenanceRequest | null; error: string | null }> {
  try {
    // Create initial activity log
    const initialActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: 'Request submitted and is under review.',
      actor: 'system',
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
      status: 'under_review',
      activity: [initialActivity],
    };

    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert(requestData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating maintenance request:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      
      if (error.code === '42P01') {
        return { 
          data: null, 
          error: 'Database table not found. Please run the CREATE_MAINTENANCE_REQUESTS_TABLE.sql migration in Supabase SQL Editor.' 
        };
      }
      
      return { data: null, error: error.message || 'Failed to create maintenance request' };
    }

    console.log('✅ Maintenance request created:', data.id);

    // Send notification to landlord
    try {
      await supabase.from('notifications').insert({
        user_id: input.landlordId,
        type: 'maintenance_request',
        title: 'New Maintenance Request',
        message: `New ${input.urgency} priority request: ${input.title}`,
        data: {
          requestId: data.id,
          propertyId: input.propertyId,
          urgency: input.urgency,
          category: input.category,
        },
        created_at: new Date().toISOString(),
      });
    } catch (notifError) {
      // Don't fail the request if notification fails
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create maintenance request',
    };
  }
}

/**
 * Fetch maintenance requests for a user (tenant or landlord)
 */
export async function fetchMaintenanceRequests(
  userId: string,
  userType: 'tenant' | 'landlord'
): Promise<{ data: DbMaintenanceRequest[]; error: string | null }> {
  try {
    console.log(`📡 Fetching maintenance requests for ${userType}:`, userId);

    let query = supabase.from('maintenance_requests').select('*');

    if (userType === 'tenant') {
      query = query.eq('tenant_id', userId);
    } else {
      query = query.eq('landlord_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching maintenance requests:', error);
      return { data: [], error: error.message };
    }

    console.log('✅ Fetched maintenance requests:', data?.length || 0);
    return { data: data || [], error: null };
  } catch (error) {
    console.error('❌ Error in fetchMaintenanceRequests:', error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch maintenance requests',
    };
  }
}

/**
 * Get a single maintenance request by ID
 */
export async function getMaintenanceRequestById(
  requestId: string
): Promise<{ data: DbMaintenanceRequest | null; error: string | null }> {
  try {
    console.log('📡 Fetching maintenance request:', requestId);

    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      console.error('❌ Error fetching maintenance request:', error);
      return { data: null, error: error.message };
    }

    console.log('✅ Fetched maintenance request:', data.id);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Error in getMaintenanceRequestById:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch maintenance request',
    };
  }
}

/**
 * Update maintenance request status
 */
export async function updateMaintenanceStatus(
  requestId: string,
  status: string,
  actor: 'tenant' | 'landlord' | 'system' = 'landlord',
  userId?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    console.log('🔄 Updating maintenance request status:', requestId, status);

    // Get current request to append to activity
    const { data: currentRequest, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity, tenant_id, landlord_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !currentRequest) {
      return { success: false, error: 'Request not found' };
    }

    // Create new activity entry
    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: `Status updated to ${status.replace(/_/g, ' ')}`,
      actor,
    };

    const updatedActivity = [...(currentRequest.activity || []), newActivity];

    // Update the request
    const updateData: any = {
      status,
      activity: updatedActivity,
    };

    // If status is resolved, set resolved_at timestamp
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

    console.log('✅ Maintenance status updated');

    // Send notification to tenant about status change
    try {
      await supabase.from('notifications').insert({
        user_id: currentRequest.tenant_id,
        type: 'maintenance_status_update',
        title: 'Maintenance Request Updated',
        message: `Your maintenance request status: ${status.replace(/_/g, ' ')}`,
        data: {
          requestId,
          status,
        },
        created_at: new Date().toISOString(),
      });
    } catch (notifError) {
      console.error('⚠️ Error sending status update notification:', notifError);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error in updateMaintenanceStatus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status',
    };
  }
}

/**
 * Assign a vendor to a maintenance request
 */
export async function assignVendor(
  requestId: string,
  vendorName: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    console.log('👷 Assigning vendor to request:', requestId, vendorName);

    // Get current request
    const { data: currentRequest, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity')
      .eq('id', requestId)
      .single();

    if (fetchError || !currentRequest) {
      return { success: false, error: 'Request not found' };
    }

    // Create activity entry
    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: `Vendor assigned: ${vendorName}`,
      actor: 'landlord',
    };

    const updatedActivity = [...(currentRequest.activity || []), newActivity];

    const { error: updateError } = await supabase
      .from('maintenance_requests')
      .update({
        assigned_vendor: vendorName,
        activity: updatedActivity,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ Error assigning vendor:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('✅ Vendor assigned');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error in assignVendor:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign vendor',
    };
  }
}

/**
 * Add resolution notes to a maintenance request
 */
export async function addResolutionNotes(
  requestId: string,
  notes: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    console.log('📝 Adding resolution notes to request:', requestId);

    // Get current request
    const { data: currentRequest, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity')
      .eq('id', requestId)
      .single();

    if (fetchError || !currentRequest) {
      return { success: false, error: 'Request not found' };
    }

    // Create activity entry
    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: 'Resolution notes updated.',
      actor: 'landlord',
    };

    const updatedActivity = [...(currentRequest.activity || []), newActivity];

    const { error: updateError } = await supabase
      .from('maintenance_requests')
      .update({
        resolution_notes: notes,
        activity: updatedActivity,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ Error adding resolution notes:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('✅ Resolution notes added');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error in addResolutionNotes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add resolution notes',
    };
  }
}

/**
 * Link an expense/transaction to a maintenance request
 */
export async function linkExpenseToRequest(
  requestId: string,
  expenseId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    console.log('🔗 Linking expense to maintenance request:', requestId, expenseId);

    // Get current request
    const { data: currentRequest, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('activity')
      .eq('id', requestId)
      .single();

    if (fetchError || !currentRequest) {
      return { success: false, error: 'Request not found' };
    }

    // Create activity entry
    const newActivity: MaintenanceActivity = {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: 'Expense/invoice added.',
      actor: 'landlord',
    };

    const updatedActivity = [...(currentRequest.activity || []), newActivity];

    const { error: updateError } = await supabase
      .from('maintenance_requests')
      .update({
        expense_id: expenseId,
        activity: updatedActivity,
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ Error linking expense:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('✅ Expense linked to maintenance request');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Error in linkExpenseToRequest:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link expense',
    };
  }
}

/**
 * Upload maintenance attachment to Supabase storage
 */
export async function uploadMaintenanceAttachment(
  file: { uri: string; type: string; name: string },
  requestId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    console.log('📤 Uploading maintenance attachment');

    // Convert file URI to blob for upload
    const response = await fetch(file.uri);
    const blob = await response.blob();

    const fileName = `${requestId}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('maintenance-attachments')
      .upload(fileName, blob, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (error) {
      console.error('❌ Error uploading file:', error);
      return { url: null, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('maintenance-attachments')
      .getPublicUrl(fileName);

    console.log('✅ File uploaded successfully');
    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('❌ Error in uploadMaintenanceAttachment:', error);
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Failed to upload attachment',
    };
  }
}

/**
 * Get maintenance statistics for landlord dashboard
 */
export async function getMaintenanceStats(
  landlordId: string
): Promise<{
  totalRequests: number;
  newRequests: number;
  inProgressRequests: number;
  resolvedRequests: number;
  emergencyRequests: number;
}> {
  try {
    console.log('📊 Fetching maintenance stats for landlord:', landlordId);

    const { data, error } = await supabase.rpc('get_landlord_maintenance_stats', {
      landlord_uuid: landlordId,
    });

    if (error) {
      console.error('❌ Error fetching maintenance stats:', error);
      return {
        totalRequests: 0,
        newRequests: 0,
        inProgressRequests: 0,
        resolvedRequests: 0,
        emergencyRequests: 0,
      };
    }

    const stats = data[0] || {
      total_requests: 0,
      new_requests: 0,
      in_progress_requests: 0,
      resolved_requests: 0,
      emergency_requests: 0,
    };

    return {
      totalRequests: Number(stats.total_requests),
      newRequests: Number(stats.new_requests),
      inProgressRequests: Number(stats.in_progress_requests),
      resolvedRequests: Number(stats.resolved_requests),
      emergencyRequests: Number(stats.emergency_requests),
    };
  } catch (error) {
    console.error('❌ Error in getMaintenanceStats:', error);
    return {
      totalRequests: 0,
      newRequests: 0,
      inProgressRequests: 0,
      resolvedRequests: 0,
      emergencyRequests: 0,
    };
  }
}
