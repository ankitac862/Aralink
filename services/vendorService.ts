import { supabase } from '@/lib/supabase';
import type { Vendor } from '@/constants/vendors';

interface DbVendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string;
  category: string;
  address: string | null;
  is_sponsored: boolean;
  website: string | null;
}

function mapDbVendor(row: DbVendor): Vendor {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    city: row.city,
    category: row.category,
    address: row.address ?? '',
    isSponsored: row.is_sponsored,
    website: row.website ?? undefined,
  };
}

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('is_sponsored', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching vendors:', error);
    return [];
  }

  return (data as DbVendor[]).map(mapDbVendor);
}

export async function fetchVendorsByFilter(city: string, category?: string): Promise<Vendor[]> {
  let query = supabase
    .from('vendors')
    .select('*')
    .eq('city', city)
    .order('is_sponsored', { ascending: false })
    .order('name', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching vendors by filter:', error);
    return [];
  }

  return (data as DbVendor[]).map(mapDbVendor);
}
