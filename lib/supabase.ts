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
    return {
      getItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
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
  phone?: string;
  avatar_url?: string;
  is_social_login: boolean;
  social_provider?: 'google' | 'apple' | 'facebook' | null;
  created_at: string;
  updated_at: string;
}

// Helper function to get user profile from database
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

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
      .single();

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ profiles table not found. User profile not saved.');
      } else {
        console.error('Error upserting user profile:', error);
      }
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
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (error) {
      console.error('Error fetching property:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching property:', error);
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
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        console.warn('⚠️ tenants table not found. Using local data.');
        return [];
      }
      console.error('Error fetching tenants:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching tenants:', error);
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
    // Fetch all leases and properties
    const [leases, propertiesData] = await Promise.all([
      fetchLeases(userId),
      supabase.from('properties').select('*, units(*, sub_units(*))').eq('user_id', userId)
    ]);

    // Count active leases
    const now = new Date();
    const activeLeases = leases.filter(lease => 
      lease.status === 'signed' && 
      (!lease.expiry_date || new Date(lease.expiry_date) > now)
    ).length;

    // Count rentable units
    let totalRentableUnits = 0;
    let rentedUnits = 0;

    if (propertiesData.data) {
      for (const property of propertiesData.data) {
        if (!property.units || property.units.length === 0) {
          // Property with no units = 1 rentable unit
          totalRentableUnits += 1;
          // Check if property has active lease
          const hasLease = leases.some(l => 
            l.property_id === property.id && 
            l.status === 'signed' &&
            (!l.expiry_date || new Date(l.expiry_date) > now)
          );
          if (hasLease) rentedUnits += 1;
        } else {
          // Property has units
          for (const unit of property.units) {
            if (!unit.sub_units || unit.sub_units.length === 0) {
              // Unit with no subunits = 1 rentable unit
              totalRentableUnits += 1;
              const hasLease = leases.some(l => 
                l.unit_id === unit.id && 
                l.status === 'signed' &&
                (!l.expiry_date || new Date(l.expiry_date) > now)
              );
              if (hasLease) rentedUnits += 1;
            } else {
              // Unit has subunits - count each subunit
              totalRentableUnits += unit.sub_units.length;
              // Count rented subunits (would need to check lease form_data for subunit matching)
              // For now, approximate by checking unit-level leases
              const unitLeases = leases.filter(l => 
                l.unit_id === unit.id && 
                l.status === 'signed' &&
                (!l.expiry_date || new Date(l.expiry_date) > now)
              );
              rentedUnits += Math.min(unitLeases.length, unit.sub_units.length);
            }
          }
        }
      }
    }

    const occupancyPercentage = totalRentableUnits > 0 
      ? Math.round((rentedUnits / totalRentableUnits) * 100) 
      : 0;

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
  
  status: LeaseStatus;
  
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
    const { data, error } = await supabase
      .from('leases')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leases by tenant:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching leases by tenant:', error);
    return [];
  }
}

// Fetch a single lease by ID
export async function fetchLeaseById(leaseId: string): Promise<DbLease | null> {
  try {
    const { data, error } = await supabase
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .single();

    if (error) {
      console.error('Error fetching lease:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching lease:', error);
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

// Update a lease
export async function updateLeaseInDb(leaseId: string, updates: Partial<DbLease>): Promise<DbLease | null> {
  try {
    const { data, error } = await supabase
      .from('leases')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId)
      .select()
      .single();

    if (error) {
      console.error('Error updating lease:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating lease:', error);
    return null;
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
export async function sendLeaseToTenant(leaseId: string, tenantId: string): Promise<DbLease | null> {
  try {
    const { data, error } = await supabase
      .from('leases')
      .update({
        status: 'sent',
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId)
      .select()
      .single();

    if (error) {
      console.error('Error sending lease to tenant:', error);
      return null;
    }

    // TODO: Trigger notification to tenant (in-app, push, email)
    // This would typically be handled by a Supabase Edge Function or backend service

    return data;
  } catch (error) {
    console.error('Error sending lease to tenant:', error);
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
