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
import { useAuthStore } from '@/store/authStore';

interface LoginScreenProps {
  onSwitchToRegister?: () => void;
}

export default function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });

  // Get auth store state and actions
  const { 
    signIn, 
    signInWithGoogle, 
    signInWithApple, 
    signInWithFacebook,
    resetPassword,
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

  const handleLogin = async () => {
    if (!formData.identifier || !formData.password) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    clearError();
    const result = await signIn(formData.identifier, formData.password);
    
    if (result.success && result.user) {
      // Navigate based on user role
      const userRole = result.user.role;
      console.log('Login successful, user role:', userRole);
      
      if (userRole === 'tenant') {
        router.replace('/(tabs)/tenant-dashboard');
      } else if (userRole === 'manager') {
        router.replace('/(tabs)/landlord-dashboard');
      } else {
        // Default to landlord dashboard for landlord role
        router.replace('/(tabs)/landlord-dashboard');
      }
    } else {
      Alert.alert('Login Failed', result.error || 'Invalid email/phone or password');
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    const result = await signInWithGoogle();
    
    if (!result.success) {
      Alert.alert('Google Sign In Failed', result.error || 'An error occurred');
    }
    // OAuth flow will handle navigation via deep link callback
  };

  const handleAppleSignIn = async () => {
    clearError();
    const result = await signInWithApple();
    
    if (!result.success) {
      Alert.alert('Apple Sign In Failed', result.error || 'An error occurred');
    }
    // OAuth flow will handle navigation via deep link callback
  };

  const handleFacebookSignIn = async () => {
    clearError();
    const result = await signInWithFacebook();
    
    if (!result.success) {
      Alert.alert('Facebook Sign In Failed', result.error || 'An error occurred');
    }
    // OAuth flow will handle navigation via deep link callback
  };

  const handleForgotPassword = () => {
    router.push({ pathname: '/(auth)/forgot-password', params: { email: formData.identifier } });
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
                  backgroundColor: cardBgColor,
                  borderRadius: 6,
                },
              ]}
            >
              <ThemedText style={[styles.tabText, { color: textColor, fontWeight: '600' }]}>
                Log In
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: 'transparent',
                },
              ]}
              onPress={onSwitchToRegister}
            >
              <ThemedText style={[styles.tabText, { color: subtextColor }]}>
                Sign Up
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <View style={styles.formContent}>
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
                  placeholder="Enter your password"
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

            {/* Forgot Password */}
            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
            >
              <ThemedText style={[styles.forgotPasswordText, { color: primaryColor }]}>
                Forgot Password?
              </ThemedText>
            </TouchableOpacity>

            {/* Log In Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: primaryColor,
                  opacity: isLoading ? 0.7 : 1,
                },
              ]}
              disabled={isLoading}
              onPress={handleLogin}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.submitButtonText}>Log In</ThemedText>
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
              onPress={handleGoogleSignIn}
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
                onPress={handleAppleSignIn}
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
              onPress={handleFacebookSignIn}
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
    justifyContent: 'center',
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
    marginBottom: 24,
    textAlign: 'center',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '500',
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
