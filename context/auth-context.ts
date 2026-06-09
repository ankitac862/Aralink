import { createContext } from 'react';

import { AuthUser, UserRole } from '@/store/authStore';

// Legacy context type for backwards compatibility
// New code should use useAuthStore directly from '@/store/authStore'
export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  signInWithGoogle: (role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (role: UserRole) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

// Default context value - should not be used directly
// Components should use useAuthStore hook instead
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  error: null,
  signIn: async () => ({ success: false, error: 'Not implemented' }),
  signUp: async () => ({ success: false, error: 'Not implemented' }),
  signOut: async () => {},
  signInWithGoogle: async () => ({ success: false, error: 'Not implemented' }),
  updateUserRole: async () => ({ success: false, error: 'Not implemented' }),
  resetPassword: async () => ({ success: false, error: 'Not implemented' }),
});

export type { AuthUser, UserRole };
