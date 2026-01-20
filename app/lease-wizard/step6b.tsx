/**
 * Ontario Lease Wizard - Step 7: Deposits, Rules & Terms
 * 
 * Sections 7-11 of Ontario Standard Lease:
 * - Rent Discounts (Section 7)
 * - Rent Deposit (Section 8)
 * - Key Deposit (Section 9)
 * - Smoking Rules (Section 10)
 * - Tenant's Insurance (Section 11)
 * - Additional Terms (Section 12-15)
 */

import React from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOntarioLeaseStore } from '@/store/ontarioLeaseStore';

export default function LeaseWizardStep6b() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    formData,
    updateFormData,
    nextStep,
    prevStep,
  } = useOntarioLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const inputBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  const handleNext = () => {
    nextStep();
    router.push('/lease-wizard/step6'); // Go to final review step
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
          Step 7: Deposits & Rules
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressContainer, { borderBottomColor: borderColor }]}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '87.5%', backgroundColor: primaryColor }]} />
        </View>
        <ThemedText style={[styles.progressText, { color: secondaryTextColor }]}>
          7 of 8
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
          {/* Section 7: Rent Discounts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="percent" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Rent Discounts
              </ThemedText>
            </View>

            <View style={[styles.switchRow, { backgroundColor: inputBgColor, borderColor }]}>
              <View style={styles.switchContent}>
                <ThemedText style={[styles.switchLabel, { color: textColor }]}>Is there a rent discount?</ThemedText>
                <ThemedText style={[styles.switchDescription, { color: secondaryTextColor }]}>
                  e.g., Early payment discount
                </ThemedText>
              </View>
              <Switch
                value={formData.hasRentDiscount || false}
                onValueChange={(value) => updateFormData('hasRentDiscount', value)}
                trackColor={{ false: borderColor, true: `${primaryColor}60` }}
                thumbColor={formData.hasRentDiscount ? primaryColor : '#f4f3f4'}
              />
            </View>

            {formData.hasRentDiscount && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>Describe the discount</ThemedText>
                <TextInput
                  style={[styles.textArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="e.g., $50 off if rent is paid by the 1st of each month"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.rentDiscountDescription}
                  onChangeText={(text) => updateFormData('rentDiscountDescription', text)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>

          {/* Section 8: Rent Deposit */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cash-lock" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Rent Deposit
              </ThemedText>
            </View>

            <View style={[styles.switchRow, { backgroundColor: inputBgColor, borderColor }]}>
              <View style={styles.switchContent}>
                <ThemedText style={[styles.switchLabel, { color: textColor }]}>Is a rent deposit required?</ThemedText>
                <ThemedText style={[styles.switchDescription, { color: secondaryTextColor }]}>
                  Applied to last month's rent only
                </ThemedText>
              </View>
              <Switch
                value={formData.requiresRentDeposit || false}
                onValueChange={(value) => updateFormData('requiresRentDeposit', value)}
                trackColor={{ false: borderColor, true: `${primaryColor}60` }}
                thumbColor={formData.requiresRentDeposit ? primaryColor : '#f4f3f4'}
              />
            </View>

            {formData.requiresRentDeposit && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>Rent Deposit Amount ($)</ThemedText>
                <View style={styles.currencyInputContainer}>
                  <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                  <TextInput
                    style={[styles.currencyInput, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="0.00"
                    placeholderTextColor={secondaryTextColor}
                    value={formData.rentDepositAmount?.toString() || ''}
                    onChangeText={(text) => updateFormData('rentDepositAmount', parseFloat(text) || 0)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <ThemedText style={[styles.hint, { color: secondaryTextColor }]}>
                  Cannot exceed one month's rent
                </ThemedText>
              </View>
            )}
          </View>

          {/* Section 9: Key Deposit */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="key" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Key Deposit
              </ThemedText>
            </View>

            <View style={[styles.switchRow, { backgroundColor: inputBgColor, borderColor }]}>
              <View style={styles.switchContent}>
                <ThemedText style={[styles.switchLabel, { color: textColor }]}>Is a key deposit required?</ThemedText>
                <ThemedText style={[styles.switchDescription, { color: secondaryTextColor }]}>
                  Refundable upon return of keys
                </ThemedText>
              </View>
              <Switch
                value={formData.requiresKeyDeposit || false}
                onValueChange={(value) => updateFormData('requiresKeyDeposit', value)}
                trackColor={{ false: borderColor, true: `${primaryColor}60` }}
                thumbColor={formData.requiresKeyDeposit ? primaryColor : '#f4f3f4'}
              />
            </View>

            {formData.requiresKeyDeposit && (
              <>
                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: textColor }]}>Key Deposit Amount ($)</ThemedText>
                  <View style={styles.currencyInputContainer}>
                    <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                    <TextInput
                      style={[styles.currencyInput, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="0.00"
                      placeholderTextColor={secondaryTextColor}
                      value={formData.keyDepositAmount?.toString() || ''}
                      onChangeText={(text) => updateFormData('keyDepositAmount', parseFloat(text) || 0)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: textColor }]}>Keys/Cards Description</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="e.g., 2 keys, 1 fob, 1 mailbox key"
                    placeholderTextColor={secondaryTextColor}
                    value={formData.keyDepositDescription}
                    onChangeText={(text) => updateFormData('keyDepositDescription', text)}
                  />
                </View>
              </>
            )}
          </View>

          {/* Section 10: Smoking */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="smoking-off" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Smoking Rules
              </ThemedText>
            </View>

            <View style={styles.radioGroup}>
              {[
                { value: 'none', label: 'No additional rules', icon: 'minus-circle-outline' },
                { value: 'prohibited', label: 'No smoking in unit or property', icon: 'smoking-off' },
                { value: 'designated', label: 'Smoking allowed in designated areas only', icon: 'smoking' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.radioButton,
                    { backgroundColor: inputBgColor, borderColor },
                    formData.smokingRules === option.value && { borderColor: primaryColor, backgroundColor: `${primaryColor}10` },
                  ]}
                  onPress={() => updateFormData('smokingRules', option.value)}
                >
                  <View style={[styles.radio, { borderColor: formData.smokingRules === option.value ? primaryColor : borderColor }]}>
                    {formData.smokingRules === option.value && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
                  </View>
                  <MaterialCommunityIcons name={option.icon as any} size={20} color={secondaryTextColor} />
                  <ThemedText style={[styles.radioLabel, { color: textColor }]}>{option.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {formData.smokingRules && formData.smokingRules !== 'none' && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>Smoking Rules Details</ThemedText>
                <TextInput
                  style={[styles.textArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="Specify smoking rules and designated areas..."
                  placeholderTextColor={secondaryTextColor}
                  value={formData.smokingRulesDescription}
                  onChangeText={(text) => updateFormData('smokingRulesDescription', text)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>

          {/* Section 11: Tenant's Insurance */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="shield-check" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Tenant's Insurance
              </ThemedText>
            </View>

            <View style={[styles.switchRow, { backgroundColor: inputBgColor, borderColor }]}>
              <View style={styles.switchContent}>
                <ThemedText style={[styles.switchLabel, { color: textColor }]}>Require tenant insurance?</ThemedText>
                <ThemedText style={[styles.switchDescription, { color: secondaryTextColor }]}>
                  Tenant must have liability insurance
                </ThemedText>
              </View>
              <Switch
                value={formData.requiresTenantInsurance || false}
                onValueChange={(value) => updateFormData('requiresTenantInsurance', value)}
                trackColor={{ false: borderColor, true: `${primaryColor}60` }}
                thumbColor={formData.requiresTenantInsurance ? primaryColor : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Section 12-15: Additional Terms */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="file-document-edit" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Additional Terms
              </ThemedText>
            </View>
            <ThemedText style={[styles.sectionDescription, { color: secondaryTextColor }]}>
              Any other terms agreed upon by landlord and tenant that don't conflict with the Residential Tenancies Act.
            </ThemedText>

            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.largeTextArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Enter any additional terms or conditions..."
                placeholderTextColor={secondaryTextColor}
                value={formData.additionalTerms}
                onChangeText={(text) => updateFormData('additionalTerms', text)}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
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
            <ThemedText style={styles.primaryButtonText}>Review & Generate</ThemedText>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  progressBar: { flex: 1, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 12, fontWeight: '500' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionDescription: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  largeTextArea: {
    minHeight: 140,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  currencyInputContainer: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: { position: 'absolute', left: 16, fontSize: 16, fontWeight: '600', zIndex: 1 },
  currencyInput: {
    flex: 1,
    height: 48,
    paddingLeft: 36,
    paddingRight: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  hint: { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  switchContent: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  switchDescription: { fontSize: 12, marginTop: 4 },
  radioGroup: { gap: 10, marginBottom: 16 },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 14, flex: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 16, borderTopWidth: 1 },
  footerButtons: { flexDirection: 'row', gap: 12 },
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
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
