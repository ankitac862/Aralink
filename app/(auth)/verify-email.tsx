import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

export default function VerifyEmailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const [isResending, setIsResending] = useState(false);

  const isDark = colorScheme === 'dark';
  const primaryColor = '#2A64F5';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#1a202c' : '#ffffff';
  const textColor = isDark ? '#F4F6F8' : '#111827';
  const subtextColor = isDark ? '#94a3b8' : '#6B7280';

  const email = params.email || '';

  const handleResendEmail = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address not found. Please try signing up again.');
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Verification email has been resent. Please check your inbox.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToLogin = () => {
    router.replace('/(auth)');
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${primaryColor}15` }]}>
          <MaterialCommunityIcons name="email-check-outline" size={64} color={primaryColor} />
        </View>

        {/* Title */}
        <ThemedText style={[styles.title, { color: textColor }]}>
          Verify Your Email
        </ThemedText>

        {/* Message */}
        <ThemedText style={[styles.message, { color: subtextColor }]}>
          We've sent a verification link to:
        </ThemedText>
        
        <ThemedText style={[styles.email, { color: textColor }]}>
          {email || 'your email address'}
        </ThemedText>

        <ThemedText style={[styles.instruction, { color: subtextColor }]}>
          Please check your inbox and click the verification link to activate your account. 
          Once verified, you can log in.
        </ThemedText>

        {/* Card with steps */}
        <View style={[styles.stepsCard, { backgroundColor: cardBgColor }]}>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: primaryColor }]}>
              <ThemedText style={styles.stepNumberText}>1</ThemedText>
            </View>
            <ThemedText style={[styles.stepText, { color: textColor }]}>
              Check your email inbox
            </ThemedText>
          </View>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: primaryColor }]}>
              <ThemedText style={styles.stepNumberText}>2</ThemedText>
            </View>
            <ThemedText style={[styles.stepText, { color: textColor }]}>
              Click the verification link
            </ThemedText>
          </View>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: primaryColor }]}>
              <ThemedText style={styles.stepNumberText}>3</ThemedText>
            </View>
            <ThemedText style={[styles.stepText, { color: textColor }]}>
              Return here and log in
            </ThemedText>
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[styles.loginButton, { backgroundColor: primaryColor }]}
          onPress={handleGoToLogin}
        >
          <ThemedText style={styles.loginButtonText}>Go to Login</ThemedText>
        </TouchableOpacity>

        {/* Resend Link */}
        <View style={styles.resendContainer}>
          <ThemedText style={[styles.resendText, { color: subtextColor }]}>
            Didn't receive the email?{' '}
          </ThemedText>
          <TouchableOpacity onPress={handleResendEmail} disabled={isResending}>
            {isResending ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <ThemedText style={[styles.resendLink, { color: primaryColor }]}>
                Resend
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Spam notice */}
        <ThemedText style={[styles.spamNotice, { color: subtextColor }]}>
          💡 Check your spam folder if you don't see the email in your inbox.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  stepsCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  stepText: {
    fontSize: 15,
    flex: 1,
  },
  loginButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  spamNotice: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

