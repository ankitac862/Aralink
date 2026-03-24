import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env.local file');
}

// Create a custom storage adapter that works on all platforms
const createStorageAdapter = () => {
  // For web, use localStorage
  if (Platform.OS === 'web') {
    const memoryStorage = new Map<string, string>();

    const safeGet = (key: string) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch {
        // Safari/private mode can throw on localStorage access
      }
      return memoryStorage.get(key) ?? null;
    };

    const safeSet = (key: string, value: string) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch {
        // Safari/private mode can throw on localStorage access
      }
      memoryStorage.set(key, value);
    };

    const safeRemove = (key: string) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Safari/private mode can throw on localStorage access
      }
      memoryStorage.delete(key);
    };

    return {
      getItem: (key: string) => Promise.resolve(safeGet(key)),
      setItem: (key: string, value: string) => {
        safeSet(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        safeRemove(key);
        return Promise.resolve();
      },
    };
  }
  
  // For native (iOS/Android), use AsyncStorage
  // Import dynamically to avoid issues on web
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return {
    getItem: (key: string) => AsyncStorage.getItem(key),
    setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
    removeItem: (key: string) => AsyncStorage.removeItem(key),
  };
};

// Create Supabase client with platform-specific storage
let supabase: SupabaseClient;

try {
  const storageAdapter = createStorageAdapter();
  
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: storageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      // Add error handling for session issues
      flowType: 'pkce',
    },
  });
  
  // Add global error handler for auth errors
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      // Session is being managed, no action needed
      return;
    }
  });
  
} catch (error) {
  console.error('Error creating Supabase client:', error);
  // Create a fallback client without storage
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      flowType: 'pkce',
    },
  });
}

export { supabase };

// Database types for the users table
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  user_type: 'landlord' | 'tenant' | 'manager';
  account_status?: 'active' | 'pending' | 'invited' | 'suspended';
  phone?: string;
  avatar_url?: string;
  is_social_login: boolean;
  social_provider?: 'google' | 'apple' | 'facebook' | null;
  created_at: string;
  updated_at: string;
}

// Maintenance Request types
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
  category: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'general';
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  availability: string;
  permission_to_enter: boolean;
  attachments: MaintenanceAttachment[];
  status: 'new' | 'under_review' | 'in_progress' | 'waiting_vendor' | 'resolved' | 'cancelled';
  assigned_vendor?: string;
  resolution_notes?: string;
  expense_id?: string;
  activity: MaintenanceActivity[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

// Helper function to get user profile from database
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ profiles table not found. Please run the SQL schema in Supabase.');
      }
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Helper function to create or update user profile
export async function upsertUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        ...profile,
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ profiles table not found. User profile not saved.');
      } else {
        console.error('Error upserting user profile:', error);
      }
      return null;
    }

    if (!data) {
      console.error('❌ Profile upsert returned 0 rows - likely RLS policy blocking. Run FIX_PROFILES_RLS_SIMPLE.sql');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error upserting user profile:', error);
    return null;
  }
}

// Helper to get storage for platform
export const getStorage = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.localStorage : null;
  }
  return require('@react-native-async-storage/async-storage').default;
};

// Helper function to clear corrupted session
export async function clearCorruptedSession(): Promise<void> {
  try {
    // Sign out to clear any corrupted session
    await supabase.auth.signOut();
    
    // Also clear storage manually
    const storage = getStorage();
    if (storage) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Clear Supabase session keys from localStorage
        const keys = Object.keys(window.localStorage);
        keys.forEach(key => {
          if (key.includes('supabase') || key.includes('auth')) {
            window.localStorage.removeItem(key);
          }
        });
      } else {
        // Clear AsyncStorage keys
        const AsyncStorage = storage;
        const allKeys = await AsyncStorage.getAllKeys();
        const supabaseKeys = allKeys.filter((key: string) => 
          key.includes('supabase') || key.includes('auth')
        );
        if (supabaseKeys.length > 0) {
          await AsyncStorage.multiRemove(supabaseKeys);
        }
      }
    }
  } catch (error) {
    console.error('Error clearing corrupted session:', error);
  }
}

// =====================================================
// STORAGE (IMAGE UPLOAD) FUNCTIONS
// =====================================================

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload an image to Supabase Storage
 * @param uri - Local file URI (from ImagePicker)
 * @param bucket - Storage bucket name ('property-images', 'tenant-photos', etc.)
 * @param folder - Folder path within bucket (e.g., 'properties/123')
 * @returns Upload result with public URL or error
 */
