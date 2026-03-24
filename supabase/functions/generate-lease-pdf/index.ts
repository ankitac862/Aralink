/**
 * Supabase Edge Function: Generate Ontario Standard Lease PDF
 * 
 * FINAL VERSION: Uses annotations to draw checkmarks (✓) as visual elements
 * This ensures checkboxes are visible in ALL viewers (Safari, Chrome, downloaded PDFs)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const PDFCO_API_KEY = Deno.env.get('PDFCO_API_KEY');
const PDFCO_EDIT_ENDPOINT = 'https://api.pdf.co/v1/pdf/edit/add';

// [Keep all the same interfaces...]
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
  parkingSpaces?: string;
  isCondo: boolean;
}

interface Contact {
  unit?: string;
  streetNumber: string;
  streetName: string;
  poBox?: string;
  city: string;
  province: string;
  postalCode: string;
  emailConsent: boolean;
  email?: string;
  phoneNumber?: string;
}

interface Term {
  startDate: string;
  type: 'fixed' | 'month_to_month' | 'other';
  endDate?: string;
  otherDescription?: string;
}

interface Rent {
  dueDay: number;
  frequency: 'monthly' | 'weekly_daily';
  base: number;
  parking?: number;
  otherDescription?: string;
  otherAmount?: number;
  total: number;
  payableTo: string;
  paymentMethod: string;
  partial?: {
    amount: number;
    date: string;
    startDate: string;
    endDate: string;
  };
  nsfCharge?: number;
}

interface Services {
  gas: boolean;
  airConditioning: boolean;
  storage: boolean;
  laundry: 'none' | 'included' | 'coin' | 'pay_per_use';
  guestParking: 'none' | 'included' | 'paid' | 'other';
  other1: boolean;
  other2: boolean;
}

interface Utilities {
  electricity: 'landlord' | 'tenant';
  heat: 'landlord' | 'tenant';
  water: 'landlord' | 'tenant';
}

interface Discounts {
  hasDiscount: boolean;
  description?: string;
}

interface Deposits {
  rentDeposit: boolean;
  rentDepositAmount?: number;
  keyDeposit: boolean;
  keyDepositAmount?: number;
}

interface Smoking {
  hasRules: boolean;
  description?: string;
}

interface Insurance {
  required: boolean;
}

interface AdditionalTerms {
  hasTerms: boolean;
}

interface OntarioLeaseFormData {
  landlords: Landlord[];
  tenants: Tenant[];
  rentalUnit: RentalUnit;
  contact: Contact;
  term: Term;
  rent: Rent;
  services: Services;
  utilities: Utilities;
  discounts: Discounts;
  deposits: Deposits;
  smoking: Smoking;
  insurance: Insurance;
  additionalTerms: AdditionalTerms;
}

interface GeneratePdfRequest {
  leaseId: string;
  formData: OntarioLeaseFormData;
}

interface GeneratePdfResponse {
  success: boolean;
  documentUrl?: string;
  documentId?: string;
  version?: number;
  error?: string;
  code?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const TEMPLATE_URL = Deno.env.get('LEASE_TEMPLATE_URL') || '';

function formatCurrency(amount?: number): string {
  if (!amount) return '';
  return amount.toFixed(2);
}

/**
 * Build text fields AND checkbox annotations
 * Annotations draw visual checkmarks that work in all viewers
 */
