/**
 * Supabase Edge Function: Generate Lease PDF
 * 
 * This function handles Ontario Standard Lease PDF generation:
 * 1. First tries to fill the official template (if configured)
 * 2. Falls back to HTML-to-PDF generation if template filling fails
 * 
 * Environment Variables (set in Supabase Dashboard → Edge Functions → Secrets):
 * - LEASE_TEMPLATE_URL: URL to the fillable Ontario lease PDF template
 * - PDF_GENERATOR_URL: (optional) External HTML-to-PDF service URL
 * - PDF_GENERATOR_API_KEY: (optional) API key for PDF generator
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// PDF.co API Endpoints - CORRECTED
const PDFCO_FILL_FORM_ENDPOINT = 'https://api.pdf.co/v1/pdf/edit/add'; // ← Form filling uses /add endpoint
const PDFCO_GET_INFO_ENDPOINT = 'https://api.pdf.co/v1/pdf/info';

// Types
interface OntarioLeaseFormData {
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
  tenancyStartDate: string;
  tenancyEndDate?: string;
  tenancyType: 'fixed' | 'month_to_month';
  paymentFrequency: 'monthly' | 'weekly' | 'daily';
  
  // Section 5: Rent
  rentPaymentDay: number;
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
  
  // Legacy support
  otherServices?: Array<{ description: string; amount: number }>;
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
  engineUsed?: 'template' | 'standard';
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
 * Attempts to fill the official Ontario lease template
 */
