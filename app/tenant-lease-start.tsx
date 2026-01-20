import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function TenantLeaseStartScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenantApplication, getTenantStatus } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';

  const status = getTenantStatus();
  const hasApplication = !!tenantApplication;

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Rental Application</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color={primaryColor} />
          <ThemedText style={[styles.title, { color: textPrimaryColor }]}>Start Your Application</ThemedText>
          <ThemedText style={[styles.description, { color: textSecondaryColor }]}>
            Complete your lease application in a few simple steps. We'll guide you through the process.
          </ThemedText>

          {hasApplication && status ? (
            <View style={styles.statusContainer}>
              <ThemedText style={[styles.statusLabel, { color: textSecondaryColor }]}>Current Status:</ThemedText>
              <ThemedText style={[styles.statusValue, { color: primaryColor }]}>
                {status.replace('_', ' ').toUpperCase()}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.buttonContainer}>
          {hasApplication ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryColor }]}
              onPress={() => router.push('/tenant-lease-status')}>
              <ThemedText style={styles.buttonText}>View Application Status</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryColor }]}
              onPress={() => router.push('/tenant-lease-step1')}>
              <ThemedText style={styles.buttonText}>Start Application</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  card: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  statusContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContainer: {
    marginTop: 8,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

