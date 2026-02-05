/**
 * Ontario Lease Wizard - Step 5: Rent
 * 
 * Section 5 of Ontario Standard Lease:
 * - Rent payment day
 * - Base rent amount
 * - Parking rent
 * - Other services
 * - Payment method
 */

import React, { useEffect, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOntarioLeaseStore } from '@/store/ontarioLeaseStore';
import { usePropertyStore } from '@/store/propertyStore';

const PAYMENT_METHODS = [
  { value: 'etransfer', label: 'e-Transfer', icon: 'cellphone' },
  { value: 'cheque', label: 'Cheque', icon: 'checkbook' },
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'other', label: 'Other', icon: 'dots-horizontal' },
];

export default function LeaseWizardStep5() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    formData,
    updateFormData,
    nextStep,
    prevStep,
    propertyContext,
  } = useOntarioLeaseStore();

  const { properties, getPropertyById } = usePropertyStore();

  // Get rent amount from property/unit/subunit hierarchy
  const propertyRentInfo = useMemo(() => {
    if (!propertyContext?.propertyId) return null;

    const property = getPropertyById(propertyContext.propertyId);
    if (!property) return null;

    let rentAmount: number | undefined;
    let parkingIncluded = property.parkingIncluded;

    // Check subunit first, then unit, then property
    if (propertyContext.unitId) {
      const unit = property.units?.find(u => u.id === propertyContext.unitId);
      if (unit) {
        if (propertyContext.subUnitId) {
          const subUnit = unit.subUnits?.find(s => s.id === propertyContext.subUnitId);
          if (subUnit?.rentPrice) { // ← FIX: Use rentPrice not rentAmount
            rentAmount = subUnit.rentPrice;
          }
        }
        if (!rentAmount && unit.defaultRentPrice) { // ← FIX: Use defaultRentPrice for units
          rentAmount = unit.defaultRentPrice;
          parkingIncluded = unit.amenities?.parkingIncluded ?? parkingIncluded;
        }
      }
    }

    if (!rentAmount && property.rentAmount) {
      rentAmount = property.rentAmount;
    }

    return { rentAmount, parkingIncluded };
  }, [propertyContext, properties, getPropertyById]);

  // Pre-fill rent from property if not already set
  useEffect(() => {
    if (propertyRentInfo?.rentAmount && formData.baseRent === 0) {
      updateFormData('baseRent', propertyRentInfo.rentAmount);
    }
  }, [propertyRentInfo]);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const inputBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  const totalRent = (formData.baseRent || 0) + (formData.parkingRent || 0) + (formData.otherServicesRent || 0);

  const handleNext = () => {
    if (!formData.baseRent || formData.baseRent <= 0) {
      return;
    }
    if (!formData.rentPayableTo.trim()) {
      return;
    }

    nextStep();
    router.push('/lease-wizard/step6a');
  };

  const handleBack = () => {
    prevStep();
    router.back();
  };

  const handleNumberInput = (field: keyof typeof formData, value: string) => {
    const numValue = parseFloat(value) || 0;
    updateFormData(field, numValue);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleBack}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Step 5: Rent
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressContainer, { borderBottomColor: borderColor }]}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '83.33%', backgroundColor: primaryColor }]} />
        </View>
        <ThemedText style={[styles.progressText, { color: secondaryTextColor }]}>
          5 of 6
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
          {/* Rent Payment Day Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="calendar-today" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Payment Day
              </ThemedText>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Day of {formData.paymentFrequency === 'monthly' ? 'Month' : formData.paymentFrequency === 'weekly' ? 'Week' : 'Day'} <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="1"
                placeholderTextColor={secondaryTextColor}
                value={formData.rentPaymentDay?.toString() || ''}
                onChangeText={(text) => handleNumberInput('rentPaymentDay', text)}
                keyboardType="number-pad"
                maxLength={2}
              />
              <ThemedText style={[styles.inputHint, { color: secondaryTextColor }]}>
                {formData.paymentFrequency === 'monthly' ? 'Enter 1-31' : 'Enter payment day'}
              </ThemedText>
            </View>
          </View>

          {/* Rent Amounts Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="currency-usd" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Rent Amounts
              </ThemedText>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Base Rent <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
              </ThemedText>
              <View style={styles.currencyInput}>
                <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                <TextInput
                  style={[styles.currencyField, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.baseRent?.toString() || ''}
                  onChangeText={(text) => handleNumberInput('baseRent', text)}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Parking (if included)
              </ThemedText>
              <View style={styles.currencyInput}>
                <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                <TextInput
                  style={[styles.currencyField, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.parkingRent?.toString() || ''}
                  onChangeText={(text) => handleNumberInput('parkingRent', text)}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Other Services
              </ThemedText>
              <View style={styles.currencyInput}>
                <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                <TextInput
                  style={[styles.currencyField, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.otherServicesRent?.toString() || ''}
                  onChangeText={(text) => handleNumberInput('otherServicesRent', text)}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Total */}
            <View style={[styles.totalCard, { backgroundColor: `${primaryColor}15`, borderColor: primaryColor }]}>
              <ThemedText style={[styles.totalLabel, { color: textColor }]}>
                Total {formData.paymentFrequency === 'monthly' ? 'Monthly' : formData.paymentFrequency === 'weekly' ? 'Weekly' : 'Daily'} Rent
              </ThemedText>
              <ThemedText style={[styles.totalAmount, { color: primaryColor }]}>
                ${totalRent.toFixed(2)}
              </ThemedText>
            </View>
          </View>

          {/* Payment Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="credit-card" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Payment Details
              </ThemedText>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Rent Payable To <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Landlord's name"
                placeholderTextColor={secondaryTextColor}
                value={formData.rentPayableTo}
                onChangeText={(text) => updateFormData('rentPayableTo', text)}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Payment Method
              </ThemedText>
              <View style={styles.paymentMethodsGrid}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.value}
                    style={[
                      styles.paymentMethodCard,
                      { backgroundColor: inputBgColor, borderColor },
                      formData.paymentMethod === method.value && {
                        borderColor: primaryColor,
                        backgroundColor: `${primaryColor}10`,
                      },
                    ]}
                    onPress={() => updateFormData('paymentMethod', method.value)}
                  >
                    <MaterialCommunityIcons
                      name={method.icon as any}
                      size={24}
                      color={formData.paymentMethod === method.value ? primaryColor : secondaryTextColor}
                    />
                    <ThemedText
                      style={[
                        styles.paymentMethodLabel,
                        { color: formData.paymentMethod === method.value ? primaryColor : textColor },
                      ]}
                    >
                      {method.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {formData.paymentMethod === 'cheque' && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>
                  NSF Cheque Fee
                </ThemedText>
                <View style={styles.currencyInput}>
                  <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                  <TextInput
                    style={[styles.currencyField, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="20.00"
                    placeholderTextColor={secondaryTextColor}
                    value={formData.chequeBounceCharge?.toString() || ''}
                    onChangeText={(text) => handleNumberInput('chequeBounceCharge', text)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <ThemedText style={[styles.inputHint, { color: secondaryTextColor }]}>
                  Fee charged for returned cheques (max $20 in Ontario)
                </ThemedText>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 4,
  },
  currencyInput: {
    position: 'relative',
  },
  currencySymbol: {
    position: 'absolute',
    left: 16,
    top: 14,
    fontSize: 16,
    fontWeight: '500',
    zIndex: 1,
  },
  currencyField: {
    height: 48,
    paddingLeft: 32,
    paddingRight: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  paymentMethodCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  paymentMethodLabel: {
    fontSize: 13,
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
