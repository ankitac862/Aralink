/**
 * Lease Generation Service
 * 
 * Client-side service for generating, sending, and viewing lease PDFs.
 * Communicates with Supabase Edge Functions for PDF generation.
 * 
 * Features:
 * - XFA-based PDF generation with automatic fallback
 * - Standard HTML-to-PDF generation
 * - Send lease to tenant (email + notification)
 * - View/download lease document
 * - Version tracking
 */

import { supabase } from '@/lib/supabase';
import type { OntarioLeaseFormData } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

export interface GeneratePdfRequest {
  leaseId: string;
  formData: OntarioLeaseFormData;
  useXfa?: boolean;
}

export interface GeneratePdfResponse {
  success: boolean;
  documentUrl?: string;
  documentId?: string;
  version?: number;
  engineUsed?: 'xfa' | 'standard';
  error?: string;
  code?: string;
  warning?: string;
}

export interface SendLeaseRequest {
  leaseId: string;
  tenantEmail?: string;
  /** Auth user id (profiles.id) — primary recipient for notifications; use when applicant has no tenant row */
  recipientUserId?: string;
  propertyId?: string;
  applicationId?: string;
  tenantId?: string;
  sendEmail?: boolean;
  sendNotification?: boolean;
  message?: string;
  /** Landlord edited lease; tenant must sign again (notification + email copy). */
  leaseUpdatedResign?: boolean;
}

export interface SendLeaseResponse {
  success: boolean;
  status?: string;
  emailSent?: boolean;
  notificationSent?: boolean;
  error?: string;
}

export interface LeaseDocument {
  id: string;
  leaseId: string;
  fileUrl: string;
  filename: string;
  version: number;
  isCurrent: boolean;
  engineUsed: 'xfa' | 'standard' | 'uploaded';
  createdAt: string;
}

// =====================================================
// CONFIGURATION
// =====================================================

// Supabase Edge Functions URLs
const getEdgeFunctionUrl = (functionName: string): string => {
  const projectRef = process.env.EXPO_PUBLIC_SUPABASE_URL?.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
  if (!projectRef) {
    throw new Error('Unable to determine Supabase project reference');
  }
  return `https://${projectRef}.supabase.co/functions/v1/${functionName}`;
};

// =====================================================
// LEASE GENERATION
// =====================================================

/**
 * Transforms the app's OntarioLeaseFormData to match the Edge Function's expected format
 * Maps all fields from the app form structure to the comprehensive PDF structure
 */
