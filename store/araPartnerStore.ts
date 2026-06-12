import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type ReferralStatus = 'pending' | 'approved' | 'rejected';
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'cancelled';
export type PaymentMethod = 'etransfer' | 'bank';

export interface AraPartner {
  id: string;
  userId: string;
  email?: string;
  fullName: string;
  phone?: string;
  companyName?: string;
  paymentMethod: PaymentMethod;
  etransferId?: string;
  bankTransit?: string;
  bankRouting?: string;
  bankAccount?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Referral {
  id: string;
  araPartnerId: string;
  landlordName: string;
  landlordPhone?: string;
  landlordEmail?: string;
  propertyAddress: string;
  status: ReferralStatus;
  subscriptionFee?: number;
  notes?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  commissionRules?: CommissionRule[];
}

export interface CommissionRule {
  id: string;
  referralId: string;
  commissionPercent: number;
  startDate: string;
  endDate?: string;
  createdAt: string;
}

export interface PayoutRecord {
  id: string;
  araPartnerId: string;
  referralId: string;
  payoutMonth: string;
  subscriptionFeeSnapshot: number;
  commissionPercentSnapshot: number;
  amount: number;
  paymentMethodSnapshot: string;
  etransferIdSnapshot?: string;
  bankDetailsSnapshot?: Record<string, string>;
  status: PayoutStatus;
  paidAt?: string;
  createdAt: string;
  referral?: { propertyAddress: string; landlordName: string };
}

interface AraPartnerStore {
  profile: AraPartner | null;
  referrals: Referral[];
  payouts: PayoutRecord[];
  isLoading: boolean;
  error: string | null;

  loadProfile: (userId: string) => Promise<void>;
  createProfile: (userId: string, data: Partial<AraPartner>) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<AraPartner>) => Promise<{ success: boolean; error?: string }>;
  loadReferrals: () => Promise<void>;
  submitReferral: (data: Omit<Referral, 'id' | 'araPartnerId' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; error?: string }>;
  loadPayouts: () => Promise<void>;
  clearError: () => void;
}

export const useAraPartnerStore = create<AraPartnerStore>((set, get) => ({
  profile: null,
  referrals: [],
  payouts: [],
  isLoading: false,
  error: null,

  loadProfile: async (userId: string) => {
    try {
      set({ isLoading: true, error: null });
      const { data, error } = await supabase
        .from('ara_partners')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set({
          profile: {
            id: data.id,
            userId: data.user_id,
            email: data.email,
            fullName: data.full_name,
            phone: data.phone,
            companyName: data.company_name,
            paymentMethod: data.payment_method,
            etransferId: data.etransfer_id,
            bankTransit: data.bank_transit,
            bankRouting: data.bank_routing,
            bankAccount: data.bank_account,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          },
          isLoading: false,
        });
      } else {
        set({ profile: null, isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load profile' });
    }
  },

  createProfile: async (userId: string, data: Partial<AraPartner>) => {
    try {
      set({ isLoading: true, error: null });
      const { data: created, error } = await supabase
        .from('ara_partners')
        .insert({
          user_id: userId,
          email: data.email,
          full_name: data.fullName || '',
          phone: data.phone,
          company_name: data.companyName,
          payment_method: data.paymentMethod || 'etransfer',
          etransfer_id: data.etransferId,
          bank_transit: data.bankTransit,
          bank_routing: data.bankRouting,
          bank_account: data.bankAccount,
        })
        .select()
        .single();

      if (error) throw error;

      set({
        profile: {
          id: created.id,
          userId: created.user_id,
          fullName: created.full_name,
          phone: created.phone,
          companyName: created.company_name,
          paymentMethod: created.payment_method,
          etransferId: created.etransfer_id,
          bankTransit: created.bank_transit,
          bankRouting: created.bank_routing,
          bankAccount: created.bank_account,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        },
        isLoading: false,
      });
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },

  updateProfile: async (data: Partial<AraPartner>) => {
    const profile = get().profile;
    if (!profile) return { success: false, error: 'No profile loaded' };
    try {
      set({ isLoading: true, error: null });
      const { error } = await supabase
        .from('ara_partners')
        .update({
          full_name: data.fullName,
          phone: data.phone,
          company_name: data.companyName,
          payment_method: data.paymentMethod,
          etransfer_id: data.etransferId,
          bank_transit: data.bankTransit,
          bank_routing: data.bankRouting,
          bank_account: data.bankAccount,
        })
        .eq('id', profile.id);

      if (error) throw error;

      set({ profile: { ...profile, ...data }, isLoading: false });
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },

  loadReferrals: async () => {
    const profile = get().profile;
    if (!profile) return;
    try {
      set({ isLoading: true, error: null });
      const { data, error } = await supabase
        .from('referrals')
        .select('*, commission_rules(*)')
        .eq('ara_partner_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({
        referrals: (data || []).map((r) => ({
          id: r.id,
          araPartnerId: r.ara_partner_id,
          landlordName: r.landlord_name,
          landlordPhone: r.landlord_phone,
          landlordEmail: r.landlord_email,
          propertyAddress: r.property_address,
          status: r.status,
          subscriptionFee: r.subscription_fee,
          notes: r.notes,
          approvedAt: r.approved_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          commissionRules: (r.commission_rules || []).map((c: any) => ({
            id: c.id,
            referralId: c.referral_id,
            commissionPercent: c.commission_percent,
            startDate: c.start_date,
            endDate: c.end_date,
            createdAt: c.created_at,
          })),
        })),
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load referrals' });
    }
  },

  submitReferral: async (data) => {
    const profile = get().profile;
    if (!profile) return { success: false, error: 'Profile not found' };
    try {
      set({ isLoading: true, error: null });
      const { error } = await supabase.from('referrals').insert({
        ara_partner_id: profile.id,
        landlord_name: data.landlordName,
        landlord_phone: data.landlordPhone,
        landlord_email: data.landlordEmail,
        property_address: data.propertyAddress,
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          set({ isLoading: false });
          return { success: false, error: 'This property address has already been referred.' };
        }
        throw error;
      }

      await get().loadReferrals();
      set({ isLoading: false });
      return { success: true };
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      return { success: false, error: error.message };
    }
  },

  loadPayouts: async () => {
    const profile = get().profile;
    if (!profile) return;
    try {
      set({ isLoading: true, error: null });
      const { data, error } = await supabase
        .from('payout_records')
        .select('*, referrals(property_address, landlord_name)')
        .eq('ara_partner_id', profile.id)
        .order('payout_month', { ascending: false });

      if (error) throw error;

      set({
        payouts: (data || []).map((p) => ({
          id: p.id,
          araPartnerId: p.ara_partner_id,
          referralId: p.referral_id,
          payoutMonth: p.payout_month,
          subscriptionFeeSnapshot: p.subscription_fee_snapshot,
          commissionPercentSnapshot: p.commission_percent_snapshot,
          amount: p.amount,
          paymentMethodSnapshot: p.payment_method_snapshot,
          etransferIdSnapshot: p.etransfer_id_snapshot,
          bankDetailsSnapshot: p.bank_details_snapshot,
          status: p.status,
          paidAt: p.paid_at,
          createdAt: p.created_at,
          referral: p.referrals
            ? { propertyAddress: p.referrals.property_address, landlordName: p.referrals.landlord_name }
            : undefined,
        })),
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load payouts' });
    }
  },

  clearError: () => set({ error: null }),
}));
