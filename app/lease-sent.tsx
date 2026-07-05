import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function LeaseSentScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentLeaseDraft, landlordApplications } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const textPrimaryColor = isDark ? '#FFFFFF' : '#111315';
  const textSecondaryColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';

  const application = currentLeaseDraft
    ? landlordApplications.find((app) => app.id === currentLeaseDraft.applicationId)
    : null;
  const tenantName = application?.tenantName || 'Tenant';

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: `${primaryColor}20` }]}>
            <MaterialCommunityIcons name="check-circle" size={64} color={primaryColor} />
          </View>
        </View>

        <ThemedText style={[styles.title, { color: textPrimaryColor }]}>Lease Sent for Signature</ThemedText>

        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.message, { color: textSecondaryColor }]}>
            Lease sent for signature to <ThemedText style={{ fontWeight: '700' }}>{tenantName}</ThemedText>. You will be
            notified when the tenant signs the lease.
          </ThemedText>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: primaryColor }]}
          onPress={() => router.push('/landlord-applications')}>
          <ThemedText style={[styles.buttonText, { color: onPrimaryColor }]}>Back to Applications</ThemedText>
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
    fontSize: 24,
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
    textAlign: 'center',
  },
  button: {
    width: '100%',
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