function buildFieldsAndAnnotations(formData: OntarioLeaseFormData): { fields: any[], annotations: any[] } {
  const fields: any[] = [];
  const annotations: any[] = [];

  // Helper to add checkmark annotation
  // Note: Using X instead of ✓ to avoid box rendering issues
  const addCheckmark = (x: number, y: number, page: string) => {
    annotations.push({
      x: x + 2,
      y: y - 2,  // Adjusted Y to position inside checkbox
      text: 'X',
      fontSize: 9,
      fontName: 'Helvetica-Bold',
      color: '000000',
      pages: page
    });
  };

  console.log('🔧 Building fields and annotations from data');

  // ==================== SECTION 1: LANDLORDS (Page 1) ====================
  formData.landlords?.forEach((landlord, index) => {
    if (index < 4) {
      fields.push({
        fieldName: `landlord_name${index + 1}`,
        pages: '0',
        text: landlord.legalName
      });
    }
  });

  // ==================== SECTION 1: TENANTS (Pages 1-2) ====================
  formData.tenants?.forEach((tenant, index) => {
    if (index < 14) {
      fields.push({
        fieldName: `tenant_lastname${index + 1}`,
        pages: index < 9 ? '0' : '1',
        text: tenant.lastName
      });
      fields.push({
        fieldName: `tenant_firstname${index + 1}`,
        pages: index < 9 ? '0' : '1',
        text: tenant.firstName
      });
    }
  });

  // ==================== SECTION 2: RENTAL UNIT (Page 2) ====================
  if (formData.rentalUnit) {
    const unit = formData.rentalUnit;
    
    if (unit.unit) {
      fields.push({ fieldName: 'rental_unit', pages: '1', text: unit.unit });
    }
    
    fields.push({ fieldName: 'rental_street_number', pages: '1', text: unit.streetNumber });
    fields.push({ fieldName: 'rental_city', pages: '1', text: `${unit.streetName}, ${unit.city}` });
    fields.push({ fieldName: 'rental_postalcode', pages: '1', text: unit.postalCode });
    
    if (unit.parkingSpaces) {
      fields.push({ fieldName: 'rental_parking', pages: '1', text: unit.parkingSpaces });
    }
    
    // Condominium checkboxes - USE ANNOTATIONS
    console.log(`✓ Condo: ${unit.isCondo} (using annotation)`);
    if (unit.isCondo) {
      addCheckmark(18, 370, '1'); // rental_condominium_yes
    } else {
      addCheckmark(68, 371, '1'); // rental_condominium_no
    }
  }

  // ==================== SECTION 3: CONTACT INFORMATION (Page 2) ====================
  if (formData.contact) {
    const contact = formData.contact;
    
    if (contact.unit) {
      fields.push({ fieldName: 'contact_unit', pages: '1', text: contact.unit });
    }
    
    fields.push({ fieldName: 'contact_street_number', pages: '1', text: contact.streetNumber });
    fields.push({ fieldName: 'contact_street_name', pages: '1', text: contact.streetName });
    
    if (contact.poBox) {
      fields.push({ fieldName: 'contact_po_box', pages: '1', text: contact.poBox });
    }
    
    fields.push({ fieldName: 'contact_city', pages: '1', text: contact.city });
    fields.push({ fieldName: 'contact_province', pages: '1', text: contact.province });
    fields.push({ fieldName: 'contact_postalcode', pages: '1', text: contact.postalCode });
    
    // Email consent - USE ANNOTATIONS
    console.log(`✓ Email consent: ${contact.emailConsent} (using annotation)`);
    if (contact.emailConsent) {
      addCheckmark(20, 536, '1');
    } else {
      addCheckmark(68, 536, '1');
    }
    
    if (contact.email) {
      fields.push({ fieldName: 'contact_email', pages: '1', text: contact.email });
    }
    
    if (contact.phoneNumber) {
      fields.push({ fieldName: 'contact_number', pages: '1', text: contact.phoneNumber });
    }
  }

  // ==================== SECTION 4: TERM (Page 3) ====================
  if (formData.term) {
    const term = formData.term;
    
    // Term type - USE ANNOTATIONS
    console.log(`✓ Term: ${term.type} (using annotation)`);
    if (term.type === 'fixed') {
      addCheckmark(18, 56, '2');
    } else if (term.type === 'month_to_month') {
      addCheckmark(19, 82, '2');
    } else if (term.type === 'other') {
      addCheckmark(19, 103, '2');
    }
    
    if (term.type === 'other' && term.otherDescription) {
      fields.push({ fieldName: 'term_other_specify', pages: '2', text: term.otherDescription });
    }
  }

  // ==================== SECTION 5: RENT (Page 3) ====================
  if (formData.rent) {
    const rent = formData.rent;
    
    fields.push({ fieldName: 'rent_date', pages: '2', text: rent.dueDay.toString() });
    
    // Rent frequency - USE ANNOTATIONS
    console.log(`✓ Rent frequency: ${rent.frequency} (using annotation)`);
    if (rent.frequency === 'monthly') {
      addCheckmark(38, 209, '2');
    } else {
      addCheckmark(38, 228, '2');
    }
    
    fields.push({ fieldName: 'rent_amount_base', pages: '2', text: formatCurrency(rent.base) });
    
    if (rent.parking) {
      fields.push({ fieldName: 'rent_amount_parking', pages: '2', text: formatCurrency(rent.parking) });
    }
    
    if (rent.otherDescription) {
      fields.push({ fieldName: 'rent_other', pages: '2', text: rent.otherDescription });
    }
    
    if (rent.otherAmount) {
      fields.push({ fieldName: 'rent_amount_other', pages: '2', text: formatCurrency(rent.otherAmount) });
    }
    
    fields.push({ fieldName: 'rent_amount_total', pages: '2', text: formatCurrency(rent.total) });
    fields.push({ fieldName: 'rent_payable', pages: '2', text: rent.payableTo });
    fields.push({ fieldName: 'rent_method', pages: '2', text: rent.paymentMethod });
    
    if (rent.partial) {
      fields.push({ fieldName: 'partial_amount', pages: '2', text: formatCurrency(rent.partial.amount) });
      fields.push({ fieldName: 'partial_date', pages: '2', text: rent.partial.date });
      fields.push({ fieldName: 'partial_rent_start', pages: '2', text: rent.partial.startDate });
      fields.push({ fieldName: 'partial_date_end', pages: '2', text: rent.partial.endDate });
    }
    
    if (rent.nsfCharge) {
      fields.push({ fieldName: 'nsf_charge', pages: '2', text: formatCurrency(rent.nsfCharge) });
    }
  }

  // ==================== SECTION 6: SERVICES (Page 4) ====================
  if (formData.services) {
    const s = formData.services;
    
    console.log(`✓ Services: gas=${s.gas}, AC=${s.airConditioning}, storage=${s.storage} (using annotations)`);
    
    // Gas - USE ANNOTATIONS
    if (s.gas) {
      addCheckmark(332, 147, '3');
    }
    
    // Air Conditioning - USE ANNOTATIONS
    if (s.airConditioning) {
      addCheckmark(332, 169, '3');
    } else {
      addCheckmark(373, 169, '3');
    }
    
    // Storage - USE ANNOTATIONS
    if (s.storage) {
      addCheckmark(332, 190, '3');
    } else {
      addCheckmark(374, 189, '3');
    }
    
    // Laundry - USE ANNOTATIONS
    if (s.laundry !== 'none') {
      addCheckmark(332, 211, '3'); // yes
    } else {
      addCheckmark(373, 211, '3'); // no
    }
    
    if (s.laundry === 'included') {
      addCheckmark(409, 211, '3'); // no charge
    } else if (s.laundry === 'pay_per_use') {
      addCheckmark(479, 211, '3'); // pay per use
    }
    
    // Guest Parking - USE ANNOTATIONS
    if (s.guestParking !== 'none') {
      addCheckmark(331, 232, '3'); // yes
    } else {
      addCheckmark(373, 232, '3'); // no
    }
    
    if (s.guestParking === 'included') {
      addCheckmark(408, 232, '3');
    } else if (s.guestParking === 'paid') {
      addCheckmark(479, 231, '3');
    }
    
    // Other services - USE ANNOTATIONS
    if (s.other1) {
      addCheckmark(331, 254, '3');
    } else {
      addCheckmark(374, 254, '3');
    }
    
    if (s.other2) {
      addCheckmark(332, 274, '3');
    } else {
      addCheckmark(373, 274, '3');
    }
  }

  // ==================== UTILITIES (Page 4) ====================
  if (formData.utilities) {
    const u = formData.utilities;
    
    console.log(`✓ Utilities: elec=${u.electricity}, heat=${u.heat}, water=${u.water} (using annotations)`);
    
    // Electricity - USE ANNOTATIONS
    if (u.electricity === 'landlord') {
      addCheckmark(71, 630, '3');
    } else {
      addCheckmark(142, 629, '3');
    }
    
    // Heat - USE ANNOTATIONS
    if (u.heat === 'landlord') {
      addCheckmark(71, 651, '3');
    } else {
      addCheckmark(142, 651, '3');
    }
    
    // Water - USE ANNOTATIONS
    if (u.water === 'landlord') {
      addCheckmark(72, 672, '3');
    } else {
      addCheckmark(142, 672, '3');
    }
  }

  // ==================== SECTION 7: RENT DISCOUNT (Page 5) ====================
  if (formData.discounts) {
    console.log(`✓ Discount: ${formData.discounts.hasDiscount} (using annotation)`);
    
    if (formData.discounts.hasDiscount) {
      addCheckmark(19, 202, '4'); // yes
    } else {
      addCheckmark(19, 162, '4'); // no
    }
    
    if (formData.discounts.description) {
      fields.push({ fieldName: 'rent_discount_discription', pages: '4', text: formData.discounts.description });
    }
  }

  // ==================== SECTION 8: DEPOSITS (Page 5) ====================
  if (formData.deposits) {
    console.log(`✓ Deposits: rent=${formData.deposits.rentDeposit}, key=${formData.deposits.keyDeposit} (using annotations)`);
    
    // Rent deposit - USE ANNOTATIONS
    if (formData.deposits.rentDeposit) {
      addCheckmark(19, 431, '4'); // yes
    } else {
      addCheckmark(20, 395, '4'); // no
    }
    
    if (formData.deposits.rentDepositAmount) {
      fields.push({ fieldName: 'rent_deposit_amount', pages: '4', text: formatCurrency(formData.deposits.rentDepositAmount) });
    }
    
    // Key deposit - USE ANNOTATIONS
    if (formData.deposits.keyDeposit) {
      addCheckmark(20, 579, '4'); // yes
    } else {
      addCheckmark(20, 614, '4'); // no
    }
    
    if (formData.deposits.keyDepositAmount) {
      fields.push({ fieldName: 'key_deposit_amount', pages: '4', text: formatCurrency(formData.deposits.keyDepositAmount) });
    }
  }

  // ==================== SECTION 10: SMOKING (Page 6) ====================
  if (formData.smoking) {
    console.log(`✓ Smoking: ${formData.smoking.hasRules} (using annotation)`);
    
    if (formData.smoking.hasRules) {
      addCheckmark(19, 168, '5'); // yes
    } else {
      addCheckmark(20, 133, '5'); // no
    }
    
    if (formData.smoking.description) {
      fields.push({ fieldName: 'smoking_rule_description', pages: '5', text: formData.smoking.description });
    }
  }

  // ==================== SECTION 11: INSURANCE (Page 6) ====================
  if (formData.insurance) {
    console.log(`✓ Insurance: ${formData.insurance.required} (using annotation)`);
    
    if (formData.insurance.required) {
      addCheckmark(19, 410, '5'); // yes
    } else {
      addCheckmark(20, 375, '5'); // no
    }
  }

  // ==================== SECTION 15: ADDITIONAL TERMS (Page 7) ====================
  if (formData.additionalTerms) {
    console.log(`✓ Additional terms: ${formData.additionalTerms.hasTerms} (using annotation)`);
    
    if (formData.additionalTerms.hasTerms) {
      addCheckmark(20, 416, '6'); // yes
    } else {
      addCheckmark(20, 375, '6'); // no
    }
  }

  console.log(`📊 Total: ${fields.length} text fields, ${annotations.length} checkbox annotations`);

  return { fields, annotations };
}