function transformFormDataForEdgeFunction(formData: OntarioLeaseFormData): any {
  // Parse landlord name - handle multiple landlords (up to 4)
  const landlords = [];
  if (formData.landlordName) {
    const names = formData.landlordName.split(/[,&]/).map(n => n.trim()).filter(n => n);
    for (const name of names.slice(0, 4)) {
      landlords.push({ legalName: name });
    }
  }
  
  // Parse tenant names into first and last names (up to 14)
  const tenants = [];
  if (formData.tenantNames) {
    for (const fullName of formData.tenantNames.slice(0, 14)) {
      if (fullName.trim()) {
        const parts = fullName.trim().split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || '';
        tenants.push({ firstName, lastName });
      }
    }
  }
  
  return {
    landlords,
    tenants,
    rentalUnit: {
      unit: formData.unitAddress?.unit,
      streetNumber: formData.unitAddress?.streetNumber || '',
      streetName: formData.unitAddress?.streetName || '',
      city: formData.unitAddress?.city || '',
      province: formData.unitAddress?.province || 'ON',
      postalCode: formData.unitAddress?.postalCode || '',
      parkingSpaces: formData.parkingDescription ? '1' : undefined,
      isCondo: formData.isCondo || false,
    },
    contact: {
      unit: formData.unitAddress?.unit,
      streetNumber: formData.unitAddress?.streetNumber || '',
      streetName: formData.unitAddress?.streetName || '',
      poBox: undefined,
      city: formData.unitAddress?.city || '',
      province: formData.unitAddress?.province || 'ON',
      postalCode: formData.unitAddress?.postalCode || '',
      emailConsent: formData.allowEmailNotices || false,
      email: formData.landlordEmail,
      phoneNumber: formData.emergencyContactPhone,
    },
    term: {
      startDate: formData.tenancyStartDate || '',
      type: (formData.tenancyType === 'fixed' ? 'fixed' : 'month_to_month') as 'fixed' | 'month_to_month' | 'other',
      endDate: formData.tenancyEndDate,
      otherDescription: undefined,
    },
    rent: {
      dueDay: formData.rentPaymentDay || 1,
      frequency: (formData.paymentFrequency === 'monthly' ? 'monthly' : 'weekly_daily') as 'monthly' | 'weekly_daily',
      base: formData.baseRent || 0,
      parking: formData.parkingRent,
      otherDescription: formData.otherServicesDescription,
      otherAmount: formData.otherServicesRent,
      total: (formData.baseRent || 0) + (formData.parkingRent || 0) + (formData.otherServicesRent || 0),
      payableTo: formData.rentPayableTo || '',
      paymentMethod: formData.paymentMethod || 'etransfer',
      partial: formData.partialRentAmount ? {
        amount: formData.partialRentAmount,
        date: formData.partialRentFromDate || '',
        startDate: formData.partialRentFromDate || '',
        endDate: formData.partialRentToDate || '',
      } : undefined,
      nsfCharge: formData.chequeBounceCharge,
    },
    services: {
      gas: formData.utilities?.gas || false,
      airConditioning: formData.utilities?.airConditioning || false,
      storage: formData.utilities?.additionalStorage || false,
      laundry: (formData.utilities?.laundry as 'none' | 'included' | 'coin' | 'pay_per_use') || 'none',
      guestParking: (formData.utilities?.guestParking as 'none' | 'included' | 'paid' | 'other') || 'none',
      other1: false,
      other2: false,
    },
    utilities: {
      electricity: formData.utilities?.electricity || 'landlord',
      heat: formData.utilities?.heat || 'landlord',
      water: formData.utilities?.water || 'landlord',
    },
    discounts: {
      hasDiscount: formData.hasRentDiscount || false,
      description: formData.rentDiscountDescription,
    },
    deposits: {
      rentDeposit: formData.requiresRentDeposit || false,
      rentDepositAmount: formData.rentDepositAmount,
      keyDeposit: formData.requiresKeyDeposit || false,
      keyDepositAmount: formData.keyDepositAmount,
    },
    smoking: {
      hasRules: !!formData.smokingRules && formData.smokingRules !== 'none',
      description: formData.smokingRulesDescription,
    },
    insurance: {
      required: formData.requiresTenantInsurance || false,
    },
    additionalTerms: {
      hasTerms: !!formData.additionalTerms || !!formData.specialConditions,
    },
  };
}

/**
 * Generates a lease PDF using the XFA template with automatic fallback
 * 
 * Flow:
 * 1. Try XFA generation first (official Ontario lease template)
 * 2. If XFA fails, automatically fall back to HTML-to-PDF generation
 * 3. Store the PDF with version tracking
 * 4. Return the document URL
 */
export async function generateLeasePdf(
  leaseId: string,
  formData: OntarioLeaseFormData,
  options?: {
    useXfa?: boolean;
    forceStandard?: boolean;
  }
): Promise<GeneratePdfResponse> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        success: false,
        error: 'Not authenticated. Please log in to generate a lease.',
      };
    }
    
    // Validate form data
    const validationError = validateFormData(formData);
    if (validationError) {
      return {
        success: false,
        error: validationError,
      };
    }
    
    const useXfa = options?.forceStandard ? false : (options?.useXfa ?? true);
    
    // Transform form data to match Edge Function's expected format
    const transformedFormData = transformFormDataForEdgeFunction(formData);
    
    console.log('📤 Sending to Edge Function, transformed data:', JSON.stringify(transformedFormData, null, 2));
    
    // Call edge function
    const response = await fetch(getEdgeFunctionUrl('generate-lease-pdf'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        leaseId,
        formData: transformedFormData,
      } as GeneratePdfRequest),
    });
    
    const result: GeneratePdfResponse = await response.json();
    
    // Add warning if fallback was used
    if (result.success && result.code === 'FALLBACK_USED') {
      result.warning = 'Official XFA template could not be filled automatically; generated equivalent lease PDF instead.';
    }
    
    return result;
  } catch (error) {
    console.error('Error generating lease PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate lease PDF',
    };
  }
}

/**
 * Generates a lease PDF using only the standard (HTML-to-PDF) method
 * Use this when you explicitly want to skip XFA generation
 */
