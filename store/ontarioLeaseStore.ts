/**
 * Ontario Lease Wizard Store
 * 
 * Manages the multi-step Ontario Standard Lease generation wizard.
 * Persists draft data between screens until finalized.
 */

import { create } from 'zustand';
import { 
  OntarioLeaseFormData, 
  DbLease, 
  createLease, 
  updateLeaseInDb,
  uploadLeaseDocument,
  fetchLeaseById,
} from '@/lib/supabase';
import {
  generateLeasePdf,
  sendLeaseToTenant as sendLeaseApi,
  getLeaseDocumentUrl,
  GeneratePdfResponse,
  SendLeaseResponse,
} from '@/services/lease-generation-service';

// Get first day of next month
const getFirstOfNextMonth = (): string => {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0];
};

// Default form data with sensible defaults - matching Ontario Standard Lease sections 1-17
const getDefaultFormData = (): OntarioLeaseFormData => ({
  // Section 1: Parties
  landlordName: '',
  landlordAddress: '',
  tenantNames: [''],
  
  // Section 2: Rental Unit
  unitAddress: {
    unit: '',
    streetNumber: '',
    streetName: '',
    city: '',
    province: 'ON', // Default to Ontario
    postalCode: '',
  },
  parkingDescription: '',
  isCondo: false,
  
  // Section 3: Contact Information
  landlordNoticeAddress: '',
  allowEmailNotices: true,
  landlordEmail: '',
  emergencyContactPhone: '',
  
  // Section 4: Term
  tenancyStartDate: getFirstOfNextMonth(),
  tenancyEndDate: '',
  tenancyType: 'month_to_month',
  paymentFrequency: 'monthly',
  
  // Section 5: Rent
  rentPaymentDay: 1,
  baseRent: 0,
  parkingRent: 0,
  otherServicesRent: 0,
  otherServicesDescription: '',
  rentPayableTo: '',
  paymentMethod: 'etransfer',
  chequeBounceCharge: 20,
  partialRentAmount: 0,
  partialRentFromDate: '',
  partialRentToDate: '',
  
  // Section 6: Services and Utilities
  utilities: {
    electricity: 'landlord',
    heat: 'landlord',
    water: 'landlord',
    gas: false,
    airConditioning: false,
    additionalStorage: false,
    laundry: 'none', // 'none' | 'included' | 'payPerUse'
    guestParking: 'none', // 'none' | 'included' | 'payPerUse'
  },
  servicesDescription: '',
  utilitiesDescription: '',
  
  // Section 7: Rent Discounts
  hasRentDiscount: false,
  rentDiscountDescription: '',
  
  // Section 8: Rent Deposit
  requiresRentDeposit: false,
  rentDepositAmount: 0,
  
  // Section 9: Key Deposit
  requiresKeyDeposit: false,
  keyDepositAmount: 0,
  keyDepositDescription: '',
  
  // Section 10: Smoking
  smokingRules: 'none', // 'none' | 'prohibited' | 'allowed' | 'designated'
  smokingRulesDescription: '',
  
  // Section 11: Tenant's Insurance
  requiresTenantInsurance: false,
  
  // Section 12-15: Additional Terms (handled in additionalTerms)
  additionalTerms: '',
  specialConditions: '',
  
  // Section 16-17: Signatures (handled at generation time)
  signatureDate: '',
});

interface OntarioLeaseWizardState {
  // Current step (1-6)
  currentStep: number;
  totalSteps: number;
  
  // Form data
  formData: OntarioLeaseFormData;
  
  // Property/tenant context
  propertyId: string | null;
  unitId: string | null;
  tenantId: string | null;
  
  // Draft lease (if saved to DB)
  draftLeaseId: string | null;
  
  // Loading/error states
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  // Form data updates
  updateFormData: (section: keyof OntarioLeaseFormData, value: any) => void;
  updateUnitAddress: (field: keyof OntarioLeaseFormData['unitAddress'], value: string) => void;
  addTenantName: () => void;
  removeTenantName: (index: number) => void;
  updateTenantName: (index: number, value: string) => void;
  