export async function uploadImage(
  uri: string, 
  bucket: string, 
  folder: string
): Promise<UploadResult> {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${folder}/${timestamp}-${randomId}.${extension}`;

    // For web, we need to fetch the blob
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
          upsert: true,
        });

      if (error) {
        console.error('Error uploading image:', error);
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return { success: true, url: urlData.publicUrl };
    }

    const uriToBase64 = async (uri: string) => {
      const response = await fetch(uri);
      const blob = await response.blob();
    
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]); // remove "data:image/...;base64,"
        };
        reader.readAsDataURL(blob);
      });
    };
    

    // For native (iOS/Android), we need to read the file and convert to base64
    // const base64 = await FileSystem.readAsStringAsync(uri, {
    //   // Use string literal to avoid type issues across platforms
    //   encoding: 'base64',
    // });

    const base64 = await uriToBase64(uri);

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, bytes, {
        contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        upsert: true,
      });

    if (error) {
      console.error('Error uploading image:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error('Error uploading image:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

/**
 * Upload multiple images in parallel
 * @param uris - Array of local file URIs
 * @param bucket - Storage bucket name
 * @param folder - Folder path within bucket
 * @returns Array of public URLs for successfully uploaded images
 */
export async function uploadMultipleImages(
  uris: string[], 
  bucket: string, 
  folder: string
): Promise<string[]> {
  const uploadPromises = uris.map(uri => uploadImage(uri, bucket, folder));
  const results = await Promise.all(uploadPromises);
  
  // Return only successful uploads
  return results
    .filter(result => result.success && result.url)
    .map(result => result.url!);
}

/**
 * Delete an image from Supabase Storage
 * @param url - Public URL of the image
 * @param bucket - Storage bucket name
 * @returns true if deleted successfully
 */
export async function deleteImage(url: string, bucket: string): Promise<boolean> {
  try {
    // Extract file path from URL
    const urlParts = url.split(`${bucket}/`);
    if (urlParts.length < 2) {
      console.error('Invalid image URL format');
      return false;
    }
    
    const filePath = urlParts[1];
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}

/**
 * Get all storage buckets (for verification)
 */
export async function listBuckets() {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('Error listing buckets:', error);
      return [];
    }
    return data;
  } catch (error) {
    console.error('Error listing buckets:', error);
    return [];
  }
}

// Storage bucket constants
export const STORAGE_BUCKETS = {
  PROPERTY_IMAGES: 'property-images',
  TENANT_PHOTOS: 'tenant-photos',
  UNIT_PHOTOS: 'unit-photos',
  DOCUMENTS: 'documents',
} as const;

// =====================================================
// PROPERTY API FUNCTIONS
// =====================================================

// Database types for properties
export interface DbProperty {
  id: string;
  user_id: string;
  name?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  property_type: 'single_unit' | 'multi_unit' | 'commercial' | 'parking';
  landlord_name?: string;
  rent_complete_property?: boolean;
  description?: string;
  photos?: string[];
  parking_included?: boolean;
  rent_amount?: number;
  utilities?: {
    electricity: 'landlord' | 'tenant';
    heatGas: 'landlord' | 'tenant';
    water: 'landlord' | 'tenant';
    wifi: 'landlord' | 'tenant';
    rentalEquipments: 'landlord' | 'tenant';
  };
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface DbUnit {
  id: string;
  property_id: string;
  name: string;
  description?: string;
  unit_type?: 'apartment' | 'condo' | 'commercial_suite';
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  rent_entire_unit?: boolean;
  default_rent_price?: number;
  availability_date?: string;
  lease_start_date?: string;
  lease_end_date?: string;
  photos?: string[];
  amenities?: Record<string, boolean>;
  tenant_id?: string;
  is_occupied: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSubUnit {
  id: string;
  unit_id: string;
  name: string;
  type: 'bedroom' | 'bathroom' | 'living_room' | 'kitchen' | 'other';
  rent_price?: number;
  area?: number;
  availability_date?: string;
  photos?: string[];
  amenities?: string[];
  shared_spaces?: string[];
  tenant_id?: string;
  tenant_name?: string;
  created_at: string;
  updated_at: string;
}

// Fetch all properties for the current user
export async function fetchProperties(userId: string): Promise<DbProperty[]> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ properties table not found. Using local data.');
        return [];
      }
      console.error('Error fetching properties:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching properties:', error);
    return [];
  }
}

// Fetch a single property with units and subunits
export async function fetchPropertyById(propertyId: string): Promise<DbProperty | null> {
  try {
    console.log('🔍 fetchPropertyById called with ID:', propertyId);
    
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (error) {
      console.error('❌ Error fetching property:', error);
      console.error('❌ Property ID that failed:', propertyId);
      return null;
    }

    console.log('✅ Property found:', data ? `${data.address1}, ${data.city}` : 'null');
    return data;
  } catch (error) {
    console.error('❌ Exception fetching property:', error);
    console.error('❌ Property ID that failed:', propertyId);
    return null;
  }
}

// Fetch units for a property
export async function fetchUnitsForProperty(propertyId: string): Promise<DbUnit[]> {
  try {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ units table not found.');
        return [];
      }
      console.error('Error fetching units:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching units:', error);
    return [];
  }
}

// Fetch subunits for a unit
export async function fetchSubUnitsForUnit(unitId: string): Promise<DbSubUnit[]> {
  try {
    const { data, error } = await supabase
      .from('sub_units')
      .select('*')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ sub_units table not found.');
        return [];
      }
      console.error('Error fetching sub units:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching sub units:', error);
    return [];
  }
}

// Create a new property
export async function createProperty(property: Omit<DbProperty, 'id' | 'created_at' | 'updated_at'>): Promise<DbProperty | null> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .insert({
        ...property,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating property:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating property:', error);
    return null;
  }
}

// Update a property
export async function updatePropertyInDb(propertyId: string, updates: Partial<DbProperty>): Promise<DbProperty | null> {
  try {
    const { data, error } = await supabase
      .from('properties')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating property:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating property:', error);
    return null;
  }
}

// Delete a property
export async function deletePropertyFromDb(propertyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId);

    if (error) {
      console.error('Error deleting property:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting property:', error);
    return false;
  }
}

// Create a unit
export async function createUnit(unit: Omit<DbUnit, 'id' | 'created_at' | 'updated_at'>): Promise<DbUnit | null> {
  try {
    const { data, error } = await supabase
      .from('units')
      .insert({
        ...unit,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating unit:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating unit:', error);
    return null;
  }
}

// Update a unit
export async function updateUnitInDb(unitId: string, updates: Partial<DbUnit>): Promise<DbUnit | null> {
  try {
    const { data, error } = await supabase
      .from('units')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', unitId)
      .select()
      .single();

    if (error) {
      console.error('Error updating unit:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating unit:', error);
    return null;
  }
}

// Delete a unit
export async function deleteUnitFromDb(unitId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('units')
      .delete()
      .eq('id', unitId);

    if (error) {
      console.error('Error deleting unit:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting unit:', error);
    return false;
  }
}

// Create a sub-unit (room)
export async function createSubUnit(subUnit: Omit<DbSubUnit, 'id' | 'created_at' | 'updated_at'>): Promise<DbSubUnit | null> {
  try {
    const { data, error } = await supabase
      .from('sub_units')
      .insert({
        ...subUnit,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sub unit:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating sub unit:', error);
    return null;
  }
}

// Update a sub-unit
export async function updateSubUnitInDb(subUnitId: string, updates: Partial<DbSubUnit>): Promise<DbSubUnit | null> {
  try {
    const { data, error } = await supabase
      .from('sub_units')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subUnitId)
      .select()
      .single();

    if (error) {
      console.error('Error updating sub unit:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating sub unit:', error);
    return null;
  }
}

// Delete a sub-unit
export async function deleteSubUnitFromDb(subUnitId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sub_units')
      .delete()
      .eq('id', subUnitId);

    if (error) {
      console.error('Error deleting sub unit:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting sub unit:', error);
    return false;
  }
}

// =====================================================
// TENANT API FUNCTIONS
// =====================================================

export interface DbTenant {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  property_id: string;
  unit_id?: string;
  unit_name?: string;
  photo?: string;
  start_date?: string;
  end_date?: string;
  rent_amount?: number;
  status: 'active' | 'inactive';
  payments?: {
    rent: { paid: number; total: number; percentage: number };
    maintenance: { paid: number; total: number; percentage: number };
    utility: { paid: number; total: number; percentage: number };
    other: { paid: number; total: number; percentage: number };
  };
  created_at: string;
  updated_at: string;
}

// Fetch all tenants for the current user
export async function fetchTenants(userId: string): Promise<DbTenant[]> {
  try {
    console.log('🔍 Fetching tenants for landlord:', userId);
    
    // Method 1: Get tenants via tenant_property_links (NEW METHOD)
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('user_id', userId);

    if (propError) {
      console.error('❌ Error fetching landlord properties:', propError);
    }

    let tenantsFromLinks: DbTenant[] = [];
    
    if (properties && properties.length > 0) {
      const propertyIds = properties.map(p => p.id);
      console.log(`📋 Found ${propertyIds.length} properties for landlord:`, propertyIds);

      // Convert property IDs to string for comparison (tenant_property_links.property_id is often TEXT)
      const propertyIdsAsStrings = propertyIds.map(id => String(id));
      console.log('📋 Property IDs as strings:', propertyIdsAsStrings);

      // Get ACTIVE tenant IDs for these properties via tenant_property_links
      const { data: links, error: linksError } = await supabase
        .from('tenant_property_links')
        .select('tenant_id, status, property_id')
        .in('property_id', propertyIdsAsStrings)
        .eq('status', 'active');

      if (linksError) {
        console.error('❌ Error fetching tenant_property_links:', linksError);
      } else if (links && links.length > 0) {
        console.log(`📋 Found ${links.length} tenant links:`, links);
        
        const tenantIds = [...new Set(links.map(link => link.tenant_id))];
        console.log(`📋 Unique tenant IDs to fetch:`, tenantIds);

        // Fetch all tenants by their IDs
        const { data: tenantsData, error: tenantsError } = await supabase
          .from('tenants')
          .select('*')
          .in('id', tenantIds)
          .order('created_at', { ascending: false });

        if (tenantsError) {
          console.error('❌ Error fetching tenants by IDs:', tenantsError);
          console.error('❌ Tenant error details:', JSON.stringify(tenantsError, null, 2));
        } else {
          tenantsFromLinks = tenantsData || [];
          console.log(`✅ Fetched ${tenantsFromLinks.length} tenants via links`);
          console.log('📋 Tenant data:', JSON.stringify(tenantsFromLinks, null, 2));
        }
      } else {
        console.log('⚠️ No tenant links found for these properties');
      }
    } else {
      console.log('⚠️ No properties found for landlord');
    }

    // Method 2: FALLBACK - Get tenants by user_id (OLD METHOD for backwards compatibility)
    const { data: tenantsDirectly, error: directError } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (directError) {
      if (directError.code === 'PGRST205') {
        console.warn('⚠️ tenants table not found. Using local data.');
      } else {
        console.error('❌ Error fetching tenants directly:', directError);
      }
    }

    const tenantsFromDirect = tenantsDirectly || [];
    console.log(`📋 Fetched ${tenantsFromDirect.length} tenants directly by user_id`);
    if (tenantsFromDirect.length > 0) {
      console.log('📋 Direct tenant data:', JSON.stringify(tenantsFromDirect, null, 2));
    }

    // Merge both methods and deduplicate by ID
    const allTenants = [...tenantsFromLinks, ...tenantsFromDirect];
    const uniqueTenants = allTenants.filter((tenant, index, self) => 
      index === self.findIndex((t) => t.id === tenant.id)
    );

    console.log(`✅ Total unique tenants: ${uniqueTenants.length}`);
    if (uniqueTenants.length > 0) {
      console.log('✅ Final tenant list:', uniqueTenants.map(t => ({ 
        id: t.id, 
        name: `${t.first_name} ${t.last_name}`,
        email: t.email,
        property_id: t.property_id
      })));
    }
    return uniqueTenants;
  } catch (error) {
    console.error('❌ Error fetching tenants:', error);
    return [];
  }
}

// Fetch approved applicants for a landlord (for lease generation)
export async function fetchApprovedApplicants(userId: string) {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      // .eq('status', 'approved') // Removed to allow all applicants to be selected for lease generation
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching approved applicants:', error);
      return [];
    }

    // Filter to only this landlord's properties
    const { data: properties } = await supabase
      .from('properties')
      .select('id')
      .eq('user_id', userId);

    const propertyIds = properties?.map(p => p.id) || [];
    const filtered = (data || []).filter(app => propertyIds.includes(app.property_id));

    return filtered;
  } catch (error) {
    console.error('Error fetching approved applicants:', error);
    return [];
  }
}

// Fetch a single tenant by ID
export async function fetchTenantById(tenantId: string): Promise<DbTenant | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error('Error fetching tenant:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return null;
  }
}

// Create a new tenant
export async function createTenant(tenant: Omit<DbTenant, 'id' | 'created_at' | 'updated_at'>): Promise<DbTenant | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        ...tenant,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tenant:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating tenant:', error);
    return null;
  }
}

// Update a tenant
export async function updateTenantInDb(tenantId: string, updates: Partial<DbTenant>): Promise<DbTenant | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating tenant:', error);
    return null;
  }
}

// Delete a tenant
export async function deleteTenantFromDb(tenantId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (error) {
      console.error('Error deleting tenant:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return false;
  }
}

// =====================================================
// TENANT-LANDLORD CONNECTION FUNCTIONS
// =====================================================

export interface TenantResolutionResult {
  tenantId: string;
  existed: boolean;
  invited: boolean;
  accountStatus?: string;
  userType?: string;
}

export interface DbTenantPropertyLink {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id?: string | null;
  sub_unit_id?: string | null;
  status: 'active' | 'pending_invite' | 'inactive' | 'removed';
  created_via: 'landlord_invite' | 'lease_creation' | 'application_approval';
  created_by_user_id: string;
  link_start_date?: string | null;
  link_end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbApplication {
  id: string;
  user_id: string;
  property_id: string | null;
  unit_id?: string | null;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string | null;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'lease_ready' | 'lease_sent' | 'lease_signed' | 'move_in_approved' | 'completed';
  form_data?: Record<string, any>;
  
  // NEW FIELDS
  proposed_move_in_date?: string | null;
  approved_move_in_date?: string | null;
  move_in_status?: 'unselected' | 'pending_approval' | 'approved' | 'declined';
  is_transfer?: boolean;
  current_property_id?: string | null;
  
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbInvite {
  id: string;
  token_hash: string;
  property_id: string;
  landlord_id: string;
  tenant_id?: string | null;
  tenant_email: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InviteDetails {
  inviteStatus: string;
  expiresAt?: string;
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
}

export async function resolveTenantByEmail(
  email: string,
  fullName?: string
): Promise<TenantResolutionResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('resolve-tenant', {
      body: { email, fullName },
    });

    if (error) {
      console.error('Error resolving tenant via edge function:', error);
      return null;
    }

    return data as TenantResolutionResult;
  } catch (error) {
    console.error('Error resolving tenant:', error);
    return null;
  }
}

export async function addTenantToProperty(params: {
  landlordUserId: string;
  propertyId: string;
  tenantEmail: string;
  tenantName?: string;
  unitId?: string;
  subUnitId?: string;
  linkStartDate?: string;
}): Promise<DbTenantPropertyLink | null> {
  try {
    const property = await fetchPropertyById(params.propertyId);
    if (!property) {
      console.error('Property not found');
      return null;
    }

    // If property doesn't have user_id set, set it to the landlord
    if (!property.user_id) {
      console.log('⚠️ Property has no user_id, setting to landlord:', params.landlordUserId);
      await supabase
        .from('properties')
        .update({ user_id: params.landlordUserId })
        .eq('id', params.propertyId);
      console.log('✅ Property user_id updated');
    } else if (property.user_id !== params.landlordUserId) {
      console.error('Property is owned by different landlord');
      return null;
    }

    const tenant = await resolveTenantByEmail(params.tenantEmail, params.tenantName);
    if (!tenant?.tenantId) {
      return null;
    }

    // Always set status to active for landlord-added tenants
    const status = 'active';

    // First, ensure tenant record exists in tenants table with active status
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id, user_id, landlord_id')
      .eq('user_id', tenant.tenantId)
      .maybeSingle();

    if (existingTenant) {
      // Update existing tenant to active
      await supabase
        .from('tenants')
        .update({
          status: 'active',
          landlord_id: params.landlordUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTenant.id);
      console.log('✅ Updated tenant status to active in tenants table');
    } else {
      // Create new tenant record
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name, phone')
        .eq('id', tenant.tenantId)
        .maybeSingle();

      await supabase
        .from('tenants')
        .insert({
          user_id: tenant.tenantId,
          landlord_id: params.landlordUserId,
          email: profile?.email || params.tenantEmail,
          first_name: profile?.full_name?.split(' ')[0] || params.tenantName?.split(' ')[0] || '',
          last_name: profile?.full_name?.split(' ').slice(1).join(' ') || params.tenantName?.split(' ').slice(1).join(' ') || '',
          phone: profile?.phone || '',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      console.log('✅ Created new tenant record with active status');
    }

    const { data, error } = await supabase
      .from('tenant_property_links')
      .upsert(
        {
          tenant_id: tenant.tenantId,
          landlord_id: params.landlordUserId,
          property_id: params.propertyId,
          unit_id: params.unitId || null,
          sub_unit_id: params.subUnitId || null,
          status,
          created_via: 'landlord_invite',
          created_by_user_id: params.landlordUserId,
          link_start_date: params.linkStartDate || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,property_id,unit_id,sub_unit_id' }
      )
      .select()
      .single();

    console.log('✅ Tenant property link created:', {
      status: status,
      landlord_id: params.landlordUserId,
      tenant_id: tenant.tenantId,
      link_data: data
    });

    if (error) {
      console.error('Error creating tenant-property link:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error adding tenant to property:', error);
    return null;
  }
}

export async function createLeaseWithTenant(params: {
  landlordUserId: string;
  propertyId: string;
  unitId?: string;
  subUnitId?: string;
  tenantEmail: string;
  tenantName?: string;
  applicationId?: string;
  formData?: OntarioLeaseFormData;
  status?: LeaseStatus;
  effectiveDate?: string;
  expiryDate?: string;
}): Promise<DbLease | null> {
  try {
    const property = await fetchPropertyById(params.propertyId);
    if (!property || property.user_id !== params.landlordUserId) {
      console.error('Property not found or not owned by landlord.');
      return null;
    }

    const tenant = await resolveTenantByEmail(params.tenantEmail, params.tenantName);
    if (!tenant?.tenantId) {
      return null;
    }

    await supabase
      .from('tenant_property_links')
      .upsert(
        {
          tenant_id: tenant.tenantId,
          property_id: params.propertyId,
          unit_id: params.unitId || null,
          sub_unit_id: params.subUnitId || null,
          status: 'active',
          created_via: 'lease_creation',
          created_by_user_id: params.landlordUserId,
          link_start_date: params.effectiveDate || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,property_id,unit_id,sub_unit_id' }
      );

    // Set tenant to active when creating lease
    await supabase
      .from('tenants')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', tenant.tenantId);
    
    console.log('✅ Tenant set to active upon lease creation');

    const { data, error } = await supabase
      .from('leases')
      .insert({
        user_id: params.landlordUserId,
        property_id: params.propertyId,
        unit_id: params.unitId || null,
        tenant_id: tenant.tenantId,
        application_id: params.applicationId || null,
        status: params.status || 'generated',
        form_data: params.formData || null,
        effective_date: params.effectiveDate || null,
        expiry_date: params.expiryDate || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lease:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating lease with tenant:', error);
    return null;
  }
}

export async function submitPropertyApplication(params: {
  tenantUserId: string;
  propertyId: string;
  unitId?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  formData?: Record<string, any>;
}): Promise<DbApplication | null> {
  try {
    const { data, error } = await supabase
      .from('applications')
      .insert({
        user_id: params.tenantUserId,
        property_id: params.propertyId,
        unit_id: params.unitId || null,
        applicant_name: params.applicantName,
        applicant_email: params.applicantEmail,
        applicant_phone: params.applicantPhone || null,
        status: 'submitted',
        form_data: params.formData || null,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting application:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error submitting application:', error);
    return null;
  }
}

export async function approvePropertyApplication(params: {
  applicationId: string;
  landlordUserId: string;
  unitId?: string;
  subUnitId?: string;
}): Promise<{ application: DbApplication; link: DbTenantPropertyLink } | null> {
  try {
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', params.applicationId)
      .single();

    if (appError || !application) {
      console.error('Error fetching application:', appError);
      return null;
    }

    if (!application.property_id) {
      console.error('Application missing property id.');
      return null;
    }

    const property = await fetchPropertyById(application.property_id);
    if (!property || property.user_id !== params.landlordUserId) {
      console.error('Property not found or not owned by landlord.');
      return null;
    }

    const tenantId = application.user_id;
    const { data: link, error: linkError } = await supabase
      .from('tenant_property_links')
      .upsert(
        {
          tenant_id: tenantId,
          property_id: application.property_id,
          unit_id: params.unitId || application.unit_id || null,
          sub_unit_id: params.subUnitId || null,
          status: 'active',
          created_via: 'application_approval',
          created_by_user_id: params.landlordUserId,
          link_start_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,property_id,unit_id,sub_unit_id' }
      )
      .select()
      .single();

    if (linkError || !link) {
      console.error('Error creating tenant-property link:', linkError);
      return null;
    }

    const { data: updatedApp, error: updateError } = await supabase
      .from('applications')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.applicationId)
      .select()
      .single();

    if (updateError || !updatedApp) {
      console.error('Error updating application status:', updateError);
      return null;
    }

    return { application: updatedApp, link };
  } catch (error) {
    console.error('Error approving application:', error);
    return null;
  }
}

export async function inviteTenantToProperty(params: {
  propertyId: string;
  tenantEmail: string;
  tenantName?: string;
  unitId?: string;
  subUnitId?: string;
  expiresInHours?: number;
  autoActivate?: boolean; // Set to true to immediately activate the tenant (for approved applicants)
  rentAmount?: number; // Monthly rent amount
}): Promise<{ inviteId?: string; token?: string; notificationQueued?: boolean; emailQueued?: boolean; error?: string } | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: 'Supabase credentials are missing in env.' };
    }

    if (!accessToken) {
      return { error: 'No auth session found. Please sign in again.' };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/invite-tenant`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const rawText = await response.text();
    if (!response.ok) {
      let message = rawText || `Invite failed with status ${response.status}`;
      try {
        const parsed = JSON.parse(rawText);
        message = parsed?.error || parsed?.message || message;
      } catch {
        // keep raw text
      }
      console.error('Error inviting tenant:', { message, status: response.status, rawText });
      return { error: `${message} (status ${response.status})` };
    }

    const data = rawText ? JSON.parse(rawText) : {};
    return { 
      inviteId: data?.inviteId, 
      token: data?.token,
      notificationQueued: data?.notificationQueued,
      emailQueued: data?.emailQueued,
    };
  } catch (error) {
    console.error('Error inviting tenant:', error);
    return null;
  }
}