export async function generateStandardLeasePdf(
  leaseId: string,
  formData: OntarioLeaseFormData
): Promise<GeneratePdfResponse> {
  return generateLeasePdf(leaseId, formData, { forceStandard: true });
}

/**
 * Regenerates the lease PDF (creates a new version)
 */
export async function regenerateLeasePdf(
  leaseId: string,
  formData: OntarioLeaseFormData
): Promise<GeneratePdfResponse> {
  // Same as generate, but we can track that this is a regeneration
  const result = await generateLeasePdf(leaseId, formData);
  
  if (result.success) {
    console.log(`Lease ${leaseId} regenerated. Version: ${result.version}`);
  }
  
  return result;
}

// =====================================================
// SEND LEASE
// =====================================================

/**
 * Sends the lease document to the tenant
 * 
 * - Sends email with download link
 * - Creates in-app notification
 * - Updates lease status to 'sent'
 */
export async function sendLeaseToTenant(
  leaseId: string,
  options?: {
    tenantEmail?: string;
    recipientUserId?: string;
    propertyId?: string;
    applicationId?: string;
    tenantId?: string;
    message?: string;
    skipEmail?: boolean;
    skipNotification?: boolean;
    leaseUpdatedResign?: boolean;
  }
): Promise<SendLeaseResponse> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        success: false,
        error: 'Not authenticated. Please log in to send a lease.',
      };
    }
    
    // Call edge function
    const response = await fetch(getEdgeFunctionUrl('send-lease'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        leaseId,
        tenantEmail: options?.tenantEmail,
        recipientUserId: options?.recipientUserId,
        propertyId: options?.propertyId,
        applicationId: options?.applicationId,
        tenantId: options?.tenantId,
        sendEmail: !options?.skipEmail,
        sendNotification: !options?.skipNotification,
        message: options?.message,
        leaseUpdatedResign: options?.leaseUpdatedResign,
      } as SendLeaseRequest),
    });
    
    const result: SendLeaseResponse = await response.json();
    
    return result;
  } catch (error) {
    console.error('Error sending lease:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send lease',
    };
  }
}

// =====================================================
// VIEW/DOWNLOAD LEASE
// =====================================================

/**
 * Gets the current lease document URL
 */
export async function getLeaseDocumentUrl(leaseId: string): Promise<string | null> {
  try {
    const { data: lease, error } = await supabase
      .from('leases')
      .select('document_url')
      .eq('id', leaseId)
      .single();
    
    if (error || !lease) {
      console.error('Error fetching lease document URL:', error);
      return null;
    }
    
    return lease.document_url;
  } catch (error) {
    console.error('Error getting lease document URL:', error);
    return null;
  }
}

/**
 * Gets all document versions for a lease
 */
export async function getLeaseDocumentVersions(leaseId: string): Promise<LeaseDocument[]> {
  try {
    const { data: documents, error } = await supabase
      .from('lease_documents')
      .select('*')
      .eq('lease_id', leaseId)
      .order('version', { ascending: false });
    
    if (error) {
      // Table might not exist yet
      if (error.code === 'PGRST205') {
        return [];
      }
      console.error('Error fetching lease documents:', error);
      return [];
    }
    
    return (documents || []).map((doc: any) => ({
      id: doc.id,
      leaseId: doc.lease_id,
      fileUrl: doc.file_url,
      filename: doc.filename,
      version: doc.version,
      isCurrent: doc.is_current,
      engineUsed: doc.engine_used || 'standard',
      createdAt: doc.created_at,
    }));
  } catch (error) {
    console.error('Error getting lease document versions:', error);
    return [];
  }
}

/**
 * Gets a signed URL for secure document download
 * Use this for private bucket storage
 */
export async function getSignedDownloadUrl(
  storageKey: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('lease-documents')
      .createSignedUrl(storageKey, expiresIn);
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed download URL:', error);
    return null;
  }
}

// =====================================================
// VALIDATION
// =====================================================

/**
 * Validates form data before PDF generation
 */
