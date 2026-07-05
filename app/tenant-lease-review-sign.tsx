import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function TenantLeaseReviewSignScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenantApplication, currentLeaseDraft, signLease } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const textPrimaryColor = isDark ? '#FFFFFF' : '#111315';
  const textSecondaryColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const inputBgColor = isDark ? '#1A1B1E' : '#FFFFFF';

  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const lease = currentLeaseDraft;
  const application = tenantApplication;

  if (!lease || !application) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <ThemedText style={{ color: textPrimaryColor }}>No lease available</ThemedText>
      </ThemedView>
    );
  }

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!agreed) {
      newErrors.agreed = 'You must agree to the terms';
    }

    if (!signature.trim()) {
      newErrors.signature = 'Signature is required';
    } else if (signature.trim() !== application.draft.personal.fullName.trim()) {
      newErrors.signature = 'Signature must match your full name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      signLease(application.id, signature);
      Alert.alert('Success', 'Lease signed successfully!', [
        {
          text: 'OK',
          onPress: () => router.push('/tenant-lease-status'),
        },
      ]);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Review & Sign Lease</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.summaryCard, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.summaryTitle, { color: textPrimaryColor }]}>Lease Summary</ThemedText>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: textSecondaryColor }]}>Property Address</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: textPrimaryColor }]}>
              {application.propertyAddress || '123 Main St, Apt 4B'}
            </ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: textSecondaryColor }]}>Monthly Rent</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: textPrimaryColor }]}>${lease.rent}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: textSecondaryColor }]}>Deposit Amount</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: textPrimaryColor }]}>${lease.deposit}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: textSecondaryColor }]}>Lease Start Date</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: textPrimaryColor }]}>{lease.startDate}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: textSecondaryColor }]}>Lease End Date</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: textPrimaryColor }]}>{lease.endDate}</ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: textSecondaryColor }]}>Pets Allowed</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: textPrimaryColor }]}>
              {lease.allowPets ? 'Yes' : 'No'}
            </ThemedText>
          </View>

          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: textSecondaryColor }]}>Tenant Insurance Required</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: textPrimaryColor }]}>
              {lease.insuranceRequired ? 'Yes' : 'No'}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.consentCard, { backgroundColor: cardBgColor, borderColor }]}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAgreed(!agreed)}>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: agreed ? primaryColor : 'transparent',
                  borderColor: agreed ? primaryColor : borderColor,
                },
              ]}>
              {agreed && <MaterialCommunityIcons name="check" size={16} color="#ffffff" />}
            </View>
            <ThemedText style={[styles.consentText, { color: textPrimaryColor }]}>
              I agree to the terms of this lease.
            </ThemedText>
          </TouchableOpacity>
          {errors.agreed && <ThemedText style={styles.errorText}>{errors.agreed}</ThemedText>}
        </View>

        <View style={[styles.signatureCard, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.label, { color: textPrimaryColor }]}>
            Type your full name as signature
          </ThemedText>
          <TextInput
            style={[
              styles.signatureInput,
              {
                backgroundColor: inputBgColor,
                color: textPrimaryColor,
                borderColor: errors.signature ? '#ff3b30' : borderColor,
              },
            ]}
            placeholder="Enter your full name"
            placeholderTextColor={textSecondaryColor}
            value={signature}
            onChangeText={(value) => {
              setSignature(value);
              if (errors.signature) setErrors({ ...errors, signature: '' });
            }}
          />
          {errors.signature && <ThemedText style={styles.errorText}>{errors.signature}</ThemedText>}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: primaryColor }]}
          onPress={handleSubmit}>
          <ThemedText style={[styles.submitButtonText, { color: onPrimaryColor }]}>Submit Signed Lease</ThemedText>
        </TouchableOpacity>
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
    paddingBottom: 12,
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
    paddingBottom: 40,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  consentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  signatureCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  signatureInput: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 44,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

