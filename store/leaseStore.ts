import { create } from 'zustand';

export type LeaseApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'lease_ready'
  | 'lease_signed';

export interface LeaseApplicationDraft {
  personal: {
    fullName: string;
    email: string;
    phone: string;
    dob: string;
  };
  residence: {
    currentAddress: string;
    currentLandlordName: string;
    currentLandlordContact: string;
    previousAddress: string;
    previousLandlordName: string;
    previousLandlordContact: string;
  };
  employment: {
    employerName: string;
    jobTitle: string;
    employmentType: string;
    annualIncome: string;
    additionalIncome?: string;
  };
  other: {
    occupants?: string;
    vehicleInfo?: string;
    pets: boolean;
    notes?: string;
  };
  documents: {
    governmentId?: string;
    proofOfIncome?: string;
    referenceLetter?: string;
    utilityBill?: string;
  };
}

export interface LeaseApplication {
  id: string;
  tenantId: string;
  tenantName: string;
  propertyId?: string;
  propertyAddress?: string;
  status: LeaseApplicationStatus;
  draft: LeaseApplicationDraft;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface DraftLease {
  applicationId: string;
  rent: number;
  deposit: number;
  startDate: string;
  endDate: string;
  allowPets: boolean;
  insuranceRequired: boolean;
}

interface LeaseStore {
  tenantDraft: LeaseApplicationDraft;
  primaryApplicantDraft: LeaseApplicationDraft; // Backup of primary applicant when adding co-applicants
  coApplicants: LeaseApplicationDraft[]; // Up to 11 co-applicants
  currentCoApplicantIndex: number | null; // Which co-applicant is being edited
  isAddingCoApplicant: boolean; // Whether user is in "add co-applicant" mode
  tenantApplication?: LeaseApplication;
  landlordApplications: LeaseApplication[];
  currentLeaseDraft?: DraftLease;

  updateDraft: (section: keyof LeaseApplicationDraft, data: Partial<LeaseApplicationDraft[keyof LeaseApplicationDraft]>) => void;
  submitDraft: (propertyId?: string, unitId?: string, subUnitId?: string, userId?: string, inviteId?: string) => Promise<string>;
  getTenantStatus: () => LeaseApplicationStatus | undefined;
  loadLandlordApplications: () => void;
  selectApplication: (id: string) => LeaseApplication | undefined;
  approveApplication: (id: string, terms: Omit<DraftLease, 'applicationId'>) => void;
  rejectApplication: (id: string) => void;
  requestMoreInfo: (id: string) => void;
  signLease: (applicationId: string, signature: string) => void;
  resetDraft: () => void;
  
