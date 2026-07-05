import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function TenantLeaseSubmittedScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenantApplication } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const textPrimaryColor = isDark ? '#FFFFFF' : '#111315';
  const textSecondaryColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';

  const applicationId = tenantApplication?.id || 'RNT-' + Date.now().toString().slice(-5);

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: `${primaryColor}20` }]}>
            <MaterialCommunityIcons name="check-circle" size={64} color={primaryColor} />
          </View>
        </View>

        <ThemedText style={[styles.title, { color: textPrimaryColor }]}>Application Received!</ThemedText>

        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.message, { color: textSecondaryColor }]}>
            Your application has been successfully submitted. The property manager will review your submission and we
            will notify you of any updates.
          </ThemedText>

          <View style={styles.idContainer}>
            <ThemedText style={[styles.idLabel, { color: textSecondaryColor }]}>Application ID:</ThemedText>
            <ThemedText style={[styles.idValue, { color: primaryColor }]}>{applicationId}</ThemedText>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={() => router.push('/tenant-lease-status')}>
          <ThemedText style={[styles.buttonText, { color: onPrimaryColor }]}>View Application Status</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backButton, { borderColor }]}
          onPress={() => router.push('/(tabs)/tenant-dashboard')}>
          <ThemedText style={[styles.backButtonText, { color: textPrimaryColor }]}>Back to Dashboard</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  card: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    marginBottom: 24,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  idContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  idLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  idValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

