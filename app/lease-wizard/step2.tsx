/**
 * Ontario Lease Wizard - Step 2: Rental Unit
 * 
 * Section 2 of Ontario Standard Lease:
 * - Property address (autofill from stored address OR select from existing properties)
 * - Parking details
 * - Is Condo
 */

import React, { useState, useEffect } from 'react';
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
import PropertyAddressSelector, { SelectedPropertyData } from '@/components/PropertyAddressSelector';

export default function LeaseWizardStep2() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    formData,
    updateFormData,
    updateUnitAddress,
    nextStep,
    prevStep,
    propertyContext,
    setPropertyContext,
  } = useOntarioLeaseStore();

  const [usePropertySelector, setUsePropertySelector] = useState(!formData.unitAddress.city);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const inputBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  // Handle property selection from PropertyAddressSelector
  const handlePropertySelect = (data: SelectedPropertyData) => {
    // Update property context in store
    setPropertyContext({
      propertyId: data.property.id,
      unitId: data.unit?.id,
      subUnitId: data.subUnit?.id,
    });

    // Parse address from property
    const addressParts = data.property.address1?.split(' ') || [];
    const streetNumber = addressParts[0] || '';
    const streetName = addressParts.slice(1).join(' ') || '';

    // Update unit address fields
    updateUnitAddress('unit', data.unit?.unitNumber || data.property.address2 || '');
    updateUnitAddress('streetNumber', streetNumber);
    updateUnitAddress('streetName', streetName);
    updateUnitAddress('city', data.property.city || '');
    updateUnitAddress('province', data.property.state || 'ON');
    updateUnitAddress('postalCode', data.property.zipCode || '');

    // Update parking if available
    if (data.parkingIncluded) {
      updateFormData('parkingDescription', 'Parking included');
    }

    // Update rent amount if available
    if (data.rentAmount) {
      updateFormData('baseRent', data.rentAmount);
    }

    // Switch to edit mode
    setUsePropertySelector(false);
  };

  const handleNext = () => {
    // Validation
    if (!formData.unitAddress.streetNumber || !formData.unitAddress.streetName) {
      return;
    }
    if (!formData.unitAddress.city || !formData.unitAddress.postalCode) {
      return;
    }

    nextStep();
    router.push('/lease-wizard/step3');
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
          Step 2: Rental Unit
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressContainer, { borderBottomColor: borderColor }]}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '33.33%', backgroundColor: primaryColor }]} />
        </View>
        <ThemedText style={[styles.progressText, { color: secondaryTextColor }]}>
          2 of 6
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
          {/* Address Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="home-map-marker" size={24} color={primaryColor} />
                <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                  Rental Unit Address
                </ThemedText>
              </View>
              <TouchableOpacity
                style={[styles.toggleModeButton, { borderColor: primaryColor }]}
                onPress={() => setUsePropertySelector(!usePropertySelector)}
              >
                <MaterialCommunityIcons 
                  name={usePropertySelector ? "pencil" : "home-search"} 
                  size={14} 
                  color={primaryColor} 
                />
                <ThemedText style={[styles.toggleModeText, { color: primaryColor }]}>
                  {usePropertySelector ? "Enter Manually" : "Select Property"}
                </ThemedText>
              </TouchableOpacity>
            </View>
            <ThemedText style={[styles.sectionDescription, { color: secondaryTextColor }]}>
              {usePropertySelector 
                ? "Select from your existing properties or enter manually."
                : "Enter the complete address of the rental unit as it should appear on the lease."}
            </ThemedText>

            {usePropertySelector ? (
              <>
                {/* Property Selector */}
                <PropertyAddressSelector
                  onSelect={handlePropertySelect}
                  selectedPropertyId={propertyContext?.propertyId}
                  selectedUnitId={propertyContext?.unitId}
                  label="Select Property / Unit"
                  required
                  placeholder="Choose a property..."
                />
                
                {/* Hint for manual entry */}
                <TouchableOpacity 
                  style={styles.manualHint}
                  onPress={() => setUsePropertySelector(false)}
                >
                  <MaterialCommunityIcons name="information-outline" size={14} color={secondaryTextColor} />
                  <ThemedText style={[styles.manualHintText, { color: secondaryTextColor }]}>
                    Property not listed? Switch to manual entry
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Manual Address Entry */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <ThemedText style={[styles.label, { color: textColor }]}>
                      Unit # (if applicable)
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="e.g., 4B"
                      placeholderTextColor={secondaryTextColor}
                      value={formData.unitAddress.unit}
                      onChangeText={(text) => updateUnitAddress('unit', text)}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <ThemedText style={[styles.label, { color: textColor }]}>
                      Street Number <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="123"
                      placeholderTextColor={secondaryTextColor}
                      value={formData.unitAddress.streetNumber}
                      onChangeText={(text) => updateUnitAddress('streetNumber', text)}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: textColor }]}>
                    Street Name <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="Main Street"
                    placeholderTextColor={secondaryTextColor}
                    value={formData.unitAddress.streetName}
                    onChangeText={(text) => updateUnitAddress('streetName', text)}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 2 }]}>
                    <ThemedText style={[styles.label, { color: textColor }]}>
                      City <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="Toronto"
                      placeholderTextColor={secondaryTextColor}
                      value={formData.unitAddress.city}
                      onChangeText={(text) => updateUnitAddress('city', text)}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <ThemedText style={[styles.label, { color: textColor }]}>
                      Province <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="ON"
                      placeholderTextColor={secondaryTextColor}
                      value={formData.unitAddress.province}
                      onChangeText={(text) => updateUnitAddress('province', text)}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: textColor }]}>
                    Postal Code <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="M5V 1A1"
                    placeholderTextColor={secondaryTextColor}
                    value={formData.unitAddress.postalCode}
                    onChangeText={(text) => updateUnitAddress('postalCode', text)}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Show address preview if filled */}
                {formData.unitAddress.city && (
                  <View style={[styles.addressPreview, { backgroundColor: isDark ? '#1a242d' : '#f0f9ff', borderColor: primaryColor }]}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={primaryColor} />
                    <ThemedText style={[styles.addressPreviewText, { color: textColor }]} numberOfLines={2}>
                      {formData.unitAddress.unit ? `Unit ${formData.unitAddress.unit}, ` : ''}
                      {formData.unitAddress.streetNumber} {formData.unitAddress.streetName}, {formData.unitAddress.city}, {formData.unitAddress.province} {formData.unitAddress.postalCode}
                    </ThemedText>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Parking Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="car" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Parking
              </ThemedText>
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Parking Description (if included)
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="e.g., One underground parking spot, Space #42"
                placeholderTextColor={secondaryTextColor}
                value={formData.parkingDescription}
                onChangeText={(text) => updateFormData('parkingDescription', text)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Condo Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="office-building" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Condominium
              </ThemedText>
            </View>

            <View style={[styles.switchRow, { backgroundColor: inputBgColor, borderColor }]}>
              <View style={styles.switchContent}>
                <ThemedText style={[styles.switchLabel, { color: textColor }]}>
                  Is this unit in a condominium?
                </ThemedText>
                <ThemedText style={[styles.switchDescription, { color: secondaryTextColor }]}>
                  Condo rules and bylaws may apply
                </ThemedText>
              </View>
              <Switch
                value={formData.isCondo}
                onValueChange={(value) => updateFormData('isCondo', value)}
                trackColor={{ false: borderColor, true: `${primaryColor}60` }}
                thumbColor={formData.isCondo ? primaryColor : '#f4f3f4'}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  toggleModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  toggleModeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  manualHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  manualHintText: {
    fontSize: 12,
  },
  addressPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  addressPreviewText: {
    flex: 1,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  switchContent: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  switchDescription: {
    fontSize: 12,
    marginTop: 4,
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