  // Co-applicant methods
  startAddingCoApplicant: () => void; // Start adding a new co-applicant
  saveCurrentCoApplicant: () => void; // Save the current co-applicant being edited
  cancelAddingCoApplicant: () => void; // Cancel adding co-applicant
  editCoApplicant: (index: number) => void; // Edit an existing co-applicant
  removeCoApplicant: (index: number) => void; // Remove a co-applicant
  getCoApplicantCount: () => number; // Get total number of applicants (primary + co-applicants)
}

const initialDraft: LeaseApplicationDraft = {
  personal: {
    fullName: '',
    email: '',
    phone: '',
    dob: '',
  },
  residence: {
    currentAddress: '',
    currentLandlordName: '',
    currentLandlordContact: '',
    previousAddress: '',
    previousLandlordName: '',
    previousLandlordContact: '',
  },
  employment: {
    employerName: '',
    jobTitle: '',
    employmentType: '',
    annualIncome: '',
    additionalIncome: '',
  },
  other: {
    occupants: '',
    vehicleInfo: '',
    pets: false,
    notes: '',
  },
  documents: {},
};

// Mock data for landlord applications
const mockApplications: LeaseApplication[] = [
  {
    id: 'app-001',
    tenantId: 'tenant-001',
    tenantName: 'John Doe',
    propertyAddress: '123 Main St, Apt 4B',
    status: 'submitted',
    draft: {
      personal: {
        fullName: 'John Doe',
        email: 'john.doe@email.com',
        phone: '(123) 456-7890',
        dob: 'Jan 1, 1990',
      },
      residence: {
        currentAddress: '456 Oak Avenue, Anytown, USA',
        currentLandlordName: 'Jane Smith',
        currentLandlordContact: '(555) 123-4567',
        previousAddress: '789 Pine Street',
        previousLandlordName: 'Bob Johnson',
        previousLandlordContact: '(555) 987-6543',
      },
      employment: {
        employerName: 'Tech Corp',
        jobTitle: 'Software Engineer',
        employmentType: 'Full-time',
        annualIncome: '85000',
      },
      other: {
        pets: false,
      },
      documents: {
        governmentId: 'uploaded',
        proofOfIncome: 'uploaded',
        referenceLetter: 'uploaded',
        utilityBill: 'uploaded',
      },
    },
    submittedAt: new Date().toISOString(),
  },
];

export const useLeaseStore = create<LeaseStore>((set, get) => ({
  tenantDraft: initialDraft,
  primaryApplicantDraft: initialDraft,
  coApplicants: [],
  currentCoApplicantIndex: null,
  isAddingCoApplicant: false,
  tenantApplication: undefined,
  landlordApplications: mockApplications,
  currentLeaseDraft: undefined,

  updateDraft: (section, data) => {
    set((state) => ({
      tenantDraft: {
        ...state.tenantDraft,
        [section]: {
          ...state.tenantDraft[section],
          ...data,
        },
      },
    }));
  },

  submitDraft: async (propertyId?: string, unitId?: string, subUnitId?: string, userId?: string, inviteId?: string) => {
    const { tenantDraft, coApplicants } = get();
    const applicationId = `app-${Date.now()}`;
    
    console.log('📤 submitDraft called with:', { propertyId, unitId, subUnitId, userId, inviteId });
    console.log('📤 Total applicants:', coApplicants.length + 1, '(1 primary +', coApplicants.length, 'co-applicants)');
    console.log('📤 unitId type:', typeof unitId, 'value:', unitId);
    console.log('📤 subUnitId type:', typeof subUnitId, 'value:', subUnitId);
    console.log('📤 Are they empty strings?', { 
      unitIdIsEmptyString: unitId === '', 
      subUnitIdIsEmptyString: subUnitId === '' 
    });
    console.log('📤 Primary Applicant data:', {
      fullName: tenantDraft.personal.fullName,
      email: tenantDraft.personal.email,
      phone: tenantDraft.personal.phoneNumber,
    });
    
    const application: LeaseApplication = {
      id: applicationId,
      tenantId: userId || 'current-tenant',
      tenantName: tenantDraft.personal.fullName,
      status: 'submitted',
      draft: tenantDraft,
      submittedAt: new Date().toISOString(),
      propertyId, // Include propertyId if provided
    };

    // Save to local state
    set({
      tenantApplication: application,
      landlordApplications: [...get().landlordApplications, application],
    });

    // Save to database if we have required data
    if (propertyId && userId) {
      console.log('✅ Required data present, calling submitApplication API...');
      console.log('🔍 Passing to submitApplication:', {
        propertyId,
        unitId: unitId || undefined,
        subUnitId: subUnitId || undefined,
        unitIdAfterConversion: unitId || undefined,
        subUnitIdAfterConversion: subUnitId || undefined,
        coApplicantsCount: coApplicants.length,
      });
      
      const { submitApplication } = await import('@/lib/supabase');
      const result = await submitApplication({
        userId,
        propertyId,
        unitId: unitId && unitId !== '' ? unitId : undefined,
        subUnitId: subUnitId && subUnitId !== '' ? subUnitId : undefined,
        applicantName: tenantDraft.personal.fullName,
        applicantEmail: tenantDraft.personal.email,
        applicantPhone: tenantDraft.personal.phoneNumber,
        formData: tenantDraft,
        coApplicants: coApplicants, // Pass co-applicants to be saved
        inviteId,
      });

      if (result.success) {
        console.log('✅ Application saved to database:', result.applicationId);
        return result.applicationId || applicationId;
      } else {
        console.error('❌ Failed to save application to database:', result.error);
      }
    } else {
      console.warn('⚠️ Missing required data for database save:', { 
        hasPropertyId: !!propertyId, 
        hasUserId: !!userId 
      });
    }

    return applicationId;
  },

  getTenantStatus: () => {
    return get().tenantApplication?.status;
  },

  loadLandlordApplications: () => {
    // In a real app, this would fetch from backend
    set({ landlordApplications: mockApplications });
  },

  selectApplication: (id) => {
    return get().landlordApplications.find((app) => app.id === id);
  },

  approveApplication: (id, terms) => {
    const applications = get().landlordApplications.map((app) =>
      app.id === id
        ? {
            ...app,
            status: 'lease_ready' as LeaseApplicationStatus,
            reviewedAt: new Date().toISOString(),
          }
        : app
    );

    const tenantApp = get().tenantApplication;
    if (tenantApp?.id === id) {
      set({
        tenantApplication: {
          ...tenantApp,
          status: 'lease_ready',
          reviewedAt: new Date().toISOString(),
        },
      });
    }

    set({
      landlordApplications: applications,
      currentLeaseDraft: {
        applicationId: id,
        ...terms,
      },
    });
  },

  rejectApplication: (id) => {
    const applications = get().landlordApplications.map((app) =>
      app.id === id
        ? { ...app, status: 'rejected' as LeaseApplicationStatus, reviewedAt: new Date().toISOString() }
        : app
    );

    const tenantApp = get().tenantApplication;
    if (tenantApp?.id === id) {
      set({
        tenantApplication: {
          ...tenantApp,
          status: 'rejected',
          reviewedAt: new Date().toISOString(),
        },
      });
    }

    set({ landlordApplications: applications });
  },

  requestMoreInfo: (id) => {
    const applications = get().landlordApplications.map((app) =>
      app.id === id ? { ...app, status: 'under_review' as LeaseApplicationStatus } : app
    );
    set({ landlordApplications: applications });
  },

  signLease: (applicationId, signature) => {
    const applications = get().landlordApplications.map((app) =>
      app.id === applicationId
        ? { ...app, status: 'lease_signed' as LeaseApplicationStatus }
        : app
    );

    const tenantApp = get().tenantApplication;
    if (tenantApp?.id === applicationId) {
      set({
        tenantApplication: {
          ...tenantApp,
          status: 'lease_signed',
        },
      });
    }

    set({ landlordApplications: applications });
  },

  resetDraft: () => {
    set({ 
      tenantDraft: initialDraft,
      primaryApplicantDraft: initialDraft,
      coApplicants: [],
      currentCoApplicantIndex: null,
      isAddingCoApplicant: false,
    });
  },

  // Co-applicant methods
  startAddingCoApplicant: () => {
    const currentCount = get().coApplicants.length + 1; // +1 for primary applicant
    if (currentCount >= 12) {
      console.warn('⚠️ Maximum of 12 applicants reached');
      return;
    }
    
    // Save current primary applicant data before switching to co-applicant mode
    const { tenantDraft } = get();
    
    set({
      primaryApplicantDraft: { ...tenantDraft }, // Backup primary applicant
      tenantDraft: initialDraft, // Reset for co-applicant
      isAddingCoApplicant: true,
      currentCoApplicantIndex: null,
    });
    
    console.log('💾 Saved primary applicant data before adding co-applicant');
  },

  saveCurrentCoApplicant: () => {
    const { tenantDraft, coApplicants, currentCoApplicantIndex, primaryApplicantDraft } = get();
    
    // Validate that required fields are filled
    if (!tenantDraft.personal.fullName || !tenantDraft.personal.email) {
      console.error('❌ Co-applicant must have name and email');
      return;
    }

    if (currentCoApplicantIndex !== null) {
      // Editing existing co-applicant
      const updatedCoApplicants = [...coApplicants];
      updatedCoApplicants[currentCoApplicantIndex] = { ...tenantDraft };
      
      set({
        coApplicants: updatedCoApplicants,
        tenantDraft: { ...primaryApplicantDraft }, // Restore primary applicant
        isAddingCoApplicant: false,
        currentCoApplicantIndex: null,
      });
      
      console.log('✅ Updated co-applicant at index', currentCoApplicantIndex);
      console.log('✅ Restored primary applicant data');
    } else {
      // Adding new co-applicant
      const currentCount = coApplicants.length + 1; // +1 for primary
      if (currentCount >= 12) {
        console.warn('⚠️ Maximum of 12 applicants reached');
        return;
      }
      
      set({
        coApplicants: [...coApplicants, { ...tenantDraft }],
        tenantDraft: { ...primaryApplicantDraft }, // Restore primary applicant
        isAddingCoApplicant: false,
      });
      
      console.log('✅ Added new co-applicant. Total count:', currentCount + 1);
      console.log('✅ Restored primary applicant data');
    }
  },

  cancelAddingCoApplicant: () => {
    const { primaryApplicantDraft } = get();
    set({
      tenantDraft: { ...primaryApplicantDraft }, // Restore primary applicant
      isAddingCoApplicant: false,
      currentCoApplicantIndex: null,
    });
    console.log('✅ Cancelled co-applicant, restored primary applicant data');
  },

  editCoApplicant: (index: number) => {
    const { coApplicants, tenantDraft } = get();
    
    if (index < 0 || index >= coApplicants.length) {
      console.error('❌ Invalid co-applicant index:', index);
      return;
    }
    
    // Save current tenant draft (primary applicant) before editing co-applicant
    // Load the co-applicant data into tenantDraft for editing
    set({
      primaryApplicantDraft: { ...tenantDraft }, // Backup current data
      tenantDraft: { ...coApplicants[index] }, // Load co-applicant for editing
      isAddingCoApplicant: true,
      currentCoApplicantIndex: index,
    });
    
    console.log('✏️ Editing co-applicant at index', index);
    console.log('💾 Saved current data before editing');
  },

  removeCoApplicant: (index: number) => {
    const { coApplicants } = get();
    
    if (index < 0 || index >= coApplicants.length) {
      console.error('❌ Invalid co-applicant index:', index);
      return;
    }
    
    const updatedCoApplicants = coApplicants.filter((_, i) => i !== index);
    set({ coApplicants: updatedCoApplicants });
    
    console.log('🗑️ Removed co-applicant at index', index);
  },

  getCoApplicantCount: () => {
    return get().coApplicants.length + 1; // +1 for primary applicant
  },
}));

