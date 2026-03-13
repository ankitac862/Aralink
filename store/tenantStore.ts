import { create } from 'zustand';

import {
  createTenant as createTenantInDb,
  DbTenant,
  deleteTenantFromDb,
  fetchTenants,
  updateTenantInDb,
} from '@/lib/supabase';

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  propertyId: string;
  unitId?: string;
  unitName?: string;
  photo?: string;
  startDate?: string;
  endDate?: string;
  rentAmount?: number;
  status: 'active' | 'inactive';
  createdAt: string;
  // Payment data
  payments?: {
    rent: { paid: number; total: number; percentage: number };
    maintenance: { paid: number; total: number; percentage: number };
    utility: { paid: number; total: number; percentage: number };
    other: { paid: number; total: number; percentage: number };
  };
}

interface TenantStore {
  tenants: Tenant[];
  isLoading: boolean;
  isSynced: boolean;
  error: string | null;
  
  // Actions
  loadFromSupabase: (userId: string) => Promise<void>;
  addTenant: (tenant: Omit<Tenant, 'id' | 'createdAt' | 'status'>, userId?: string) => Promise<string>;
  updateTenant: (id: string, updates: Partial<Tenant>) => Promise<void>;
  deleteTenant: (id: string) => Promise<void>;
  getTenantById: (id: string) => Tenant | undefined;
  getTenantsByProperty: (propertyId: string) => Tenant[];
}

// Generate unique ID (fallback for local)
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

// Convert DB tenant to local format
const dbToLocalTenant = (dbTenant: DbTenant): Tenant => ({
  id: dbTenant.id,
  firstName: dbTenant.first_name,
  lastName: dbTenant.last_name,
  email: dbTenant.email,
  phone: dbTenant.phone,
  propertyId: dbTenant.property_id,
  unitId: dbTenant.unit_id,
  unitName: dbTenant.unit_name,
  photo: dbTenant.photo,
  startDate: dbTenant.start_date,
  endDate: dbTenant.end_date,
  rentAmount: dbTenant.rent_amount,
  status: dbTenant.status,
  createdAt: dbTenant.created_at,
  payments: dbTenant.payments,
});

// Convert local tenant to DB format
const localToDbTenant = (tenant: Partial<Tenant>, userId: string): Partial<DbTenant> => ({
  user_id: userId,
  first_name: tenant.firstName || '',
  last_name: tenant.lastName || '',
  email: tenant.email || '',
  phone: tenant.phone || '',
  property_id: tenant.propertyId || '',
  unit_id: tenant.unitId,
  unit_name: tenant.unitName,
  photo: tenant.photo,
  start_date: tenant.startDate,
  end_date: tenant.endDate,
  rent_amount: tenant.rentAmount,
  status: tenant.status || 'active',
  payments: tenant.payments,
});

// Start with empty tenants - data will be loaded from Supabase
// Each user will only see their own tenants based on RLS policies

export const useTenantStore = create<TenantStore>((set, get) => ({
  tenants: [],
  isLoading: false,
  isSynced: false,
  error: null,
  
  // Load tenants from Supabase
  loadFromSupabase: async (userId: string) => {
    try {
      console.log('🔄 TenantStore: Starting to load tenants for user:', userId);
      set({ isLoading: true, error: null });
      
      const dbTenants = await fetchTenants(userId);
      console.log('📋 TenantStore: Received', dbTenants.length, 'tenants from fetchTenants');
      console.log('📋 TenantStore: Raw tenant data:', JSON.stringify(dbTenants, null, 2));
      
      // Always update with API data (even if empty)
      // This ensures user only sees their own tenants
      const tenants = dbTenants.map(dbToLocalTenant);
      console.log('📋 TenantStore: Transformed to', tenants.length, 'local tenants');
      console.log('📋 TenantStore: Transformed tenants:', tenants.map(t => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        email: t.email,
        propertyId: t.propertyId
      })));
      
      set({ tenants, isLoading: false, isSynced: true });
      console.log('✅ TenantStore: State updated with', tenants.length, 'tenants');
    } catch (error) {
      console.error('❌ TenantStore: Error loading tenants from Supabase:', error);
      // On error, show empty list (don't fallback to mock data)
      set({ tenants: [], isLoading: false, error: 'Failed to load tenants' });
    }
  },
  
  addTenant: async (tenantData, userId) => {
    // Try to save to Supabase if userId is provided
    if (userId) {
      try {
        set({ isLoading: true });
        
        const dbTenantData = localToDbTenant({
          ...tenantData,
          payments: tenantData.payments || {
            rent: { paid: 0, total: tenantData.rentAmount || 0, percentage: 0 },
            maintenance: { paid: 0, total: 0, percentage: 0 },
            utility: { paid: 0, total: 0, percentage: 0 },
            other: { paid: 0, total: 0, percentage: 0 },
          },
        }, userId);
        
        const savedTenant = await createTenantInDb(dbTenantData as any);
        
        if (savedTenant) {
          // Refresh list from API
          await get().loadFromSupabase(userId);
          set({ isLoading: false });
          return savedTenant.id;
        }
        
        set({ isLoading: false });
      } catch (error) {
        console.error('Error saving tenant to Supabase:', error);
        set({ isLoading: false });
      }
    }
    
    // Fallback: Add locally
    const id = generateId();
    const newTenant: Tenant = {
      ...tenantData,
      id,
      status: 'active',
      createdAt: new Date().toISOString(),
      payments: tenantData.payments || {
        rent: { paid: 0, total: tenantData.rentAmount || 0, percentage: 0 },
        maintenance: { paid: 0, total: 0, percentage: 0 },
        utility: { paid: 0, total: 0, percentage: 0 },
        other: { paid: 0, total: 0, percentage: 0 },
      },
    };
    set((state) => ({ tenants: [...state.tenants, newTenant] }));
    return id;
  },
  
  updateTenant: async (id, updates) => {
    // Update local state first
    set((state) => ({
      tenants: state.tenants.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
    
    // Try to update in Supabase
    try {
      await updateTenantInDb(id, {
        first_name: updates.firstName,
        last_name: updates.lastName,
        email: updates.email,
        phone: updates.phone,
        property_id: updates.propertyId,
        unit_id: updates.unitId,
        unit_name: updates.unitName,
        photo: updates.photo,
        start_date: updates.startDate,
        end_date: updates.endDate,
        rent_amount: updates.rentAmount,
        status: updates.status,
        payments: updates.payments,
      } as any);
    } catch (error) {
      console.error('Error updating tenant in Supabase:', error);
    }
  },
  
  deleteTenant: async (id) => {
    // Update local state first
    set((state) => ({
      tenants: state.tenants.filter((t) => t.id !== id),
    }));
    
    // Try to delete from Supabase
    try {
      await deleteTenantFromDb(id);
    } catch (error) {
      console.error('Error deleting tenant from Supabase:', error);
    }
  },
  
  getTenantById: (id) => {
    return get().tenants.find((t) => t.id === id);
  },
  
  getTenantsByProperty: (propertyId) => {
    return get().tenants.filter((t) => t.propertyId === propertyId);
  },
}));
