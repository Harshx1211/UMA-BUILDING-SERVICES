// useAuth — clean hook wrapping authStore with formatted error messages
import { useAuthStore } from '@/store/authStore';

export function useAuth() {
  const {
    user,
    session,
    isLoading,
    isAuthenticated,
    error,
    signIn,
    signOut,
    restoreSession,
    updateUser,
    clearError,
  } = useAuthStore();

  /** Human-readable error — maps Supabase codes to friendly messages */
  const friendlyError = error
    ? error
        .replace('Invalid login credentials', 'Incorrect email or password.')
        .replace('Email not confirmed', 'Please verify your email before signing in.')
        .replace('User not found', 'No account found with that email address.')
    : null;

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    error: friendlyError,
    rawError: error,
    signIn,
    signOut,
    restoreSession,
    updateUser,
    clearError,
    /** First name only, for greeting display */
    firstName: user?.full_name?.split(' ')[0] ?? 'Technician',
  };
}
