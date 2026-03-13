import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function TenantLeaseStep4Screen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId, address, fromInvite, unitId, subUnitId, inviteId, isCoApplicant } = useLocalSearchParams<{ 
    propertyId?: string; 
    address?: string; 
    fromInvite?: string;
    unitId?: string;
    subUnitId?: string;
    inviteId?: string;
    isCoApplicant?: string;
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
    occupants: tenantDraft.other.occupants || '',
    vehicleInfo: tenantDraft.other.vehicleInfo || '',
    pets: tenantDraft.other.pets || false,
    notes: tenantDraft.other.notes || '',
  });

  const handleContinue = () => {
    updateDraft('other', formData);
    router.push({
      pathname: '/tenant-lease-step5', 
      params: { propertyId, address, fromInvite, unitId, subUnitId, inviteId, isCoApplicant } 
    });
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
          <ThemedText style={[styles.progressText, { color: textSecondaryColor }]}>This is Step 4 of 6</ThemedText>
          <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
            <View style={[styles.progressFill, { backgroundColor: primaryColor, width: '66.67%' }]} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Other Details</ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: textSecondaryColor }]}>
            Please provide any additional information about occupants, vehicles, and pets.
          </ThemedText>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Other Occupants</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: borderColor,
                  },
                ]}
                placeholder="List any additional occupants (names and ages)"
                placeholderTextColor={textSecondaryColor}
                value={formData.occupants}
                onChangeText={(value) => setFormData({ ...formData, occupants: value })}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Vehicle Information</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: borderColor,
                  },
                ]}
                placeholder="Make, model, year, license plate (if applicable)"
                placeholderTextColor={textSecondaryColor}
                value={formData.vehicleInfo}
                onChangeText={(value) => setFormData({ ...formData, vehicleInfo: value })}
              />
            </View>

            <View style={[styles.formGroup, styles.toggleGroup]}>
              <View style={styles.toggleLabelContainer}>
                <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Any additional occupants?</ThemedText>
                <ThemedText style={[styles.toggleSubtext, { color: textSecondaryColor }]}>
                  Do you have pets?
                </ThemedText>
              </View>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    {
                      backgroundColor: formData.pets ? primaryColor : 'transparent',
                      borderColor: formData.pets ? primaryColor : borderColor,
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, pets: true })}>
                  <ThemedText
                    style={[
                      styles.toggleText,
                      { color: formData.pets ? '#ffffff' : textPrimaryColor },
                    ]}>
                    Yes
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    {
                      backgroundColor: !formData.pets ? primaryColor : 'transparent',
                      borderColor: !formData.pets ? primaryColor : borderColor,
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, pets: false })}>
                  <ThemedText
                    style={[
                      styles.toggleText,
                      { color: !formData.pets ? '#ffffff' : textPrimaryColor },
                    ]}>
                    No
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Additional Notes</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: borderColor,
                  },
                ]}
                placeholder="Any additional information you'd like to provide (optional)"
                placeholderTextColor={textSecondaryColor}
                value={formData.notes}
                onChangeText={(value) => setFormData({ ...formData, notes: value })}
                multiline
                numberOfLines={4}
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  toggleGroup: {
    marginTop: 8,
  },
  toggleLabelContainer: {
    marginBottom: 12,
  },
  toggleSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
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

