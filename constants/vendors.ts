export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  category: string;
  address: string;
  isSponsored: boolean;
  website?: string;
}

// Used for dropdown options; the authoritative list comes from the DB.
// These serve as fallback labels and for TypeScript exhaustiveness checks.
export const VENDOR_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Cleaning',
  'Appliance Repair',
  'Painting',
  'Carpentry',
  'Landscaping',
  'Pest Control',
  'General Repair',
] as const;

export const VENDOR_CITIES = [
  'Toronto',
  'Mississauga',
  'Brampton',
  'Vaughan',
  'Markham',
  'Oakville',
  'Hamilton',
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];
export type VendorCity = (typeof VENDOR_CITIES)[number];
