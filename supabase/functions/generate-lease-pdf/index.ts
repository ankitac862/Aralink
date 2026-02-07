/**
 * Supabase Edge Function: Generate Lease PDF
 * 
 * This function generates Ontario Standard Lease PDF (Form 2229E) using PDF.co:
 * 1. Uses PDF.co's /pdf/edit/add endpoint to fill form fields and add text overlays
 * 2. Creates editable signature fields (AcroForm) for Section 17
 * 3. Generates a 7-page legally compliant Ontario lease document
 * 
 * Environment Variables (set in Supabase Dashboard → Edge Functions → Secrets):
 * - PDFCO_API_KEY: Your PDF.co API key (required)
 * - LEASE_TEMPLATE_URL: URL to the base Ontario lease PDF template (required)
 * - SUPABASE_URL: Supabase project URL (auto-set)
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key (auto-set)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// PDF.co API Configuration
const PDFCO_API_KEY = Deno.env.get('PDFCO_API_KEY');
const PDFCO_EDIT_ADD_ENDPOINT = 'https://api.pdf.co/v1/pdf/edit/add';

// Enhanced Types matching your requirements
interface Landlord {
  legalName: string;
}

interface Tenant {
  firstName: string;
  lastName: string;
}

interface RentalUnit {
  unit?: string;
  streetNumber: string;
  streetName: string;
  city: string;
  province: string;
  postalCode: string;
  parkingSpaces?: number;
  isCondo: boolean;
}

interface Contact {
  noticeAddress: string;
  emailConsent: boolean;
  emails?: string[];
  emergencyContactConsent: boolean;
  emergencyContact?: string;
}

interface Term {
  startDate: string; // ISO date
  type: 'fixed' | 'month_to_month' | 'other';
  endDate?: string; // ISO date (for fixed term)
  otherDescription?: string;
}

interface Rent {
  dueDay: number; // Day of month (1-31)
  frequency: 'monthly' | 'weekly' | 'daily';
  base: number;
  parking?: number;
  otherServices?: number;
  total: number;
  payableTo: string;
  paymentMethods: ('cash' | 'cheque' | 'debit' | 'credit' | 'e-transfer' | 'other')[];
  partial?: {
    amount: number;
    fromDate: string;
    toDate: string;
  };
  nsfFee?: number;
}

interface Services {
  gas?: boolean;
  airConditioning?: boolean;
  storage?: boolean;
  laundry?: 'none' | 'included' | 'coin' | 'other';
  guestParking?: 'none' | 'free' | 'paid' | 'other';
  otherServices?: string;
  utilityDetails?: string;
}

interface Utilities {
  electricity: 'landlord' | 'tenant';
  heat: 'landlord' | 'tenant';
  water: 'landlord' | 'tenant';
  utilityDetails?: string;
}

interface Discounts {
  hasDiscount: boolean;
  description?: string;
}

interface Deposits {
  rentDepositRequired: boolean;
  rentDepositAmount?: number;
  keyDepositRequired: boolean;
  keyDepositAmount?: number;
  keyDepositDescription?: string;
}

interface Smoking {
  hasRules: boolean;
  rulesDescription?: string;
}

interface Insurance {
  required: boolean;
}

interface AdditionalTerms {
  hasAdditionalTerms: boolean;
  description?: string;
}

interface OntarioLeaseFormData {
  // Up to 4 landlords
  landlords: Landlord[];
  
  // Up to 12 tenants (app sends 12, but PDF template has 4 rows)
  tenants: Tenant[];
  
  // Section 2: Rental Unit
  rentalUnit: RentalUnit;
  
  // Section 3: Contact Information
  contact: Contact;
  
  // Section 4: Term
  term: Term;
  
  // Section 5: Rent
  rent: Rent;
  
  // Section 6: Services
  services?: Services;
  
  // Section 6: Utilities
  utilities?: Utilities;
  
  // Section 7: Discounts
  discounts?: Discounts;
  
  // Section 8: Rent Deposit
  deposits?: Deposits;
  
  // Section 10: Smoking
  smoking?: Smoking;
  
  // Section 11: Insurance
  insurance?: Insurance;
  
  // Section 15: Additional Terms
  additionalTerms?: AdditionalTerms;
  
  // Signature placeholders
  signaturePlaceholders?: boolean;
}

interface GeneratePdfRequest {
  leaseId: string;
  formData: OntarioLeaseFormData;
  useXfa?: boolean;
}

interface GeneratePdfResponse {
  success: boolean;
  documentUrl?: string;
  documentId?: string;
  version?: number;
  engineUsed?: 'pdfco' | 'standard';
  error?: string;
  code?: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Template URL - set this in Edge Function secrets
const TEMPLATE_URL = Deno.env.get('LEASE_TEMPLATE_URL') || '';

/**
 * Helper function to format checkbox (☑ for checked, ☐ for unchecked)
 */
