import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function TenantLeaseStep2Screen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId, address, fromInvite, unitId, subUnitId, inviteId } = useLocalSearchParams<{ 
    propertyId?: string; 
    address?: string; 
    fromInvite?: string;
    unitId?: string;
    subUnitId?: string;
    inviteId?: string;
  }>();
  const { tenantDraft, updateDraft } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const inputBgColor = isDark ? '#1a202c' : '#ffffff';

  const [formData, setFormData] = useState({
    currentAddress: tenantDraft.residence.currentAddress || '',
    currentLandlordName: tenantDraft.residence.currentLandlordName || '',
    currentLandlordContact: tenantDraft.residence.currentLandlordContact || '',
    previousAddress: tenantDraft.residence.previousAddress || '',
    previousLandlordName: tenantDraft.residence.previousLandlordName || '',
    previousLandlordContact: tenantDraft.residence.previousLandlordContact || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentAddress.trim()) {
      newErrors.currentAddress = 'Current address is required';
    }
    if (!formData.currentLandlordName.trim()) {
      newErrors.currentLandlordName = 'Current landlord name is required';
    }
    if (!formData.currentLandlordContact.trim()) {
      newErrors.currentLandlordContact = 'Current landlord contact is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      updateDraft('residence', formData);
      router.push({ 
        pathname: '/tenant-lease-step3', 
        params: { propertyId, address, fromInvite, unitId, subUnitId, inviteId } 
      });
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Lease Application</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progressContainer}>
          <ThemedText style={[styles.progressText, { color: textSecondaryColor }]}>This is Step 2 of 6</ThemedText>
          <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
            <View style={[styles.progressFill, { backgroundColor: primaryColor, width: '33.33%' }]} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Residence History</ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: textSecondaryColor }]}>
            Please provide your current and previous residence information.
          </ThemedText>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Current Address</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.currentAddress ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="Enter your current address"
                placeholderTextColor={textSecondaryColor}
                value={formData.currentAddress}
                onChangeText={(value) => {
                  setFormData({ ...formData, currentAddress: value });
                  if (errors.currentAddress) setErrors({ ...errors, currentAddress: '' });
                }}
                multiline
              />
              {errors.currentAddress && <ThemedText style={styles.errorText}>{errors.currentAddress}</ThemedText>}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Current Landlord Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.currentLandlordName ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="Enter landlord name"
                placeholderTextColor={textSecondaryColor}
                value={formData.currentLandlordName}
                onChangeText={(value) => {
                  setFormData({ ...formData, currentLandlordName: value });
                  if (errors.currentLandlordName) setErrors({ ...errors, currentLandlordName: '' });
                }}
              />
              {errors.currentLandlordName && (
                <ThemedText style={styles.errorText}>{errors.currentLandlordName}</ThemedText>
              )}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Current Landlord Contact</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.currentLandlordContact ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="Phone or email"
                placeholderTextColor={textSecondaryColor}
                value={formData.currentLandlordContact}
                onChangeText={(value) => {
                  setFormData({ ...formData, currentLandlordContact: value });
                  if (errors.currentLandlordContact) setErrors({ ...errors, currentLandlordContact: '' });
                }}
              />
              {errors.currentLandlordContact && (
                <ThemedText style={styles.errorText}>{errors.currentLandlordContact}</ThemedText>
              )}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Previous Address</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: borderColor,
                  },
                ]}
                placeholder="Enter previous address (optional)"
                placeholderTextColor={textSecondaryColor}
                value={formData.previousAddress}
                onChangeText={(value) => setFormData({ ...formData, previousAddress: value })}
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Previous Landlord Reference</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: borderColor,
                  },
                ]}
                placeholder="Name and contact (optional)"
                placeholderTextColor={textSecondaryColor}
                value={`${formData.previousLandlordName} ${formData.previousLandlordContact}`.trim()}
                onChangeText={(value) => {
                  const parts = value.split(' ');
                  setFormData({
                    ...formData,
                    previousLandlordName: parts[0] || '',
                    previousLandlordContact: parts.slice(1).join(' ') || '',
                  });
                }}
              />
            </View>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor }]}
            onPress={() => router.back()}>
            <ThemedText style={[styles.backButtonText, { color: textPrimaryColor }]}>Back</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: primaryColor }]}
            onPress={handleContinue}>
            <ThemedText style={styles.continueButtonText}>Next</ThemedText>
          </TouchableOpacity>
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
  progressContainer: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 12,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  form: {
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

