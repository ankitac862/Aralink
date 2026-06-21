import { useAuthStore, useIsAuthenticated, useUserRole, UserRole, AuthUser } from '@/store/authStore';

// Re-export the auth store hooks for backwards compatibility
export { useAuthStore, useIsAuthenticated, useUserRole };
export type { UserRole, AuthUser };

// Main hook for using auth in components
export function useAuth() {
  const {
    user,
    session,
    isLoading,
    isInitialized,
    error,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    updateUserRole,
    resetPassword,
    clearError,
  } = useAuthStore();

  return {
    // State
    user,
    session,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    error,

    // Actions
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    updateUserRole,
    resetPassword,
    clearError,
  };
}
