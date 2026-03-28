import { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { clearCorruptedSession, getUserProfile, supabase, upsertUserProfile, UserProfile } from '@/lib/supabase';

export type UserRole = 'landlord' | 'tenant' | 'manager';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  isSocialLogin: boolean;
  socialProvider?: 'google' | 'apple' | 'facebook' | null;
  emailVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  pendingVerificationEmail: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  signUp: (identifier: string, password: string, name: string, role: UserRole) => Promise<{ success: boolean; error?: string; needsVerification?: boolean; verificationType?: 'email' | 'phone'; verificationTarget?: string }>;
  signIn: (identifier: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  signOut: () => Promise<void>;
  signInWithGoogle: (role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  signInWithApple: (role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  signInWithFacebook: (role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (role: UserRole) => Promise<{ success: boolean; error?: string }>;
  updateAvatar: (avatarUrl: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  setPendingVerificationEmail: (email: string | null) => void;
}

// Platform-specific storage helper
const getStorageValue = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const setStorageValue = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error('Error setting storage value:', error);
  }
};

const removeStorageValue = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing storage value:', error);
  }
};

const isEmailIdentifier = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

const normalizePhoneIdentifier = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;

  const startsWithPlus = raw.startsWith('+');
  const digitsOnly = raw.replace(/\D/g, '');

  if (startsWithPlus) {
    if (digitsOnly.length < 8) return null;
    return `+${digitsOnly}`;
  }

  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }

  if (digitsOnly.length >= 8) {
    return `+${digitsOnly}`;
  }

  return null;
};

const resolveAuthIdentifier = (identifier: string): { type: 'email' | 'phone'; value: string; error?: string } => {
  const trimmed = identifier.trim();

  if (!trimmed) {
    return { type: 'email', value: '', error: 'Email or phone number is required' };
  }

  if (isEmailIdentifier(trimmed)) {
    return { type: 'email', value: trimmed.toLowerCase() };
  }

  const normalizedPhone = normalizePhoneIdentifier(trimmed);
  if (normalizedPhone) {
    return { type: 'phone', value: normalizedPhone };
  }

  return { type: 'email', value: '', error: 'Please enter a valid email or phone number' };
};