  // Context setters
  propertyContext: { propertyId?: string; unitId?: string; subUnitId?: string } | null;
  setPropertyContext: (context: { propertyId?: string; unitId?: string; subUnitId?: string; tenantId?: string }) => void;
  
  // Pre-fill from user profile
  prefillLandlordInfo: (name: string, email?: string, phone?: string, address?: string) => void;
  
  // Pre-fill from property
  prefillFromProperty: (address: {
    unit?: string;
    streetNumber: string;
    streetName: string;
    city: string;
    province: string;
    postalCode: string;
  }) => void;
  
  // Persistence
  saveDraft: (userId: string) => Promise<string | null>;
  loadDraft: (leaseId: string) => Promise<boolean>;
  
  // Generate/Upload/Send
  generateLease: (userId: string) => Promise<{ leaseId: string; documentUrl?: string } | null>;
  generateOfficialPdf: (userId: string) => Promise<GeneratePdfResponse>;
  uploadLease: (uri: string, userId: string) => Promise<{ leaseId: string; documentUrl: string } | null>;
  sendLease: (tenantEmail?: string, message?: string) => Promise<SendLeaseResponse>;
  
  // Document state
  documentUrl: string | null;
  documentVersion: number | null;
  engineUsed: 'xfa' | 'standard' | 'uploaded' | null;
  isSent: boolean;
  
  // Reset
  resetWizard: () => void;
}