function checkbox(checked: boolean): string {
  return checked ? '☑' : '☐';
}

/**
 * Helper function to format date (YYYY-MM-DD to readable format)
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  } catch {
    return dateStr;
  }
}

/**
 * Helper function to format currency
 */
function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '$0.00';
  return `$${amount.toFixed(2)}`;
}

/**
 * Generates Ontario Lease PDF using PDF.co
 * This function creates a legally compliant 7-page Ontario Standard Lease (Form 2229E)
 */
async function generateLeaseWithPdfCo(
  formData: OntarioLeaseFormData,
  leaseId: string,
  userId: string
): Promise<GeneratePdfResponse> {
  if (!PDFCO_API_KEY) {
    return {
      success: false,
      code: 'PDFCO_NOT_CONFIGURED',
      error: 'PDF.co API key not configured. Please set PDFCO_API_KEY in environment variables.',
    };
  }

  if (!TEMPLATE_URL) {
    return {
      success: false,
      code: 'TEMPLATE_NOT_CONFIGURED',
      error: 'Lease template URL not configured. Please set LEASE_TEMPLATE_URL in environment variables.',
    };
  }

  try {
    console.log('Generating Ontario Lease PDF with PDF.co for lease:', leaseId);
    
    // Build the text annotations and form fields
    const annotations = buildPdfCoAnnotations(formData);
    const formFields = buildSignatureFields(formData);
    
    console.log(`Prepared ${annotations.length} annotations and ${formFields.length} signature fields`);
    
    // Call PDF.co API
    const response = await fetch(PDFCO_EDIT_ADD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PDFCO_API_KEY,
      },
      body: JSON.stringify({
        url: TEMPLATE_URL,
        name: `ontario-lease-${leaseId}.pdf`,
        annotations: annotations,
        fields: formFields,
        async: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PDF.co API error:', response.status, errorText);
      return {
        success: false,
        code: 'PDFCO_API_ERROR',
        error: `PDF.co API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    console.log('PDF.co response:', result);

    if (!result.url) {
      return {
        success: false,
        code: 'PDFCO_NO_URL',
        error: 'PDF.co did not return a URL for the generated PDF',
      };
    }

    // Download the generated PDF
    const pdfResponse = await fetch(result.url);
    if (!pdfResponse.ok) {
      return {
        success: false,
        code: 'PDFCO_DOWNLOAD_FAILED',
        error: 'Failed to download generated PDF from PDF.co',
      };
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log('Downloaded PDF, size:', pdfBuffer.byteLength, 'bytes');

    // Store the PDF in Supabase
    return await storePdf(new Uint8Array(pdfBuffer), leaseId, userId, 'pdfco');

  } catch (error) {
    console.error('Error generating lease with PDF.co:', error);
    return {
      success: false,
      code: 'GENERATION_FAILED',
      error: `Failed to generate lease: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Builds PDF.co text annotations for all lease sections
 * These are text overlays that will be added to the PDF template
 * 
 * PDF.co annotation format:
 * {
 *   "x": number,        // X position in points
 *   "y": number,        // Y position in points
 *   "text": string,     // Text content
 *   "fontName": string, // Font name (e.g., "Helvetica")
 *   "fontSize": number, // Font size in points
 *   "color": string,    // Color in hex format (e.g., "000000")
 *   "pages": string     // Page numbers (e.g., "0" for first page, "0,1,2" for multiple)
 * }
 */
function buildPdfCoAnnotations(formData: OntarioLeaseFormData): any[] {
  const annotations: any[] = [];
  
  // Ensure required arrays exist (handle undefined/null)
  const landlords = formData.landlords || [];
  const tenants = formData.tenants || [];
  
  // Ensure required objects exist with defaults
  const rentalUnit = formData.rentalUnit || { 
    streetNumber: '', 
    streetName: '', 
    city: '', 
    province: 'ON', 
    postalCode: '',
    isCondo: false 
  };
  const contact = formData.contact || { 
    noticeAddress: '', 
    emailConsent: false,
    emergencyContactConsent: false 
  };
  const term = formData.term || { 
    startDate: '', 
    type: 'month_to_month' as const
  };
  const rent = formData.rent || { 
    dueDay: 1, 
    frequency: 'monthly' as const, 
    base: 0, 
    total: 0,
    payableTo: '',
    paymentMethods: []
  };
  const utilities = formData.utilities;
  const services = formData.services;
  
  // ==================== SECTION 1: PARTIES (Page 1) ====================
  
  // Landlords (up to 4) - Based on actual PDF positions
  landlords.slice(0, 4).forEach((landlord, index) => {
    annotations.push({
      x: 150,  // After "Landlord's Legal Name" label at x:39.6
      y: 340 + (index * 27),  // Start at 340, spacing of 27 points per landlord
      text: landlord.legalName,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "0"
    });
  });
  
  // Tenants (up to 12) - Template has 4 labeled rows, but we fit 12 tenants
  // Strategy: Use all 4 labeled rows, then continue below with same spacing
  // PDF shows tenant fields at: Last Name (x:39.6), First Name (x:363.9)
  // Y positions for labeled rows: 425.1, 452.1, 479.1, 506.1 (spacing of ~27 points)
  tenants.slice(0, 12).forEach((tenant, index) => {
    const yPos = 445 + (index * 27);  // Start at 445, spacing of 27 points
    // This will use rows 1-4 (labeled) and continue to rows 5-12 (same format)
    
    // Last Name (left column)
    annotations.push({
      x: 150,  // After "Last Name" label at x:39.6
      y: yPos,
      text: tenant.lastName,
      fontName: "Helvetica",
      fontSize: 9,  // Slightly smaller to fit more
      color: "000000",
      pages: "0"
    });
    
    // First Name (right column)
    annotations.push({
      x: 410,  // After "First Name" label at x:363.9
      y: yPos,
      text: tenant.firstName,
      fontName: "Helvetica",
      fontSize: 9,  // Slightly smaller to fit more
      color: "000000",
      pages: "0"
    });
  });
  
  // ==================== SECTION 2: RENTAL UNIT (Page 1) ====================
  
  // Unit number
  if (rentalUnit.unit) {
    annotations.push({
      x: 100,
      y: 350,
      text: rentalUnit.unit,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "0"
    });
  }
  
  // Street address
  annotations.push({
    x: 150,
    y: 350,
    text: `${rentalUnit.streetNumber} ${rentalUnit.streetName}`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "0"
  });
  
  // City, Province, Postal Code
  annotations.push({
    x: 100,
    y: 370,
    text: `${rentalUnit.city}, ${rentalUnit.province} ${rentalUnit.postalCode}`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "0"
  });
  
  // Parking spaces
  if (rentalUnit.parkingSpaces) {
    annotations.push({
      x: 100,
      y: 390,
      text: `${rentalUnit.parkingSpaces} parking space(s)`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "0"
    });
  }
  
  // Condo checkbox
  annotations.push({
    x: 100,
    y: 410,
    text: checkbox(rentalUnit.isCondo),
    fontName: "Helvetica",
    fontSize: 12,
    color: "000000",
    pages: "0"
  });
  
  // ==================== SECTION 3: CONTACT (Page 1-2) ====================
  
  annotations.push({
    x: 100,
    y: 450,
    text: contact.noticeAddress,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "0"
  });
  
  // Email consent
  annotations.push({
    x: 100,
    y: 470,
    text: checkbox(contact.emailConsent),
    fontName: "Helvetica",
    fontSize: 12,
    color: "000000",
    pages: "0"
  });
  
  // Email addresses
  if (contact.emails && contact.emails.length > 0) {
    annotations.push({
      x: 150,
      y: 470,
      text: contact.emails.join(', '),
      fontName: "Helvetica",
      fontSize: 9,
      color: "000000",
      pages: "0"
    });
  }
  
  // Emergency contact
  if (contact.emergencyContact) {
    annotations.push({
      x: 100,
      y: 490,
      text: contact.emergencyContact,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "0"
    });
  }
  
  // ==================== SECTION 4: TERM (Page 2) ====================
  
  annotations.push({
    x: 100,
    y: 100,
    text: `Start Date: ${formatDate(term.startDate)}`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "1"
  });
  
  // Term type checkboxes
  annotations.push({
    x: 100,
    y: 120,
    text: `${checkbox(term.type === 'fixed')} Fixed Term`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "1"
  });
  
  annotations.push({
    x: 200,
    y: 120,
    text: `${checkbox(term.type === 'month_to_month')} Month-to-Month`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "1"
  });
  
  if (term.type === 'fixed' && term.endDate) {
    annotations.push({
      x: 100,
      y: 140,
      text: `End Date: ${formatDate(term.endDate)}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "1"
    });
  }
  
  if (term.type === 'other' && term.otherDescription) {
    annotations.push({
      x: 100,
      y: 140,
      text: term.otherDescription,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "1"
    });
  }
  
  // ==================== SECTION 5: RENT (Page 2-3) ====================
  
  annotations.push({
    x: 100,
    y: 200,
    text: `Rent due on day ${rent.dueDay} of each ${rent.frequency === 'monthly' ? 'month' : rent.frequency === 'weekly' ? 'week' : 'day'}`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "1"
  });
  
  // Base rent
  annotations.push({
    x: 100,
    y: 220,
    text: `Base Rent: ${formatCurrency(rent.base)}`,
    fontName: "Helvetica-Bold",
    fontSize: 11,
    color: "000000",
    pages: "1"
  });
  
  // Parking rent
  if (rent.parking) {
    annotations.push({
      x: 100,
      y: 240,
      text: `Parking: ${formatCurrency(rent.parking)}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "1"
    });
  }
  
  // Other services
  if (rent.otherServices) {
    annotations.push({
      x: 100,
      y: 260,
      text: `Other Services: ${formatCurrency(rent.otherServices)}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "1"
    });
  }
  
  // Total rent
  annotations.push({
    x: 100,
    y: 280,
    text: `TOTAL RENT: ${formatCurrency(rent.total)}`,
    fontName: "Helvetica-Bold",
    fontSize: 12,
    color: "000000",
    pages: "1"
  });
  
  // Payable to
  annotations.push({
    x: 100,
    y: 300,
    text: `Payable to: ${rent.payableTo}`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "1"
  });
  
  // Payment methods
  const paymentMethodsText = rent.paymentMethods.map(m => {
    switch (m) {
      case 'e-transfer': return 'E-Transfer';
      case 'cheque': return 'Cheque';
      case 'cash': return 'Cash';
      case 'debit': return 'Debit';
      case 'credit': return 'Credit Card';
      default: return m;
    }
  }).join(', ');
  
  annotations.push({
    x: 100,
    y: 320,
    text: `Payment Methods: ${paymentMethodsText}`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "1"
  });
  
  // NSF fee
  if (rent.nsfFee) {
    annotations.push({
      x: 100,
      y: 340,
      text: `NSF Fee: ${formatCurrency(rent.nsfFee)}`,
      fontName: "Helvetica",
      fontSize: 9,
      color: "000000",
      pages: "1"
    });
  }
  
  // Partial rent
  if (rent.partial) {
    annotations.push({
      x: 100,
      y: 360,
      text: `Partial Rent: ${formatCurrency(rent.partial.amount)} (${formatDate(rent.partial.fromDate)} to ${formatDate(rent.partial.toDate)})`,
      fontName: "Helvetica",
      fontSize: 9,
      color: "000000",
      pages: "1"
    });
  }
  
  // ==================== SECTION 6: SERVICES & UTILITIES (Page 3-4) ====================
  
  if (utilities) {
    annotations.push({
      x: 100,
      y: 100,
      text: `Electricity: ${utilities.electricity === 'landlord' ? 'Landlord pays' : 'Tenant pays'}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "2"
    });
    
    annotations.push({
      x: 100,
      y: 120,
      text: `Heat: ${utilities.heat === 'landlord' ? 'Landlord pays' : 'Tenant pays'}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "2"
    });
    
    annotations.push({
      x: 100,
      y: 140,
      text: `Water: ${utilities.water === 'landlord' ? 'Landlord pays' : 'Tenant pays'}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "2"
    });
    
    if (utilities.utilityDetails) {
      annotations.push({
        x: 100,
        y: 160,
        text: utilities.utilityDetails,
        fontName: "Helvetica",
        fontSize: 9,
        color: "000000",
        pages: "2"
      });
    }
  }
  
  if (services) {
    let serviceY = 200;
    
    if (services.gas) {
      annotations.push({
        x: 100,
        y: serviceY,
        text: `${checkbox(true)} Natural Gas`,
        fontName: "Helvetica",
        fontSize: 10,
        color: "000000",
        pages: "2"
      });
      serviceY += 20;
    }
    
    if (services.airConditioning) {
      annotations.push({
        x: 100,
        y: serviceY,
        text: `${checkbox(true)} Air Conditioning`,
        fontName: "Helvetica",
        fontSize: 10,
        color: "000000",
        pages: "2"
      });
      serviceY += 20;
    }
    
    if (services.storage) {
      annotations.push({
        x: 100,
        y: serviceY,
        text: `${checkbox(true)} Storage`,
        fontName: "Helvetica",
        fontSize: 10,
        color: "000000",
        pages: "2"
      });
      serviceY += 20;
    }
    
    if (services.laundry && services.laundry !== 'none') {
      annotations.push({
        x: 100,
        y: serviceY,
        text: `Laundry: ${services.laundry}`,
        fontName: "Helvetica",
        fontSize: 10,
        color: "000000",
        pages: "2"
      });
      serviceY += 20;
    }
    
    if (services.guestParking && services.guestParking !== 'none') {
      annotations.push({
        x: 100,
        y: serviceY,
        text: `Guest Parking: ${services.guestParking}`,
        fontName: "Helvetica",
        fontSize: 10,
        color: "000000",
        pages: "2"
      });
      serviceY += 20;
    }
    
    if (services.otherServices) {
      annotations.push({
        x: 100,
        y: serviceY,
        text: services.otherServices,
        fontName: "Helvetica",
        fontSize: 9,
        color: "000000",
        pages: "2"
      });
    }
  }
  
  // ==================== SECTION 7: DISCOUNTS (Page 4) ====================
  
  if (formData.discounts?.hasDiscount && formData.discounts.description) {
    annotations.push({
      x: 100,
      y: 400,
      text: `Rent Discount: ${formData.discounts.description}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "3"
    });
  }
  
  // ==================== SECTION 8: RENT DEPOSIT (Page 4) ====================
  
  if (formData.deposits?.rentDepositRequired && formData.deposits.rentDepositAmount) {
    annotations.push({
      x: 100,
      y: 450,
      text: `Rent Deposit: ${formatCurrency(formData.deposits.rentDepositAmount)}`,
      fontName: "Helvetica-Bold",
      fontSize: 10,
      color: "000000",
      pages: "3"
    });
  }
  
  // ==================== SECTION 9: KEY DEPOSIT (Page 4) ====================
  
  if (formData.deposits?.keyDepositRequired && formData.deposits.keyDepositAmount) {
    annotations.push({
      x: 100,
      y: 500,
      text: `Key Deposit: ${formatCurrency(formData.deposits.keyDepositAmount)}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "3"
    });
    
    if (formData.deposits.keyDepositDescription) {
      annotations.push({
        x: 100,
        y: 520,
        text: formData.deposits.keyDepositDescription,
        fontName: "Helvetica",
        fontSize: 9,
        color: "000000",
        pages: "3"
      });
    }
  }
  
  // ==================== SECTION 10: SMOKING (Page 5) ====================
  
  if (formData.smoking?.hasRules && formData.smoking.rulesDescription) {
    annotations.push({
      x: 100,
      y: 100,
      text: `Smoking Rules: ${formData.smoking.rulesDescription}`,
      fontName: "Helvetica",
      fontSize: 10,
      color: "000000",
      pages: "4"
    });
  }
  
  // ==================== SECTION 11: INSURANCE (Page 5) ====================
  
  annotations.push({
    x: 100,
    y: 150,
    text: `${checkbox(formData.insurance?.required || false)} Tenant insurance required`,
    fontName: "Helvetica",
    fontSize: 10,
    color: "000000",
    pages: "4"
  });
  
  // ==================== SECTION 15: ADDITIONAL TERMS (Page 6) ====================
  
  if (formData.additionalTerms?.hasAdditionalTerms && formData.additionalTerms.description) {
    annotations.push({
      x: 100,
      y: 100,
      text: formData.additionalTerms.description,
      fontName: "Helvetica",
      fontSize: 9,
      color: "000000",
      pages: "5"
    });
  }
  
  return annotations;
}

/**
 * Builds signature fields for Section 17
 * These are editable AcroForm fields that allow digital signing
 * 
 * PDF.co field format:
 * {
 *   "fieldType": "signature" | "text",
 *   "fieldName": string,
 *   "x": number,
 *   "y": number,
 *   "width": number,
 *   "height": number,
 *   "pages": string
 * }
 */
function buildSignatureFields(formData: OntarioLeaseFormData): any[] {
  const fields: any[] = [];
  const signaturePage = "6"; // Section 17 on page 7 (0-indexed = 6)
  
  // Ensure required arrays exist (handle undefined/null)
  const landlords = formData.landlords || [];
  const tenants = formData.tenants || [];
  
  // Starting positions
  const landlordStartY = 150;
  const tenantStartY = 400;
  const signatureWidth = 200;
  const signatureHeight = 40;
  const dateWidth = 100;
  const dateHeight = 30;
  const rowHeight = 60;
  
  // ==================== LANDLORD SIGNATURES (up to 4) ====================
  
  landlords.slice(0, 4).forEach((landlord, index) => {
    const yPos = landlordStartY + (index * rowHeight);
    
    // Label (as text annotation - not editable)
    fields.push({
      fieldType: "text",
      fieldName: `landlord_label_${index + 1}`,
      x: 50,
      y: yPos - 15,
      width: 150,
      height: 12,
      pages: signaturePage,
      text: `Landlord ${index + 1}: ${landlord.legalName}`,
      fontSize: 9,
      fontName: "Helvetica"
    });
    
    // Signature field
    fields.push({
      fieldType: "signature",
      fieldName: `landlord_sig_${index + 1}`,
      x: 50,
      y: yPos,
      width: signatureWidth,
      height: signatureHeight,
      pages: signaturePage
    });
    
    // Date field
    fields.push({
      fieldType: "text",
      fieldName: `landlord_date_${index + 1}`,
      x: 270,
      y: yPos + 5,
      width: dateWidth,
      height: dateHeight,
      pages: signaturePage
    });
    
    // Date label
    fields.push({
      fieldType: "text",
      fieldName: `landlord_date_label_${index + 1}`,
      x: 270,
      y: yPos - 15,
      width: dateWidth,
      height: 12,
      pages: signaturePage,
      text: "Date",
      fontSize: 9,
      fontName: "Helvetica"
    });
  });
  
  // ==================== TENANT SIGNATURES (up to 12) ====================
  
  tenants.slice(0, 12).forEach((tenant, index) => {
    // Layout: 2 columns × 6 rows to fit 12 tenants
    const col = index % 2; // 2 columns
    const row = Math.floor(index / 2); // 6 rows
    const xPos = 50 + (col * 280);
    const yPos = tenantStartY + (row * 60);  // 60 points per row to fit 6 rows
    
    // Label
    fields.push({
      fieldType: "text",
      fieldName: `tenant_label_${index + 1}`,
      x: xPos,
      y: yPos - 15,
      width: 150,
      height: 12,
      pages: signaturePage,
      text: `Tenant ${index + 1}: ${tenant.firstName} ${tenant.lastName}`,
      fontSize: 8,  // Smaller font to fit more
      fontName: "Helvetica"
    });
    
    // Signature field (smaller to fit 12)
    fields.push({
      fieldType: "signature",
      fieldName: `tenant_sig_${index + 1}`,
      x: xPos,
      y: yPos,
      width: 150,
      height: 35,
      pages: signaturePage
    });
    
    // Date field
    fields.push({
      fieldType: "text",
      fieldName: `tenant_date_${index + 1}`,
      x: xPos + 160,
      y: yPos + 5,
      width: 80,
      height: 25,
      pages: signaturePage
    });
    
    // Date label
    fields.push({
      fieldType: "text",
      fieldName: `tenant_date_label_${index + 1}`,
      x: xPos + 160,
      y: yPos - 15,
      width: 80,
      height: 12,
      pages: signaturePage,
      text: "Date",
      fontSize: 8,  // Smaller font to fit more
      fontName: "Helvetica"
    });
  });
  
  return fields;
}

/**
 * Stores the PDF in Supabase storage
 */
async function storePdf(
  pdfBuffer: Uint8Array,
  leaseId: string,
  userId: string,
  engineUsed: 'pdfco' | 'standard'
): Promise<GeneratePdfResponse> {
  try {
    const filename = `lease-${leaseId}-${Date.now()}.pdf`;
    const storagePath = `leases/${userId}/${filename}`;
    
    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('lease-documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return {
        success: false,
        code: 'STORAGE_UPLOAD_FAILED',
        error: `Failed to upload PDF to storage: ${uploadError.message}`,
      };
    }
    
    // Get signed URL (valid for 1 year) - Required for private buckets
    const { data: urlData, error: urlError } = await supabase.storage
      .from('lease-documents')
      .createSignedUrl(storagePath, 31536000); // 1 year in seconds
    
    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      return {
        success: false,
        code: 'SIGNED_URL_FAILED',
        error: `Failed to create signed URL: ${urlError.message}`,
      };
    }
    
    const documentUrl = urlData.signedUrl;
    
    // Update lease record with document URL
    const { error: updateError } = await supabase
      .from('leases')
      .update({
        document_url: documentUrl,
        document_storage_key: storagePath,
        status: 'generated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId);
    
    if (updateError) {
      console.error('Lease record update error:', updateError);
      // Don't fail the whole operation if just the record update fails
    }
    
    // Create document version record (optional - if lease_documents table exists)
    try {
      const { data: versionData, error: versionError } = await supabase
        .from('lease_documents')
        .insert({
          lease_id: leaseId,
          file_url: documentUrl,
          storage_key: storagePath,
          filename: filename,
          mime_type: 'application/pdf',
          file_size: pdfBuffer.length,
          version: 1,
          is_current: true,
          engine_used: engineUsed,
          uploaded_by: userId,
        })
        .select('id, version')
        .single();
      
      if (!versionError && versionData) {
        console.log('Document version created:', versionData);
      }
    } catch (versionErr) {
      // Ignore if lease_documents table doesn't exist
      console.log('Could not create document version (table may not exist):', versionErr);
    }
    
    return {
      success: true,
      documentUrl: documentUrl,
      documentId: uploadData.path,
      version: 1,
      engineUsed: engineUsed,
    };
  } catch (error) {
    console.error('Error storing PDF:', error);
    return {
      success: false,
      code: 'STORAGE_FAILED',
      error: `Failed to store PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }
  
  try {
    // Get user from auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request
    const requestData: GeneratePdfRequest = await req.json();
    const { leaseId, formData } = requestData;
    
    if (!leaseId || !formData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing leaseId or formData' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate PDF using PDF.co
    const result = await generateLeaseWithPdfCo(formData, leaseId, user.id);
    
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
