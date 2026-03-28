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
import {
  completeApplicantInvitePassword,
  completeApplicantInvitePasswordWithSession,
  fetchPendingTenantInvitationForSignup,
  getInviteDetails,
  supabase,
} from '@/lib/supabase';

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
  const [tokenAndEmail, setTokenAndEmail] = useState<{ token?: string; email?: string }>({
    token: routerToken,
    email: routerEmail,
  });
  const [isRedirecting, setIsRedirecting] = useState(false);

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

  useEffect(() => {
    let isMounted = true;
    const bootstrapInviteSession = async () => {
      try {
        setError(null);

        const queryEarly = readQueryParams();
        const paramToken =
          (Array.isArray(routerToken) ? routerToken[0] : routerToken) ||
          queryEarly.get('token') ||
          undefined;
        const paramEmail =
          (Array.isArray(routerEmail) ? routerEmail[0] : routerEmail) ||
          queryEarly.get('email') ||
          undefined;

        // Tenant activation (tenant_invitations) — separate from property applicant invites.
        if (paramToken && paramEmail) {
          setIsRedirecting(true);
          const pending = await fetchPendingTenantInvitationForSignup(paramToken, paramEmail);
          if (pending && isMounted) {
            router.replace({
              pathname: '/activate-tenant',
              params: { token: paramToken, email: paramEmail },
            });
            return;
          }
          if (isMounted) setIsRedirecting(false);

          const propertyInvite = await getInviteDetails({
            token: paramToken,
            tenantEmail: paramEmail,
          });
          if (propertyInvite?.hasSetPassword && isMounted) {
            setError('This link is expired or already used');
            setIsBootstrapping(false);
            return;
          }
        }

        const hashParams = readHashParams();
        const queryParams = readQueryParams();

        // Check for Supabase auth errors (expired OTP, etc.)
        const errorCode = hashParams.get('error_code') || queryParams.get('error_code');
        const errorDescription =
          hashParams.get('error_description') || queryParams.get('error_description');

        if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
          if (paramToken && paramEmail) {
            const pending = await fetchPendingTenantInvitationForSignup(paramToken, paramEmail);
            if (pending && isMounted) {
              router.replace({
                pathname: '/activate-tenant',
                params: { token: paramToken, email: paramEmail },
              });
              return;
            }
            const inviteDetails = await getInviteDetails({
              token: paramToken,
              tenantEmail: paramEmail,
            });
            if (inviteDetails?.hasSetPassword && isMounted) {
              setError('This link is expired or already used');
              setIsBootstrapping(false);
              return;
            }
            if (inviteDetails?.inviteStatus === 'pending' && isMounted) {
              setError(null);
              setTokenAndEmail({ token: paramToken, email: paramEmail });
              setIsBootstrapping(false);
              return;
            }
          }
          if (isMounted) {
            setError('This link is expired or already used');
            setIsBootstrapping(false);
          }
          return;
        }

        if (errorCode || errorDescription) {
          setError(
            errorDescription ||
              `Something went wrong with this link (${errorCode}). Ask your landlord to send a new invitation if you need access.`
          );
          setIsBootstrapping(false);
          return;
        }

        const hashEmail = hashParams.get('email') || queryParams.get('email');
        const routerEmailSingle = Array.isArray(routerEmail) ? routerEmail[0] : routerEmail;
        const mergedToken =
          paramToken || queryParams.get('token') || undefined;
        const mergedEmail =
          paramEmail || queryParams.get('email') || hashEmail || routerEmailSingle || undefined;
        setTokenAndEmail({
          token: mergedToken,
          email: mergedEmail,
        });

        // Extract tokens but DO NOT WAIT for session setup
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const authCode = queryParams.get('code') || hashParams.get('code');

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            // Keep ?token=&email= so repeat visits / resend still know the property invite context
            const cleaned = `${window.location.origin}${window.location.pathname}${window.location.search}`;
            window.history.replaceState({}, document.title, cleaned);
          } catch {
            // no-op
          }
        }

        // Establish session so we have user email for password completion (redirect_to has no ?token= now).
        if (accessToken && refreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            const { data: userData } = await supabase.auth.getUser();
            const sessionEmail = userData?.user?.email;
            if (sessionEmail && isMounted) {
              setTokenAndEmail((prev) => ({
                token: prev.token ?? mergedToken,
                email: prev.email ?? mergedEmail ?? sessionEmail,
              }));
            }
          } catch (err) {
            console.warn('setSession failed:', err);
          }
        } else if (authCode) {
          try {
            await supabase.auth.exchangeCodeForSession(authCode);
            const { data: userData } = await supabase.auth.getUser();
            const sessionEmail = userData?.user?.email;
            if (sessionEmail && isMounted) {
              setTokenAndEmail((prev) => ({
                token: prev.token ?? mergedToken,
                email: prev.email ?? mergedEmail ?? sessionEmail,
              }));
            }
          } catch (err) {
            console.warn('Code exchange failed:', err);
          }
        }

        if (isMounted) {
          setIsBootstrapping(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(`Failed to parse invite: ${err?.message || 'Unknown error'}`);
          setIsBootstrapping(false);
        }
      }
    };

    bootstrapInviteSession();

    return () => {
      isMounted = false;
    };
  }, [router, routerToken, routerEmail]);

  const handleSetPassword = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    const rawToken = Array.isArray(tokenAndEmail.token)
      ? tokenAndEmail.token[0]
      : tokenAndEmail.token;
    const rawEmail = Array.isArray(tokenAndEmail.email)
      ? tokenAndEmail.email[0]
      : tokenAndEmail.email;

    try {
      setIsSubmitting(true);
      setError(null);

      if (rawToken && rawEmail) {
        const { error: edgeError } = await completeApplicantInvitePassword({
          token: rawToken,
          email: rawEmail,
          password,
        });
        if (edgeError) {
          setError(edgeError);
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: rawEmail,
          password,
        });
        if (signInError) {
          setError(signInError.message || 'Could not sign in after setting password.');
          return;
        }
        setPassword('');
        setConfirmPassword('');
        showMessage('✓ Password Set', 'Your account is ready.');
        router.replace('/');
        return;
      }

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
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          setError(
            'Your session is not ready. Open the link from your invitation email again, or use the link that includes your email in the address bar.'
          );
          return;
        }
      }

      const { error: edgeSessionError } = await completeApplicantInvitePasswordWithSession({ password });
      if (edgeSessionError) {
        setError(edgeSessionError);
        return;
      }

      setPassword('');
      setConfirmPassword('');
      showMessage('✓ Password Set', 'Your account is ready.');
      router.replace('/');
    } catch (updateError: unknown) {
      const errorMsg =
        updateError instanceof Error
          ? updateError.message
          : 'Failed to set password. Try again or ask your landlord to send a new invitation.';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}> 
      <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}> 
        <ThemedText style={[styles.title, { color: textColor }]}>Set Your Password</ThemedText>
        <ThemedText style={[styles.subtitle, { color: secondaryText }]}> 
          {tokenAndEmail.email ? `Finish creating your account for ${tokenAndEmail.email}.` : 'Finish creating your invited account.'}
        </ThemedText>

        {(isBootstrapping || isRedirecting) ? (
          <View style={styles.loaderBlock}>
            <ActivityIndicator size="small" color={primaryColor} />
            <ThemedText style={[styles.helperText, { color: secondaryText }]}>
              {isRedirecting ? 'Opening activation…' : 'Preparing your invite...'}
            </ThemedText>
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

            {error && (
              <TouchableOpacity
                style={[styles.secondaryActionButton, { borderColor }]}
                onPress={() => router.replace('/(auth)/login')}
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