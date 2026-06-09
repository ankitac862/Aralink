// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'landlord' | 'tenant' | 'manager';
  phone?: string;
  createdAt: string;
  socialProvider?: 'google';
  profilePicture?: string;
}

// Property types
export interface Property {
  id: string;
  userId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  units: Unit[];
  isActive: boolean;
  createdAt: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  subUnits?: SubUnit[];
  tenantId?: string;
  isActive: boolean;
}

export interface SubUnit {
  id: string;
  unitId: string;
  name: string;
  type: string; // e.g., 'bedroom', 'living room'
}

// Tenant types
export interface Tenant {
  id: string;
  propertyId: string;
  name: string;
  email: string;
  phone: string;
  documentIds: string[];
  isActive: boolean;
  moveInDate: string;
  moveOutDate?: string;
}

export interface TenantDocument {
  id: string;
  tenantId: string;
  documentType: string; // e.g., 'lease', 'id', 'deposit'
  fileUrl: string;
  uploadedAt: string;
}

// Maintenance types
export interface MaintenanceTicket {
  id: string;
  propertyId: string;
  createdBy: string; // userId
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  attachments: MaintenanceAttachment[];
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface MaintenanceAttachment {
  id: string;
  ticketId: string;
  fileUrl: string;
  fileType: string; // 'image', 'video'
  fileSizeBytes: number;
  uploadedAt: string;
}

// Applicant types
export interface Applicant {
  id: string;
  propertyId: string;
  name: string;
  email: string;
  phone: string;
  status: 'new' | 'under-review' | 'approved' | 'rejected';
  applicationDate: string;
  documents: ApplicantDocument[];
}

export interface ApplicantDocument {
  id: string;
  applicantId: string;
  documentType: string; // e.g., 'id', 'income-proof'
  fileUrl: string;
}

// Accounting types
export interface Invoice {
  id: string;
  propertyId: string;
  vendor: string;
  amount: number;
  invoiceDate: string;
  paymentDate?: string;
  serviceDate: string;
  category: string; // e.g., 'maintenance', 'utilities', 'property-tax'
  description: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface RentTransaction {
  id: string;
  propertyId: string;
  tenantId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'pending' | 'paid' | 'overdue';
  createdAt: string;
}

export interface Report {
  id: string;
  propertyId: string;
  reportType: 'rental-income' | 'expenses' | 'year-end';
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpenses: number;
  generatedAt: string;
}