async function generateLeaseWithPdfCo(
  formData: OntarioLeaseFormData,
  leaseId: string,
  userId: string
): Promise<GeneratePdfResponse> {
  if (!PDFCO_API_KEY || !TEMPLATE_URL) {
    return {
      success: false,
      code: 'CONFIG_ERROR',
      error: 'PDF.co API key or template URL not configured',
    };
  }

  try {
    console.log('🚀 Generating lease PDF:', leaseId);
    
    const { fields, annotations } = buildFieldsAndAnnotations(formData);
    
    if (fields.length === 0 && annotations.length === 0) {
      return {
        success: false,
        code: 'NO_FIELDS',
        error: 'No fields or annotations generated',
      };
    }
    
    const payload = {
      url: TEMPLATE_URL,
      name: `ontario-lease-${leaseId}.pdf`,
      async: false,
      fields: fields,
      annotations: annotations
    };
    
    console.log('📤 Sending to PDF.co...');
    console.log(`   Fields: ${fields.length}`);
    console.log(`   Annotations: ${annotations.length}`);
    
    const response = await fetch(PDFCO_EDIT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PDFCO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ PDF.co error:', errorText);
      return {
        success: false,
        code: 'PDFCO_ERROR',
        error: errorText,
      };
    }

    const result = await response.json();
    
    if (!result.url) {
      return {
        success: false,
        code: 'NO_URL',
        error: 'PDF.co did not return URL',
      };
    }

    console.log('✅ PDF generated with annotations');
    console.log('🔗 PDF URL:', result.url);

    const pdfResponse = await fetch(result.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    return await storePdf(new Uint8Array(pdfBuffer), leaseId, userId);

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      success: false,
      code: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function storePdf(
  pdfBuffer: Uint8Array,
  leaseId: string,
  userId: string
): Promise<GeneratePdfResponse> {
  try {
    const filename = `lease-${leaseId}-${Date.now()}.pdf`;
    const storagePath = `leases/${userId}/${filename}`;
    
    console.log('💾 Uploading to Supabase Storage...');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('lease-documents')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });
    
    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      throw uploadError;
    }
    
    console.log('✅ Uploaded successfully');
    
    const { data: urlData, error: urlError } = await supabase.storage
      .from('lease-documents')
      .createSignedUrl(storagePath, 31536000);
    
    if (urlError) throw urlError;
    
    console.log('🔗 Supabase URL:', urlData.signedUrl);
    
    await supabase
      .from('leases')
      .update({
        document_url: urlData.signedUrl,
        original_pdf_url: urlData.signedUrl,
        version: 1,
        document_storage_key: storagePath,
        status: 'generated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', leaseId);
    
    return {
      success: true,
      documentUrl: urlData.signedUrl,
      documentId: uploadData.path,
      version: 1,
    };
  } catch (error) {
    console.error('❌ Storage error:', error);
    return {
      success: false,
      code: 'STORAGE_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

serve(async (req) => {
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing auth' }),
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
    
    const { leaseId, formData }: GeneratePdfRequest = await req.json();
    
    if (!leaseId || !formData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('📨 Request received - leaseId:', leaseId);
    
    const result = await generateLeaseWithPdfCo(formData, leaseId, user.id);
    
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error('❌ Handler error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});