export const useOntarioLeaseStore = create<OntarioLeaseWizardState>((set, get) => ({
  currentStep: 1,
  totalSteps: 8, // 7 main sections + review/generate
  
  formData: getDefaultFormData(),
  
  propertyId: null,
  unitId: null,
  tenantId: null,
  draftLeaseId: null,
  propertyContext: null,
  
  isLoading: false,
  isSaving: false,
  error: null,
  
  // Document state
  documentUrl: null,
  documentVersion: null,
  engineUsed: null,
  isSent: false,
  
  setStep: (step) => {
    if (step >= 1 && step <= get().totalSteps) {
      set({ currentStep: step, error: null });
    }
  },
  
  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps) {
      set({ currentStep: currentStep + 1, error: null });
    }
  },
  
  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      set({ currentStep: currentStep - 1, error: null });
    }
  },
  
  updateFormData: (section, value) => {
    set((state) => ({
      formData: {
        ...state.formData,
        [section]: value,
      },
    }));
  },
  
  updateUnitAddress: (field, value) => {
    set((state) => ({
      formData: {
        ...state.formData,
        unitAddress: {
          ...state.formData.unitAddress,
          [field]: value,
        },
      },
    }));
  },
  
  addTenantName: () => {
    set((state) => ({
      formData: {
        ...state.formData,
        tenantNames: [...state.formData.tenantNames, ''],
      },
    }));
  },
  
  removeTenantName: (index) => {
    set((state) => ({
      formData: {
        ...state.formData,
        tenantNames: state.formData.tenantNames.filter((_, i) => i !== index),
      },
    }));
  },
  
  updateTenantName: (index, value) => {
    set((state) => {
      const newNames = [...state.formData.tenantNames];
      newNames[index] = value;
      return {
        formData: {
          ...state.formData,
          tenantNames: newNames,
        },
      };
    });
  },
  
  setPropertyContext: (context) => {
    set({ 
      propertyId: context.propertyId || null, 
      unitId: context.unitId || null, 
      tenantId: context.tenantId || null,
      propertyContext: context,
    });
  },
  
  prefillLandlordInfo: (name, email, phone, address) => {
    set((state) => ({
      formData: {
        ...state.formData,
        landlordName: name || state.formData.landlordName,
        landlordEmail: email || state.formData.landlordEmail,
        emergencyContactPhone: phone || state.formData.emergencyContactPhone,
        landlordNoticeAddress: address || state.formData.landlordNoticeAddress,
        rentPayableTo: name || state.formData.rentPayableTo,
      },
    }));
  },
  
  prefillFromProperty: (address) => {
    set((state) => ({
      formData: {
        ...state.formData,
        unitAddress: {
          unit: address.unit || '',
          streetNumber: address.streetNumber,
          streetName: address.streetName,
          city: address.city,
          province: address.province || 'ON',
          postalCode: address.postalCode,
        },
      },
    }));
  },
  
  saveDraft: async (userId) => {
    const { formData, propertyId, unitId, tenantId, draftLeaseId } = get();
    
    if (!propertyId) {
      set({ error: 'Property ID is required' });
      return null;
    }
    
    set({ isSaving: true, error: null });
    
    try {
      if (draftLeaseId) {
        // Update existing draft
        const updated = await updateLeaseInDb(draftLeaseId, {
          form_data: formData,
          property_id: propertyId,
          unit_id: unitId || undefined,
          tenant_id: tenantId || undefined,
        });
        
        set({ isSaving: false });
        return updated?.id || null;
      } else {
        // Create new draft
        const created = await createLease({
          user_id: userId,
          property_id: propertyId,
          unit_id: unitId || undefined,
          tenant_id: tenantId || undefined,
          status: 'draft',
          form_data: formData,
        });
        
        if (created) {
          set({ draftLeaseId: created.id, isSaving: false });
          return created.id;
        }
        
        set({ isSaving: false, error: 'Failed to save draft' });
        return null;
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      set({ isSaving: false, error: 'Failed to save draft' });
      return null;
    }
  },
  
  loadDraft: async (leaseId) => {
    set({ isLoading: true, error: null });
    
    try {
      // This would fetch from Supabase
      // For now, just set the ID
      set({ draftLeaseId: leaseId, isLoading: false });
      return true;
    } catch (error) {
      console.error('Error loading draft:', error);
      set({ isLoading: false, error: 'Failed to load draft' });
      return false;
    }
  },
  
  generateLease: async (userId) => {
    const { formData, propertyId, unitId, tenantId, draftLeaseId } = get();
    
    if (!propertyId) {
      set({ error: 'Property ID is required' });
      return null;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      let leaseId = draftLeaseId;
      
      // Create lease record if not exists
      if (!leaseId) {
        const created = await createLease({
          user_id: userId,
          property_id: propertyId,
          unit_id: unitId || undefined,
          tenant_id: tenantId || undefined,
          status: 'draft',
          form_data: formData,
          effective_date: formData.tenancyStartDate,
          expiry_date: formData.tenancyEndDate || undefined,
        });
        
        if (created) {
          leaseId = created.id;
          set({ draftLeaseId: created.id });
        } else {
          set({ isLoading: false, error: 'Failed to create lease record' });
          return null;
        }
      }
      
      // Generate PDF using the edge function
      const pdfResult = await generateLeasePdf(leaseId, formData);
      
      if (!pdfResult.success) {
        set({ 
          isLoading: false, 
          error: pdfResult.error || 'Failed to generate PDF' 
        });
        return null;
      }
      
      // Update state with document info
      set({ 
        isLoading: false,
        documentUrl: pdfResult.documentUrl || null,
        documentVersion: pdfResult.version || 1,
        engineUsed: pdfResult.engineUsed || 'standard',
        error: pdfResult.warning || null, // Show warning if fallback was used
      });
      
      return { leaseId, documentUrl: pdfResult.documentUrl };
    } catch (error) {
      console.error('Error generating lease:', error);
      set({ isLoading: false, error: 'Failed to generate lease' });
      return null;
    }
  },
  
  /**
   * Generate official PDF with XFA template (with automatic fallback)
   */
  generateOfficialPdf: async (userId) => {
    const { formData, propertyId, unitId, tenantId, draftLeaseId } = get();
    
    if (!propertyId) {
      return { success: false, error: 'Property ID is required' };
    }
    
    set({ isLoading: true, error: null });
    
    try {
      let leaseId = draftLeaseId;
      
      // Create lease record if not exists
      if (!leaseId) {
        const created = await createLease({
          user_id: userId,
          property_id: propertyId,
          unit_id: unitId || undefined,
          tenant_id: tenantId || undefined,
          status: 'draft',
          form_data: formData,
          effective_date: formData.tenancyStartDate,
          expiry_date: formData.tenancyEndDate || undefined,
        });
        
        if (created) {
          leaseId = created.id;
          set({ draftLeaseId: created.id });
        } else {
          set({ isLoading: false });
          return { success: false, error: 'Failed to create lease record' };
        }
      } else {
        // Update form data before generating
        await updateLeaseInDb(leaseId, {
          form_data: formData,
        });
      }
      
      // Generate PDF using edge function (tries XFA first, then fallback)
      const result = await generateLeasePdf(leaseId, formData, { useXfa: true });
      
      if (result.success) {
        set({
          isLoading: false,
          documentUrl: result.documentUrl || null,
          documentVersion: result.version || 1,
          engineUsed: result.engineUsed || 'standard',
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: result.error || 'PDF generation failed',
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error generating official PDF:', error);
      set({ isLoading: false, error: 'Failed to generate PDF' });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate PDF' 
      };
    }
  },
  
  /**
   * Send the generated lease to tenant
   */
  sendLease: async (tenantEmail, message) => {
    const { draftLeaseId, documentUrl } = get();
    
    if (!draftLeaseId) {
      return { success: false, error: 'No lease to send. Generate or upload a lease first.' };
    }
    
    if (!documentUrl) {
      return { success: false, error: 'No document attached. Generate or upload a PDF first.' };
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const result = await sendLeaseApi(draftLeaseId, {
        tenantEmail,
        message,
      });
      
      if (result.success) {
        set({
          isLoading: false,
          isSent: true,
        });
      } else {
        set({
          isLoading: false,
          error: result.error || 'Failed to send lease',
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error sending lease:', error);
      set({ isLoading: false, error: 'Failed to send lease' });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send lease' 
      };
    }
  },
  
  uploadLease: async (uri, userId) => {
    const { propertyId, unitId, tenantId, draftLeaseId } = get();
    
    if (!propertyId) {
      set({ error: 'Property ID is required' });
      return null;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      // Create lease entry if not exists
      let leaseId = draftLeaseId;
      
      if (!leaseId) {
        const created = await createLease({
          user_id: userId,
          property_id: propertyId,
          unit_id: unitId || undefined,
          tenant_id: tenantId || undefined,
          status: 'uploaded',
          form_data: get().formData,
        });
        
        if (created) {
          leaseId = created.id;
          set({ draftLeaseId: created.id });
        }
      }
      
      if (!leaseId) {
        set({ isLoading: false, error: 'Failed to create lease record' });
        return null;
      }
      
      // Upload the document
      const uploadResult = await uploadLeaseDocument(uri, leaseId, userId);
      
      if (!uploadResult.success || !uploadResult.url) {
        set({ isLoading: false, error: uploadResult.error || 'Failed to upload document' });
        return null;
      }
      
      // Update lease with document URL
      await updateLeaseInDb(leaseId, {
        status: 'uploaded',
        document_url: uploadResult.url,
      });
      
      set({ isLoading: false });
      
      return { leaseId, documentUrl: uploadResult.url };
    } catch (error) {
      console.error('Error uploading lease:', error);
      set({ isLoading: false, error: 'Failed to upload lease' });
      return null;
    }
  },
  
  resetWizard: () => {
    set({
      currentStep: 1,
      formData: getDefaultFormData(),
      propertyId: null,
      unitId: null,
      tenantId: null,
      draftLeaseId: null,
      propertyContext: null,
      isLoading: false,
      isSaving: false,
      error: null,
      documentUrl: null,
      documentVersion: null,
      engineUsed: null,
      isSent: false,
    });
  },
}));