// Invite applicant to property (similar to tenant invite but for applicants)
export async function inviteApplicantToProperty(params: {
  propertyId: string;
  applicantEmail: string;
  applicantName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  unitId?: string;
  subUnitId?: string;
}): Promise<{ inviteId?: string; token?: string; notificationQueued?: boolean; emailQueued?: boolean; error?: string } | null> {
  try {
    console.log('🚀 inviteApplicantToProperty called with params:', JSON.stringify(params, null, 2));
    
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: 'Supabase credentials are missing in env.' };
    }

    if (!accessToken) {
      return { error: 'No auth session found. Please sign in again.' };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/invite-applicant`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const rawText = await response.text();
    console.log('📥 Raw response text:', rawText);
    
    if (!response.ok) {
      let message = rawText || `Invite failed with status ${response.status}`;
      try {
        const parsed = JSON.parse(rawText);
        message = parsed?.error || parsed?.message || message;
      } catch {
        // keep raw text
      }
      console.error('❌ Error inviting applicant:', { message, status: response.status, rawText });
      return { error: `${message} (status ${response.status})` };
    }

    const data = rawText ? JSON.parse(rawText) : {};
    console.log('✅ Parsed applicant invite response:', JSON.stringify(data, null, 2));
    
    return { 
      inviteId: data?.inviteId, 
      token: data?.token,
      notificationQueued: data?.notificationQueued,
      emailQueued: data?.emailQueued,
    };
  } catch (error) {
    console.error('❌ Unexpected error inviting applicant:', error);
    return null;
  }
}

export async function getInviteDetails(params: {
  token: string;
  tenantEmail?: string;
}): Promise<InviteDetails | null> {
  try {
    const searchParams = new URLSearchParams({ token: params.token });
    if (params.tenantEmail) {
      searchParams.append('tenant_email', params.tenantEmail);
    }
    const { data, error } = await supabase.functions.invoke(
      `get-invite?${searchParams.toString()}`,
      { method: 'GET' }
    );

    if (error) {
      console.error('Error fetching invite details:', error);
      return null;
    }

    return data as InviteDetails;
  } catch (error) {
    console.error('Error fetching invite details:', error);
    return null;
  }
}

export async function acceptInvite(token: string): Promise<{ inviteStatus: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      `accept-invite?token=${encodeURIComponent(token)}`
    );

    if (error) {
      console.error('Error accepting invite:', error);
      return null;
    }

    return { inviteStatus: data?.inviteStatus };
  } catch (error) {
    console.error('Error accepting invite:', error);
    return null;
  }
}

export async function declineInvite(token: string): Promise<{ inviteStatus: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      `decline-invite?token=${encodeURIComponent(token)}`
    );

    if (error) {
      console.error('Error declining invite:', error);
      return null;
    }

    return { inviteStatus: data?.inviteStatus };
  } catch (error) {
    console.error('Error declining invite:', error);
    return null;
  }
}

// =====================================================
// TRANSACTION API FUNCTIONS (for Accounting)
// =====================================================

// Database Transaction type
// Flexible structure based on property type:
// - Single Unit Property: property_id + subunit_id (rooms)
// - Multi-Unit Property: property_id + unit_id + subunit_id (if room exists)
// - Parking/Commercial: property_id only
// - With Tenant: tenant_id
// - With Lease: lease_id
export interface DbTransaction {
  id: string;
  user_id: string;
  property_id?: string;        // Always present if attached to property
  unit_id?: string;            // Present for multi-unit properties
  subunit_id?: string;         // Present for rooms/sub-units
  tenant_id?: string;          // If transaction is tied to a tenant
  lease_id?: string;           // If transaction is tied to a lease
  type: 'income' | 'expense';
  category: 'rent' | 'garage' | 'parking' | 'utility' | 'maintenance' | 'other';
  amount: number;
  date: string;
  description?: string;
  service_type?: string;
  status: 'paid' | 'pending' | 'overdue';
  created_at: string;
  updated_at: string;
}

// Fetch all transactions for the current user
export async function fetchTransactions(userId: string): Promise<DbTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ transactions table not found. Using local data.');
        return [];
      }
      console.error('Error fetching transactions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

// Fetch a single transaction by ID
export async function fetchTransactionById(transactionId: string): Promise<DbTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ transactions table not found.');
        return null;
      }
      console.error('Error fetching transaction:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return null;
  }
}

// Create a new transaction
export async function createTransaction(transaction: Omit<DbTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<DbTransaction | null> {
  try {
    // Only include subunit_id if it's provided and not empty
    const dataToInsert: any = {
      user_id: transaction.user_id,
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount,
      date: transaction.date,
      status: transaction.status || 'paid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add optional fields only if they exist
    if (transaction.property_id) dataToInsert.property_id = transaction.property_id;
    if (transaction.unit_id) dataToInsert.unit_id = transaction.unit_id;
    // Skip subunit_id for now since subunits table might be empty
    // if (transaction.subunit_id) dataToInsert.subunit_id = transaction.subunit_id;
    if (transaction.tenant_id) dataToInsert.tenant_id = transaction.tenant_id;
    if (transaction.lease_id) dataToInsert.lease_id = transaction.lease_id;
    if (transaction.description) dataToInsert.description = transaction.description;
    if (transaction.service_type) dataToInsert.service_type = transaction.service_type;

    const { data, error } = await supabase
      .from('transactions')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      return null;
    }

    // If this transaction is for a tenant, update their profile with latest data
    if (transaction.tenant_id && transaction.property_id) {
      try {
        await updateTenantProfileWithTransaction(
          transaction.tenant_id,
          transaction.property_id,
          transaction.unit_id,
          transaction.subunit_id
        );
      } catch (updateError) {
        console.warn('Warning: Could not update tenant profile:', updateError);
        // Don't fail the transaction creation if profile update fails
      }
    }

    return data;
  } catch (error) {
    console.error('Error creating transaction:', error);
    return null;
  }
}

// Update a transaction
export async function updateTransactionInDb(transactionId: string, updates: Partial<DbTransaction>): Promise<DbTransaction | null> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating transaction:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating transaction:', error);
    return null;
  }
}

// Delete a transaction
export async function deleteTransactionFromDb(transactionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      console.error('Error deleting transaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }
}

// Find active lease for a property/unit/subunit
export async function findActiveLease(
  propertyId: string,
  unitId?: string,
  subunitId?: string
): Promise<DbLease | null> {
  try {
    let query = supabase
      .from('leases')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'signed') // Only signed leases are active
      .gte('expiry_date', new Date().toISOString()); // Not expired

    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    // Note: subunit matching would need to be in form_data JSONB
    // For now, we match by property/unit
    
    const { data, error } = await query.limit(1).single();

    if (error) {
      if (error.code !== 'PGRST116') { // Not found is OK
        console.error('Error finding active lease:', error);
      }
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error finding active lease:', error);
    return null;
  }
}

// Aggregate transactions for accounting dashboard
export interface TransactionAggregates {
  totalIncome: number;
  totalExpense: number;
  chartData: Array<{ date: string; income: number; expense: number }>;
}

export async function getTransactionAggregates(
  userId: string, 
  startDate?: string, 
  endDate?: string
): Promise<TransactionAggregates> {
  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ transactions table not found.');
      } else {
        console.error('Error fetching transaction aggregates:', error);
      }
      return { totalIncome: 0, totalExpense: 0, chartData: [] };
    }

    const transactions = data || [];

    // Calculate totals (only from paid transactions)
    const paidTransactions = transactions.filter(t => t.status === 'paid');
    const totalIncome = paidTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = paidTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Group all transactions by date for chart (last 7 days)
    const chartDataMap = new Map<string, { income: number; expense: number }>();
    
    transactions.forEach(t => {
      const date = t.date.split('T')[0]; // Get YYYY-MM-DD
      const existing = chartDataMap.get(date) || { income: 0, expense: 0 };
      
      if (t.type === 'income') {
        existing.income += t.amount;
      } else {
        existing.expense += t.amount;
      }
      
      chartDataMap.set(date, existing);
    });

    const chartData = Array.from(chartDataMap.entries())
      .map(([date, amounts]) => ({ date, ...amounts }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days

    return { totalIncome, totalExpense, chartData };
  } catch (error) {
    console.error('Error calculating transaction aggregates:', error);
    return { totalIncome: 0, totalExpense: 0, chartData: [] };
  }
}

// Fetch transactions for a specific tenant (ledger)
export async function fetchTenantTransactions(tenantId: string): Promise<DbTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ transactions table not found.');
        return [];
      }
      if (error.code === '42703') {
        console.warn('⚠️ tenant_id column not found in transactions table. Run ADD_TENANT_ID_MIGRATION.sql');
        return [];
      }
      console.error('Error fetching tenant transactions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching tenant transactions:', error);
    return [];
  }
}

// Get lease status for a tenant (returns 'active', 'inactive', or 'pending')
export async function getTenantLeaseStatus(tenantId: string): Promise<'active' | 'inactive' | 'pending'> {
  try {
    const leases = await fetchLeasesByTenant(tenantId);
    
    if (leases.length === 0) {
      return 'inactive';
    }

    // Check for signed and active lease
    const now = new Date();
    const activeLease = leases.find(lease => 
      lease.status === 'signed' && 
      (!lease.expiry_date || new Date(lease.expiry_date) > now)
    );

    if (activeLease) {
      return 'active';
    }

    // Check for pending leases (sent but not signed)
    const pendingLease = leases.find(lease => 
      lease.status === 'sent' || lease.status === 'generated' || lease.status === 'uploaded'
    );

    if (pendingLease) {
      return 'pending';
    }

    return 'inactive';
  } catch (error) {
    console.error('Error getting tenant lease status:', error);
    return 'inactive';
  }
}

// Dashboard metrics interface
export interface DashboardMetrics {
  activeLeases: number;
  totalRentableUnits: number;
  rentedUnits: number;
  occupancyPercentage: number;
}

// Get dashboard metrics for landlord
export async function getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  try {
    // Fetch leases, tenants, and properties
    const [leases, tenants, propertiesData] = await Promise.all([
      fetchLeases(userId),
      fetchTenants(userId),
      supabase.from('properties').select('*, units(*, sub_units(*))').eq('user_id', userId)
    ]);

    console.log('📊 Dashboard Metrics - Fetched:', {
      leases: leases.length,
      tenants: tenants.length,
      properties: propertiesData.data?.length || 0
    });

    const now = new Date();
    
    // Helper function to check if lease is active
    const isLeaseActive = (lease: any) => {
      const isCancelled = lease.status === 'cancelled' || lease.status === 'rejected' || lease.status === 'terminated';
      const hasExpired = lease.expiry_date && new Date(lease.expiry_date) < now;
      return !isCancelled && !hasExpired;
    };

    // Helper function to check if tenant is active and assigned
    const isTenantActive = (tenant: any) => {
      return tenant.status === 'active' && !!tenant.property_id;
    };

    // Count active leases and active tenants
    const activeLeasesCount = leases.filter(isLeaseActive).length;
    const activeTenantsCount = tenants.filter(isTenantActive).length;
    const activeLeases = Math.max(activeLeasesCount, activeTenantsCount);

    console.log('✅ Active count - Leases:', activeLeasesCount, '| Tenants:', activeTenantsCount, '| Combined:', activeLeases);

    // Count rentable units
    let totalRentableUnits = 0;
    let rentedUnits = 0;
    const occupiedUnitIds = new Set<string>();

    // Mark units occupied by leases
    leases.filter(isLeaseActive).forEach(lease => {
      if (lease.unit_id) {
        occupiedUnitIds.add(lease.unit_id);
      } else if (lease.property_id) {
        occupiedUnitIds.add(lease.property_id); // If no unit_id, mark property as occupied
      }
    });

    // Mark units occupied by active tenants
    tenants.filter(isTenantActive).forEach(tenant => {
      if (tenant.unit_id) {
        occupiedUnitIds.add(tenant.unit_id);
      } else if (tenant.property_id) {
        occupiedUnitIds.add(tenant.property_id);
      }
    });

    if (propertiesData.data) {
      for (const property of propertiesData.data) {
        if (!property.units || property.units.length === 0) {
          // Property with no units = 1 rentable unit
          totalRentableUnits += 1;
          if (occupiedUnitIds.has(property.id)) {
            rentedUnits += 1;
          }
        } else {
          // Property has units
          for (const unit of property.units) {
            if (!unit.sub_units || unit.sub_units.length === 0) {
              // Unit with no subunits = 1 rentable unit
              totalRentableUnits += 1;
              if (occupiedUnitIds.has(unit.id)) {
                rentedUnits += 1;
              }
            } else {
              // Unit has subunits - count each subunit
              totalRentableUnits += unit.sub_units.length;
              // Count rented subunits
              const unitOccupancy = unit.sub_units.filter((su: any) => occupiedUnitIds.has(su.id)).length;
              rentedUnits += unitOccupancy;
            }
          }
        }
      }
    }

    const occupancyPercentage = totalRentableUnits > 0 
      ? Math.round((rentedUnits / totalRentableUnits) * 100) 
      : 0;

    console.log(`📈 Metrics - Active: ${activeLeases}, Rented: ${rentedUnits}/${totalRentableUnits}, Occupancy: ${occupancyPercentage}%`);

    return {
      activeLeases,
      totalRentableUnits,
      rentedUnits,
      occupancyPercentage,
    };
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    return {
      activeLeases: 0,
      totalRentableUnits: 0,
      rentedUnits: 0,
      occupancyPercentage: 0,
    };
  }
}

// Rent collection summary interface
export interface RentCollectionSummary {
  totalExpected: number;
  paid: number;
  pending: number;
  overdue: number;
}

// Get rent collection summary for current month
export async function getRentCollectionSummary(userId: string): Promise<RentCollectionSummary> {
  try {
    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    // Fetch rent transactions for current month
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'income')
      .eq('category', 'rent')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (error) {
      console.error('Error fetching rent collection:', error);
      return { totalExpected: 0, paid: 0, pending: 0, overdue: 0 };
    }

    const transactions = data || [];
    
    const paid = transactions
      .filter(t => t.status === 'paid')
      .reduce((sum, t) => sum + t.amount, 0);

    const pending = transactions
      .filter(t => t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0);

    const overdue = transactions
      .filter(t => t.status === 'overdue')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpected = paid + pending + overdue;

    return { totalExpected, paid, pending, overdue };
  } catch (error) {
    console.error('Error getting rent collection summary:', error);
    return { totalExpected: 0, paid: 0, pending: 0, overdue: 0 };
  }
}

// =====================================================
// LEASE API FUNCTIONS
// =====================================================

export type LeaseStatus = 'draft' | 'generated' | 'uploaded' | 'sent' | 'signed';

// Ontario Lease Form Data Structure (maps to standard lease sections)
export interface OntarioLeaseFormData {
  // Section 1: Parties
  landlordName: string;
  landlordAddress?: string;
  tenantNames: string[];
  tenantEmails?: string[];
  
  // Section 2: Rental Unit
  unitAddress: {
    unit?: string;
    streetNumber: string;
    streetName: string;
    city: string;
    province: string;
    postalCode: string;
  };
  parkingDescription?: string;
  isCondo: boolean;
  
  // Section 3: Contact Information
  landlordNoticeAddress: string;
  allowEmailNotices: boolean;
  landlordEmail?: string;
  emergencyContactPhone: string;
  
  // Section 4: Term
  tenancyStartDate: string; // ISO date
  tenancyEndDate?: string; // ISO date (for fixed term)
  tenancyType: 'fixed' | 'month_to_month';
  paymentFrequency: 'monthly' | 'weekly' | 'daily';
  
  // Section 5: Rent
  rentPaymentDay: number; // Day of month (1-31)
  baseRent: number;
  parkingRent?: number;
  otherServicesRent?: number;
  otherServicesDescription?: string;
  rentPayableTo: string;
  paymentMethod: 'etransfer' | 'cheque' | 'cash' | 'other';
  chequeBounceCharge?: number;
  partialRentAmount?: number;
  partialRentFromDate?: string;
  partialRentToDate?: string;
  
  // Section 6: Services and Utilities
  utilities?: {
    electricity: 'landlord' | 'tenant';
    heat: 'landlord' | 'tenant';
    water: 'landlord' | 'tenant';
    gas?: boolean;
    airConditioning?: boolean;
    additionalStorage?: boolean;
    laundry?: 'none' | 'included' | 'payPerUse';
    guestParking?: 'none' | 'included' | 'payPerUse';
  };
  servicesDescription?: string;
  utilitiesDescription?: string;
  
  // Section 7: Rent Discounts
  hasRentDiscount?: boolean;
  rentDiscountDescription?: string;
  
  // Section 8: Rent Deposit
  requiresRentDeposit?: boolean;
  rentDepositAmount?: number;
  
  // Section 9: Key Deposit
  requiresKeyDeposit?: boolean;
  keyDepositAmount?: number;
  keyDepositDescription?: string;
  
  // Section 10: Smoking
  smokingRules?: 'none' | 'prohibited' | 'allowed' | 'designated';
  smokingRulesDescription?: string;
  
  // Section 11: Tenant's Insurance
  requiresTenantInsurance?: boolean;
  
  // Section 12-15: Additional Terms
  additionalTerms?: string;
  specialConditions?: string;
  
  // Section 16-17: Signatures
  signatureDate?: string;
}

// Lease document metadata
export interface DbLeaseDocument {
  id: string;
  lease_id: string;
  file_url: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  file_size: number;
  version: number;
  is_current: boolean;
  uploaded_by: string;
  created_at: string;
}

// Main Lease entity
export interface DbLease {
  id: string;
  user_id: string; // Landlord/PM who created
  property_id: string;
  unit_id?: string; // Optional - for multi-unit properties
  tenant_id?: string; // Tenant assigned to this lease
  application_id?: string; // Link to application if created from approved application
  
  status: 'draft' | 'generated' | 'uploaded' | 'sent' | 'signed' | 'signed_pending_move_in' | 'active' | 'terminated';
  
  // NEW FIELDS FOR VERSIONING
  original_pdf_url?: string;
  signed_pdf_url?: string;
  version?: number;
  
  // Ontario lease form data (stored as JSONB)
  form_data?: OntarioLeaseFormData;
  
  // Document metadata
  document_url?: string;
  document_storage_key?: string;
  
  // Dates
  effective_date?: string;
  expiry_date?: string;
  signed_date?: string;
  
  created_at: string;
  updated_at: string;
}

// Fetch all leases for a user
export async function fetchLeases(userId: string): Promise<DbLease[]> {
  try {
    const { data, error } = await supabase
      .from('leases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ leases table not found. Using local data.');
        return [];
      }
      console.error('Error fetching leases:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching leases:', error);
    return [];
  }
}

// Fetch leases by property
export async function fetchLeasesByProperty(propertyId: string): Promise<DbLease[]> {
  try {
    const { data, error } = await supabase
      .from('leases')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leases by property:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching leases by property:', error);
    return [];
  }
}

// Fetch leases by tenant
export async function fetchLeasesByTenant(tenantId: string): Promise<DbLease[]> {
  try {
    console.log('🔍 Fetching leases for user:', tenantId);
    
    // Get user's email from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', tenantId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    const userEmail = profile?.email;
    console.log('📧 User email:', userEmail);
    
    // First, get leases where user is directly the tenant
    const { data: tenantLeases, error: tenantError } = await supabase
      .from('leases')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (tenantError) {
      console.error('Error fetching tenant leases:', tenantError);
    }

    console.log('📄 Direct tenant leases:', tenantLeases?.length || 0);

    // Second, get leases associated with user's applications
    const { data: applications, error: appError } = await supabase
      .from('applications')
      .select('id, applicant_email')
      .eq('user_id', tenantId);

    if (appError) {
      console.error('Error fetching applications:', appError);
    }

    console.log('📋 User applications:', applications?.length || 0, applications);

    let applicationLeases: DbLease[] = [];
    if (applications && applications.length > 0) {
      const applicationIds = applications.map(app => app.id);
      
      const { data: appLeases, error: appLeasesError } = await supabase
        .from('leases')
        .select('*')
        .in('application_id', applicationIds)
        .order('created_at', { ascending: false });

      if (appLeasesError) {
        console.error('Error fetching application leases:', appLeasesError);
      } else {
        applicationLeases = appLeases || [];
        console.log('📄 Application-based leases:', applicationLeases.length);
      }
    }

    // Third, get leases by email match (for applicants who haven't been linked yet)
    let emailLeases: DbLease[] = [];
    if (userEmail) {
      // Find all invitations matching email
      const { data: invitations, error: invError } = await supabase
        .from('tenant_invitations')
        .select('lease_id')
        .eq('email', userEmail);
        
      if (!invError && invitations && invitations.length > 0) {
        const leaseIds = invitations.map(inv => inv.lease_id).filter(Boolean);
        if (leaseIds.length > 0) {
          const { data: invLeases, error: lError } = await supabase
            .from('leases')
            .select('*')
            .in('id', leaseIds);
          if (!lError && invLeases) {
            emailLeases = invLeases;
            console.log('📄 Invited leases matching email:', emailLeases.length);
          }
        }
      }
    }

    // Combine and deduplicate leases
    const allLeases = [...(tenantLeases || []), ...applicationLeases, ...emailLeases];
    const uniqueLeases = Array.from(
      new Map(allLeases.map(lease => [lease.id, lease])).values()
    );

    console.log('✅ Total unique leases for user:', uniqueLeases.length);
    return uniqueLeases;
  } catch (error) {
    console.error('Error fetching leases by tenant:', error);
    return [];
  }
}

// Fetch a single lease by ID
export async function fetchLeaseById(leaseId: string): Promise<DbLease | null> {
  try {
    console.log('🔍 Fetching lease by ID:', leaseId);
    
    const { data, error } = await supabase
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .single();

    if (error) {
      console.error('❌ Error fetching lease:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      if (error.code === 'PGRST116') {
        console.error('❌ Lease not found with ID:', leaseId);
      } else if (error.code === '42501') {
        console.error('❌ Permission denied - check RLS policies');
      }
      
      return null;
    }

    console.log('✅ Lease found:', data.id, 'Status:', data.status);
    return data;
  } catch (error) {
    console.error('❌ Exception fetching lease:', error);
    return null;
  }
}

// Create a new lease (draft)
export async function createLease(lease: Omit<DbLease, 'id' | 'created_at' | 'updated_at'>): Promise<DbLease | null> {
  try {
    const { data, error } = await supabase
      .from('leases')
      .insert({
        ...lease,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lease:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating lease:', error);
    return null;
  }
}

// Convert approved applicant to tenant after lease signing
export async function convertApplicantToTenant(params: {
  applicationId: string;
  propertyId: string;
  unitId?: string;
  subUnitId?: string;
  leaseId: string;
  startDate?: string;
  rentAmount?: number;
}): Promise<{ tenant: DbTenant; activationStatus: 'active' | 'pending_move_in' } | null> {
  try {
    console.log('🔄 Starting applicant to tenant conversion:', params);
    
    // 0. Get current authenticated user (landlord)
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      console.error('❌ No authenticated user found');
      throw new Error('Authentication required');
    }
    console.log('✅ Current user (landlord):', currentUser.id);
    
    // 0.5. Check if lease already has a tenant (already converted)
    const { data: existingLease, error: leaseCheckError } = await supabase
      .from('leases')
      .select('tenant_id')
      .eq('id', params.leaseId)
      .single();
    
    if (existingLease?.tenant_id) {
      console.error('❌ This application has already been converted to a tenant');
      throw new Error('This applicant has already been converted to a tenant. Please refresh the page.');
    }
    
    // 1. Get application data
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', params.applicationId)
      .single();

    if (appError || !application) {
      console.error('❌ Error fetching application:', appError);
      throw new Error('Application not found');
    }

    console.log('✅ Application found:', {
      id: application.id,
      email: application.applicant_email,
      name: application.applicant_name,
    });

    // 2. Resolve the applicant auth user id
    let userId = application.user_id || null;

    if (userId) {
      console.log('✅ Found applicant user_id on application:', userId);
    } else {
      const { data: existingUser, error: profileLookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', application.applicant_email)
        .maybeSingle();

      if (profileLookupError) {
        console.error('❌ Error looking up profile by email:', profileLookupError);
        throw new Error(`Failed to look up applicant profile: ${profileLookupError.message}`);
      }

      if (existingUser?.id) {
        userId = existingUser.id;
        console.log('✅ Found existing user profile:', userId);
      } else {
        console.log('⚠️ No user profile found for email:', application.applicant_email);
      }
    }

    if (!userId) {
      console.error('❌ No auth user found for applicant:', application.applicant_email);
      throw new Error(
        'Applicant does not have an account yet. They must sign up and log in before being converted to a tenant.'
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const moveInDate = params.startDate || today;
    
    // As per new Flow rules, do NOT auto-activate a tenant/link on lease signing
    // Action MUST await landlord approval, then wait for Move In Date hook.
    const shouldActivateNow = false;

    // 3. Create tenant record
    console.log('🔄 Creating tenant record...');
    const tenantData = {
      user_id: userId,
      first_name: application.applicant_name?.split(' ')[0] || '',
      last_name: application.applicant_name?.split(' ').slice(1).join(' ') || '',
      email: application.applicant_email,
      phone: application.applicant_phone || '',
      property_id: params.propertyId,
      unit_id: params.unitId,
      start_date: params.startDate,
      rent_amount: params.rentAmount,
      status: shouldActivateNow ? 'active' : 'inactive',
    };
    console.log('📋 Tenant data to insert:', tenantData);
    
    // Check if tenant already exists for this email + property combo
    const { data: existingTenants } = await supabase
      .from('tenants')
      .select('id, status')
      .eq('email', application.applicant_email)
      .eq('property_id', params.propertyId)
      .limit(2);
    
    if (existingTenants && existingTenants.length > 0) {
      const activeTenant = existingTenants.find(t => t.status === 'active');
      if (activeTenant) {
        console.error('❌ Active tenant already exists for this email/property');
        throw new Error('This applicant has already been converted to a tenant.');
      }
      console.log('⚠️ Inactive tenant exists, creating new tenant record');
    }
    
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert(tenantData)
      .select()
      .single();

    if (tenantError) {
      console.error('❌ Error creating tenant:', tenantError);
      console.error('❌ Tenant error details:', JSON.stringify(tenantError, null, 2));
      throw new Error(`Failed to create tenant: ${tenantError.message}`);
    }

    console.log('✅ Tenant created successfully:', tenant.id);

    // 4. Create tenant_property_links record
    console.log('🔄 Creating tenant_property_links record...');
    const linkData = {
      tenant_id: tenant.id,
      property_id: params.propertyId,
      unit_id: params.unitId,
      status: shouldActivateNow ? 'active' : 'inactive', // Changed from pending_invite to inactive because the link isn't active until Move-In Date
      created_via: 'lease_creation',
      created_by_user_id: currentUser.id, // Use the current authenticated landlord's ID
      link_start_date: moveInDate,
    };
    console.log('📋 Link data to insert:', linkData);
    
    const { data: linkResult, error: linkError } = await supabase
      .from('tenant_property_links')
      .insert(linkData)
      .select();

    if (linkError) {
      console.error('❌ Error creating tenant_property_links:', linkError);
      console.error('❌ Link error details:', JSON.stringify(linkError, null, 2));
      
      // Check if it's a duplicate key error (tenant already linked to this property)
      if (linkError.code === '23505') {
        console.error('❌ Tenant is already linked to this property');
        await supabase.from('tenants').delete().eq('id', tenant.id);
        throw new Error('This tenant is already linked to the property. Please check the tenant list.');
      }
      
      // For other errors, clean up the tenant and fail the conversion
      console.error('❌ Tenant was created but link failed - cleaning up tenant record');
      await supabase.from('tenants').delete().eq('id', tenant.id);
      
      throw new Error(`Failed to link tenant to property: ${linkError.message || 'Unknown error'}`);
    }
    
    console.log('✅ Tenant property link created successfully');

    // 5.5. Create co-tenant records for co-applicants
    console.log('🔄 Creating co-tenant records for co-applicants...');
    const { data: coApplicants, error: coAppError } = await supabase
      .from('co_applicants')
      .select('*')
      .eq('application_id', params.applicationId)
      .order('applicant_order', { ascending: true });

    if (!coAppError && coApplicants && coApplicants.length > 0) {
      console.log(`📋 Found ${coApplicants.length} co-applicants to convert`);
      
      // Get the tenant_property_link id we just created
      const tenantLinkId = linkResult[0].id;
      
      const coTenantRecords = coApplicants.map(coApp => ({
        tenant_id: tenantLinkId,
        property_id: params.propertyId,
        full_name: coApp.full_name,
        email: coApp.email,
        phone: coApp.phone,
        co_applicant_id: coApp.id,
      }));

      const { error: coTenantError } = await supabase
        .from('co_tenants')
        .insert(coTenantRecords);

      if (coTenantError) {
        console.error('⚠️ Error creating co-tenant records:', coTenantError);
        // Don't fail the whole conversion if co-tenants fail
      } else {
        console.log(`✅ Created ${coTenantRecords.length} co-tenant records`);
      }
    } else {
      console.log('ℹ️ No co-applicants found for this application');
    }

    // 5. Update lease with tenant_id AND mark as signed_pending_move_in
    console.log('🔄 Updating lease with tenant_id and signed_pending_move_in status...');
    const { error: leaseUpdateError } = await supabase
      .from('leases')
      .update({ 
        tenant_id: tenant.id,
        status: 'signed_pending_move_in',
        signed_date: new Date().toISOString(),
      })
      .eq('id', params.leaseId);

    if (leaseUpdateError) {
      console.error('❌ Error updating lease with tenant_id:', leaseUpdateError);
      console.error('❌ Lease update error details:', JSON.stringify(leaseUpdateError, null, 2));
      // Continue anyway - tenant was created successfully
    } else {
      console.log('✅ Lease updated with tenant_id and signed status');
    }

    // 5.1 If move-in is today/past, make this the active tenancy now and retire old links for same user
    if (shouldActivateNow) {
      const { data: allTenantRecords } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', userId);

      const allTenantIds = (allTenantRecords || []).map((row: any) => row.id);
      const oldTenantIds = allTenantIds.filter((tenantId: string) => tenantId !== tenant.id);

      if (oldTenantIds.length > 0) {
        await supabase
          .from('tenant_property_links')
          .update({
            status: 'removed',
            link_end_date: today,
            updated_at: new Date().toISOString(),
          })
          .in('tenant_id', oldTenantIds)
          .eq('status', 'active');

        await supabase
          .from('tenants')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString(),
          })
          .in('id', oldTenantIds)
          .eq('status', 'active');
      }
    }

    // 6. Update the application (converted to tenant profile but keep application for move-in flow)
    console.log('🔄 Updating application instead of deleting...');
    const { error: appUpdateError } = await supabase
      .from('applications')
      .update({ 
        status: 'lease_signed',
        proposed_move_in_date: moveInDate,
        move_in_status: 'pending_approval'
      })
      .eq('id', params.applicationId);
      
    if (appUpdateError) {
      console.error('❌ Error updating application:', appUpdateError);
    } else {
      console.log('✅ Successfully updated application to lease_signed status');
    }

    console.log('✅ Successfully processed applicant to tenant conversion step:', tenant.id, 'status:', shouldActivateNow ? 'active' : 'pending_move_in');
    return {
      tenant,
      activationStatus: shouldActivateNow ? 'active' : 'pending_move_in',
    };
  } catch (error) {
    console.error('❌ Error converting applicant to tenant:', error);
    // Rethrow the error so the UI can display it
    throw error;
  }
}

export async function activateScheduledTenancyForUser(
  userId: string
): Promise<{ activated: boolean; tenantId?: string; propertyId?: string }> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: tenantRows, error: tenantError } = await supabase
      .from('tenants')
      .select('id, user_id, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (tenantError || !tenantRows || tenantRows.length === 0) {
      return { activated: false };
    }

    const tenantIds = tenantRows.map((row: any) => row.id);

    const { data: pendingLinks, error: pendingError } = await supabase
      .from('tenant_property_links')
      .select('id, tenant_id, property_id, status, link_start_date')
      .in('tenant_id', tenantIds)
      .eq('status', 'pending_invite')
      .lte('link_start_date', today)
      .order('link_start_date', { ascending: true })
      .limit(1);

    if (pendingError || !pendingLinks || pendingLinks.length === 0) {
      return { activated: false };
    }

    const targetLink = pendingLinks[0] as any;
    const targetTenantId = targetLink.tenant_id as string;

    const oldTenantIds = tenantIds.filter((tenantId: string) => tenantId !== targetTenantId);

    if (oldTenantIds.length > 0) {
      await supabase
        .from('tenant_property_links')
        .update({
          status: 'removed',
          link_end_date: today,
          updated_at: new Date().toISOString(),
        })
        .in('tenant_id', oldTenantIds)
        .eq('status', 'active');

      await supabase
        .from('tenants')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString(),
        })
        .in('id', oldTenantIds)
        .eq('status', 'active');
    }

    await supabase
      .from('tenant_property_links')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetLink.id);

    await supabase
      .from('tenants')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetTenantId);

    return {
      activated: true,
      tenantId: targetTenantId,
      propertyId: targetLink.property_id,
    };
  } catch (error) {
    console.error('Error activating scheduled tenancy:', error);
    return { activated: false };
  }
}

// Update a lease
export async function updateLeaseInDb(leaseId: string, updates: Partial<DbLease>): Promise<DbLease | null> {
  try {
    console.log('🔄 Updating lease:', leaseId, 'with updates:', updates);
    
    const { data, error } = await supabase
      .from('leases')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating lease:', error);
      return null;
    }

    if (!data) {
      console.error('❌ Lease update returned 0 rows - likely RLS policy blocking update. Lease ID:', leaseId);
      console.error('💡 Make sure to run FIX_LEASE_RLS_FOR_APPLICANTS.sql to allow tenants to update their leases');
      return null;
    }

    console.log('✅ Lease updated successfully:', data.id);

    // Auto-update tenant status based on lease status
    if (data && updates.status && data.tenant_id) {
      const tenantStatus = ['active', 'signed'].includes(updates.status) ? 'active' : 'inactive';
      
      console.log(`🔄 Auto-updating tenant status to '${tenantStatus}' based on lease status: ${updates.status}`);
      
      // Update tenant status in tenants table
      await supabase
        .from('tenants')
        .update({ 
          status: tenantStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.tenant_id);
      
      // Update tenant_property_links status
      await supabase
        .from('tenant_property_links')
        .update({ 
          status: tenantStatus,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', data.tenant_id)
        .eq('property_id', data.property_id);
      
      console.log(`✅ Tenant status updated to: ${tenantStatus}`);
    }

    return data;
  } catch (error) {
    console.error('Error updating lease:', error);
    return null;
  }
}

// Handle lease signing - converts applicant to tenant if needed
export async function handleLeaseSigning(params: {
  leaseId: string;
  applicationId?: string; // If this is an applicant lease
  propertyId: string;
  unitId?: string;
  subUnitId?: string;
  startDate?: string;
  rentAmount?: number;
}): Promise<{ success: boolean; tenantId?: string; activationStatus?: 'active' | 'pending_move_in'; error?: string }> {
  try {
    // If this is an applicant, convert to tenant first
    if (params.applicationId) {
      console.log('🔄 Converting applicant to tenant before signing lease...');
      const conversion = await convertApplicantToTenant({
        applicationId: params.applicationId,
        propertyId: params.propertyId,
        unitId: params.unitId,
        subUnitId: params.subUnitId,
        leaseId: params.leaseId,
        startDate: params.startDate,
        rentAmount: params.rentAmount,
      });

      if (!conversion?.tenant) {
        return { success: false, error: 'Failed to convert applicant to tenant' };
      }

      console.log('✅ Applicant converted to tenant:', conversion.tenant.id, 'activationStatus:', conversion.activationStatus);
      
      // Lease is already updated to 'signed' status in convertApplicantToTenant
      // No need to update again
      console.log('✅ Lease signing completed');

      return {
        success: true,
        tenantId: conversion.tenant.id,
        activationStatus: conversion.activationStatus,
      };
    } else {
      // Just update lease status to signed for existing tenant
      await updateLeaseInDb(params.leaseId, { status: 'signed' });
      return { success: true };
    }
  } catch (error) {
    console.error('Error handling lease signing:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process lease signing' 
    };
  }
}

export async function requestArrivalDateChange(params: {
  leaseId: string;
  tenantUserId: string;
  requestedDate: string; // YYYY-MM-DD
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select('id, user_id, property_id, effective_date, form_data')
      .eq('id', params.leaseId)
      .single();

    if (leaseError || !lease) {
      return { success: false, error: 'Lease not found' };
    }

    const baseFormData = (lease.form_data || {}) as Record<string, any>;
    const updatedFormData = {
      ...baseFormData,
      tenant_requested_arrival_date: params.requestedDate,
      arrival_date_request_status: 'requested',
      arrival_date_requested_at: new Date().toISOString(),
      landlord_arrival_date: lease.effective_date || null,
    };

    const { error: updateError } = await supabase
      .from('leases')
      .update({
        form_data: updatedFormData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.leaseId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await supabase.from('notifications').insert({
      user_id: lease.user_id,
      type: 'arrival_date_change_request',
      title: 'Arrival date change requested',
      message: `Tenant requested to change move-in date to ${params.requestedDate}.`,
      data: {
        leaseId: lease.id,
        propertyId: lease.property_id,
        requestedDate: params.requestedDate,
        landlordDate: lease.effective_date || null,
        tenantUserId: params.tenantUserId,
      },
      created_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error requesting arrival date change:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request date change',
    };
  }
}

// Delete a lease
export async function deleteLeaseFromDb(leaseId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('leases')
      .delete()
      .eq('id', leaseId);

    if (error) {
      console.error('Error deleting lease:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting lease:', error);
    return false;
  }
}

// Upload lease document (PDF)
export async function uploadLeaseDocument(
  uri: string,
  leaseId: string,
  userId: string
): Promise<UploadResult> {
  try {
    const bucket = 'lease-documents';
    const timestamp = Date.now();
    const fileName = `leases/${userId}/${leaseId}/${timestamp}-lease.pdf`;

    // For web, fetch the blob
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (error) {
        console.error('Error uploading lease document:', error);
        return { success: false, error: error.message };
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return { success: true, url: urlData.publicUrl };
    }

    // For native, read as base64
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading lease document:', error);
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error('Error uploading lease document:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
}

// Send lease to tenant (update status and potentially trigger notification)
export async function sendLeaseToTenant(leaseId: string, tenantId: string | null): Promise<DbLease | null> {
  try {
    console.log('📤 Sending lease to tenant:', { leaseId, tenantId });
    
    // Fetch the lease to check if it has application_id
    const { data: lease, error: fetchError } = await supabase
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .single();

    if (fetchError || !lease) {
      console.error('Error fetching lease:', fetchError);
      return null;
    }

    console.log('📄 Lease data:', { 
      id: lease.id, 
      tenant_id: lease.tenant_id, 
      application_id: lease.application_id,
      status: lease.status 
    });

    // Update lease status to 'sent'
    const updateData: any = {
      status: 'sent',
      updated_at: new Date().toISOString(),
    };

    // Only update tenant_id if it's provided and not already set
    if (tenantId && !lease.tenant_id) {
      updateData.tenant_id = tenantId;
    }

    const { data, error } = await supabase
      .from('leases')
      .update(updateData)
      .eq('id', leaseId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating lease status:', error);
      return null;
    }

    console.log('✅ Lease sent successfully:', data);

    // TODO: Trigger notification to tenant (in-app, push, email)
    // This would typically be handled by a Supabase Edge Function or backend service

    return data;
  } catch (error) {
    console.error('❌ Error sending lease to tenant:', error);
    return null;
  }
}

// Fetch lease documents for a lease
export async function fetchLeaseDocuments(leaseId: string): Promise<DbLeaseDocument[]> {
  try {
    const { data, error } = await supabase
      .from('lease_documents')
      .select('*')
      .eq('lease_id', leaseId)
      .order('version', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        return [];
      }
      console.error('Error fetching lease documents:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching lease documents:', error);
    return [];
  }
}

// =====================================================
// TENANT-PROPERTY RELATIONSHIP & TRANSACTION ANALYTICS
// =====================================================

// Interface for tenant with associated property/lease data
export interface TenantPropertyAssociation {
  tenantId: string;
  tenantName?: string;
  tenantEmail?: string;
  propertyId: string;
  propertyAddress?: string;
  unitId?: string;
  unitName?: string;
  subunitId?: string;
  subunitName?: string;
  leaseId?: string;
  leaseStatus?: LeaseStatus;
  leaseStartDate?: string;
  leaseEndDate?: string;
  totalTransactions: number;
  totalRentPaid: number;
  pendingAmount: number;
  overdueAmount: number;
  lastPaymentDate?: string;
}

/**
 * Get tenant-property association for a specific property/unit/subunit
 * Looks up which tenant rented this space and their transaction history
 * NOTE: Requires tenant_id column in transactions table (see ADD_TENANT_ID_MIGRATION.sql)
 */
export async function getTenantPropertyAssociation(
  propertyId: string,
  unitId?: string,
  subunitId?: string
): Promise<TenantPropertyAssociation | null> {
  try {
    // Find active lease for this property/unit/subunit
    let leaseQuery = supabase
      .from('leases')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'signed')
      .gte('expiry_date', new Date().toISOString());

    if (unitId) {
      leaseQuery = leaseQuery.eq('unit_id', unitId);
    }

    const { data: leases, error: leaseError } = await leaseQuery;

    if (leaseError || !leases || leases.length === 0) {
      if (leaseError?.code === '42703') {
        console.warn('⚠️ Column not found in leases table. Run ADD_TENANT_ID_MIGRATION.sql');
      }
      return null;
    }

    const lease = leases[0];
    const tenantId = lease.tenant_id;

    if (!tenantId) {
      return null;
    }

    // Get tenant details
    const tenant = await fetchTenantById(tenantId);
    const property = await fetchPropertyById(propertyId);
    
    let unit = null;
    if (unitId) {
      unit = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .single()
        .then(res => res.data || null);
    }

    // Get all transactions for this tenant
    const transactions = await fetchTenantTransactions(tenantId);
    
    // Filter for this property and unit if specified
    const relevantTransactions = transactions.filter(t => 
      t.property_id === propertyId && 
      (!unitId || t.unit_id === unitId) &&
      (!subunitId || t.subunit_id === subunitId)
    );

    const totalRentPaid = relevantTransactions
      .filter(t => t.type === 'income' && t.category === 'rent' && t.status === 'paid')
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingAmount = relevantTransactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0);

    const overdueAmount = relevantTransactions
      .filter(t => t.type === 'income' && t.status === 'overdue')
      .reduce((sum, t) => sum + t.amount, 0);

    const lastPayment = relevantTransactions
      .filter(t => t.status === 'paid')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    return {
      tenantId,
      tenantName: tenant ? `${tenant.first_name} ${tenant.last_name}` : undefined,
      tenantEmail: tenant?.email,
      propertyId,
      propertyAddress: property ? `${property.address1}, ${property.city}` : undefined,
      unitId,
      unitName: unit?.name,
      subunitId,
      leaseId: lease.id,
      leaseStatus: lease.status as LeaseStatus,
      leaseStartDate: lease.effective_date,
      leaseEndDate: lease.expiry_date,
      totalTransactions: relevantTransactions.length,
      totalRentPaid,
      pendingAmount,
      overdueAmount,
      lastPaymentDate: lastPayment?.date,
    };
  } catch (error) {
    console.error('Error getting tenant-property association:', error);
    return null;
  }
}

/**
 * Update tenant profile with latest transaction data for a property
 * Called when a new transaction is added for a tenant
 */
export async function updateTenantProfileWithTransaction(
  tenantId: string,
  propertyId: string,
  unitId?: string,
  subunitId?: string
): Promise<DbTenant | null> {
  try {
    // Get the tenant-property association data
    const association = await getTenantPropertyAssociation(propertyId, unitId, subunitId);
    
    if (!association) {
      return null;
    }

    // Update tenant profile with the latest data
    const updatedTenant = await updateTenantInDb(tenantId, {
      property_id: propertyId,
      unit_id: unitId,
      unit_name: association.unitName,
      status: association.leaseStatus === 'signed' ? 'active' : 'inactive',
      rent_amount: association.totalRentPaid, // Store total paid so far
    });

    return updatedTenant;
  } catch (error) {
    console.error('Error updating tenant profile with transaction:', error);
    return null;
  }
}

/**
 * Get time-series transaction data for accounting graphs
 * Returns aggregated data grouped by date and category
 */
export interface TimeSeriesTransactionData {
  date: string;
  category: 'rent' | 'garage' | 'parking' | 'utility' | 'maintenance' | 'other' | 'total';
  income: number;
  expense: number;
  netCashFlow: number;
}

export async function getTimeSeriesTransactionData(
  userId: string,
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<TimeSeriesTransactionData[]> {
  try {
    // Fetch all transactions in the date range
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'paid'); // Only count paid transactions

    if (error) {
      console.error('Error fetching time series transactions:', error);
      return [];
    }

    const transactions = data || [];

    // Group transactions by date and category
    const groupedData = new Map<string, Map<string, { income: number; expense: number }>>();

    transactions.forEach(t => {
      // Determine the group key based on groupBy parameter
      const date = new Date(t.date);
      let groupKey = '';

      if (groupBy === 'day') {
        groupKey = t.date.split('T')[0]; // YYYY-MM-DD
      } else if (groupBy === 'week') {
        // Get start of week (Monday)
        const firstDay = new Date(date);
        const day = firstDay.getDay();
        const diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(firstDay.setDate(diff));
        groupKey = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        groupKey = t.date.substring(0, 7); // YYYY-MM
      }

      // Initialize category data if needed
      if (!groupedData.has(groupKey)) {
        groupedData.set(groupKey, new Map());
      }

      const categoryMap = groupedData.get(groupKey)!;
      const category = t.category || 'other';

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { income: 0, expense: 0 });
      }

      const amounts = categoryMap.get(category)!;
      if (t.type === 'income') {
        amounts.income += t.amount;
      } else {
        amounts.expense += t.amount;
      }

      // Also add to 'total' category
      if (!categoryMap.has('total')) {
        categoryMap.set('total', { income: 0, expense: 0 });
      }

      const totals = categoryMap.get('total')!;
      if (t.type === 'income') {
        totals.income += t.amount;
      } else {
        totals.expense += t.amount;
      }
    });

    // Convert to array and sort by date
    const result: TimeSeriesTransactionData[] = [];

    groupedData.forEach((categoryMap, date) => {
      categoryMap.forEach((amounts, category) => {
        result.push({
          date,
          category: category as any,
          income: amounts.income,
          expense: amounts.expense,
          netCashFlow: amounts.income - amounts.expense,
        });
      });
    });

    return result.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error getting time series transaction data:', error);
    return [];
  }
}

/**
 * Get transaction summary by category for pie/donut charts
 */
export interface TransactionCategorySummary {
  category: 'rent' | 'garage' | 'parking' | 'utility' | 'maintenance' | 'other';
  type: 'income' | 'expense';
  amount: number;
  percentage: number;
  transactionCount: number;
}

export async function getTransactionCategorySummary(
  userId: string,
  startDate: string,
  endDate: string,
  type?: 'income' | 'expense'
): Promise<TransactionCategorySummary[]> {
  try {
    // Fetch transactions
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .gte('date', startDate)
      .lte('date', endDate);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching category summary:', error);
      return [];
    }

    const transactions = data || [];

    // Group by category and type
    const categoryMap = new Map<string, { income: number; expense: number; count: number }>();

    transactions.forEach(t => {
      const category = t.category || 'other';
      const key = `${category}`;

      if (!categoryMap.has(key)) {
        categoryMap.set(key, { income: 0, expense: 0, count: 0 });
      }

      const existing = categoryMap.get(key)!;
      if (t.type === 'income') {
        existing.income += t.amount;
      } else {
        existing.expense += t.amount;
      }
      existing.count += 1;
    });

    // Calculate totals for percentage
    const incomeTotals = new Map<string, number>();
    const expenseTotals = new Map<string, number>();
    const counts = new Map<string, number>();

    categoryMap.forEach((data, category) => {
      incomeTotals.set(category, data.income);
      expenseTotals.set(category, data.expense);
      counts.set(category, data.count);
    });

    const totalIncome = Array.from(incomeTotals.values()).reduce((sum, v) => sum + v, 0);
    const totalExpense = Array.from(expenseTotals.values()).reduce((sum, v) => sum + v, 0);

    // Build result
    const result: TransactionCategorySummary[] = [];

    categoryMap.forEach((data, category) => {
      if (data.income > 0) {
        result.push({
          category: category as any,
          type: 'income',
          amount: data.income,
          percentage: totalIncome > 0 ? Math.round((data.income / totalIncome) * 100) : 0,
          transactionCount: counts.get(category) || 0,
        });
      }

      if (data.expense > 0) {
        result.push({
          category: category as any,
          type: 'expense',
          amount: data.expense,
          percentage: totalExpense > 0 ? Math.round((data.expense / totalExpense) * 100) : 0,
          transactionCount: counts.get(category) || 0,
        });
      }
    });

    return result;
  } catch (error) {
    console.error('Error getting category summary:', error);
    return [];
  }
}

// Fetch tenant notifications (for announcements section)
export async function fetchTenantNotifications(userId: string) {
  try {
    console.log('📡 Fetching notifications for user:', userId);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return [];
    }

    console.log('✅ Notifications fetched:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching tenant notifications:', error);
    return [];
  }
}

// Fetch landlord notifications (same as tenant but for clarity)
export async function fetchLandlordNotifications(userId: string) {
  try {
    console.log('📡 Fetching landlord notifications for user:', userId);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return [];
    }

    console.log('✅ Landlord notifications fetched:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Error fetching landlord notifications:', error);
    return [];
  }
}

// Mark a single notification as read
export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

// Mark all notifications as read for a user
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
}

// Get unread notification count
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}


// Fetch pending invites for tenant (to auto-select property when starting application)
export async function fetchPendingInvites(userId: string) {
  try {
    // Get user's email first
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    const userEmail = profile?.email;

    // Fetch pending invites from invites table (has unit_id and sub_unit_id columns)
    const { data: invites, error: invitesError } = await supabase
      .from('invites')
      .select('*')
      .or(`tenant_id.eq.${userId}${userEmail ? `,tenant_email.eq.${userEmail}` : ''}`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (invitesError) {
      console.error('Error fetching invites:', invitesError);
      // Fallback to notification-based approach
      return await fetchPendingInvitesFromNotifications(userId);
    }

    if (!invites || invites.length === 0) {
      return [];
    }

    // Get property details for each invite
    const invitesWithDetails = await Promise.all(
      invites.map(async (invite) => {
        // Fetch property details
        const { data: property, error: propError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', invite.property_id)
          .single();

        if (propError || !property) {
          return null;
        }

        // Fetch unit details if unit_id exists in invite
        let unit = null;
        if (invite.unit_id) {
          const { data: unitData } = await supabase
            .from('units')
            .select('*')
            .eq('id', invite.unit_id)
            .single();
          unit = unitData;
        }

        // Fetch subunit details if sub_unit_id exists in invite
        let subUnit = null;
        if (invite.sub_unit_id) {
          const { data: subUnitData } = await supabase
            .from('sub_units')
            .select('*')
            .eq('id', invite.sub_unit_id)
            .single();
          subUnit = subUnitData;
        }

        return {
          id: invite.id,
          property,
          unit,
          subUnit,
          inviteData: {
            propertyId: invite.property_id,
            unitId: invite.unit_id,
            subUnitId: invite.sub_unit_id,
          },
        };
      })
    );

    return invitesWithDetails.filter(Boolean);
  } catch (error) {
    console.error('Error fetching pending invites:', error);
    return [];
  }
}

// Fallback: Fetch from notifications if invites table query fails
async function fetchPendingInvitesFromNotifications(userId: string) {
  try {
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'invite')
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (notifError || !notifications || notifications.length === 0) {
      return [];
    }

    const invitesWithDetails = await Promise.all(
      notifications.map(async (notif) => {
        const data = notif.data as { propertyId?: string; unitId?: string; subUnitId?: string };
        
        if (!data.propertyId) {
          return null;
        }

        const { data: property, error: propError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', data.propertyId)
          .single();

        if (propError || !property) {
          return null;
        }

        let unit = null;
        if (data.unitId) {
          const { data: unitData } = await supabase
            .from('units')
            .select('*')
            .eq('id', data.unitId)
            .single();
          unit = unitData;
        }

        let subUnit = null;
        if (data.subUnitId) {
          const { data: subUnitData } = await supabase
            .from('sub_units')
            .select('*')
            .eq('id', data.subUnitId)
            .single();
          subUnit = subUnitData;
        }

        return {
          id: notif.id,
          property,
          unit,
          subUnit,
          notificationData: data,
        };
      })
    );

    return invitesWithDetails.filter(Boolean);
  } catch (error) {
    console.error('Error fetching from notifications:', error);
    return [];
  }
}

// Submit application to database
export async function submitApplication(params: {
  userId: string;
  propertyId: string;
  unitId?: string;
  subUnitId?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  formData: any;
  coApplicants?: any[]; // Array of co-applicant data
  inviteId?: string;
}) {
  try {
    console.log('🗄️ submitApplication called with params:', {
      userId: params.userId,
      propertyId: params.propertyId,
      unitId: params.unitId,
      subUnitId: params.subUnitId,
      unitIdType: typeof params.unitId,
      subUnitIdType: typeof params.subUnitId,
      hasUnitId: !!params.unitId,
      hasSubUnitId: !!params.subUnitId,
      inviteId: params.inviteId,
    });

    // First, get the property to find the landlord
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('user_id, address1, city')
      .eq('id', params.propertyId)
      .single();

    if (propError) {
      console.error('Error fetching property:', propError);
      return { success: false, error: 'Property not found' };
    }

    const landlordId = property.user_id;
    const propertyAddress = `${property.address1}, ${property.city}`;

    console.log('🗄️ About to insert application with:', {
      unit_id: params.unitId || null,
      sub_unit_id: params.subUnitId || null,
      willBeNull: !params.unitId,
    });

    // Insert the application
    const { data, error } = await supabase
      .from('applications')
      .insert({
        user_id: params.userId,
        property_id: params.propertyId,
        unit_id: params.unitId || null,
        sub_unit_id: params.subUnitId || null,
        invite_id: params.inviteId || null,
        applicant_name: params.applicantName,
        applicant_email: params.applicantEmail,
        applicant_phone: params.applicantPhone || null,
        status: 'submitted',
        form_data: params.formData,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting application:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Application inserted successfully:', {
      id: data.id,
      unit_id: data.unit_id,
      sub_unit_id: data.sub_unit_id,
    });

    // Insert co-applicants if provided
    if (params.coApplicants && params.coApplicants.length > 0) {
      console.log('👥 Inserting', params.coApplicants.length, 'co-applicants...');
      
      const coApplicantsToInsert = params.coApplicants.map((coApp, index) => ({
        application_id: data.id,
        applicant_order: index + 2, // 1 is primary, so start from 2
        full_name: coApp.personal?.fullName || '',
        email: coApp.personal?.email || '',
        phone: coApp.personal?.phone || null,
        date_of_birth: coApp.personal?.dob || null,
        current_address: coApp.residence?.currentAddress || null,
        current_landlord_name: coApp.residence?.currentLandlordName || null,
        current_landlord_contact: coApp.residence?.currentLandlordContact || null,
        previous_address: coApp.residence?.previousAddress || null,
        previous_landlord_name: coApp.residence?.previousLandlordName || null,
        previous_landlord_contact: coApp.residence?.previousLandlordContact || null,
        employer_name: coApp.employment?.employerName || null,
        job_title: coApp.employment?.jobTitle || null,
        employment_type: coApp.employment?.employmentType || null,
        annual_income: coApp.employment?.annualIncome || null,
        additional_income: coApp.employment?.additionalIncome || null,
        occupants: coApp.other?.occupants || null,
        vehicle_info: coApp.other?.vehicleInfo || null,
        pets: coApp.other?.pets || false,
        notes: coApp.other?.notes || null,
        documents: coApp.documents || {},
        form_data: coApp,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data: coAppData, error: coAppError } = await supabase
        .from('co_applicants')
        .insert(coApplicantsToInsert)
        .select();

      if (coAppError) {
        console.error('❌ Error inserting co-applicants:', coAppError);
        // Don't fail the whole application if co-applicants fail
        // The primary application is already saved
      } else {
        console.log('✅ Co-applicants inserted successfully:', coAppData?.length || 0);
      }
    }

    // Update applicant record status to 'applied'
    if (params.inviteId) {
      await supabase
        .from('applicants')
        .update({ 
          status: 'applied',
          application_id: data.id,
          updated_at: new Date().toISOString()
        })
        .eq('invite_id', params.inviteId)
        .eq('email', params.applicantEmail);
    }

    // Send notification to landlord
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: landlordId,
          type: 'application',
          title: 'New Application Received',
          message: `${params.applicantName} has submitted an application for ${propertyAddress}`,
          data: {
            applicationId: data.id,
            applicantName: params.applicantName,
            applicantEmail: params.applicantEmail,
            propertyId: params.propertyId,
            propertyAddress: propertyAddress,
          },
          created_at: new Date().toISOString(),
        });

      console.log('✅ Notification sent to landlord:', landlordId);
    } catch (notifError) {
      console.error('Error sending notification to landlord:', notifError);
      // Don't fail the application submission if notification fails
    }

    console.log('✅ Application submitted successfully:', data.id);
    return { success: true, applicationId: data.id };
  } catch (error) {
    console.error('Error submitting application:', error);
    return { success: false, error: 'Failed to submit application' };
  }
}

// Fetch applications for landlord
export async function fetchLandlordApplications(landlordId: string) {
  try {
    // First, get all properties for this landlord
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('user_id', landlordId);

    if (propError) {
      console.error('Error fetching properties:', propError);
      return [];
    }

    if (!properties || properties.length === 0) {
      return [];
    }

    const propertyIds = properties.map(p => p.id);

    // Get applications for those properties
    // Note: Applications are deleted when converted to tenant, so no filtering needed
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      return [];
    }

    console.log('📋 Total applications fetched:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('📋 Application IDs:', data.map(a => ({ id: a.id, email: a.applicant_email, name: a.applicant_name })));
    }

    // Fetch property details for each application
    const applicationsWithAddress = await Promise.all(
      (data || []).map(async (app) => {
        const { data: property } = await supabase
          .from('properties')
          .select('address1, address2, city, state, zip_code')
          .eq('id', app.property_id)
          .single();

        const propertyAddress = property
          ? [property.address1, property.address2, property.city, property.state, property.zip_code]
              .filter(Boolean)
              .join(', ')
          : 'Unknown Property';

        return {
          ...app,
          property_address: propertyAddress,
        };
      })
    );

    return applicationsWithAddress;
  } catch (error) {
    console.error('Error fetching applications:', error);
    return [];
  }
}

// Fetch applications by property
export async function fetchApplicationsByProperty(propertyId: string) {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('property_id', propertyId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching applications:', error);
    return [];
  }
}

// Approve application
export async function approveApplication(applicationId: string, shouldAddTenant: 'now' | 'later') {
  try {
    console.log('✅ Approving application:', applicationId, 'Add tenant:', shouldAddTenant);

    // Update application status
    const { data: application, error: updateError } = await supabase
      .from('applications')
      .update({ 
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select('*, property_id')
      .single();

    if (updateError) {
      console.error('Error updating application:', updateError);
      return { success: false, error: 'Failed to approve application' };
    }

    // Get property details for notification
    const { data: property } = await supabase
      .from('properties')
      .select('address1, address2, city, state, zip_code')
      .eq('id', application.property_id)
      .single();

    const propertyAddress = property
      ? [property.address1, property.address2, property.city, property.state, property.zip_code]
          .filter(Boolean)
          .join(', ')
      : 'Unknown Property';

    // Send notification to tenant (applicant)
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: application.applicant_id,
          type: 'application_approved',
          title: 'Application Approved! 🎉',
          message: `Your application for ${propertyAddress} has been approved!`,
          data: {
            applicationId: application.id,
            propertyId: application.property_id,
            propertyAddress: propertyAddress,
            status: 'approved'
          },
          created_at: new Date().toISOString(),
        });

      console.log('✅ Approval notification sent to applicant:', application.applicant_id);
    } catch (notifError) {
      console.error('Error sending approval notification:', notifError);
    }

    return { 
      success: true, 
      application,
      shouldAddTenant 
    };
  } catch (error) {
    console.error('Error approving application:', error);
    return { success: false, error: 'Failed to approve application' };
  }
}

// Reject application
export async function rejectApplication(applicationId: string, reason?: string) {
  try {
    console.log('❌ Rejecting application:', applicationId);

    // Update application status
    const { data: application, error: updateError } = await supabase
      .from('applications')
      .update({ 
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select('*, property_id')
      .single();

    if (updateError) {
      console.error('Error updating application:', updateError);
      return { success: false, error: 'Failed to reject application' };
    }

    // Get property details for notification
    const { data: property } = await supabase
      .from('properties')
      .select('address1, address2, city, state, zip_code')
      .eq('id', application.property_id)
      .single();

    const propertyAddress = property
      ? [property.address1, property.address2, property.city, property.state, property.zip_code]
          .filter(Boolean)
          .join(', ')
      : 'Unknown Property';

    // Send notification to tenant (applicant)
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: application.applicant_id,
          type: 'application_rejected',
          title: 'Application Update',
          message: `Your application for ${propertyAddress} has been reviewed.`,
          data: {
            applicationId: application.id,
            propertyId: application.property_id,
            propertyAddress: propertyAddress,
            status: 'rejected',
            reason: reason
          },
          created_at: new Date().toISOString(),
        });

      console.log('✅ Rejection notification sent to applicant:', application.applicant_id);
    } catch (notifError) {
      console.error('Error sending rejection notification:', notifError);
    }

    // Cleanup applicant pipeline artifacts for rejected applications
    try {
      const applicantUserId = application.applicant_id || application.user_id;

      await supabase
        .from('applicants')
        .delete()
        .eq('email', application.applicant_email)
        .eq('property_id', application.property_id)
        .in('status', ['invited', 'pending', 'rejected']);

      await supabase
        .from('invites')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_email', application.applicant_email)
        .eq('property_id', application.property_id)
        .eq('status', 'pending');

      if (applicantUserId) {
        const { data: activeTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('user_id', applicantUserId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        // Fresh applicant (no active tenancy): suspend profile access
        if (!activeTenant) {
          await supabase
            .from('profiles')
            .update({
              account_status: 'suspended',
              updated_at: new Date().toISOString(),
            })
            .eq('id', applicantUserId);
        }
      }
    } catch (cleanupError) {
      console.error('Error during rejection cleanup:', cleanupError);
    }

    return { success: true };
  } catch (error) {
    console.error('Error rejecting application:', error);
    return { success: false, error: 'Failed to reject application' };
  }
}

// Get application by ID
export async function getApplicationById(applicationId: string) {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error) {
      console.error('Error fetching application:', error);
      return null;
    }

    // Get property details
    const { data: property } = await supabase
      .from('properties')
      .select('address1, address2, city, state, zip_code')
      .eq('id', data.property_id)
      .single();

    let propertyAddress = property
      ? [property.address1, property.address2, property.city, property.state, property.zip_code]
          .filter(Boolean)
          .join(', ')
      : 'Unknown Property';

    // Add unit info if available
    if (data.unit_id) {
      const { data: unit } = await supabase
        .from('units')
        .select('name')
        .eq('id', data.unit_id)
        .single();
      
      if (unit?.name) {
        propertyAddress += ` - Unit ${unit.name}`;
      }
    }

    // Add sub-unit (room) info if available
    if (data.sub_unit_id) {
      const { data: subUnit } = await supabase
        .from('sub_units')
        .select('name')
        .eq('id', data.sub_unit_id)
        .single();
      
      if (subUnit?.name) {
        propertyAddress += ` - Room ${subUnit.name}`;
      }
    }

    return {
      ...data,
      property_address: propertyAddress,
    };
  } catch (error) {
    console.error('Error fetching application:', error);
    return null;
  }
}

// ============ TENANT INVITATION FLOW ============

/**
 * Create a tenant invitation
 * This sends an invitation link to the applicant so they can activate their account
 */
export async function createTenantInvitation(params: {
  email: string;
  tenantName: string;
  applicationId: string;
  leaseId: string;
  propertyId: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate secure random token
    const token = Math.random().toString(36).substring(2) + 
                  Math.random().toString(36).substring(2) + 
                  Date.now().toString(36);

    const { data, error } = await supabase
      .from('tenant_invitations')
      .insert({
        token: token,
        email: params.email,
        tenant_name: params.tenantName,
        application_id: params.applicationId,
        lease_id: params.leaseId,
        property_id: params.propertyId,
        created_by_user_id: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      invitation: data,
      activationLink: `${process.env.EXPO_PUBLIC_APP_URL || 'https://aaralink.app'}/activate-tenant?token=${token}&email=${encodeURIComponent(params.email)}`,
    };
  } catch (error) {
    console.error('Error creating tenant invitation:', error);
    throw error;
  }
}

/**
 * Send tenant invitation email via Edge Function
 */
export async function sendTenantInvitationEmail(params: {
  email: string;
  tenantName: string;
  activationLink: string;
  propertyName: string;
  landlordName: string;
}) {
  try {
    const { data, error } = await supabase.functions.invoke('send-tenant-invitation', {
      body: {
        email: params.email,
        tenantName: params.tenantName,
        activationLink: params.activationLink,
        propertyName: params.propertyName,
        landlordName: params.landlordName,
      },
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
}

/**
 * Send tenant invitation-based lease for applicant-tenant conversion
 * Instead of auto-converting, send an invitation link
 */
export async function handleInviteBasedLeaseSigning(params: {
  applicationId: string;
  leaseId: string;
  propertyId: string;
  applicantEmail: string;
  applicantName: string;
  propertyName: string;
  landlordName: string;
}) {
  try {
    console.log('📧 Creating tenant invitation for lease signing...');

    // 1. Create the invitation
    const invitationResult = await createTenantInvitation({
      email: params.applicantEmail,
      tenantName: params.applicantName,
      applicationId: params.applicationId,
      leaseId: params.leaseId,
      propertyId: params.propertyId,
    });

    console.log('✅ Invitation created:', invitationResult.invitation.id);

    // 2. Send the invitation email
    await sendTenantInvitationEmail({
      email: params.applicantEmail,
      tenantName: params.applicantName,
      activationLink: invitationResult.activationLink,
      propertyName: params.propertyName,
      landlordName: params.landlordName,
    });

    console.log('✅ Invitation email sent');

    // 3. Update lease status to 'sent' (awaiting tenant activation)
    const { error: leaseError } = await supabase
      .from('leases')
      .update({ 
        status: 'sent',
        sent_date: new Date().toISOString(),
      })
      .eq('id', params.leaseId);

    if (leaseError) throw leaseError;

    console.log('✅ Lease status updated to sent');

    return {
      success: true,
      message: 'Invitation sent successfully. Tenant can now activate their account.',
    };
  } catch (error) {
    console.error('Error in invitation-based lease signing:', error);
    throw error;
  }
}

/**
 * Complete tenant activation after they set their password
 * This is called from the activate-tenant screen after user creates their account
 */
export async function completeTenantActivation(params: {
  invitationToken: string;
  userId: string;
}) {
  try {
    console.log('🔄 Completing tenant activation...');

    // 1. Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('tenant_invitations')
      .select('*')
      .eq('token', params.invitationToken)
      .single();

    if (inviteError || !invitation) {
      throw new Error('Invitation not found');
    }

    // 2. Mark invitation as activated
    const { error: updateError } = await supabase
      .from('tenant_invitations')
      .update({
        status: 'activated',
        activated_at: new Date().toISOString(),
        user_id: params.userId,
      })
      .eq('token', params.invitationToken);

    if (updateError) throw updateError;

    console.log('✅ Invitation marked as activated');

    // 3. Keep user in applicant flow after activation.
    // Conversion to tenant happens on lease signing completion.
    return {
      success: true,
      activationStatus: 'activated_pending_signature',
      message: 'Account activated successfully. Please review and sign your lease to complete tenant conversion.',
    };
  } catch (error) {
    console.error('Error completing tenant activation:', error);
    throw error;
  }
}

// ============ TENANT DELETION FLOW ============

/**
 * Hard delete a tenant and all associated data
 * This is called when a lease ends or tenant is removed
 * Note: This requires server-side action due to needing service role key for auth deletion
 */
export async function hardDeleteTenant(params: {
  tenantId: string;
  leaseId?: string;
  reason?: string;
}) {
  try {
    console.log('🗑️ Starting hard delete for tenant:', params.tenantId);

    // Get tenant details first
    const { data: tenant, error: tenantFetchError } = await supabase
      .from('tenants')
      .select('*, profiles:user_id(email)')
      .eq('id', params.tenantId)
      .single();

    if (tenantFetchError || !tenant) {
      throw new Error('Tenant not found');
    }

    console.log('📋 Tenant details:', tenant.user_id, tenant.profiles?.email);

    // Call edge function to handle hard deletion (requires service role)
    console.log('📞 Calling edge function for auth user deletion...');
    const { data, error: edgeFunctionError } = await supabase.functions.invoke('hard-delete-tenant-account', {
      body: {
        userId: tenant.user_id,
        tenantId: params.tenantId,
        leaseId: params.leaseId,
        reason: params.reason || 'Lease ended',
      },
    });

    if (edgeFunctionError) {
      console.error('Error from edge function:', edgeFunctionError);
      throw edgeFunctionError;
    }

    console.log('✅ Edge function completed:', data);

    // Clean up local references if deletion was successful
    if (data.success) {
      // Delete lease soft-delete or mark as historical
      if (params.leaseId) {
        await supabase
          .from('leases')
          .update({ 
            status: 'terminated',
            terminated_date: new Date().toISOString(),
          })
          .eq('id', params.leaseId);
      }

      console.log('✅ Tenant hard delete completed successfully');
    }

    return {
      success: data.success === true,
      message: data.message || 'Tenant deleted successfully',
      deletedRecords: data.deletedRecords,
    };
  } catch (error) {
    console.error('Error hard deleting tenant:', error);
    throw error;
  }
}

/**
 * Schedule or trigger tenant deletion when lease ends
 * Can be called from lease end date or manual removal
 */
export async function initiateTenantRemoval(params: {
  leaseId: string;
  reason: 'lease_ended' | 'manual_removal' | 'payment_failed';
}) {
  try {
    console.log('📅 Initiating tenant removal for lease:', params.leaseId);

    // Get lease and tenant info
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select('*, tenants(*)')
      .eq('id', params.leaseId)
      .single();

    if (leaseError || !lease) {
      throw new Error('Lease not found');
    }

    if (!lease.tenant_id) {
      console.log('ℹ️ Lease has no tenant - marking as ended');
      await supabase
        .from('leases')
        .update({ status: 'terminated' })
        .eq('id', params.leaseId);
      return { success: true, message: 'Lease marked as terminated' };
    }

    // Hard delete the tenant account
    const deleteResult = await hardDeleteTenant({
      tenantId: lease.tenant_id,
      leaseId: params.leaseId,
      reason: params.reason,
    });

    return deleteResult;
  } catch (error) {
    console.error('Error initiating tenant removal:', error);
    throw error;
  }
}
export async function approveMoveInDate(applicationId: string) {
  try {
    const { data: appData, error: appFetchError } = await supabase
      .from('applications')
      .select('*, leases(*)')
      .eq('id', applicationId)
      .single();

    if (appFetchError) throw appFetchError;
    
    // Update application move-in status
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: 'move_in_approved',
        move_in_status: 'approved',
        approved_move_in_date: appData.proposed_move_in_date || appData.leases?.[0]?.effective_date || new Date().toISOString().split('T')[0]
      })
      .eq('id', applicationId);

    if (updateError) throw updateError;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error approving move-in date:', error);
    return { success: false, error: error.message };
  }
}
