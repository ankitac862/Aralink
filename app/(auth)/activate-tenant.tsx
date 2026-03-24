import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

export default function ActivateTenantScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token: inviteToken, email: inviteEmail } = useLocalSearchParams<{
    token: string;
    email: string;
  }>();

  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDark = colorScheme === 'dark';
  const primaryColor = '#2A64F5';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#1a202c' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#D1D5DB';
  const textColor = isDark ? '#F4F6F8' : '#111827';
  const subtextColor = isDark ? '#94a3b8' : '#6B7280';
  const placeholderColor = isDark ? '#64748b' : '#9ca3af';

  // Validate invitation token
  useEffect(() => {
    validateInvite();
  }, [inviteToken, inviteEmail]);

  const validateInvite = async () => {
    if (!inviteToken || !inviteEmail) {
      setError('Invalid invitation link. Please check your email for the correct link.');
      setIsValidating(false);
      return;
    }

    try {
      // Check if invite exists and is not expired
      const { data, error: fetchError } = await supabase
        .from('tenant_invitations')
        .select('*')
        .eq('token', inviteToken)
        .eq('email', inviteEmail)
        .eq('status', 'pending')
        .single();

      if (fetchError || !data) {
        setError('This invitation link is invalid or has already been used.');
        setIsValidating(false);
        return;
      }

      // Check if expired (created more than 30 days ago)
      const createdDate = new Date(data.created_at);
      const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation > 30) {
        setError('This invitation link has expired. Please contact your landlord for a new one.');
        setIsValidating(false);
        return;
      }

      setTenantName(data.tenant_name || '');
      setInviteValid(true);
      setIsValidating(false);
    } catch (err: any) {
      console.error('Error validating invite:', err);
      setError(err.message || 'Failed to validate invitation');
      setIsValidating(false);
    }
  };

  const handleActivate = async () => {
    setError(null);

    if (!tenantName.trim()) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    if (!inviteEmail) {
      Alert.alert('Error', 'Email not found in invitation');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create auth user with email and temporary password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: inviteEmail,
        password: password,
        options: {
          data: {
            full_name: tenantName,
            role: 'tenant',
            user_type: 'tenant',
          },
        },
      });

      if (signUpError) {
        // Check if user already exists
        if (signUpError.message.includes('User already registered') || 
            signUpError.message.includes('already exists')) {
          setError('An account with this email already exists. Please log in instead.');
          setTimeout(() => router.back(), 2000);
          return;
        }
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error('Failed to create account');
      }

      // 2. Mark invitation as used
      const { error: updateInviteError } = await supabase
        .from('tenant_invitations')
        .update({ 
          status: 'activated',
          activated_at: new Date().toISOString(),
          user_id: signUpData.user.id,
        })
        .eq('token', inviteToken);

      if (updateInviteError) {
        console.warn('Warning: Could not mark invitation as used:', updateInviteError);
        // Don't fail - user is already created
      }

      // 3. Auto-convert applicant to tenant if invitation contains application_id and lease_id
      // This will be handled by checking the tenant_invitations table for these IDs
      // and calling convertApplicantToTenant in a background job or via edge function

      Alert.alert(
        'Success!',
        'Your account has been activated. Please log in with your email and password.',
        [
          {
            text: 'Go to Login',
            onPress: () => {
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Error activating account:', err);
      setError(err.message || 'Failed to activate account');
      Alert.alert('Activation Failed', err.message || 'Failed to activate your account');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={primaryColor} />
          <ThemedText style={[styles.validatingText, { color: subtextColor }]}>
            Validating your invitation...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!inviteValid || error) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <View style={[styles.logo, { backgroundColor: '#DC2626' }]}>
              <MaterialCommunityIcons name="alert-circle" size={32} color="#fff" />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: cardBgColor }]}>
            <View style={styles.formContent}>
              <ThemedText style={[styles.title, { color: textColor }]}>
                Invitation Invalid
              </ThemedText>
              <ThemedText style={[styles.errorText, { color: subtextColor }]}>
                {error || 'This invitation link is not valid.'}
              </ThemedText>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: primaryColor }]}
                onPress={() => router.back()}
              >
                <ThemedText style={styles.buttonText}>Go Back</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={[styles.logo, { backgroundColor: primaryColor }]}>
            <MaterialCommunityIcons name="check-circle" size={32} color="#fff" />
          </View>
        </View>

        {/* Title */}
        <ThemedText type="title" style={[styles.mainTitle, { color: textColor }]}>
          Welcome, Tenant!
        </ThemedText>

        {/* Auth Card */}
        <View style={[styles.card, { backgroundColor: cardBgColor }]}>
          <View style={styles.formContent}>
            <ThemedText style={[styles.formTitle, { color: textColor }]}>
              Activate Your Account
            </ThemedText>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Full Name
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#F4F6F8',
                    borderColor,
                    color: textColor,
                  },
                ]}
                placeholder="Enter your full name"
                placeholderTextColor={placeholderColor}
                value={tenantName}
                onChangeText={setTenantName}
                editable={!isLoading}
              />
            </View>

            {/* Email Display */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Email
              </ThemedText>
              <View
                style={[
                  styles.displayBox,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#F4F6F8',
                    borderColor,
                  },
                ]}
              >
                <ThemedText style={[{ color: textColor }]}>
                  {inviteEmail}
                </ThemedText>
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Set Password
              </ThemedText>
              <View style={[
                styles.passwordInputContainer,
                {
                  backgroundColor: isDark ? '#1e293b' : '#F4F6F8',
                  borderColor,
                }
              ]}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      color: textColor,
                    },
                  ]}
                  placeholder="Enter at least 6 characters"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={subtextColor}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View style={[styles.errorBox, { borderColor: '#DC2626' }]}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                <ThemedText style={[styles.errorMessage, { color: '#DC2626' }]}>
                  {error}
                </ThemedText>
              </View>
            )}

            {/* Activate Button */}
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: isLoading ? '#94a3b8' : primaryColor,
                },
              ]}
              onPress={handleActivate}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Activate Account</ThemedText>
              )}
            </TouchableOpacity>

            {/* Info Note */}
            <View style={[
              styles.infoBox,
              { backgroundColor: isDark ? '#1e293b' : '#EFF6FF', borderColor: primaryColor }
            ]}>
              <MaterialCommunityIcons name="information" size={16} color={primaryColor} />
              <ThemedText style={[styles.infoText, { color: subtextColor }]}>
                After activation, you'll be able to sign in with your email and password to access your rental property information.
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  validatingText: {
    marginTop: 12,
    fontSize: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  formContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  displayBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  errorMessage: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
