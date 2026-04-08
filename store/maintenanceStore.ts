import { create } from 'zustand';
import {
  createMaintenanceRequest,
  fetchMaintenanceRequests,
  updateMaintenanceStatus,
  assignVendor as assignVendorService,
  addResolutionNotes as addResolutionNotesService,
  submitTenantFeedback as submitTenantFeedbackService,
  getMaintenanceRequestById,
  MaintenanceRequestInput,
  DbMaintenanceRequest,
} from '@/services/maintenanceService';
import { MaintenanceCreatorRole } from '@/lib/maintenancePermissions';

export type MaintenanceStatus =
  | 'new'
  | 'under_review'
  | 'in_progress'
  | 'waiting_vendor'
  | 'resolved'
  | 'cancelled';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency';
export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'appliance'
  | 'general';

export interface MaintenanceActivity {
  id: string;
  timestamp: string;
  message: string;
  actor: 'tenant' | 'landlord' | 'manager' | 'system';
}

export interface MaintenanceRequest {
  id: string;
  tenantId: string;
  landlordId?: string;
  propertyId?: string;
  unitId?: string;
  subUnitId?: string;
  tenantName: string;
  property: string;
  unit: string;
  category: MaintenanceCategory;
  title: string;
  description: string;
  urgency: UrgencyLevel;
  availability: string;
  permissionToEnter: boolean;
  attachments: { uri: string; type: string }[];
  status: MaintenanceStatus;
  createdByRole: MaintenanceCreatorRole;
  createdById: string;
  approvedBy?: string;
  approvedAt?: string;
  vendor?: string;
  resolutionNotes?: string;
  tenantFeedback?: string;
  tenantFeedbackRating?: number;
  activity: MaintenanceActivity[];
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceStore {
  requests: MaintenanceRequest[];
  selectedRequest?: MaintenanceRequest;
  loading: boolean;
  error: string | null;

  addRequest: (
    input: Omit<MaintenanceRequest, 'id' | 'status' | 'activity' | 'createdAt' | 'updatedAt'>,
    callerRole?: MaintenanceCreatorRole
  ) => Promise<string | null>;
  updateRequestStatus: (
    id: string,
    status: MaintenanceStatus,
    actor?: 'tenant' | 'landlord' | 'manager' | 'system',
    callerRole?: MaintenanceCreatorRole
  ) => Promise<boolean>;
  assignVendor: (id: string, vendor: string, callerRole?: MaintenanceCreatorRole) => Promise<boolean>;
  addResolutionNotes: (id: string, notes: string, callerRole?: MaintenanceCreatorRole) => Promise<boolean>;
  submitFeedback: (id: string, feedback: string, rating: number) => Promise<boolean>;
  selectRequest: (id?: string) => void;
  fetchRequests: (userId: string, userType: 'tenant' | 'landlord' | 'manager') => Promise<void>;
  refreshRequest: (id: string) => Promise<void>;
}

function dbToStore(db: DbMaintenanceRequest): MaintenanceRequest {
  return {
    id: db.id,
    tenantId: db.tenant_id,
    landlordId: db.landlord_id,
    propertyId: db.property_id,
    unitId: db.unit_id,
    subUnitId: db.sub_unit_id,
    tenantName: db._tenantName || 'Tenant',
    property: db._propertyLabel || 'Property',
    unit: db._unitLabel || (db.unit_id ? 'Unit' : 'N/A'),
    category: db.category as MaintenanceCategory,
    title: db.title,
    description: db.description,
    urgency: db.urgency as UrgencyLevel,
    availability: db.availability,
    permissionToEnter: db.permission_to_enter,
    attachments: db.attachments || [],
    status: db.status as MaintenanceStatus,
    createdByRole: (db.created_by_role as MaintenanceCreatorRole) || 'tenant',
    createdById: db.created_by_id,
    approvedBy: db.approved_by,
    approvedAt: db.approved_at,
    vendor: db.assigned_vendor,
    resolutionNotes: db.resolution_notes,
    tenantFeedback: db.tenant_feedback,
    tenantFeedbackRating: db.tenant_feedback_rating,
    activity: db.activity || [],
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export const useMaintenanceStore = create<MaintenanceStore>((set, get) => ({
  requests: [],
  selectedRequest: undefined,
  loading: false,
  error: null,

  addRequest: async (input, callerRole = 'tenant') => {
    try {
      set({ loading: true, error: null });

      let propertyId = input.propertyId;
      let landlordId = input.landlordId;
      let unitId = input.unitId;
      let subUnitId = input.subUnitId;

      if (!propertyId || !landlordId) {
        const { supabase } = await import('@/lib/supabase');
        const { data: allLinks } = await supabase
          .from('tenant_property_links')
          .select('property_id, unit_id, sub_unit_id, status, properties(user_id)')
          .eq('tenant_id', input.tenantId);

        const tenantLink =
          allLinks?.find((l) => l.status === 'active') ||
          (allLinks && allLinks.length > 0 ? allLinks[0] : undefined);

        if (!tenantLink) {
          set({ loading: false, error: 'No property found for tenant.' });
          return null;
        }

        propertyId = tenantLink.property_id;
        landlordId = (tenantLink.properties as any)?.user_id;
        unitId = tenantLink.unit_id || undefined;
        subUnitId = tenantLink.sub_unit_id || undefined;
      }

      const requestInput: MaintenanceRequestInput = {
        tenantId: input.tenantId,
        landlordId: landlordId!,
        propertyId: propertyId!,
        unitId,
        subUnitId,
        category: input.category,
        title: input.title,
        description: input.description,
        urgency: input.urgency,
        availability: input.availability,
        permissionToEnter: input.permissionToEnter,
        attachments: input.attachments,
        createdByRole: callerRole,
        createdById: callerRole === 'tenant' ? input.tenantId : (input.createdById || input.tenantId),
      };

      const { data, error } = await createMaintenanceRequest(requestInput);

      if (error || !data) {
        set({ loading: false, error: error || 'Failed to create request' });
        return null;
      }

      const newRequest = dbToStore(data);
      set((state) => ({
        requests: [newRequest, ...state.requests],
        selectedRequest: newRequest,
        loading: false,
      }));

      return newRequest.id;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      return null;
    }
  },

  updateRequestStatus: async (id, status, actor = 'landlord', callerRole) => {
    try {
      set({ loading: true, error: null });
      const { success, error } = await updateMaintenanceStatus(id, status, actor, callerRole);
      if (!success) {
        set({ loading: false, error: error || 'Failed to update status' });
        return false;
      }
      await get().refreshRequest(id);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      return false;
    }
  },

  assignVendor: async (id, vendor, callerRole) => {
    try {
      set({ loading: true, error: null });
      const { success, error } = await assignVendorService(id, vendor, callerRole);
      if (!success) {
        set({ loading: false, error: error || 'Failed to assign vendor' });
        return false;
      }
      await get().refreshRequest(id);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      return false;
    }
  },

  addResolutionNotes: async (id, notes, callerRole) => {
    try {
      set({ loading: true, error: null });
      const { success, error } = await addResolutionNotesService(id, notes, callerRole);
      if (!success) {
        set({ loading: false, error: error || 'Failed to save notes' });
        return false;
      }
      await get().refreshRequest(id);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      return false;
    }
  },

  submitFeedback: async (id, feedback, rating) => {
    try {
      set({ loading: true, error: null });
      const { success, error } = await submitTenantFeedbackService(id, feedback, rating);
      if (!success) {
        set({ loading: false, error: error || 'Failed to submit feedback' });
        return false;
      }
      await get().refreshRequest(id);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      return false;
    }
  },

  selectRequest: (id) => {
    if (!id) { set({ selectedRequest: undefined }); return; }
    set({ selectedRequest: get().requests.find((r) => r.id === id) });
  },

  fetchRequests: async (userId, userType) => {
    try {
      set({ loading: true, error: null });
      const { data, error } = await fetchMaintenanceRequests(userId, userType);
      if (error) { set({ loading: false, error }); return; }
      set({ requests: data.map(dbToStore), loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  refreshRequest: async (id) => {
    try {
      const { data, error } = await getMaintenanceRequestById(id);
      if (error || !data) return;
      const updated = dbToStore(data);
      set((state) => ({
        requests: state.requests.map((r) => (r.id === id ? updated : r)),
        selectedRequest: state.selectedRequest?.id === id ? updated : state.selectedRequest,
      }));
    } catch (err) {
      console.error('Error refreshing request:', err);
    }
  },
}));
