import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { resetPassword, clearError } = useAuthStore();

  const isDark = colorScheme === 'dark';
  const primaryColor = '#2A64F5';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#1a202c' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#D1D5DB';
  const textColor = isDark ? '#F4F6F8' : '#111827';
  const subtextColor = isDark ? '#94a3b8' : '#6B7280';
  const placeholderColor = isDark ? '#64748b' : '#9ca3af';

  const handleSendReset = async () => {
    if (!email) {
      Alert.alert('Email required', 'Please enter the email you used to sign up.');
      return;
    }

    clearError();
    setIsSubmitting(true);
    const result = await resetPassword(email);
    setIsSubmitting(false);

    if (result.success) {
      Alert.alert(
        'Check your email',
        'We sent a password reset link. Open it on your device to set a new password.',
        [
          {
            text: 'Back to Login',
            onPress: () => router.replace('/(auth)'),
          },
        ]
      );
    } else {
      Alert.alert('Reset failed', result.error || 'Could not send reset email. Please try again.');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.card, { backgroundColor: cardBgColor, paddingTop: insets.top + 24 }]}>
        <View style={styles.iconWrapper}>
          <MaterialCommunityIcons name="lock-reset" size={48} color={primaryColor} />
        </View>

        <ThemedText style={[styles.title, { color: textColor }]}>Forgot Password</ThemedText>
        <ThemedText style={[styles.subtitle, { color: subtextColor }]}>
          Enter the email you used to sign up. We’ll send you a reset link.
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
          placeholder="you@example.com"
          placeholderTextColor={placeholderColor}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: primaryColor, opacity: isSubmitting ? 0.7 : 1 },
          ]}
          disabled={isSubmitting}
          onPress={handleSendReset}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Send reset link</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(auth)')}>
          <ThemedText style={[styles.backLinkText, { color: primaryColor }]}>
            Back to Login
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 16,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    alignSelf: 'center',
    marginTop: 8,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

