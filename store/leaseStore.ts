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
    const { tenantDraft } = get();
    const applicationId = `app-${Date.now()}`;
    
    console.log('📤 submitDraft called with:', { propertyId, unitId, subUnitId, userId, inviteId });
    console.log('📤 unitId type:', typeof unitId, 'value:', unitId);
    console.log('📤 subUnitId type:', typeof subUnitId, 'value:', subUnitId);
    console.log('📤 Are they empty strings?', { 
      unitIdIsEmptyString: unitId === '', 
      subUnitIdIsEmptyString: subUnitId === '' 
    });
    console.log('📤 Application data:', {
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
    set({ tenantDraft: initialDraft });
  },
}));

