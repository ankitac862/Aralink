import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
};

const readHashParams = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return new URLSearchParams();
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash);
};

const readQueryParams = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function InviteAuthScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { token: routerToken, email: routerEmail } = useLocalSearchParams<{ token?: string; email?: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [canResendLink, setCanResendLink] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendEmailInput, setResendEmailInput] = useState('');
  const [tokenAndEmail, setTokenAndEmail] = useState<{ token?: string; email?: string }>({
    token: routerToken,
    email: routerEmail,
  });

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardColor = isDark ? '#111827' : '#ffffff';
  const borderColor = isDark ? '#1f2937' : '#d1d5db';
  const textColor = isDark ? '#f9fafb' : '#0f172a';
  const secondaryText = isDark ? '#94a3b8' : '#64748b';
  const primaryColor = '#2A64F5';

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const waitForSession = async (maxAttempts = 15, delayMs = 1000) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        return data.session;
      }
      await sleep(delayMs);
    }
    return null;
  };

  useEffect(() => {
    let isMounted = true;
    const bootstrapInviteSession = async () => {
      try {
        setError(null);

        const hashParams = readHashParams();
        const queryParams = readQueryParams();

        // Check for Supabase auth errors (expired OTP, etc.)
        const errorCode = hashParams.get('error_code') || queryParams.get('error_code');
        const errorDescription =
          hashParams.get('error_description') || queryParams.get('error_description');

        if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
          setError('This invite link is already used or expired. Please request a fresh link.');
          setCanResendLink(true);
          setIsBootstrapping(false);
          return;
        }

        if (errorCode || errorDescription) {
          setError(errorDescription || `Auth error: ${errorCode}. Please request a fresh link.`);
          setCanResendLink(true);
          setIsBootstrapping(false);
          return;
        }

        // Extract email from URL
        const hashEmail = hashParams.get('email') || queryParams.get('email');
        setTokenAndEmail({
          token: undefined,
          email: hashEmail || routerEmail,
        });

        // Extract tokens but DO NOT WAIT for session setup
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const authCode = queryParams.get('code') || hashParams.get('code');

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            const cleaned = `${window.location.origin}${window.location.pathname}`;
            window.history.replaceState({}, document.title, cleaned);
          } catch {
            // no-op
          }
        }

        // Fire session setup in background (don't await it)
        if (accessToken && refreshToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(() => {
            if (isMounted) {
              setSessionReady(true);
            }
          }).catch((err) => {
            console.warn('setSession failed in background:', err);
            // Don't set error here - user can still try to set password
          });
        } else if (authCode) {
          supabase.auth.exchangeCodeForSession(authCode).then(() => {
            if (isMounted) {
              setSessionReady(true);
            }
          }).catch((err) => {
            console.warn('Code exchange failed in background:', err);
          });
        }

        // Show password form immediately without waiting
        if (isMounted) {
          setIsBootstrapping(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(`Failed to parse invite: ${err?.message || 'Unknown error'}`);
          setCanResendLink(true);
          setIsBootstrapping(false);
        }
      }
    };

    bootstrapInviteSession();

    return () => {
      isMounted = false;
    };
  }, [routerToken, routerEmail]);

  const handleSetPassword = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Poll for session to be ready (give it 5 seconds max)
      const maxWaitMs = 5000;
      const startTime = Date.now();
      let userAuthed = false;

      while (Date.now() - startTime < maxWaitMs) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          userAuthed = true;
          break;
        }
        await sleep(300);
      }

      if (!userAuthed) {
        // Even without session, try to get the current user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          setError(
            'Your session is not ready. Please request a fresh link using the button below.'
          );
          setCanResendLink(true);
          return;
        }
      }

      // Try to update password WITH A TIMEOUT
      const updatePromise = supabase.auth.updateUser({ password });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Password update timed out after 8 seconds')), 8000)
      );

      const { error: updateError } = await Promise.race([updatePromise, timeoutPromise]) as any;

      if (updateError) {
        throw updateError;
      }

      // Success!
      setSessionReady(true);
      showMessage('✓ Password Set', 'Your account is ready! Redirecting to login...');

      // Clear form and sign out immediately
      setPassword('');
      setConfirmPassword('');
      
      try {
        await withTimeout(supabase.auth.signOut(), 3000, 'Sign out timed out');
      } catch (signOutError) {
        console.warn('Sign out error (non-blocking):', signOutError);
      }

      router.replace('/');
    } catch (updateError: any) {
      const errorMsg = updateError?.message || 'Failed to set password. Please try again or request a fresh link.';
      setError(errorMsg);
      setCanResendLink(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendLink = async () => {
    // Get email from multiple possible sources
    let emailToUse = tokenAndEmail.email || routerEmail || resendEmailInput.trim();

    if (!emailToUse) {
      showMessage(
        'Missing Email',
        'Email address not found in invite. Enter the invited email to receive a fresh password link.'
      );
      return;
    }

    emailToUse = emailToUse.toLowerCase();

    try {
      setIsResending(true);

      // Build app redirect URL
      const webBase =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/invite-auth`
          : 'aralink://invite-auth';

      const redirectTo = webBase; // No custom params needed; Supabase handles the auth tokens

      // Send password reset email to the user
      // This will include a fresh magic link with access_token & refresh_token
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo,
      });

      if (resetError) {
        throw resetError;
      }

      showMessage(
        'Link Sent ✓',
        `A fresh password setup link has been sent to ${emailToUse}. Check your email (including spam folder) and click the newest link.`
      );

      // Clear errors and reset UI to allow re-bootstrapping
      setError(null);
      setCanResendLink(false);
      setIsBootstrapping(true);
      setSessionReady(false);
    } catch (resendError: any) {
      const errorMsg = resendError?.message || 'Could not send a fresh link. Please try again in a moment.';
      showMessage('Resend Failed', errorMsg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}> 
      <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}> 
        <ThemedText style={[styles.title, { color: textColor }]}>Set Your Password</ThemedText>
        <ThemedText style={[styles.subtitle, { color: secondaryText }]}> 
          {tokenAndEmail.email ? `Finish creating your account for ${tokenAndEmail.email}.` : 'Finish creating your invited account.'}
        </ThemedText>

        {isBootstrapping ? (
          <View style={styles.loaderBlock}>
            <ActivityIndicator size="small" color={primaryColor} />
            <ThemedText style={[styles.helperText, { color: secondaryText }]}>Preparing your invite...</ThemedText>
          </View>
        ) : (
          <>
            {tokenAndEmail.email && (
              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>Email</ThemedText>
                <View
                  style={[
                    styles.emailDisplay,
                    { backgroundColor: isDark ? '#0b1220' : '#f8fafc', borderColor },
                  ]}
                >
                  <ThemedText style={[styles.emailText, { color: textColor }]}>{tokenAndEmail.email}</ThemedText>
                </View>
              </View>
            )}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>New Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: isDark ? '#0b1220' : '#f8fafc', borderColor, color: textColor },
                ]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter a password"
                placeholderTextColor={secondaryText}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>Confirm Password</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: isDark ? '#0b1220' : '#f8fafc', borderColor, color: textColor },
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Re-enter your password"
                placeholderTextColor={secondaryText}
                autoCapitalize="none"
              />
            </View>

            {error && <ThemedText style={[styles.errorText, { color: '#dc2626' }]}>{error}</ThemedText>}

            {error && canResendLink && !tokenAndEmail.email && (
              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>Invited Email</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: isDark ? '#0b1220' : '#f8fafc', borderColor, color: textColor },
                  ]}
                  value={resendEmailInput}
                  onChangeText={setResendEmailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Enter invited email"
                  placeholderTextColor={secondaryText}
                />
              </View>
            )}

            {error && canResendLink && (
              <TouchableOpacity
                style={[styles.secondaryActionButton, { borderColor }]}
                onPress={handleResendLink}
                disabled={isResending}
              >
                {isResending ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <ThemedText style={[styles.secondaryActionButtonText, { color: primaryColor }]}>Resend Password Link</ThemedText>
                )}
              </TouchableOpacity>
            )}

            {error && (
              <TouchableOpacity
                style={[styles.secondaryActionButton, { borderColor }]}
                onPress={() => router.replace('/')}
                disabled={isResending}
              >
                <ThemedText style={[styles.secondaryActionButtonText, { color: textColor }]}>Back to Login</ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: primaryColor }, isSubmitting && styles.buttonDisabled]}
              onPress={handleSetPassword}
              disabled={isSubmitting || isBootstrapping}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <ThemedText style={styles.buttonText}>Set Password</ThemedText>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  loaderBlock: {
    paddingVertical: 12,
    alignItems: 'center',
    gap: 10,
  },
  helperText: {
    fontSize: 14,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  emailDisplay: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});