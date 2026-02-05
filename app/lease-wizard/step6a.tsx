/**
 * Ontario Lease Wizard - Step 6: Services & Utilities
 * 
 * Section 6 of Ontario Standard Lease:
 * - Services included (gas, AC, storage, laundry, guest parking)
 * - Utility responsibility (electricity, heat, water)
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

export default function LeaseWizardStep6a() {
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

  const updateUtility = (field: string, value: any) => {
    updateFormData('utilities', {
      ...formData.utilities,
      [field]: value,
    });
  };

  const handleNext = () => {
    nextStep();
    router.push('/lease-wizard/step6b');
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
          Step 6: Services & Utilities
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressContainer, { borderBottomColor: borderColor }]}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '75%', backgroundColor: primaryColor }]} />
        </View>
        <ThemedText style={[styles.progressText, { color: secondaryTextColor }]}>
          6 of 8
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
          {/* Services Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cog" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Services Included
              </ThemedText>
            </View>
            <ThemedText style={[styles.sectionDescription, { color: secondaryTextColor }]}>
              Select which services are included in the rent.
            </ThemedText>

            {/* Gas */}
            <View style={[styles.switchRow, { backgroundColor: inputBgColor, borderColor }]}>
              <View style={styles.switchContent}>
                <ThemedText style={[styles.switchLabel, { color: textColor }]}>Gas</ThemedText>
              </View>
              <Switch
                value={formData.utilities?.gas || false}
                onValueChange={(value) => updateUtility('gas', value)}
                trackColor={{ false: borderColor, true: `${primaryColor}60` }}
                thumbColor={formData.utilities?.gas ? primaryColor : '#f4f3f4'}
              />
            </View>

            {/* Air Conditioning */}
            <View style={[styles.switchRow, { backgroundColor: inputBgColor, borderColor }]}>
              <View style={styles.switchContent}>
                <ThemedText style={[styles.switchLabel, { color: textColor }]}>Air Conditioning</ThemedText>
              </View>
              <Switch
                value={formData.utilities?.airConditioning || false}
                onValueChange={(value) => updateUtility('airConditioning', value)}
                trackColor={{ false: borderColor, true: `${primaryColor}60` }}
                thumbColor={formData.utilities?.airConditioning ? primaryColor : '#f4f3f4'}
              />
            </View>

            {/* Additional Storage */}
            <View style={[styles.switchRow, { backgroundColor: inputBgColor, borderColor }]}>
              <View style={styles.switchContent}>
                <ThemedText style={[styles.switchLabel, { color: textColor }]}>Additional Storage Space</ThemedText>
              </View>
              <Switch
                value={formData.utilities?.additionalStorage || false}
                onValueChange={(value) => updateUtility('additionalStorage', value)}
                trackColor={{ false: borderColor, true: `${primaryColor}60` }}
                thumbColor={formData.utilities?.additionalStorage ? primaryColor : '#f4f3f4'}
              />
            </View>

            {/* On-Site Laundry */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>On-Site Laundry</ThemedText>
              <View style={styles.radioGroup}>
                {['none', 'included', 'payPerUse'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.radioButton,
                      { backgroundColor: inputBgColor, borderColor },
                      formData.utilities?.laundry === option && { borderColor: primaryColor, backgroundColor: `${primaryColor}10` },
                    ]}
                    onPress={() => updateUtility('laundry', option)}
                  >
                    <View style={[styles.radio, { borderColor: formData.utilities?.laundry === option ? primaryColor : borderColor }]}>
                      {formData.utilities?.laundry === option && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
                    </View>
                    <ThemedText style={[styles.radioLabel, { color: textColor }]}>
                      {option === 'none' ? 'No' : option === 'included' ? 'Yes - No Charge' : 'Yes - Pay Per Use'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Guest Parking */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>Guest Parking</ThemedText>
              <View style={styles.radioGroup}>
                {['none', 'included', 'payPerUse'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.radioButton,
                      { backgroundColor: inputBgColor, borderColor },
                      formData.utilities?.guestParking === option && { borderColor: primaryColor, backgroundColor: `${primaryColor}10` },
                    ]}
                    onPress={() => updateUtility('guestParking', option)}
                  >
                    <View style={[styles.radio, { borderColor: formData.utilities?.guestParking === option ? primaryColor : borderColor }]}>
                      {formData.utilities?.guestParking === option && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
                    </View>
                    <ThemedText style={[styles.radioLabel, { color: textColor }]}>
                      {option === 'none' ? 'No' : option === 'included' ? 'Yes - No Charge' : 'Yes - Pay Per Use'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Services Description */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>Additional Services (optional)</ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="List any other services included..."
                placeholderTextColor={secondaryTextColor}
                value={formData.servicesDescription}
                onChangeText={(text) => updateFormData('servicesDescription', text)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Utilities Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="lightning-bolt" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Utility Responsibility
              </ThemedText>
            </View>
            <ThemedText style={[styles.sectionDescription, { color: secondaryTextColor }]}>
              Who is responsible for paying each utility?
            </ThemedText>

            {/* Electricity */}
            <View style={styles.utilityRow}>
              <ThemedText style={[styles.utilityLabel, { color: textColor }]}>Electricity</ThemedText>
              <View style={styles.utilityButtons}>
                {['landlord', 'tenant'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.utilityButton,
                      { borderColor },
                      formData.utilities?.electricity === option && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => updateUtility('electricity', option)}
                  >
                    <ThemedText style={[
                      styles.utilityButtonText,
                      { color: formData.utilities?.electricity === option ? '#fff' : textColor },
                    ]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Heat */}
            <View style={styles.utilityRow}>
              <ThemedText style={[styles.utilityLabel, { color: textColor }]}>Heat</ThemedText>
              <View style={styles.utilityButtons}>
                {['landlord', 'tenant'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.utilityButton,
                      { borderColor },
                      formData.utilities?.heat === option && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => updateUtility('heat', option)}
                  >
                    <ThemedText style={[
                      styles.utilityButtonText,
                      { color: formData.utilities?.heat === option ? '#fff' : textColor },
                    ]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Water */}
            <View style={styles.utilityRow}>
              <ThemedText style={[styles.utilityLabel, { color: textColor }]}>Water</ThemedText>
              <View style={styles.utilityButtons}>
                {['landlord', 'tenant'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.utilityButton,
                      { borderColor },
                      formData.utilities?.water === option && { backgroundColor: primaryColor, borderColor: primaryColor },
                    ]}
                    onPress={() => updateUtility('water', option)}
                  >
                    <ThemedText style={[
                      styles.utilityButtonText,
                      { color: formData.utilities?.water === option ? '#fff' : textColor },
                    ]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Utilities Description */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>Utility Details (optional)</ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="e.g., Tenant sets up account with utility provider..."
                placeholderTextColor={secondaryTextColor}
                value={formData.utilitiesDescription}
                onChangeText={(text) => updateFormData('utilitiesDescription', text)}
                multiline
                numberOfLines={3}
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
            <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
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
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionDescription: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  textArea: {
    minHeight: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  switchContent: { flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: '500' },
  radioGroup: { gap: 8 },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 14 },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  utilityLabel: { fontSize: 15, fontWeight: '500' },
  utilityButtons: { flexDirection: 'row', gap: 8 },
  utilityButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  utilityButtonText: { fontSize: 13, fontWeight: '600' },
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