// Helper to convert Supabase user and profile to AuthUser
const toAuthUser = (user: User, profile: UserProfile | null, defaultRole?: UserRole): AuthUser => {
  const role = profile?.user_type || 
    (user.user_metadata?.role as UserRole) || 
    (user.user_metadata?.user_type as UserRole) || 
    defaultRole || 
    'tenant';

  const provider = user.app_metadata?.provider;
  const isSocialLogin = profile?.is_social_login || 
    provider === 'google' || 
    provider === 'apple' || 
    provider === 'facebook' || 
    false;

  return {
    id: user.id,
    email: user.email || '',
    name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '',
    role: role,
    phone: profile?.phone || user.phone || undefined,
    avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
    isSocialLogin: isSocialLogin,
    socialProvider: profile?.social_provider || 
      (isSocialLogin ? (provider as 'google' | 'apple' | 'facebook') : null),
    emailVerified: user.email_confirmed_at !== null,
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  pendingVerificationEmail: null,

  setPendingVerificationEmail: (email) => {
    set({ pendingVerificationEmail: email });
  },

  initialize: async () => {
    try {
      set({ isLoading: true });

      // Add timeout to prevent infinite hanging (10 seconds for better UX)
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Auth initialization timeout')), 10000)
      );

      const initPromise = (async () => {
        // Get session with better error handling
        let session = null;
        try {
          const { data, error } = await supabase.auth.getSession();
        
          if (error) {
            // If there's a session error, try to clear it and start fresh
            console.warn('Session error, clearing:', error.message);
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              // Ignore sign out errors
            }
            set({ isInitialized: true, isLoading: false });
            return;
          }
          
          session = data?.session;
        } catch (sessionError: any) {
          // Handle specific session scope errors
          if (sessionError?.message?.includes('missing destination name scopes') || 
              sessionError?.code === 'PGRST205' ||
              sessionError?.message?.includes('Session')) {
            console.warn('Session scope error detected, clearing corrupted session');
            try {
              await clearCorruptedSession();
            } catch (clearError) {
              console.error('Error clearing corrupted session:', clearError);
            }
          }
          console.error('Error getting session:', sessionError);
          set({ isInitialized: true, isLoading: false });
          return;
        }

        if (session?.user) {
          try {
            const profile = await getUserProfile(session.user.id);
            const savedRole = await getStorageValue('userRole') as UserRole | null;
            const authUser = toAuthUser(session.user, profile, savedRole || undefined);
            set({ user: authUser, session, isInitialized: true, isLoading: false });
          } catch (userError) {
            console.error('Error loading user profile:', userError);
            // Still mark as initialized even if profile load fails
            set({ isInitialized: true, isLoading: false });
          }
        } else {
          set({ isInitialized: true, isLoading: false });
        }

        // Listen for auth changes with error handling
        supabase.auth.onAuthStateChange(async (event, newSession) => {
          try {
            console.log('Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && newSession?.user) {
              const profile = await getUserProfile(newSession.user.id);
              const savedRole = await getStorageValue('userRole') as UserRole | null;
              const authUser = toAuthUser(newSession.user, profile, savedRole || undefined);
              set({ user: authUser, session: newSession });
            } else if (event === 'SIGNED_OUT') {
              set({ user: null, session: null });
            } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
              const profile = await getUserProfile(newSession.user.id);
              const savedRole = await getStorageValue('userRole') as UserRole | null;
              const authUser = toAuthUser(newSession.user, profile, savedRole || undefined);
              set({ user: authUser, session: newSession });
            }
          } catch (stateChangeError) {
            console.error('Error in auth state change handler:', stateChangeError);
            // Don't crash the app, just log the error
          }
        });
      })();

      // Race between timeout and init
      await Promise.race([initPromise, timeoutPromise]);
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ isInitialized: true, isLoading: false });
    }
  },

  signUp: async (identifier, password, name, role) => {
    try {
      set({ isLoading: true, error: null });

      // Prevent tenant self-signup - tenants must be invited
      if (role === 'tenant') {
        const errorMessage = 'Tenant accounts can only be created via invitation. Contact your landlord for access.';
        set({ isLoading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      const resolved = resolveAuthIdentifier(identifier);
      if (resolved.error) {
        set({ isLoading: false, error: resolved.error });
        return { success: false, error: resolved.error };
      }

      const signUpPayload = {
        password,
        options: {
          data: {
            full_name: name,
            role: role,
            user_type: role,
          },
        },
      };

      const { data, error } = await supabase.auth.signUp(
        resolved.type === 'email'
          ? { ...signUpPayload, email: resolved.value }
          : { ...signUpPayload, phone: resolved.value }
      );

      if (error) {
        // Handle specific error cases
        let errorMessage = error.message;
        
        // Check for duplicate credential error
        if (error.message.includes('User already registered') || 
            error.message.includes('already been registered') ||
            error.message.includes('already exists')) {
          errorMessage = resolved.type === 'phone'
            ? 'An account with this phone number already exists. Please login instead.'
            : 'An account with this email already exists. Please login instead.';
        }
        
        set({ isLoading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      // Supabase returns a user even for existing emails with email confirmation disabled
      // Check if user.identities is empty (indicates user already exists)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        const errorMessage = resolved.type === 'phone'
          ? 'An account with this phone number already exists. Please login instead.'
          : 'An account with this email already exists. Please login instead.';
        set({ isLoading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }

      if (data.user) {
        // NOTE: Profile creation is handled by the database trigger (handle_new_user)
        // which runs with SECURITY DEFINER to bypass RLS.
        // DO NOT call upsertUserProfile here - the user is not authenticated yet
        // (email not verified), so RLS would block the insert.

        // Save role to storage for local use
        await setStorageValue('userRole', role);
        await setStorageValue('userName', name);

        // Check if email confirmation is required
        // If user.identities is empty or email is not confirmed, verification is needed
        const needsVerification = resolved.type === 'phone'
          ? !data.user.phone_confirmed_at
          : !data.user.email_confirmed_at;

        if (needsVerification) {
          set({ 
            isLoading: false, 
            pendingVerificationEmail: resolved.value,
          });
          return {
            success: true,
            needsVerification: true,
            verificationType: resolved.type,
            verificationTarget: resolved.value,
          };
        }

        // If no verification needed, set user
        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email || (resolved.type === 'email' ? resolved.value : ''),
          name: name,
          role: role,
          phone: data.user.phone || (resolved.type === 'phone' ? resolved.value : undefined),
          isSocialLogin: false,
          emailVerified: data.user.email_confirmed_at !== null,
        };

        set({ user: authUser, session: data.session, isLoading: false });
        return {
          success: true,
          needsVerification: false,
          verificationType: resolved.type,
          verificationTarget: resolved.value,
        };
      }

      set({ isLoading: false });
      return { success: false, error: 'Failed to create account' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  signIn: async (identifier, password) => {
    try {
      set({ isLoading: true, error: null });

      const resolved = resolveAuthIdentifier(identifier);
      if (resolved.error) {
        set({ isLoading: false, error: resolved.error });
        return { success: false, error: resolved.error };
      }

      const { data, error } = await supabase.auth.signInWithPassword(
        resolved.type === 'email'
          ? { email: resolved.value, password }
          : { phone: resolved.value, password }
      );

      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      if (data.user) {
        const profile = await getUserProfile(data.user.id);

        if (profile?.account_status === 'suspended') {
          await supabase.auth.signOut();
          const suspendedMessage =
            'This account is not active. Please contact your landlord/property manager for a new invitation.';
          set({ isLoading: false, error: suspendedMessage, user: null, session: null });
          return { success: false, error: suspendedMessage };
        }

        const savedRole = await getStorageValue('userRole') as UserRole | null;
        const savedName = await getStorageValue('userName');
        
        const authUser = toAuthUser(data.user, profile, savedRole || undefined);
        
        if (!authUser.name && savedName) {
          authUser.name = savedName;
        }

        if (authUser.role) {
          await setStorageValue('userRole', authUser.role);
        }

        set({ user: authUser, session: data.session, isLoading: false });
        return { success: true, user: authUser };
      }

      set({ isLoading: false });
      return { success: false, error: 'Failed to sign in' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      
      await supabase.auth.signOut();
      await removeStorageValue('userRole');
      await removeStorageValue('userName');
      await removeStorageValue('pendingUserRole');
      
      set({ user: null, session: null, isLoading: false, pendingVerificationEmail: null });
    } catch (error) {
      console.error('Error signing out:', error);
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async (role?: UserRole) => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'com.aralink.app://oauth-redirect',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      if (role) {
        await setStorageValue('pendingUserRole', role);
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  signInWithApple: async (role?: UserRole) => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'com.aralink.app://oauth-redirect',
        },
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      if (role) {
        await setStorageValue('pendingUserRole', role);
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  signInWithFacebook: async (role?: UserRole) => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: 'com.aralink.app://oauth-redirect',
        },
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      if (role) {
        await setStorageValue('pendingUserRole', role);
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  updateAvatar: async (avatarUrl: string) => {
    const currentUser = get().user;
    if (!currentUser) {
      return { success: false, error: 'No user logged in' };
    }

    try {
      // Update profile in database
      const result = await upsertUserProfile({
        id: currentUser.id,
        avatar_url: avatarUrl,
      });

      if (result) {
        // Update local state
        set({ 
          user: { 
            ...currentUser, 
            avatarUrl 
          } 
        });
        return { success: true };
      }

      return { success: false, error: 'Failed to update avatar' };
    } catch (error) {
      console.error('Error updating avatar:', error);
      return { success: false, error: 'Failed to update avatar' };
    }
  },

  updateUserRole: async (role: UserRole) => {
    try {
      set({ isLoading: true, error: null });

      const { user } = get();
      if (!user) {
        set({ isLoading: false });
        return { success: false, error: 'No user logged in' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({ user_type: role, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error && error.code !== 'PGRST205') {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      await setStorageValue('userRole', role);
      set({ 
        user: { ...user, role },
        isLoading: false 
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  resetPassword: async (email: string) => {
    try {
      set({ isLoading: true, error: null });

      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
          ? `${window.location.origin.replace(/\/+$/, '')}/invite-auth`
          : 'com.aralink.app://invite-auth';

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return { success: false, error: error.message };
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      set({ isLoading: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Export helper hooks
export const useIsAuthenticated = () => {
  const user = useAuthStore((state) => state.user);
  return !!user;
};

export const useUserRole = () => {
  const user = useAuthStore((state) => state.user);
  return user?.role || null;
};
