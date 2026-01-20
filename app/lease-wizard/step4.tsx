/**
 * Ontario Lease Wizard - Step 4: Term
 * 
 * Section 4 of Ontario Standard Lease:
 * - Tenancy start date
 * - Fixed term or month-to-month
 * - Payment frequency
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOntarioLeaseStore } from '@/store/ontarioLeaseStore';

const TENANCY_TYPES = [
  { value: 'month_to_month', label: 'Month-to-Month', description: 'No fixed end date' },
  { value: 'fixed', label: 'Fixed Term', description: 'Specific start and end dates' },
];

const PAYMENT_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

export default function LeaseWizardStep4() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    formData,
    updateFormData,
    nextStep,
    prevStep,
  } = useOntarioLeaseStore();

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const inputBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  const startDate = formData.tenancyStartDate ? new Date(formData.tenancyStartDate) : new Date();
  const endDate = formData.tenancyEndDate ? new Date(formData.tenancyEndDate) : new Date();

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      updateFormData('tenancyStartDate', selectedDate.toISOString().split('T')[0]);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      updateFormData('tenancyEndDate', selectedDate.toISOString().split('T')[0]);
    }
  };

  const handleNext = () => {
    if (!formData.tenancyStartDate) {
      return;
    }
    if (formData.tenancyType === 'fixed' && !formData.tenancyEndDate) {
      return;
    }

    nextStep();
    router.push('/lease-wizard/step5');
  };

  const handleBack = () => {
    prevStep();
    router.back();
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleBack}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Step 4: Term
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressContainer, { borderBottomColor: borderColor }]}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '66.66%', backgroundColor: primaryColor }]} />
        </View>
        <ThemedText style={[styles.progressText, { color: secondaryTextColor }]}>
          4 of 6
        </ThemedText>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tenancy Type Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calendar-clock" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Tenancy Type
              </ThemedText>
            </View>

            <View style={styles.optionsContainer}>
              {TENANCY_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.optionCard,
                    { backgroundColor: inputBgColor, borderColor },
                    formData.tenancyType === type.value && {
                      borderColor: primaryColor,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => updateFormData('tenancyType', type.value)}
                >
                  <View style={[
                    styles.radioCircle,
                    { borderColor: formData.tenancyType === type.value ? primaryColor : borderColor },
                  ]}>
                    {formData.tenancyType === type.value && (
                      <View style={[styles.radioCircleInner, { backgroundColor: primaryColor }]} />
                    )}
                  </View>
                  <View style={styles.optionContent}>
                    <ThemedText style={[styles.optionLabel, { color: textColor }]}>
                      {type.label}
                    </ThemedText>
                    <ThemedText style={[styles.optionDescription, { color: secondaryTextColor }]}>
                      {type.description}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Dates Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calendar" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Tenancy Dates
              </ThemedText>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Start Date <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
              </ThemedText>
              <TouchableOpacity
                style={[styles.dateInput, { backgroundColor: inputBgColor, borderColor }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <MaterialCommunityIcons name="calendar" size={20} color={secondaryTextColor} />
                <ThemedText style={[styles.dateText, { color: textColor }]}>
                  {formatDate(formData.tenancyStartDate)}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {formData.tenancyType === 'fixed' && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>
                  End Date <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                </ThemedText>
                <TouchableOpacity
                  style={[styles.dateInput, { backgroundColor: inputBgColor, borderColor }]}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <MaterialCommunityIcons name="calendar" size={20} color={secondaryTextColor} />
                  <ThemedText style={[styles.dateText, { color: textColor }]}>
                    {formatDate(formData.tenancyEndDate || '')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Payment Frequency Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="repeat" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Payment Frequency
              </ThemedText>
            </View>

            <View style={styles.frequencyContainer}>
              {PAYMENT_FREQUENCIES.map((freq) => (
                <TouchableOpacity
                  key={freq.value}
                  style={[
                    styles.frequencyButton,
                    { backgroundColor: inputBgColor, borderColor },
                    formData.paymentFrequency === freq.value && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                  ]}
                  onPress={() => updateFormData('paymentFrequency', freq.value)}
                >
                  <ThemedText
                    style={[
                      styles.frequencyLabel,
                      { color: formData.paymentFrequency === freq.value ? '#fff' : textColor },
                    ]}
                  >
                    {freq.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartDateChange}
          minimumDate={new Date()}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndDateChange}
          minimumDate={startDate}
        />
      )}

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: borderColor }]}>
        <View style={styles.footerButtons}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor }]}
            onPress={handleBack}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={textColor} />
            <ThemedText style={[styles.secondaryButtonText, { color: textColor }]}>Back</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryColor }]}
            onPress={handleNext}
          >
            <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  frequencyContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  frequencyButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
