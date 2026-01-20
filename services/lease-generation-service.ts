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
  sendEmail?: boolean;
  sendNotification?: boolean;
  message?: string;
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
    
    // Call edge function
    const response = await fetch(getEdgeFunctionUrl('generate-lease-pdf'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        leaseId,
        formData,
        useXfa,
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
    message?: string;
    skipEmail?: boolean;
    skipNotification?: boolean;
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
        sendEmail: !options?.skipEmail,
        sendNotification: !options?.skipNotification,
        message: options?.message,
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
 * Checks if user can view a lease (for tenant view)
 */
export async function canViewLease(leaseId: string, userId: string): Promise<boolean> {
  try {
    const { data: lease, error } = await supabase
      .from('leases')
      .select('user_id, tenant_id, status')
      .eq('id', leaseId)
      .single();
    
    if (error || !lease) {
      return false;
    }
    
    // Owner can always view
    if (lease.user_id === userId) {
      return true;
    }
    
    // Tenant can view if lease is sent or signed
    if (lease.tenant_id === userId && ['sent', 'signed'].includes(lease.status)) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking lease view permission:', error);
    return false;
  }
}
