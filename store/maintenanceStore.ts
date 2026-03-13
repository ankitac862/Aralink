import { create } from 'zustand';
import {
  createMaintenanceRequest,
  fetchMaintenanceRequests,
  updateMaintenanceStatus,
  assignVendor as assignVendorService,
  addResolutionNotes as addResolutionNotesService,
  getMaintenanceRequestById,
  MaintenanceRequestInput,
} from '@/services/maintenanceService';
import { DbMaintenanceRequest } from '@/lib/supabase';

type MaintenanceStatus = 'new' | 'under_review' | 'in_progress' | 'waiting_vendor' | 'resolved' | 'cancelled';
type UrgencyLevel = 'low' | 'medium' | 'high' | 'emergency';
type MaintenanceCategory = 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'general';

export interface MaintenanceActivity {
  id: string;
  timestamp: string;
  message: string;
  actor: 'tenant' | 'landlord' | 'system';
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
  vendor?: string;
  resolutionNotes?: string;
  activity: MaintenanceActivity[];
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceStore {
  requests: MaintenanceRequest[];
  selectedRequest?: MaintenanceRequest;
  loading: boolean;
  error: string | null;
  
  // Actions
  addRequest: (input: Omit<MaintenanceRequest, 'id' | 'status' | 'activity' | 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  updateRequestStatus: (id: string, status: MaintenanceStatus, actor?: 'tenant' | 'landlord' | 'system') => Promise<boolean>;
  assignVendor: (id: string, vendor: string) => Promise<boolean>;
  addResolutionNotes: (id: string, notes: string) => Promise<boolean>;
  selectRequest: (id?: string) => void;
  fetchRequests: (userId: string, userType: 'tenant' | 'landlord') => Promise<void>;
  refreshRequest: (id: string) => Promise<void>;
}

// Helper function to convert DB request to store format
function dbRequestToStoreFormat(dbRequest: DbMaintenanceRequest): MaintenanceRequest {
  return {
    id: dbRequest.id,
    tenantId: dbRequest.tenant_id,
    tenantName: 'Tenant', // Will be populated from profile
    property: 'Property', // Will be populated from property table
    unit: 'Unit', // Will be populated from unit table
    category: dbRequest.category as MaintenanceCategory,
    title: dbRequest.title,
    description: dbRequest.description,
    urgency: dbRequest.urgency as UrgencyLevel,
    availability: dbRequest.availability,
    permissionToEnter: dbRequest.permission_to_enter,
    attachments: dbRequest.attachments || [],
    status: dbRequest.status as MaintenanceStatus,
    vendor: dbRequest.assigned_vendor,
    resolutionNotes: dbRequest.resolution_notes,
    activity: dbRequest.activity || [],
    createdAt: dbRequest.created_at,
    updatedAt: dbRequest.updated_at,
  };
}

const timestamp = () => new Date().toISOString();

export const useMaintenanceStore = create<MaintenanceStore>((set, get) => ({
  requests: [],
  selectedRequest: undefined,
  loading: false,
  error: null,

  addRequest: async (input) => {
    try {
      set({ loading: true, error: null });

      console.log('🏪 Store addRequest called with:', {
        tenantId: input.tenantId,
        landlordId: input.landlordId,
        propertyId: input.propertyId,
        unitId: input.unitId,
        subUnitId: input.subUnitId,
      });

      // Get property and landlord data from tenant_property_links if not provided
      let propertyId = input.propertyId;
      let landlordId = input.landlordId;
      let unitId = input.unitId;
      let subUnitId = input.subUnitId;

      console.log('🔍 Checking if need to fetch from DB:', {
        hasPropertyId: !!propertyId,
        hasLandlordId: !!landlordId,
      });

      if (!propertyId || !landlordId) {
        // Fetch from tenant_property_links
        const { supabase } = await import('@/lib/supabase');
        
        // Get tenant property links with property details to get landlord_id
        const { data: allLinks } = await supabase
          .from('tenant_property_links')
          .select(`
            property_id, 
            unit_id, 
            sub_unit_id, 
            status,
            properties (
              user_id
            )
          `)
          .eq('tenant_id', input.tenantId);
        
        // Try to find active link first
        let tenantLink = allLinks?.find(link => link.status === 'active');
        
        // If no active link, use the most recent one
        if (!tenantLink && allLinks && allLinks.length > 0) {
          tenantLink = allLinks[0];
        }

        if (!tenantLink) {
          set({ loading: false, error: 'No property found for tenant. Please contact your landlord.' });
          return null;
        }

        propertyId = tenantLink.property_id;
        landlordId = (tenantLink.properties as any)?.user_id;
        unitId = tenantLink.unit_id || undefined;
        subUnitId = tenantLink.sub_unit_id || undefined;
      }
      
      // Create the request input for the service
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
      };

      const { data, error } = await createMaintenanceRequest(requestInput);

      if (error || !data) {
        set({ loading: false, error: error || 'Failed to create request' });
        return null;
      }

      const newRequest = dbRequestToStoreFormat(data);

      set((state) => ({
        requests: [newRequest, ...state.requests],
        selectedRequest: newRequest,
        loading: false,
      }));

      return newRequest.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ loading: false, error: errorMessage });
      return null;
    }
  },

  updateRequestStatus: async (id, status, actor = 'landlord') => {
    try {
      set({ loading: true, error: null });

      const { success, error } = await updateMaintenanceStatus(id, status, actor);

      if (!success || error) {
        set({ loading: false, error: error || 'Failed to update status' });
        return false;
      }

      // Refresh the request from backend
      await get().refreshRequest(id);

      set({ loading: false });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ loading: false, error: errorMessage });
      return false;
    }
  },

  assignVendor: async (id, vendor) => {
    try {
      set({ loading: true, error: null });

      const { success, error } = await assignVendorService(id, vendor);

      if (!success || error) {
        set({ loading: false, error: error || 'Failed to assign vendor' });
        return false;
      }

      // Refresh the request from backend
      await get().refreshRequest(id);

      set({ loading: false });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ loading: false, error: errorMessage });
      return false;
    }
  },

  addResolutionNotes: async (id, notes) => {
    try {
      set({ loading: true, error: null });

      const { success, error } = await addResolutionNotesService(id, notes);

      if (!success || error) {
        set({ loading: false, error: error || 'Failed to add notes' });
        return false;
      }

      // Refresh the request from backend
      await get().refreshRequest(id);

      set({ loading: false });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ loading: false, error: errorMessage });
      return false;
    }
  },

  selectRequest: (id) => {
    if (!id) {
      set({ selectedRequest: undefined });
      return;
    }
    const request = get().requests.find((req) => req.id === id);
    set({ selectedRequest: request });
  },

  fetchRequests: async (userId: string, userType: 'tenant' | 'landlord') => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await fetchMaintenanceRequests(userId, userType);

      if (error) {
        set({ loading: false, error });
        return;
      }

      const requests = data.map(dbRequestToStoreFormat);

      set({ requests, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ loading: false, error: errorMessage });
    }
  },

  refreshRequest: async (id: string) => {
    try {
      const { data, error } = await getMaintenanceRequestById(id);

      if (error || !data) {
        console.error('Failed to refresh request:', error);
        return;
      }

      const updatedRequest = dbRequestToStoreFormat(data);

      set((state) => {
        const updatedRequests = state.requests.map((req) =>
          req.id === id ? updatedRequest : req
        );

        return {
          requests: updatedRequests,
          selectedRequest: state.selectedRequest?.id === id ? updatedRequest : state.selectedRequest,
        };
      });
    } catch (error) {
      console.error('Error refreshing request:', error);
    }
  },
}));

