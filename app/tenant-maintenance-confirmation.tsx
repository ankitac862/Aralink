import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMaintenanceStore } from '@/store/maintenanceStore';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TenantMaintenanceRequestConfirmationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { requests } = useMaintenanceStore();
  const request = id ? requests.find((req) => req.id === id) : undefined;

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const subText = isDark ? '#9BA1A6' : '#6E7377';
  const accent = isDark ? '#FFFFFF' : '#111315';
  const onAccent = isDark ? '#0B0B0C' : '#FFFFFF';
  const success = isDark ? '#4ADE80' : '#15803D';
  const successBg = isDark ? '#1E3B2A' : '#DFF2E4';

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top + 32 }]}>
      <View style={[styles.iconCircle, { backgroundColor: successBg }]}>
        <MaterialCommunityIcons name="check" size={38} color={success} />
      </View>
      <Text style={[styles.title, { color: textColor }]}>Request Submitted!</Text>
      <Text style={[styles.description, { color: subText }]}>
        Your maintenance request has been received. Our property team will review the details and reach out shortly.
      </Text>

      <View style={[styles.card, { backgroundColor: cardColor }]}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="identifier" size={20} color={subText} />
          <Text style={[styles.cardText, { color: textColor }]}>{request?.id || 'Pending ID'}</Text>
        </View>
        <View style={styles.row}>
          <MaterialCommunityIcons name="progress-clock" size={20} color={subText} />
          <Text style={[styles.cardText, { color: textColor }]}>{request?.status.replace('_', ' ') ?? 'Under review'}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: accent }]}
        onPress={() => router.push('/tenant-maintenance-status')}>
        <Text style={[styles.primaryText, { color: onAccent }]}>View Request Status</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(tabs)/tenant-dashboard')}>
        <Text style={[styles.secondaryText, { color: textColor }]}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
