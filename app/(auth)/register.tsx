import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { useAuthStore, UserRole } from '@/store/authStore';

interface RegisterScreenProps {
  onSwitchToLogin?: () => void;
}

export default function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    identifier: '',
    password: '',
  });

  // Get auth store state and actions
  const { 
    signUp, 
    signInWithGoogle, 
    signInWithApple, 
    signInWithFacebook,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const isAndroid = Platform.OS === 'android';
  const isDark = colorScheme === 'dark';
  const primaryColor = '#2A64F5';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#1a202c' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#D1D5DB';
  const textColor = isDark ? '#F4F6F8' : '#111827';
  const subtextColor = isDark ? '#94a3b8' : '#6B7280';
  const placeholderColor = isDark ? '#64748b' : '#9ca3af';

  const navigateToDashboard = (role: UserRole) => {
    if (role === 'tenant') {
      router.replace('/(tabs)/tenant-dashboard');
    } else {
      // landlord and manager go to landlord dashboard
      router.replace('/(tabs)/landlord-dashboard');
    }
  };

  const handleRegister = async () => {
    if (!selectedUserType) {
      Alert.alert('Selection Required', 'Please select your account type');
      return;
    }

    if (!formData.identifier || !formData.password || !formData.name) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    clearError();
    const result = await signUp(formData.identifier, formData.password, formData.name, selectedUserType);
    
    if (result.success) {
      if (result.needsVerification) {
        if (result.verificationType === 'phone') {
          router.replace({
            pathname: '/(auth)/otp',
            params: { phone: result.verificationTarget || formData.identifier, type: 'signup' },
          });
        } else {
          router.replace({
            pathname: '/(auth)/verify-email',
            params: { email: result.verificationTarget || formData.identifier },
          });
        }
      } else {
        // No verification needed, go to dashboard
        navigateToDashboard(selectedUserType);
      }
    } else {
      Alert.alert('Registration Failed', result.error || 'Failed to create account');
    }
  };

  const handleGoogleSignUp = async () => {
    if (!selectedUserType) {
      Alert.alert('Selection Required', 'Please select your account type first');
      return;
    }

    clearError();
    const result = await signInWithGoogle(selectedUserType);
    
    if (!result.success) {
      Alert.alert('Google Sign Up Failed', result.error || 'An error occurred');
    }
    // OAuth flow will handle navigation via deep link callback
  };

  const handleAppleSignUp = async () => {
    if (!selectedUserType) {
      Alert.alert('Selection Required', 'Please select your account type first');
      return;
    }

    clearError();
    const result = await signInWithApple(selectedUserType);
    
    if (!result.success) {
      Alert.alert('Apple Sign Up Failed', result.error || 'An error occurred');
    }
    // OAuth flow will handle navigation via deep link callback
  };

  const handleFacebookSignUp = async () => {
    if (!selectedUserType) {
      Alert.alert('Selection Required', 'Please select your account type first');
      return;
    }

    clearError();
    const result = await signInWithFacebook(selectedUserType);
    
    if (!result.success) {
      Alert.alert('Facebook Sign Up Failed', result.error || 'An error occurred');
    }
    // OAuth flow will handle navigation via deep link callback
  };

  const getRoleDisplayName = (role: UserRole): string => {
    switch (role) {
      case 'landlord':
        return 'Landlord';
      case 'tenant':
        return 'Tenant';
      case 'manager':
        return 'Property Manager';
      default:
        return role;
    }
  };

  const UserTypeCard = ({ 
    type, 
    icon, 
    title, 
    description 
  }: { 
    type: UserRole; 
    icon: string; 
    title: string; 
    description: string 
  }) => {
    const isSelected = selectedUserType === type;
    return (
      <TouchableOpacity
        style={[
          styles.userTypeCard,
          {
            backgroundColor: isSelected ? `${primaryColor}15` : (isDark ? '#1e293b' : '#F4F6F8'),
            borderColor: isSelected ? primaryColor : borderColor,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={() => setSelectedUserType(type)}
      >
        <View style={[
          styles.userTypeIconContainer,
          { backgroundColor: isSelected ? `${primaryColor}20` : (isDark ? '#334155' : '#e5e7eb') }
        ]}>
          <MaterialCommunityIcons 
            name={icon as any} 
            size={24} 
            color={isSelected ? primaryColor : subtextColor} 
          />
        </View>
        <View style={styles.userTypeContent}>
          <ThemedText style={[
            styles.userTypeTitle, 
            { color: isSelected ? primaryColor : textColor }
          ]}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.userTypeDescription, { color: subtextColor }]}>
            {description}
          </ThemedText>
        </View>
        <View style={[
          styles.radioOuter,
          { borderColor: isSelected ? primaryColor : borderColor }
        ]}>
          {isSelected && (
            <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={[styles.logo, { backgroundColor: primaryColor }]}>
            <MaterialCommunityIcons name="home" size={32} color="#fff" />
          </View>
        </View>

        {/* Title */}
        <ThemedText type="title" style={[styles.mainTitle, { color: textColor }]}>
          Your Rental Home, Managed.
        </ThemedText>

        {/* Auth Card */}
        <View style={[styles.card, { backgroundColor: cardBgColor }]}>
          {/* Tab Navigation */}
          <View style={[styles.tabContainer, { backgroundColor: isDark ? '#0f172a' : '#e0e7ff' }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: 'transparent',
                },
              ]}
              onPress={onSwitchToLogin}
            >
              <ThemedText style={[styles.tabText, { color: subtextColor }]}>
                Log In
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: cardBgColor,
                  borderRadius: 6,
                },
              ]}
            >
              <ThemedText style={[styles.tabText, { color: textColor, fontWeight: '600' }]}>
                Sign Up
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <View style={styles.formContent}>
            <ThemedText style={[styles.formTitle, { color: textColor }]}>
              Create Your Account
            </ThemedText>

            {/* User Type Selection */}
            <View style={styles.userTypeSection}>
              <ThemedText style={[styles.sectionLabel, { color: textColor }]}>
                I am a...
              </ThemedText>
              <UserTypeCard
                type="landlord"
                icon="home-city"
                title="Landlord"
                description="Own and manage rental properties"
              />
              <UserTypeCard
                type="manager"
                icon="briefcase"
                title="Property Manager"
                description="Manage properties for landlords"
              />
            </View>

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
                value={formData.name}
                onChangeText={(value) => setFormData({ ...formData, name: value })}
              />
            </View>

            {/* Email or Phone */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Email or Phone Number
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
                placeholder="Enter your email or phone number"
                placeholderTextColor={placeholderColor}
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.identifier}
                onChangeText={(value) => setFormData({ ...formData, identifier: value })}
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Password
              </ThemedText>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#F4F6F8',
                      borderColor,
                      color: textColor,
                    },
                  ]}
                  placeholder="Create a strong password (min 6 chars)"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(value) => setFormData({ ...formData, password: value })}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={subtextColor}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: selectedUserType ? primaryColor : '#cccccc',
                  opacity: isLoading ? 0.7 : 1,
                },
              ]}
              disabled={!selectedUserType || isLoading}
              onPress={handleRegister}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.submitButtonText}>Sign Up</ThemedText>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <ThemedText style={[styles.dividerText, { color: subtextColor }]}>
              OR
            </ThemedText>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
          </View>

          {/* Social Buttons */}
          <View style={styles.socialContainer}>
            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  borderColor,
                  backgroundColor: cardBgColor,
                },
                isLoading && styles.disabledButton,
              ]}
              disabled={isLoading}
              onPress={handleGoogleSignUp}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <>
                  <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
                  <ThemedText style={[styles.socialButtonText, { color: textColor }]}>
                    Continue with Google
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

            {!isAndroid && (
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  {
                    borderColor,
                    backgroundColor: cardBgColor,
                  },
                  isLoading && styles.disabledButton,
                ]}
                disabled={isLoading}
                onPress={handleAppleSignUp}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="apple" size={20} color={textColor} />
                    <ThemedText style={[styles.socialButtonText, { color: textColor }]}>
                      Continue with Apple
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  borderColor,
                  backgroundColor: cardBgColor,
                },
                isLoading && styles.disabledButton,
              ]}
              disabled={isLoading}
              onPress={handleFacebookSignUp}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <>
                  <MaterialCommunityIcons name="facebook" size={20} color="#1877F2" />
                  <ThemedText style={[styles.socialButtonText, { color: textColor }]}>
                    Continue with Facebook
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <ThemedText style={[styles.footerText, { color: subtextColor }]}>
              By continuing, you agree to our{' '}
              <ThemedText style={[styles.footerLink, { color: primaryColor }]}>
                Terms of Service
              </ThemedText>
              {' '}and{' '}
              <ThemedText style={[styles.footerLink, { color: primaryColor }]}>
                Privacy Policy
              </ThemedText>
              .
            </ThemedText>
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  userTypeSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  userTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  userTypeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTypeContent: {
    flex: 1,
    marginLeft: 12,
  },
  userTypeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  userTypeDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginVertical: 16,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  socialContainer: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    fontWeight: '600',
  },
});