function validateFormData(formData: OntarioLeaseFormData): string | null {
  // Required fields
  if (!formData.landlordName?.trim()) {
    return 'Landlord name is required';
  }
  
  if (!formData.tenantNames?.length || !formData.tenantNames.some(n => n.trim())) {
    return 'At least one tenant name is required';
  }
  
  if (formData.tenantNames.length > 14) {
    return 'Maximum 14 tenants allowed';
  }
  
  if (!formData.unitAddress?.streetNumber || !formData.unitAddress?.streetName) {
    return 'Property address is required';
  }
  
  if (!formData.unitAddress?.city || !formData.unitAddress?.province) {
    return 'City and province are required';
  }
  
  if (!formData.tenancyStartDate) {
    return 'Tenancy start date is required';
  }
  
  if (formData.baseRent === undefined || formData.baseRent < 0) {
    return 'Base rent must be a positive number';
  }
  
  if (!formData.rentPayableTo?.trim()) {
    return 'Rent payable to is required';
  }
  
  return null;
}

// =====================================================
// STATUS HELPERS
// =====================================================

/**
 * Checks if a lease has a generated/uploaded document
 */
export async function hasLeaseDocument(leaseId: string): Promise<boolean> {
  try {
    const { data: lease, error } = await supabase
      .from('leases')
      .select('document_url, status')
      .eq('id', leaseId)
      .single();
    
    if (error || !lease) {
      return false;
    }
    
    return !!lease.document_url && ['generated', 'uploaded', 'sent', 'signed'].includes(lease.status);
  } catch (error) {
    console.error('Error checking lease document:', error);
    return false;
  }
}

/**
 * Gets the current lease status
 */
export async function getLeaseStatus(leaseId: string): Promise<string | null> {
  try {
    const { data: lease, error } = await supabase
      .from('leases')
      .select('status')
      .eq('id', leaseId)
      .single();
    
    if (error || !lease) {
      return null;
    }
    
    return lease.status;
  } catch (error) {
    console.error('Error getting lease status:', error);
    return null;
  }
}

/**
 * Checks if user can view a lease (for tenant/applicant view)
 *
 * Identity resolution order:
 * 1. Owner (landlord) can always view
 * 2. User is the tenant_id match → Tenant path
 * 3. User email matches form_data.tenantEmails → Applicant who hasn't converted yet
 * 4. User has an application linked to this lease → Applicant path
 */
export async function canViewLease(leaseId: string, userId: string): Promise<boolean> {
  try {
    const { data: lease, error } = await supabase
      .from('leases')
      .select('user_id, tenant_id, application_id, status, form_data')
      .eq('id', leaseId)
      .single();
    
    if (error || !lease) {
      return false;
    }
    
    // Owner can always view
    if (lease.user_id === userId) {
      return true;
    }

    const viewableStatuses = ['sent', 'signed', 'signed_pending_move_in', 'active'];

    // Tenant linked by tenant_id (tenant_id stores the tenants table row id, not user_id)
    // Check via tenants table: find if this userId corresponds to the tenant
    if (lease.tenant_id) {
      const { data: tenantRecord } = await supabase
        .from('tenants')
        .select('user_id')
        .eq('id', lease.tenant_id)
        .maybeSingle();
      if (tenantRecord?.user_id === userId && viewableStatuses.includes(lease.status)) {
        return true;
      }
    }

    // Resolve user email to check applicant path
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    const userEmail = profile?.email;

    if (userEmail) {
      // Check if user email is in lease form_data.tenantEmails
      const tenantEmails: string[] = lease.form_data?.tenantEmails || [];
      if (tenantEmails.some((e: string) => e?.toLowerCase() === userEmail.toLowerCase())
          && viewableStatuses.includes(lease.status)) {
        return true;
      }

      // Check if there is an application linked to this lease with this user's email
      if (lease.application_id) {
        const { data: application } = await supabase
          .from('applications')
          .select('user_id, applicant_email')
          .eq('id', lease.application_id)
          .maybeSingle();
        if (
          application &&
          (application.user_id === userId ||
            application.applicant_email?.toLowerCase() === userEmail.toLowerCase()) &&
          viewableStatuses.includes(lease.status)
        ) {
          return true;
        }
      }

      // Also check applications table by email even without application_id on lease
      const { data: appByEmail } = await supabase
        .from('applications')
        .select('id')
        .eq('applicant_email', userEmail)
        .maybeSingle();
      if (appByEmail) {
        const { data: leaseByApp } = await supabase
          .from('leases')
          .select('id, status')
          .eq('id', leaseId)
          .eq('application_id', appByEmail.id)
          .maybeSingle();
        if (leaseByApp && viewableStatuses.includes(leaseByApp.status)) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking lease view permission:', error);
    return false;
  }
}
