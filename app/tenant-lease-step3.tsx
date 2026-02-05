import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function TenantLeaseStep3Screen() {
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
    employerName: tenantDraft.employment.employerName || '',
    jobTitle: tenantDraft.employment.jobTitle || '',
    employmentType: tenantDraft.employment.employmentType || '',
    annualIncome: tenantDraft.employment.annualIncome || '',
    additionalIncome: tenantDraft.employment.additionalIncome || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Self-employed', 'Student', 'Unemployed'];

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.employerName.trim()) {
      newErrors.employerName = 'Employer name is required';
    }
    if (!formData.jobTitle.trim()) {
      newErrors.jobTitle = 'Job title is required';
    }
    if (!formData.employmentType) {
      newErrors.employmentType = 'Employment type is required';
    }
    // Annual income is optional, but if provided, must be a valid number
    if (formData.annualIncome.trim() && isNaN(Number(formData.annualIncome))) {
      newErrors.annualIncome = 'Please enter a valid number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      updateDraft('employment', formData);
      router.push({ 
        pathname: '/tenant-lease-step4', 
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
          <ThemedText style={[styles.progressText, { color: textSecondaryColor }]}>This is Step 3 of 6</ThemedText>
          <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
            <View style={[styles.progressFill, { backgroundColor: primaryColor, width: '50%' }]} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Employment & Income</ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: textSecondaryColor }]}>
            Please provide your employment and income information.
          </ThemedText>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Employer Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.employerName ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="Enter employer name"
                placeholderTextColor={textSecondaryColor}
                value={formData.employerName}
                onChangeText={(value) => {
                  setFormData({ ...formData, employerName: value });
                  if (errors.employerName) setErrors({ ...errors, employerName: '' });
                }}
              />
              {errors.employerName && <ThemedText style={styles.errorText}>{errors.employerName}</ThemedText>}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Job Title</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.jobTitle ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="Enter your job title"
                placeholderTextColor={textSecondaryColor}
                value={formData.jobTitle}
                onChangeText={(value) => {
                  setFormData({ ...formData, jobTitle: value });
                  if (errors.jobTitle) setErrors({ ...errors, jobTitle: '' });
                }}
              />
              {errors.jobTitle && <ThemedText style={styles.errorText}>{errors.jobTitle}</ThemedText>}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Employment Type</ThemedText>
              <View style={styles.segmentedControl}>
                {employmentTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.segment,
                      {
                        backgroundColor: formData.employmentType === type ? primaryColor : 'transparent',
                        borderColor: formData.employmentType === type ? primaryColor : borderColor,
                      },
                    ]}
                    onPress={() => {
                      setFormData({ ...formData, employmentType: type });
                      if (errors.employmentType) setErrors({ ...errors, employmentType: '' });
                    }}>
                    <ThemedText
                      style={[
                        styles.segmentText,
                        {
                          color: formData.employmentType === type ? '#ffffff' : textPrimaryColor,
                        },
                      ]}>
                      {type}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.employmentType && <ThemedText style={styles.errorText}>{errors.employmentType}</ThemedText>}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>
                Annual Income <ThemedText style={{ color: textSecondaryColor, fontSize: 12 }}>(Optional)</ThemedText>
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.annualIncome ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="Enter annual income (optional)"
                placeholderTextColor={textSecondaryColor}
                value={formData.annualIncome}
                onChangeText={(value) => {
                  setFormData({ ...formData, annualIncome: value });
                  if (errors.annualIncome) setErrors({ ...errors, annualIncome: '' });
                }}
                keyboardType="numeric"
              />
              {errors.annualIncome && <ThemedText style={styles.errorText}>{errors.annualIncome}</ThemedText>}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Additional Income (Optional)</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: borderColor,
                  },
                ]}
                placeholder="Enter additional income sources"
                placeholderTextColor={textSecondaryColor}
                value={formData.additionalIncome}
                onChangeText={(value) => setFormData({ ...formData, additionalIncome: value })}
                multiline
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
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
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

