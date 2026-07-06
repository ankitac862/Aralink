import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { inviteApplicantToProperty } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore } from '@/store/propertyStore';

export default function AddApplicantScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prefillEmail } = useLocalSearchParams<{ prefillEmail?: string }>();
  const properties = usePropertyStore((state) => state.properties);
  const loadProperties = usePropertyStore((state) => state.loadFromSupabase);
  const { user } = useAuthStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const secondaryTextColor = isDark ? '#9BA1A6' : '#6E7377';
  const inputBgColor = isDark ? '#141517' : '#F7F7F8';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const infoBgColor = isDark ? '#222428' : '#EDEDEF';
  const infoTextColor = isDark ? '#9BA1A6' : '#3C4043';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    propertyId: '',
    unitId: '',
    subUnitId: '',
  });

  useEffect(() => {
    if (prefillEmail) {
      setFormData(prev => ({ ...prev, email: prefillEmail }));
    }
  }, [prefillEmail]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showSubUnitDropdown, setShowSubUnitDropdown] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');

  // Load properties from Supabase on mount
  useEffect(() => {
    console.log('🔍 AddApplicant: useEffect triggered');
    console.log('🔍 AddApplicant: user?.id:', user?.id);
    console.log('🔍 AddApplicant: properties count:', properties.length);
    
    if (user?.id) {
      console.log('🔄 AddApplicant: Calling loadProperties...');
      setIsLoadingProperties(true);
      loadProperties(user.id).then(() => {
        console.log('✅ AddApplicant: loadProperties completed');
        console.log('📦 AddApplicant: properties after load:', properties.length);
        setIsLoadingProperties(false);
      }).catch(error => {
        console.error('❌ AddApplicant: loadProperties error:', error);
        setIsLoadingProperties(false);
      });
    } else {
      console.warn('⚠️ AddApplicant: No user ID available');
      setIsLoadingProperties(false);
    }
  }, [user?.id]);

  useEffect(() => {
    console.log('📊 AddApplicant: Properties updated, count:', properties.length);
    if (properties.length > 0) {
      console.log('📊 AddApplicant: First property object:', JSON.stringify(properties[0], null, 2));
      console.log('📊 AddApplicant: First property name:', properties[0]?.name);
    }
  }, [properties]);

  const selectedProperty = properties.find(p => p.id === formData.propertyId);

  // Build property options (same as add-tenant)
  const propertyOptions = properties.map(p => ({
    id: p.id,
    label: `${p.address1 || 'Unknown'}, ${p.city}`,
    type: p.propertyType,
  }));

  const isMultiUnitProperty = selectedProperty?.propertyType === 'multi_unit';
  const isByRoomProperty = !!selectedProperty && !isMultiUnitProperty && selectedProperty.rentCompleteProperty === false;

  // Get units for selected property
  const availableUnits = useMemo(() => {
    if (!selectedProperty) return [];
    if (!isMultiUnitProperty && !isByRoomProperty) return [];
    return selectedProperty.units || [];
  }, [selectedProperty, isMultiUnitProperty, isByRoomProperty]);

  // Get selected unit
  const selectedUnit = useMemo(() =>
    availableUnits.find(u => u.id === formData.unitId),
    [availableUnits, formData.unitId]
  );

  // Get sub-units (rooms) for selected unit
  const availableSubUnits = useMemo(() => {
    if (!selectedUnit) return [];
    if (!isByRoomProperty && selectedUnit.rentEntireUnit) return [];
    return selectedUnit.subUnits || [];
  }, [selectedUnit, isByRoomProperty]);

  // Get selected sub-unit
  const selectedSubUnit = useMemo(() =>
    availableSubUnits.find(s => s.id === formData.subUnitId),
    [availableSubUnits, formData.subUnitId]
  );

  // Reset dependent selections when property changes
  const handlePropertyChange = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    const shouldAutoSelectUnit = property && property.propertyType !== 'multi_unit' && property.rentCompleteProperty === false;
    const autoUnitId = shouldAutoSelectUnit ? property.units?.[0]?.id || '' : '';

    setFormData(prev => ({
      ...prev,
      propertyId,
      unitId: autoUnitId,
      subUnitId: '',
    }));
    setShowPropertyDropdown(false);
  };

  // Reset sub-unit when unit changes
  const handleUnitChange = (unitId: string) => {
    setFormData(prev => ({
      ...prev,
      unitId,
      subUnitId: '',
    }));
    setShowUnitDropdown(false);
  };

  // Handle sub-unit change
  const handleSubUnitChange = (subUnitId: string) => {
    setFormData(prev => ({
      ...prev,
      subUnitId,
    }));
    setShowSubUnitDropdown(false);
  };

  const handleSubmit = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert('Error', 'Please enter first and last name');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Please enter email address');
      return;
    }
    if (!formData.propertyId) {
      Alert.alert('Error', 'Please select a property');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!user?.id) {
        Alert.alert('Error', 'You must be signed in to invite an applicant.');
        setIsSubmitting(false);
        return;
      }

      // Log the selected property details
      console.log('🏠 SENDING INVITE FOR PROPERTY:', {
        propertyId: formData.propertyId,
        address: selectedProperty?.address1,
        city: selectedProperty?.city,
        type: selectedProperty?.propertyType,
      });

      const inviteResult = await inviteApplicantToProperty({
        propertyId: formData.propertyId,
        applicantEmail: formData.email.trim(),
        applicantName: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        unitId: formData.unitId || undefined,
        subUnitId: formData.subUnitId || undefined,
      });

      console.log('📨 AddApplicant: inviteResult:', JSON.stringify(inviteResult, null, 2));

      if (!inviteResult) {
        console.error('❌ AddApplicant: inviteResult is null or undefined');
        Alert.alert('Error', 'Failed to send invite. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (inviteResult.error) {
        console.error('❌ AddApplicant: inviteResult has error:', inviteResult.error);
        Alert.alert('Error', inviteResult.error);
        setIsSubmitting(false);
        return;
      }

      if (!inviteResult.inviteId) {
        console.error('❌ AddApplicant: inviteResult missing inviteId. Full result:', inviteResult);
        Alert.alert('Error', 'Failed to create invite. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Show success message based on how applicant was notified
      // emailQueued defaults to true unless explicitly false
      const emailSent = inviteResult.emailQueued !== false;
      const notifSent = inviteResult.notificationQueued === true;
      const successMessage =
        emailSent && notifSent
          ? 'Invitation sent! The applicant will receive an email and an in-app notification to apply for this property.'
          : notifSent
          ? 'Invitation sent! The applicant has received an in-app notification to apply for this property.'
          : emailSent
          ? 'Invitation sent! The applicant will receive an email with instructions to apply for this property.'
          : 'Applicant has been saved. The invite could not be delivered — please follow up with them directly or resend the invite later.';

      Alert.alert('Success', successMessage, [
        {
          text: 'OK',
          onPress: () => {
            setTimeout(() => {
              router.back();
            }, 100);
          }
        }
      ]);
    } catch (error) {
      console.error('Error inviting applicant:', error);
      Alert.alert('Error', 'Failed to invite applicant. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Invite Applicant
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Info Box */}
          <View style={[styles.infoBox, { backgroundColor: infoBgColor }]}>
            <MaterialCommunityIcons name="information" size={20} color={infoTextColor} />
            <ThemedText style={[styles.infoText, { color: infoTextColor }]}>
              Invite someone to apply for your property. They will receive a notification to start their application.
            </ThemedText>
          </View>

          {/* Form Fields */}
          <View style={[styles.card, { backgroundColor: cardBgColor }]}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Applicant Information</ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>First Name *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, color: textColor, borderColor }]}
                value={formData.firstName}
                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                placeholder="Enter first name"
                placeholderTextColor={secondaryTextColor}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Last Name *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, color: textColor, borderColor }]}
                value={formData.lastName}
                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                placeholder="Enter last name"
                placeholderTextColor={secondaryTextColor}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Email *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, color: textColor, borderColor }]}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="Enter email address"
                placeholderTextColor={secondaryTextColor}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Phone (Optional)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, color: textColor, borderColor }]}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="Enter phone number"
                placeholderTextColor={secondaryTextColor}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Property Selection */}
          <View style={[styles.card, { backgroundColor: cardBgColor }]}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Property Details</ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Property *</ThemedText>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: inputBgColor, borderColor }]}
                onPress={() => setShowPropertyDropdown(!showPropertyDropdown)}
                disabled={isLoadingProperties}>
                {isLoadingProperties ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={secondaryTextColor} />
                    <ThemedText style={[styles.dropdownText, { color: secondaryTextColor }]}>
                      Loading properties...
                    </ThemedText>
                  </View>
                ) : (
                  <>
                    <ThemedText style={[styles.dropdownText, { color: selectedProperty ? textColor : secondaryTextColor }]}>
                      {selectedProperty 
                        ? `${selectedProperty.address1}, ${selectedProperty.city}` 
                        : 'Select a property'}
                    </ThemedText>
                    <MaterialCommunityIcons
                      name={showPropertyDropdown ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color={secondaryTextColor}
                    />
                  </>
                )}
              </TouchableOpacity>

              {showPropertyDropdown && (
                <View style={[styles.dropdownList, { backgroundColor: cardBgColor, borderColor }]}>
                  {/* Search input */}
                  <View style={[styles.dropdownSearch, { borderBottomColor: borderColor }]}>
                    <MaterialCommunityIcons name="magnify" size={18} color={secondaryTextColor} />
                    <TextInput
                      style={[styles.dropdownSearchInput, { color: textColor }]}
                      placeholder="Search properties..."
                      placeholderTextColor={secondaryTextColor}
                      value={propertySearch}
                      onChangeText={setPropertySearch}
                      autoCorrect={false}
                    />
                    {propertySearch.length > 0 && (
                      <TouchableOpacity onPress={() => setPropertySearch('')}>
                        <MaterialCommunityIcons name="close-circle" size={16} color={secondaryTextColor} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                    {propertyOptions.length === 0 ? (
                      <View style={[styles.dropdownItem, { borderBottomColor: borderColor }]}>
                        <ThemedText style={[styles.dropdownItemText, { color: secondaryTextColor }]}>
                          No properties available
                        </ThemedText>
                        <ThemedText style={[styles.dropdownItemSubtext, { color: secondaryTextColor, fontSize: 12 }]}>
                          Add a property first from the Properties tab
                        </ThemedText>
                      </View>
                    ) : (
                      propertyOptions
                        .filter(o => o.label.toLowerCase().includes(propertySearch.toLowerCase()))
                        .map((option) => (
                          <TouchableOpacity
                            key={option.id}
                            style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                            onPress={() => { handlePropertyChange(option.id); setPropertySearch(''); }}>
                            <View style={styles.dropdownItemContent}>
                              <ThemedText style={[styles.dropdownItemText, { color: textColor }]}>
                                {option.label}
                              </ThemedText>
                              <View style={[styles.propertyTypeBadge, { backgroundColor: isDark ? '#26282C' : '#E8E8EA' }]}>
                                <ThemedText style={[styles.propertyTypeText, { color: secondaryTextColor }]}>
                                  {option.type === 'single_unit' ? 'Single' : 'Multi'}
                                </ThemedText>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Unit Selection (only for multi-unit properties) */}
            {selectedProperty?.propertyType === 'multi_unit' && availableUnits.length > 0 && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Select Unit *</ThemedText>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: inputBgColor, borderColor }]}
                  onPress={() => {
                    setShowUnitDropdown(!showUnitDropdown);
                    setShowPropertyDropdown(false);
                    setShowSubUnitDropdown(false);
                  }}
                >
                  <ThemedText style={[styles.dropdownText, { color: formData.unitId ? textColor : secondaryTextColor }]}>
                    {selectedUnit ? selectedUnit.name : 'Select a unit'}
                  </ThemedText>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
                </TouchableOpacity>
                {showUnitDropdown && (
                  <View style={[styles.dropdownList, { backgroundColor: cardBgColor, borderColor }]}>
                    {availableUnits.map((unit) => (
                      <TouchableOpacity
                        key={unit.id}
                        style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                        onPress={() => handleUnitChange(unit.id)}
                      >
                        <View style={styles.dropdownItemContent}>
                          <View>
                            <ThemedText style={[styles.dropdownItemText, { color: textColor }]}>
                              {unit.name}
                            </ThemedText>
                            {unit.defaultRentPrice && (
                              <ThemedText style={[styles.dropdownItemSubtext, { color: secondaryTextColor }]}>
                                ${unit.defaultRentPrice}/mo
                              </ThemedText>
                            )}
                          </View>
                          {unit.isOccupied ? (
                            <View style={[styles.propertyTypeBadge, { backgroundColor: '#fee2e2' }]}>
                              <ThemedText style={[styles.propertyTypeText, { color: '#991b1b' }]}>
                                Occupied
                              </ThemedText>
                            </View>
                          ) : (
                            <View style={[styles.propertyTypeBadge, { backgroundColor: '#dcfce7' }]}>
                              <ThemedText style={[styles.propertyTypeText, { color: '#166534' }]}>
                                Available
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Sub-unit/Room Selection (for by-room rentals or selected unit with rooms) */}
            {availableSubUnits.length > 0 && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                  Select Room {isByRoomProperty ? '*' : '(Optional)'}
                </ThemedText>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: inputBgColor, borderColor }]}
                  onPress={() => {
                    setShowSubUnitDropdown(!showSubUnitDropdown);
                    setShowPropertyDropdown(false);
                    setShowUnitDropdown(false);
                  }}
                >
                  <ThemedText style={[styles.dropdownText, { color: formData.subUnitId ? textColor : secondaryTextColor }]}>
                    {selectedSubUnit ? selectedSubUnit.name : 'Select a room'}
                  </ThemedText>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
                </TouchableOpacity>
                {showSubUnitDropdown && (
                  <View style={[styles.dropdownList, { backgroundColor: cardBgColor, borderColor }]}>
                    {availableSubUnits.map((subUnit) => (
                      <TouchableOpacity
                        key={subUnit.id}
                        style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                        onPress={() => handleSubUnitChange(subUnit.id)}
                      >
                        <View style={styles.dropdownItemContent}>
                          <View>
                            <ThemedText style={[styles.dropdownItemText, { color: textColor }]}>
                              {subUnit.name}
                            </ThemedText>
                            {subUnit.rentPrice && (
                              <ThemedText style={[styles.dropdownItemSubtext, { color: secondaryTextColor }]}>
                                ${subUnit.rentPrice}/mo
                              </ThemedText>
                            )}
                          </View>
                          {subUnit.tenantName ? (
                            <View style={[styles.propertyTypeBadge, { backgroundColor: '#fee2e2' }]}>
                              <ThemedText style={[styles.propertyTypeText, { color: '#991b1b' }]}>
                                Occupied
                              </ThemedText>
                            </View>
                          ) : (
                            <View style={[styles.propertyTypeBadge, { backgroundColor: '#dcfce7' }]}>
                              <ThemedText style={[styles.propertyTypeText, { color: '#166534' }]}>
                                Available
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: primaryColor }]}
            onPress={handleSubmit}
            disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color={onPrimaryColor} />
            ) : (
              <ThemedText style={[styles.submitButtonText, { color: onPrimaryColor }]}>Send Invite</ThemedText>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 20,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
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
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  dropdownText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
  },
  dropdownSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemText: {
    fontSize: 16,
    marginBottom: 4,
  },
  dropdownItemSubtext: {
    fontSize: 14,
  },
  propertyTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  propertyTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
