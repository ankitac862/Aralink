export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  category: string;
  address: string;
  isSponsored: boolean;
}

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

export const VENDORS: Vendor[] = [
  {
    id: '1',
    name: 'ABC Plumbing Services',
    email: 'abcplumbing@example.com',
    phone: '+1 555-123-4567',
    city: 'Toronto',
    category: 'Plumbing',
    address: '123 Main Street, Toronto',
    isSponsored: true,
  },
  {
    id: '2',
    name: 'QuickFix Electrical',
    email: 'quickfix@example.com',
    phone: '+1 555-987-6543',
    city: 'Toronto',
    category: 'Electrical',
    address: '45 King Street, Toronto',
    isSponsored: false,
  },
  {
    id: '3',
    name: 'CleanHome Services',
    email: 'cleanhome@example.com',
    phone: '+1 555-222-3333',
    city: 'Mississauga',
    category: 'Cleaning',
    address: '88 Queen Street, Mississauga',
    isSponsored: true,
  },
  {
    id: '4',
    name: 'FrostFix HVAC',
    email: 'frostfix@example.com',
    phone: '+1 555-444-5555',
    city: 'Toronto',
    category: 'HVAC',
    address: '200 Bay Street, Toronto',
    isSponsored: false,
  },
  {
    id: '5',
    name: 'ProPaint Solutions',
    email: 'propaint@example.com',
    phone: '+1 555-666-7777',
    city: 'Brampton',
    category: 'Painting',
    address: '55 Bovaird Drive, Brampton',
    isSponsored: true,
  },
  {
    id: '6',
    name: 'AppliancePro Repairs',
    email: 'appliancepro@example.com',
    phone: '+1 555-888-9999',
    city: 'Mississauga',
    category: 'Appliance Repair',
    address: '300 City Centre Drive, Mississauga',
    isSponsored: false,
  },
  {
    id: '7',
    name: 'GreenLeaf Landscaping',
    email: 'greenleaf@example.com',
    phone: '+1 555-111-2222',
    city: 'Oakville',
    category: 'Landscaping',
    address: '10 Lakeshore Blvd, Oakville',
    isSponsored: true,
  },
  {
    id: '8',
    name: 'PestAway Control',
    email: 'pestaway@example.com',
    phone: '+1 555-333-4444',
    city: 'Vaughan',
    category: 'Pest Control',
    address: '780 Highway 7, Vaughan',
    isSponsored: false,
  },
  {
    id: '9',
    name: 'Brampton Plumbing Co.',
    email: 'bramptonplumbing@example.com',
    phone: '+1 555-555-0000',
    city: 'Brampton',
    category: 'Plumbing',
    address: '90 Main Street N, Brampton',
    isSponsored: false,
  },
  {
    id: '10',
    name: 'Hamilton General Repairs',
    email: 'hamiltonrepairs@example.com',
    phone: '+1 555-777-8888',
    city: 'Hamilton',
    category: 'General Repair',
    address: '10 James Street S, Hamilton',
    isSponsored: true,
  },
  {
    id: '11',
    name: 'Markham Carpentry Works',
    email: 'markhamcarpentry@example.com',
    phone: '+1 555-000-1111',
    city: 'Markham',
    category: 'Carpentry',
    address: '7 Warden Avenue, Markham',
    isSponsored: false,
  },
  {
    id: '12',
    name: 'Toronto Electric Masters',
    email: 'torontoelectric@example.com',
    phone: '+1 555-123-9876',
    city: 'Toronto',
    category: 'Electrical',
    address: '500 College Street, Toronto',
    isSponsored: true,
  },
];