async function tryTemplateFilling(
  formData: OntarioLeaseFormData,
  leaseId: string,
  userId: string
): Promise<GeneratePdfResponse | null> {
  if (!TEMPLATE_URL) {
    console.log('Template URL not configured, skipping template filling');
    return {
      success: false,
      code: 'TEMPLATE_NOT_CONFIGURED',
      error: 'Lease template not configured. Using generated PDF instead.',
    };
  }

  try {
    console.log('Attempting to fetch template from:', TEMPLATE_URL.substring(0, 50) + '...');
    
    // Fetch the template PDF
    const templateResponse = await fetch(TEMPLATE_URL);
    
    if (!templateResponse.ok) {
      console.error('Failed to fetch template:', templateResponse.status, templateResponse.statusText);
      return {
        success: false,
        code: 'TEMPLATE_FETCH_FAILED',
        error: `Failed to fetch template: ${templateResponse.statusText}`,
      };
    }

    const templateBuffer = await templateResponse.arrayBuffer();
    console.log('Template fetched, size:', templateBuffer.byteLength, 'bytes');

    // For now, we'll use an external PDF filling service or return the template as-is
    // In a full implementation, you would:
    // 1. Use an XFA-capable service (Adobe PDF Services API)
    // 2. Or use a fillable AcroForm library

    // Check if we have an external PDF filling service configured
    const pdfFillerUrl = Deno.env.get('PDF_FILLER_URL');
    const pdfFillerKey = Deno.env.get('PDF_FILLER_API_KEY');

    if (pdfFillerUrl && pdfFillerKey) {
      console.log('External PDF filler configured, attempting to fill template...');
      
      // DEBUG: Uncomment the next 3 lines to see all field names in your PDF
      // console.log('\n=== ANALYZING PDF TEMPLATE ===');
      // await getPdfFieldNames(TEMPLATE_URL);
      // console.log('=== ANALYSIS COMPLETE ===\n');
      
      // Use external service to fill the template
      const fillData = buildFieldMapping(formData);
      
      // For PDF.co /edit/add, send as array of { fieldName, pages, text }
      console.log('Sending', fillData.length, 'fields to PDF.co');
      console.log('Sample fields:', fillData.slice(0, 3).map(f => `"${f.fieldName}": "${f.text}"`));
      
      try {
        const fillResponse = await fetch(pdfFillerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': pdfFillerKey,
          },
          body: JSON.stringify({
            url: TEMPLATE_URL,
            name: `ontario-lease-${leaseId}`,
            fields: fillData, // Array format: [{ fieldName, pages, text }]
            async: false,
          }),
        });

        if (fillResponse.ok) {
          const result = await fillResponse.json();
          console.log('PDF.co response:', result);
          
          if (result.url) {
            // Download the filled PDF from PDF.co
            const pdfResponse = await fetch(result.url);
            if (pdfResponse.ok) {
              const filledPdf = await pdfResponse.arrayBuffer();
              console.log('PDF filled successfully via PDF.co, size:', filledPdf.byteLength);
              return await storePdf(new Uint8Array(filledPdf), leaseId, userId, 'template');
            }
          }
        } else {
          const errorText = await fillResponse.text();
          console.error('PDF.co error:', fillResponse.status, errorText);
        }
      } catch (error) {
        console.error('PDF filler error:', error);
      }
    }

    // If no external filler available, fall back to standard generation
    console.log('No PDF filler service configured, falling back to standard generation');
    return null;

  } catch (error) {
    console.error('Template filling error:', error);
    return {
      success: false,
      code: 'TEMPLATE_FILL_FAILED',
      error: `Template filling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Builds field array for PDF.co /edit/add endpoint
 * Format: [{ fieldName: "name", pages: "0", text: "value" }]
 * 
 * COMPLETE MAPPING FOR ONTARIO STANDARD LEASE FORM 2229E (All 15 Sections)
 */
function buildFieldMapping(formData: OntarioLeaseFormData): Array<{ fieldName: string; pages: string; text: string }> {
  const totalRent = (formData.baseRent || 0) + (formData.parkingRent || 0) + (formData.otherServicesRent || 0);

  // Split tenant names into first/last (supports up to 4 tenants)
  const getTenantParts = (index: number) => {
    const name = formData.tenantNames[index] || '';
    const parts = name.trim().split(' ');
    return {
      first: parts[0] || '',
      last: parts.slice(1).join(' ') || '',
    };
  };

  const tenant1 = getTenantParts(0);
  const tenant2 = getTenantParts(1);
  const tenant3 = getTenantParts(2);
  const tenant4 = getTenantParts(3);

  // Build fields array - PDF.co format: { fieldName, pages, text }
  const fields = [
    // ==================== SECTION 1: PARTIES ====================
    { fieldName: 'Landlords Legal Name', pages: '0', text: formData.landlordName },
    { fieldName: 'Text1', pages: '0', text: formData.landlordName },
    
    // Tenants (up to 4)
    { fieldName: 'Last Name', pages: '0', text: tenant1.last },
    { fieldName: 'First Name', pages: '0', text: tenant1.first },
    { fieldName: 'Last Name_2', pages: '0', text: tenant2.last },
    { fieldName: 'First Name_2', pages: '0', text: tenant2.first },
    { fieldName: 'Last Name_3', pages: '0', text: tenant3.last },
    { fieldName: 'First Name_3', pages: '0', text: tenant3.first },
    { fieldName: 'Last Name_4', pages: '0', text: tenant4.last },
    { fieldName: 'First Name_4', pages: '0', text: tenant4.first },
    
    // ==================== SECTION 2: RENTAL UNIT ====================
    { fieldName: 'Unit eg unit 1 or basement unit', pages: '0', text: formData.unitAddress.unit || '' },
    { fieldName: 'Street Number', pages: '0', text: formData.unitAddress.streetNumber },
    { fieldName: 'Street Name', pages: '0', text: formData.unitAddress.streetName },
    { fieldName: 'CityTown', pages: '0', text: formData.unitAddress.city },
    { fieldName: 'Province', pages: '0', text: formData.unitAddress.province },
    { fieldName: 'Postal Code', pages: '0', text: formData.unitAddress.postalCode },
    { fieldName: 'Number of vehicle parking spaces and description eg indooroutdoor location', pages: '0', text: formData.parkingDescription || '' },
    
    // Condo checkboxes
    { fieldName: 'Yes', pages: '0', text: formData.isCondo ? 'true' : '' },
    { fieldName: 'No', pages: '0', text: !formData.isCondo ? 'true' : '' },
    
    // ==================== SECTION 3: CONTACT INFORMATION ====================
    // Landlord notice address (if different from main address)
    { fieldName: 'Unit_2', pages: '1', text: '' }, // Usually same as main address
    { fieldName: 'Street Number_2', pages: '1', text: formData.landlordNoticeAddress.split(',')[0] || '' },
    { fieldName: 'Street Name_2', pages: '1', text: formData.landlordNoticeAddress.split(',')[1] || '' },
    
    // Email notices checkbox
    { fieldName: 'Check Box16', pages: '1', text: formData.allowEmailNotices ? 'true' : '' },
    { fieldName: 'Check Box17', pages: '1', text: !formData.allowEmailNotices ? 'true' : '' },
    
    // Contact details
    { fieldName: 'Text12', pages: '1', text: formData.landlordEmail || '' },
    { fieldName: 'Text13', pages: '1', text: formData.emergencyContactPhone },
    
    // ==================== SECTION 4: TERM ====================
    { fieldName: 'Date yyyymmdd', pages: '1', text: formData.tenancyStartDate },
    { fieldName: 'Date yyyymmdd_2', pages: '1', text: formData.tenancyEndDate || '' },
    { fieldName: 'Check Box1', pages: '1', text: formData.tenancyType === 'fixed' ? 'true' : '' },
    { fieldName: 'Check Box2', pages: '1', text: formData.tenancyType === 'month_to_month' ? 'true' : '' },
    
    // ==================== SECTION 5: RENT ====================
    // Payment day
    { fieldName: 'undefined', pages: '1', text: formData.rentPaymentDay.toString() },
    
    // Payment frequency
    { fieldName: 'Check Box3', pages: '1', text: formData.paymentFrequency === 'monthly' ? 'true' : '' },
    
    // Rent amounts
    { fieldName: 'Text16', pages: '2', text: formData.baseRent.toFixed(2) },
    { fieldName: 'Text17', pages: '2', text: (formData.parkingRent || 0).toFixed(2) },
    { fieldName: 'Text18', pages: '2', text: (formData.otherServicesRent || 0).toFixed(2) },
    { fieldName: 'Text19', pages: '2', text: totalRent.toFixed(2) },
    
    // Payment details
    { fieldName: 'Text20', pages: '2', text: formData.rentPayableTo },
    
    // NSF charge
    { fieldName: 'undefined_4', pages: '2', text: (formData.chequeBounceCharge || 20).toFixed(2) },
    
    // ==================== SECTION 6: SERVICES AND UTILITIES ====================
    // Utilities responsibility
    { fieldName: 'Check Box18', pages: '2', text: formData.utilities?.electricity === 'landlord' ? 'true' : '' },
    { fieldName: 'Check Box19', pages: '2', text: formData.utilities?.electricity === 'tenant' ? 'true' : '' },
    { fieldName: 'Check Box20', pages: '2', text: formData.utilities?.heat === 'landlord' ? 'true' : '' },
    { fieldName: 'Check Box21', pages: '2', text: formData.utilities?.heat === 'tenant' ? 'true' : '' },
    { fieldName: 'Check Box22', pages: '2', text: formData.utilities?.water === 'landlord' ? 'true' : '' },
    { fieldName: 'Check Box23', pages: '2', text: formData.utilities?.water === 'tenant' ? 'true' : '' },
    
    // Services included (yes/no checkboxes)
    { fieldName: 'Check Box24', pages: '2', text: formData.utilities?.gas ? 'true' : '' },
    { fieldName: 'Check Box25', pages: '2', text: !formData.utilities?.gas ? 'true' : '' },
    { fieldName: 'Check Box26', pages: '2', text: formData.utilities?.airConditioning ? 'true' : '' },
    { fieldName: 'Check Box27', pages: '2', text: !formData.utilities?.airConditioning ? 'true' : '' },
    { fieldName: 'Check Box28', pages: '2', text: formData.utilities?.additionalStorage ? 'true' : '' },
    { fieldName: 'Check Box29', pages: '2', text: !formData.utilities?.additionalStorage ? 'true' : '' },
    
    // Laundry
    { fieldName: 'Check Box30', pages: '2', text: formData.utilities?.laundry === 'included' ? 'true' : '' },
    { fieldName: 'Check Box31', pages: '2', text: formData.utilities?.laundry === 'none' ? 'true' : '' },
    { fieldName: 'Check Box32', pages: '2', text: formData.utilities?.laundry === 'payPerUse' ? 'true' : '' },
    
    // Guest parking
    { fieldName: 'Check Box33', pages: '3', text: formData.utilities?.guestParking === 'included' ? 'true' : '' },
    { fieldName: 'Check Box34', pages: '3', text: formData.utilities?.guestParking === 'none' ? 'true' : '' },
    { fieldName: 'Check Box35', pages: '3', text: formData.utilities?.guestParking === 'payPerUse' ? 'true' : '' },
    
    // Services/utilities description
    { fieldName: 'Text21', pages: '3', text: formData.servicesDescription || '' },
    { fieldName: 'Text22', pages: '3', text: formData.utilitiesDescription || '' },
    
    // ==================== SECTION 7: RENT DISCOUNTS ====================
    { fieldName: 'Check Box36', pages: '3', text: !formData.hasRentDiscount ? 'true' : '' },
    { fieldName: 'Check Box37', pages: '3', text: formData.hasRentDiscount ? 'true' : '' },
    { fieldName: 'Text23', pages: '3', text: formData.rentDiscountDescription || '' },
    
    // ==================== SECTION 8: RENT DEPOSIT ====================
    { fieldName: 'Check Box38', pages: '3', text: !formData.requiresRentDeposit ? 'true' : '' },
    { fieldName: 'Check Box39', pages: '4', text: formData.requiresRentDeposit ? 'true' : '' },
    { fieldName: 'Text24', pages: '4', text: formData.requiresRentDeposit ? (formData.rentDepositAmount || 0).toFixed(2) : '' },
    
    // ==================== SECTION 9: KEY DEPOSIT ====================
    { fieldName: 'Check Box40', pages: '4', text: !formData.requiresKeyDeposit ? 'true' : '' },
    { fieldName: 'Check Box41', pages: '4', text: formData.requiresKeyDeposit ? 'true' : '' },
    { fieldName: 'Text25', pages: '4', text: formData.requiresKeyDeposit ? (formData.keyDepositAmount || 0).toFixed(2) : '' },
    { fieldName: 'Text26', pages: '4', text: formData.keyDepositDescription || '' },
    
    // ==================== SECTION 10: SMOKING ====================
    { fieldName: 'Check Box42', pages: '4', text: formData.smokingRules === 'none' ? 'true' : '' },
    { fieldName: 'Check Box43', pages: '4', text: formData.smokingRules === 'prohibited' || formData.smokingRules === 'allowed' || formData.smokingRules === 'designated' ? 'true' : '' },
    { fieldName: 'Text27', pages: '4', text: formData.smokingRulesDescription || '' },
    
    // ==================== SECTION 11: TENANT'S INSURANCE ====================
    { fieldName: 'Check Box44', pages: '4', text: !formData.requiresTenantInsurance ? 'true' : '' },
    { fieldName: 'Check Box45', pages: '4', text: formData.requiresTenantInsurance ? 'true' : '' },
    
    // ==================== SECTION 12-15: ADDITIONAL TERMS ====================
    // Additional terms (open text field)
    { fieldName: 'Text28', pages: '5', text: formData.additionalTerms || '' },
    { fieldName: 'Text29', pages: '5', text: formData.specialConditions || '' },
  ];

  // Filter out empty text values
  return fields.filter(f => f.text !== '');
}

/**
 * Generates a standard PDF using HTML-to-PDF conversion
 * This is the primary fallback when template filling is not available
 */
async function generateStandardPdf(
  formData: OntarioLeaseFormData,
  leaseId: string,
  userId: string
): Promise<GeneratePdfResponse> {
  try {
    // Generate HTML content for the Ontario Standard Lease
    const htmlContent = generateLeaseHtml(formData);
    
    // Check for external PDF generation service
    const pdfGeneratorUrl = Deno.env.get('PDF_GENERATOR_URL');
    const pdfApiKey = Deno.env.get('PDF_GENERATOR_API_KEY');
    
    let pdfBuffer: Uint8Array;
    
    if (pdfGeneratorUrl && pdfApiKey) {
      console.log('Using external PDF generator service');
      
      // Use external PDF generation service (e.g., html2pdf.app, DocRaptor)
      const response = await fetch(pdfGeneratorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pdfApiKey}`,
        },
        body: JSON.stringify({
          html: htmlContent,
          options: {
            format: 'Letter',
            margin: {
              top: '0.75in',
              right: '0.75in',
              bottom: '0.75in',
              left: '0.75in',
            },
          },
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF generator error:', errorText);
        throw new Error(`PDF generation service error: ${errorText}`);
      }
      
      pdfBuffer = new Uint8Array(await response.arrayBuffer());
      console.log('PDF generated via external service, size:', pdfBuffer.length, 'bytes');
    } else {
      console.log('No external PDF service, generating basic PDF');
      // Generate a basic PDF structure
      pdfBuffer = generateBasicPdf(htmlContent, formData);
    }
    
    // Store the PDF
    return await storePdf(pdfBuffer, leaseId, userId, 'standard');
  } catch (error) {
    console.error('Standard PDF generation error:', error);
    return {
      success: false,
      code: 'STANDARD_GENERATION_FAILED',
      error: `Standard PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generates HTML content for Ontario Standard Lease
 * Complete Sections 1-17 as per Ontario regulations
 */
function generateLeaseHtml(formData: OntarioLeaseFormData): string {
  const fullAddress = [
    formData.unitAddress.unit ? `Unit ${formData.unitAddress.unit}` : '',
    `${formData.unitAddress.streetNumber} ${formData.unitAddress.streetName}`,
    formData.unitAddress.city,
    formData.unitAddress.province,
    formData.unitAddress.postalCode,
  ].filter(Boolean).join(', ');
  
  const totalRent = (formData.baseRent || 0) + (formData.parkingRent || 0) + (formData.otherServicesRent || 0);
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  };

  const getDaySuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Generate other services rows if any
  let otherServicesHtml = '';
  if (formData.otherServices && formData.otherServices.length > 0) {
    otherServicesHtml = formData.otherServices.map((service, index) => `
      <tr>
        <td>${index === 0 ? 'Other Services' : ''}</td>
        <td>${service.description}</td>
        <td style="text-align: right;">${formatCurrency(service.amount)}</td>
      </tr>
    `).join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ontario Standard Lease Agreement</title>
  <style>
    @page {
      size: letter;
      margin: 0.75in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    
    .page {
      max-width: 7in;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 3px double #000;
      padding-bottom: 15px;
    }
    
    .header h1 {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    
    .header h2 {
      font-size: 12pt;
      font-weight: normal;
      font-style: italic;
    }
    
    .ontario-logo {
      font-size: 10pt;
      color: #666;
      margin-top: 8px;
    }
    
    .section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      background: #f5f5f5;
      padding: 6px 10px;
      margin-bottom: 10px;
      border-left: 3px solid #000;
      text-transform: uppercase;
    }
    
    .field-row {
      display: flex;
      margin-bottom: 6px;
      align-items: baseline;
    }
    
    .field-label {
      font-weight: bold;
      min-width: 160px;
      flex-shrink: 0;
      font-size: 10pt;
    }
    
    .field-value {
      flex: 1;
      border-bottom: 1px solid #999;
      padding-bottom: 1px;
      min-height: 1em;
      font-size: 10pt;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 10pt;
    }
    
    table th, table td {
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: left;
    }
    
    table th {
      background: #f0f0f0;
      font-weight: bold;
    }
    
    .checkbox {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 1px solid #000;
      margin-right: 6px;
      text-align: center;
      line-height: 10px;
      font-size: 9pt;
      vertical-align: middle;
    }
    
    .checkbox.checked::after {
      content: '✓';
    }
    
    .signature-block {
      margin-top: 30px;
      page-break-inside: avoid;
    }
    
    .signature-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .signature-box {
      width: 45%;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      height: 35px;
      margin-bottom: 3px;
    }
    
    .signature-label {
      font-size: 9pt;
      color: #444;
    }
    
    .conditional-section {
      background: #fafafa;
      padding: 10px;
      border: 1px solid #ddd;
      margin: 6px 0;
      font-size: 10pt;
    }
    
    .total-row {
      font-weight: bold;
      background: #e8e8e8;
    }
    
    .footer {
      margin-top: 30px;
      font-size: 8pt;
      color: #666;
      text-align: center;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>Ontario Standard Lease</h1>
      <h2>Residential Tenancy Agreement</h2>
      <div class="ontario-logo">
        Standard Form of Lease under the Residential Tenancies Act, 2006
      </div>
    </div>
    
    <!-- Section 1: Parties to the Agreement -->
    <div class="section">
      <div class="section-title">Section 1: Parties to the Agreement</div>
      <div class="field-row">
        <span class="field-label">Landlord(s):</span>
        <span class="field-value">${formData.landlordName}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Landlord Address:</span>
        <span class="field-value">${formData.landlordAddress || formData.landlordNoticeAddress}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Tenant(s):</span>
        <span class="field-value">${formData.tenantNames.filter(Boolean).join(', ')}</span>
      </div>
    </div>
    
    <!-- Section 2: Rental Unit -->
    <div class="section">
      <div class="section-title">Section 2: Rental Unit</div>
      <div class="field-row">
        <span class="field-label">Address:</span>
        <span class="field-value">${fullAddress}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Parking:</span>
        <span class="field-value">${formData.parkingDescription || 'None included'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Condominium:</span>
        <span class="field-value">
          <span class="checkbox ${formData.isCondo ? 'checked' : ''}"></span> Yes
          <span class="checkbox ${!formData.isCondo ? 'checked' : ''}" style="margin-left: 15px;"></span> No
        </span>
      </div>
    </div>
    
    <!-- Section 3: Contact Information -->
    <div class="section">
      <div class="section-title">Section 3: Contact Information</div>
      <div class="field-row">
        <span class="field-label">Address for Notices:</span>
        <span class="field-value">${formData.landlordNoticeAddress}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Email Notices:</span>
        <span class="field-value">
          <span class="checkbox ${formData.allowEmailNotices ? 'checked' : ''}"></span> 
          ${formData.allowEmailNotices ? `Yes - ${formData.landlordEmail}` : 'No'}
        </span>
      </div>
      <div class="field-row">
        <span class="field-label">Emergency Contact:</span>
        <span class="field-value">${formData.emergencyContactPhone}</span>
      </div>
    </div>
    
    <!-- Section 4: Term of Tenancy -->
    <div class="section">
      <div class="section-title">Section 4: Term of Tenancy</div>
      <div class="field-row">
        <span class="field-label">Start Date:</span>
        <span class="field-value">${formatDate(formData.tenancyStartDate)}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Term Type:</span>
        <span class="field-value">
          <span class="checkbox ${formData.tenancyType === 'fixed' ? 'checked' : ''}"></span> Fixed Term
          <span class="checkbox ${formData.tenancyType === 'month_to_month' ? 'checked' : ''}" style="margin-left: 15px;"></span> Month-to-Month
        </span>
      </div>
      ${formData.tenancyType === 'fixed' && formData.tenancyEndDate ? `
      <div class="field-row">
        <span class="field-label">End Date:</span>
        <span class="field-value">${formatDate(formData.tenancyEndDate)}</span>
      </div>
      ` : ''}
    </div>
    
    <!-- Section 5: Rent -->
    <div class="section">
      <div class="section-title">Section 5: Rent</div>
      <table>
        <thead>
          <tr>
            <th style="width: 30%;">Description</th>
            <th style="width: 45%;">Details</th>
            <th style="width: 25%; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Base Rent</td>
            <td>Lawful rent for the rental unit</td>
            <td style="text-align: right;">${formatCurrency(formData.baseRent)}</td>
          </tr>
          <tr>
            <td>Parking</td>
            <td>${formData.parkingDescription || 'N/A'}</td>
            <td style="text-align: right;">${formatCurrency(formData.parkingRent || 0)}</td>
          </tr>
          <tr>
            <td>Other Services</td>
            <td>Additional services included</td>
            <td style="text-align: right;">${formatCurrency(formData.otherServicesRent || 0)}</td>
          </tr>
          ${otherServicesHtml}
          <tr class="total-row">
            <td colspan="2"><strong>Total Lawful Rent</strong></td>
            <td style="text-align: right;"><strong>${formatCurrency(totalRent)}</strong></td>
          </tr>
        </tbody>
      </table>
      
      <div class="field-row">
        <span class="field-label">Rent Due:</span>
        <span class="field-value">${formData.rentPaymentDay}${getDaySuffix(formData.rentPaymentDay)} of each ${formData.paymentFrequency === 'monthly' ? 'month' : formData.paymentFrequency === 'weekly' ? 'week' : 'day'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Payable To:</span>
        <span class="field-value">${formData.rentPayableTo}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Payment Method:</span>
        <span class="field-value">${formData.paymentMethod === 'etransfer' ? 'e-Transfer' : formData.paymentMethod.charAt(0).toUpperCase() + formData.paymentMethod.slice(1)}</span>
      </div>
      ${formData.chequeBounceCharge ? `
      <div class="field-row">
        <span class="field-label">NSF Charge:</span>
        <span class="field-value">${formatCurrency(formData.chequeBounceCharge)}</span>
      </div>
      ` : ''}
    </div>
    
    <!-- Section 6: Services and Utilities -->
    <div class="section">
      <div class="section-title">Section 6: Services and Utilities</div>
      
      <p style="font-size: 10pt; font-weight: bold; margin-bottom: 8px;">Services Included:</p>
      <div style="margin-left: 20px; font-size: 10pt;">
        <p><span class="checkbox ${formData.utilities?.gas ? 'checked' : ''}"></span> Gas</p>
        <p><span class="checkbox ${formData.utilities?.airConditioning ? 'checked' : ''}"></span> Air Conditioning</p>
        <p><span class="checkbox ${formData.utilities?.additionalStorage ? 'checked' : ''}"></span> Additional Storage Space</p>
        <p><span class="checkbox ${formData.utilities?.laundry === 'included' ? 'checked' : ''}"></span> On-Site Laundry${formData.utilities?.laundry === 'payPerUse' ? ' (Pay Per Use)' : formData.utilities?.laundry === 'included' ? ' (No Charge)' : ''}</p>
        <p><span class="checkbox ${formData.utilities?.guestParking === 'included' || formData.utilities?.guestParking === 'payPerUse' ? 'checked' : ''}"></span> Guest Parking${formData.utilities?.guestParking === 'payPerUse' ? ' (Pay Per Use)' : formData.utilities?.guestParking === 'included' ? ' (No Charge)' : ''}</p>
      </div>
      
      ${formData.servicesDescription ? `
        <div class="field-row" style="margin-top: 10px;">
          <span class="field-label">Additional Services:</span>
          <span class="field-value">${formData.servicesDescription}</span>
        </div>
      ` : ''}
      
      <p style="font-size: 10pt; font-weight: bold; margin-top: 12px; margin-bottom: 8px;">Utility Responsibility:</p>
      <div style="margin-left: 20px; font-size: 10pt;">
        <p><strong>Electricity:</strong> ${formData.utilities?.electricity === 'landlord' ? 'Landlord' : 'Tenant'}</p>
        <p><strong>Heat:</strong> ${formData.utilities?.heat === 'landlord' ? 'Landlord' : 'Tenant'}</p>
        <p><strong>Water:</strong> ${formData.utilities?.water === 'landlord' ? 'Landlord' : 'Tenant'}</p>
      </div>
      
      ${formData.utilitiesDescription ? `
        <div class="field-row" style="margin-top: 10px;">
          <span class="field-label">Utility Details:</span>
          <span class="field-value">${formData.utilitiesDescription}</span>
        </div>
      ` : ''}
    </div>
    
    <!-- Section 7: Rent Discounts -->
    <div class="section">
      <div class="section-title">Section 7: Rent Discounts</div>
      ${formData.hasRentDiscount ? `
        <div class="conditional-section">
          ${formData.rentDiscountDescription || 'Rent discount as agreed between parties.'}
        </div>
      ` : '<p style="font-size: 10pt;">There is no rent discount.</p>'}
    </div>
    
    <!-- Section 8: Rent Deposit -->
    <div class="section">
      <div class="section-title">Section 8: Rent Deposit</div>
      ${formData.requiresRentDeposit ? `
        <div class="field-row">
          <span class="field-label">Deposit Amount:</span>
          <span class="field-value">${formatCurrency(formData.rentDepositAmount || 0)}</span>
        </div>
        <p style="font-size: 9pt; color: #666; margin-top: 6px;">
          This deposit can only be applied to the rent for the last rental period of the tenancy.
        </p>
      ` : '<p style="font-size: 10pt;">A rent deposit is not required.</p>'}
    </div>
    
    <!-- Section 9: Key Deposit -->
    <div class="section">
      <div class="section-title">Section 9: Key Deposit</div>
      ${formData.requiresKeyDeposit ? `
        <div class="field-row">
          <span class="field-label">Deposit Amount:</span>
          <span class="field-value">${formatCurrency(formData.keyDepositAmount || 0)}</span>
        </div>
        ${formData.keyDepositDescription ? `
          <div class="field-row">
            <span class="field-label">Description:</span>
            <span class="field-value">${formData.keyDepositDescription}</span>
          </div>
        ` : ''}
        <p style="font-size: 9pt; color: #666; margin-top: 6px;">
          This deposit is refundable upon return of all keys, remote entry devices, or access cards.
        </p>
      ` : '<p style="font-size: 10pt;">A key deposit is not required.</p>'}
    </div>
    
    <!-- Section 10: Smoking -->
    <div class="section">
      <div class="section-title">Section 10: Smoking</div>
      ${formData.smokingRules === 'prohibited' ? `
        <p style="font-size: 10pt;"><strong>Smoking is prohibited</strong> in the rental unit and on the property.</p>
        ${formData.smokingRulesDescription ? `<p style="font-size: 10pt; margin-top: 6px;">${formData.smokingRulesDescription}</p>` : ''}
      ` : formData.smokingRules === 'designated' ? `
        <p style="font-size: 10pt;"><strong>Smoking is allowed in designated areas only.</strong></p>
        ${formData.smokingRulesDescription ? `<p style="font-size: 10pt; margin-top: 6px;">${formData.smokingRulesDescription}</p>` : ''}
      ` : '<p style="font-size: 10pt;">No additional smoking rules beyond provincial law.</p>'}
      <p style="font-size: 9pt; color: #666; margin-top: 8px;">
        Note: Provincial law prohibits smoking in all indoor common areas of the building.
      </p>
    </div>
    
    <!-- Section 11: Tenant's Insurance -->
    <div class="section">
      <div class="section-title">Section 11: Tenant's Insurance</div>
      <p style="font-size: 10pt;">
        <span class="checkbox ${formData.requiresTenantInsurance ? 'checked' : ''}"></span>
        ${formData.requiresTenantInsurance 
          ? 'The tenant <strong>must have liability insurance</strong> at all times. If the landlord asks for proof of coverage, the tenant must provide it.' 
          : 'There are no tenant insurance requirements. However, tenants are encouraged to obtain contents insurance.'}
      </p>
    </div>
    
    <!-- Sections 12-14: Standard Terms -->
    <div class="section">
      <div class="section-title">Sections 12-14: Standard Terms</div>
      <p style="font-size: 9pt; color: #444; line-height: 1.5;">
        The standard terms and conditions as required by the Residential Tenancies Act, 2006 apply to this lease.
        These terms cover maintenance and repairs, assignment and subletting, and changes to the agreement.
        The tenant and landlord agree to comply with all applicable laws.
      </p>
    </div>
    
    ${formData.additionalTerms ? `
    <!-- Section 15: Additional Terms -->
    <div class="section">
      <div class="section-title">Section 15: Additional Terms</div>
      <div class="conditional-section">
        <p style="white-space: pre-wrap;">${formData.additionalTerms}</p>
      </div>
    </div>
    ` : ''}
    
    <!-- Section 16: Signatures -->
    <div class="section signature-block">
      <div class="section-title">Section 16: Signatures</div>
      <p style="margin-bottom: 15px; font-size: 10pt;">
        By signing below, the landlord(s) and tenant(s) agree to comply with the terms of this lease.
      </p>
      
      <div class="signature-row">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Landlord Signature</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Date</div>
        </div>
      </div>
      
      <div class="signature-row">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Tenant Signature</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Date</div>
        </div>
      </div>
    </div>
    
    <!-- Section 17: General Information -->
    <div class="section">
      <div class="section-title">Section 17: General Information</div>
      <p style="font-size: 9pt; color: #444;">
        This lease follows the Ontario Standard Lease format as required by the Residential Tenancies Act, 2006.
        For more information about tenant and landlord rights, visit the Landlord and Tenant Board website at tribunalsontario.ca/ltb.
      </p>
    </div>
    
    <div class="footer">
      <p>Generated on ${new Date().toLocaleDateString('en-CA')} via Aaralink Property Management</p>
      <p>Ontario Standard Lease Agreement • Residential Tenancies Act, 2006</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates a basic PDF when no external service is available
 * This creates a minimal valid PDF with the lease content
 */
function generateBasicPdf(htmlContent: string, formData: OntarioLeaseFormData): Uint8Array {
  // Create a basic PDF structure
  // Note: This is a minimal PDF - for production, use a proper PDF library or service
  
  const fullAddress = [
    formData.unitAddress.unit ? `Unit ${formData.unitAddress.unit}` : '',
    `${formData.unitAddress.streetNumber} ${formData.unitAddress.streetName}`,
    formData.unitAddress.city,
    formData.unitAddress.province,
    formData.unitAddress.postalCode,
  ].filter(Boolean).join(', ');

  const totalRent = (formData.baseRent || 0) + (formData.parkingRent || 0) + (formData.otherServicesRent || 0);
  
  // Create text content for the PDF
  const content = `
ONTARIO STANDARD LEASE
Residential Tenancy Agreement

SECTION 1: PARTIES
Landlord: ${formData.landlordName}
Tenant(s): ${formData.tenantNames.filter(Boolean).join(', ')}

SECTION 2: RENTAL UNIT
Address: ${fullAddress}
Parking: ${formData.parkingDescription || 'None'}
Condominium: ${formData.isCondo ? 'Yes' : 'No'}

SECTION 3: CONTACT INFORMATION
Notice Address: ${formData.landlordNoticeAddress}
Email: ${formData.allowEmailNotices ? formData.landlordEmail : 'N/A'}
Emergency: ${formData.emergencyContactPhone}

SECTION 4: TERM
Start Date: ${formData.tenancyStartDate}
Term: ${formData.tenancyType === 'fixed' ? 'Fixed Term' : 'Month-to-Month'}
${formData.tenancyEndDate ? `End Date: ${formData.tenancyEndDate}` : ''}

SECTION 5: RENT
Base Rent: $${formData.baseRent}
Parking: $${formData.parkingRent || 0}
Other: $${formData.otherServicesRent || 0}
Total: $${totalRent}
Due: ${formData.rentPaymentDay} of each month
Payable To: ${formData.rentPayableTo}
Method: ${formData.paymentMethod}

Generated: ${new Date().toISOString()}
  `.trim();

  // Encode content
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  
  // Create a minimal PDF structure
  // This is a simplified PDF - in production, use a proper library
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${contentBytes.length + 100} >>
stream
BT
/F1 10 Tf
50 750 Td
12 TL
${content.split('\n').map(line => `(${line.replace(/[()\\]/g, '\\$&')}) '`).join('\n')}
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000${400 + contentBytes.length} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${500 + contentBytes.length}
%%EOF`;

  return encoder.encode(pdfContent);
}

/**
 * Stores the generated PDF in Supabase Storage
 */
async function storePdf(
  pdfBuffer: Uint8Array,
  leaseId: string,
  userId: string,
  engineUsed: 'template' | 'standard'
): Promise<GeneratePdfResponse> {
  try {
    // Get current version
    const { data: existingDocs } = await supabase
      .from('lease_documents')
      .select('version')
      .eq('lease_id', leaseId)
      .order('version', { ascending: false })
      .limit(1);
    
    const newVersion = (existingDocs?.[0]?.version || 0) + 1;
    
    // Generate file path
    const timestamp = Date.now();
    const fileName = `leases/${userId}/${leaseId}/v${newVersion}-${timestamp}.pdf`;
    
    console.log('Uploading PDF to:', fileName);
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('lease-documents')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    
    // Create signed URL (valid for 1 year)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('lease-documents')
      .createSignedUrl(uploadData.path, 31536000); // 1 year in seconds
    
    if (urlError) {
      console.error('Error creating signed URL:', urlError);
      throw urlError;
    }
    
    console.log('PDF uploaded, URL:', urlData.signedUrl);
    
    // Update previous documents to not be current
    await supabase
      .from('lease_documents')
      .update({ is_current: false })
      .eq('lease_id', leaseId);
    
    // Create document record
    const { data: docData, error: docError } = await supabase
      .from('lease_documents')
      .insert({
        lease_id: leaseId,
        file_url: urlData.signedUrl,
        storage_key: uploadData.path,
        filename: `ontario-standard-lease-v${newVersion}.pdf`,
        mime_type: 'application/pdf',
        file_size: pdfBuffer.length,
        version: newVersion,
        is_current: true,
        uploaded_by: userId,
        engine_used: engineUsed,
      })
      .select()
      .single();
    
    if (docError) {
      console.error('Error creating document record:', docError);
    }
    
    // Update lease record
    const { error: updateError } = await supabase
      .from('leases')
      .update({
        status: 'generated',
        document_url: urlData.signedUrl,
        document_storage_key: uploadData.path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId);
    
    if (updateError) {
      console.error('Error updating lease record:', updateError);
    }
    
    return {
      success: true,
      documentUrl: urlData.signedUrl,
      documentId: docData?.id || uploadData.path,
      version: newVersion,
      engineUsed,
    };
  } catch (error) {
    console.error('Error storing PDF:', error);
    return {
      success: false,
      error: `Failed to store PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Main request handler
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body: GeneratePdfRequest = await req.json();
    const { leaseId, formData, useXfa = true } = body;
    
    if (!leaseId || !formData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing leaseId or formData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Generating PDF for lease:', leaseId);
    
    let result: GeneratePdfResponse;
    
    // Try template filling first if enabled
    if (useXfa && TEMPLATE_URL) {
      console.log('Attempting template filling...');
      const templateResult = await tryTemplateFilling(formData, leaseId, user.id);
      
      if (templateResult?.success) {
        result = templateResult;
      } else {
        // Fall back to standard generation
        console.log('Template filling failed, using standard generation');
        result = await generateStandardPdf(formData, leaseId, user.id);
        
        if (result.success) {
          result.code = 'FALLBACK_USED';
        }
      }
    } else {
      // Standard generation
      console.log('Using standard PDF generation');
      result = await generateStandardPdf(formData, leaseId, user.id);
    }
    
    console.log('PDF generation result:', result.success ? 'Success' : result.error);
    
    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
