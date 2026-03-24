import React, { useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

export default function OTPScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; email?: string; type?: string }>();
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const phone = params.phone || '';
  const email = params.email || '';
  const verificationType = params.type || 'signup';

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit OTP code.');
      return;
    }

    if (!phone && !email) {
      Alert.alert('Missing contact', 'Phone or email is missing. Please sign up again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = phone
        ? { phone, token: otp, type: 'sms' as const }
        : { email, token: otp, type: verificationType as 'signup' | 'recovery' | 'invite' | 'email_change' | 'magiclink' };

      const { error } = await supabase.auth.verifyOtp(payload);

      if (error) {
        Alert.alert('Verification failed', error.message);
        return;
      }

      Alert.alert('Success', 'Verification successful. You can now log in.', [
        { text: 'Go to Login', onPress: () => router.replace('/(auth)') },
      ]);
    } catch (error) {
      Alert.alert('Verification failed', 'Unable to verify OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    if (!phone && !email) {
      Alert.alert('Missing contact', 'Phone or email is missing. Please sign up again.');
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend(
        phone
          ? { type: 'signup', phone }
          : { type: verificationType as 'signup' | 'email_change', email }
      );

      if (error) {
        Alert.alert('Resend failed', error.message);
        return;
      }

      startResendTimer();
      Alert.alert('OTP Sent', phone ? 'A new OTP has been sent to your phone.' : 'A new verification code has been sent to your email.');
    } catch (error) {
      Alert.alert('Resend failed', 'Unable to resend OTP. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Verify OTP</ThemedText>
          <ThemedText style={styles.subtitle}>
            Enter the one-time password sent to your email or phone
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.form}>
          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.label}>One-Time Password</ThemedText>
            <TextInput
              style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Enter 6-digit code"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />
          </ThemedView>

          <TouchableOpacity
            style={[styles.verifyBtn, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            disabled={isSubmitting}
            onPress={handleVerifyOTP}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.verifyBtnText}>Verify OTP</ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            disabled={resendTimer > 0 || isResending}
            onPress={handleResendOTP}>
            {isResending ? (
              <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].tint} />
            ) : (
              <ThemedText style={[styles.link, resendTimer > 0 && styles.disabledLink]}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <ThemedText style={styles.link}>Back to login</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 40 },
  subtitle: { marginTop: 8, opacity: 0.7, lineHeight: 20 },
  form: { gap: 20 },
  formGroup: { gap: 8 },
  label: { fontWeight: 'bold', fontSize: 16 },
  input: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, fontSize: 18, textAlign: 'center', letterSpacing: 8 },
  verifyBtn: { padding: 14, borderRadius: 8, alignItems: 'center' },
  verifyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { textAlign: 'center', color: '#2196F3', marginTop: 12 },
  disabledLink: { opacity: 0.5 },
});
