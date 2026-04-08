import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddressAutocomplete from '@/components/AddressAutocomplete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { uploadMultipleImages, STORAGE_BUCKETS } from '@/lib/supabase';
import { StructuredAddress, EMPTY_ADDRESS } from '@/services/location-service';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore } from '@/store/propertyStore';

export default function AddPropertyScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addProperty } = usePropertyStore();
  const { user } = useAuthStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';
  const inputBgColor = isDark ? '#1f2937' : '#ffffff';

  // Toggle for manual address entry mode
  const [manualAddressMode, setManualAddressMode] = useState(false);

  // Structured address from autocomplete OR manual entry
  const [structuredAddress, setStructuredAddress] = useState<StructuredAddress>(EMPTY_ADDRESS);

  // Manual address fields (when API fails or user prefers manual)
  const [manualAddress, setManualAddress] = useState({
    streetNumber: '',
    streetName: '',
    unit: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Canada',
  });

  const [formData, setFormData] = useState({
    // Address Line 2 (unit/apt) - optional, can be filled manually
    address2: '',
    
    // Property details
    propertyType: 'single_unit' as 'single_unit' | 'multi_unit' | 'commercial' | 'parking',
    landlordName: user?.role === 'landlord' ? (user?.name || '') : '',
    
    // Rental options (conditional)
    rentCompleteProperty: false,
    description: '',
    photos: [] as string[],
    
    // Parking and rent (conditional)
    parkingIncluded: false,
    rentAmount: '',
    
    // Utilities
    utilities: {
      electricity: 'landlord' as 'landlord' | 'tenant',
      heatGas: 'landlord' as 'landlord' | 'tenant',
      water: 'landlord' as 'landlord' | 'tenant',
      wifi: 'landlord' as 'landlord' | 'tenant',
      rentalEquipments: 'landlord' as 'landlord' | 'tenant',
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle address selection from autocomplete
  const handleAddressSelect = (address: StructuredAddress) => {
    setStructuredAddress(address);
    // Sync to manual fields too (for editing)
    setManualAddress({
      streetNumber: address.streetNumber || '',
      streetName: address.streetName || '',
      unit: address.unit || '',
      city: address.city || '',
      province: address.province || '',
      postalCode: address.postalCode || '',
      country: address.country || 'Canada',
    });
    // Auto-fill unit if detected
    if (address.unit) {
      setFormData(prev => ({ ...prev, address2: `Unit ${address.unit}` }));
    }
  };

  // Handle manual address field changes
  const handleManualAddressChange = (field: keyof typeof manualAddress, value: string) => {
    setManualAddress(prev => ({ ...prev, [field]: value }));
    // Sync to structured address
    const updated = { ...manualAddress, [field]: value };
    setStructuredAddress({
      streetNumber: updated.streetNumber,
      streetName: updated.streetName,
      unit: updated.unit,
      city: updated.city,
      province: updated.province,
      postalCode: updated.postalCode,
      country: updated.country,
      formattedAddress: `${updated.streetNumber} ${updated.streetName}, ${updated.city}, ${updated.province} ${updated.postalCode}`.trim(),
      latitude: structuredAddress.latitude,
      longitude: structuredAddress.longitude,
    });
  };

  // Toggle between autocomplete and manual mode
  const toggleAddressMode = () => {
    setManualAddressMode(!manualAddressMode);
  };

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newPhotos = result.assets.map(asset => asset.uri);
        setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    // Get address from either autocomplete or manual entry
    const streetNum = structuredAddress.streetNumber || manualAddress.streetNumber;
    const streetName = structuredAddress.streetName || manualAddress.streetName;
    const city = structuredAddress.city || manualAddress.city;
    const province = structuredAddress.province || manualAddress.province;
    const postalCode = structuredAddress.postalCode || manualAddress.postalCode;
    const country = structuredAddress.country || manualAddress.country || 'Canada';

    // Validation - check address fields
    if (!streetNum || !streetName) {
      Alert.alert('Error', 'Please enter the street number and street name');
      return;
    }
    if (!city || !province || !postalCode) {
      Alert.alert('Error', 'Please enter the city, province/state, and postal code');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upload images to Supabase Storage if any
      let uploadedPhotoUrls: string[] = [];
      if (formData.photos.length > 0 && user?.id) {
        // Filter out already-uploaded URLs (they start with http)
        const localPhotos = formData.photos.filter(uri => !uri.startsWith('http'));
        const existingUrls = formData.photos.filter(uri => uri.startsWith('http'));
        
        if (localPhotos.length > 0) {
          const folder = `properties/${user.id}`;
          uploadedPhotoUrls = await uploadMultipleImages(
            localPhotos, 
            STORAGE_BUCKETS.PROPERTY_IMAGES, 
            folder
          );
        }
        
        // Combine existing URLs with newly uploaded ones
        uploadedPhotoUrls = [...existingUrls, ...uploadedPhotoUrls];
      }

      // Build the full address (streetNumber + streetName)
      const fullStreetAddress = `${streetNum} ${streetName}`.trim();
      const unitValue = manualAddressMode 
        ? manualAddress.unit 
        : (formData.address2 || structuredAddress.unit);

      // Pass the user ID to save to Supabase
      await addProperty({
        // Use structured address fields (from autocomplete or manual)
        address1: fullStreetAddress,
        address2: unitValue || undefined,
        city: city,
        state: province,
        zipCode: postalCode,
        country: country,
        
        // Store latitude/longitude if available
        // Note: These would need to be added to the Property type
        
        // Property details - NO name/location field
        propertyType: formData.propertyType,
        landlordName: formData.landlordName || undefined,
        rentCompleteProperty: formData.propertyType !== 'multi_unit' ? formData.rentCompleteProperty : undefined,
        description: formData.description || undefined,
        photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : undefined,
        parkingIncluded: formData.propertyType !== 'multi_unit' ? formData.parkingIncluded : undefined,
        rentAmount: formData.propertyType !== 'multi_unit' && formData.rentAmount 
          ? parseFloat(formData.rentAmount) 
          : undefined,
        utilities: formData.utilities,
      }, user?.id);
      
      router.back();
    } catch (error) {
      console.error('Error adding property:', error);
      Alert.alert('Error', 'Failed to add property. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMultiUnit = formData.propertyType === 'multi_unit';

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>Add Property</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Property Address Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Property Address
              </ThemedText>
              <TouchableOpacity 
                style={[styles.toggleModeButton, { borderColor: primaryColor }]}
                onPress={toggleAddressMode}
              >
                <MaterialCommunityIcons 
                  name={manualAddressMode ? "map-search" : "pencil"} 
                  size={16} 
                  color={primaryColor} 
                />
                <ThemedText style={[styles.toggleModeText, { color: primaryColor }]}>
                  {manualAddressMode ? "Use Autocomplete" : "Enter Manually"}
                </ThemedText>
              </TouchableOpacity>
            </View>
            
            {!manualAddressMode ? (
              <>
                {/* Google Maps Address Autocomplete */}
                <AddressAutocomplete
                  onAddressSelect={handleAddressSelect}
                  initialAddress={structuredAddress.formattedAddress ? structuredAddress : undefined}
                  placeholder="Start typing address..."
                  label="Street Address"
                  required
                  showUseMyLocation
                />

                {/* Hint for manual mode */}
                <TouchableOpacity 
                  style={styles.manualHint}
                  onPress={toggleAddressMode}
                >
                  <MaterialCommunityIcons name="information-outline" size={14} color={secondaryTextColor} />
                  <ThemedText style={[styles.manualHintText, { color: secondaryTextColor }]}>
                    Can't find your address? Switch to manual entry
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Manual Address Entry Fields */}
                <View style={styles.addressGrid}>
                  {/* Street Number */}
                  <View style={styles.halfInput}>
                    <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                      Street Number <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="123"
                      placeholderTextColor={secondaryTextColor}
                      value={manualAddress.streetNumber}
                      onChangeText={(text) => handleManualAddressChange('streetNumber', text)}
                      keyboardType="number-pad"
                    />
                  </View>

                  {/* Street Name */}
                  <View style={styles.halfInput}>
                    <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                      Street Name <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="Main Street"
                      placeholderTextColor={secondaryTextColor}
                      value={manualAddress.streetName}
                      onChangeText={(text) => handleManualAddressChange('streetName', text)}
                    />
                  </View>
                </View>

                {/* Unit (Optional) */}
                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                    Unit / Apt / Suite (Optional)
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="e.g., Apt 4B, Suite 200"
                    placeholderTextColor={secondaryTextColor}
                    value={manualAddress.unit}
                    onChangeText={(text) => handleManualAddressChange('unit', text)}
                  />
                </View>

                {/* City */}
                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                    City <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="Toronto"
                    placeholderTextColor={secondaryTextColor}
                    value={manualAddress.city}
                    onChangeText={(text) => handleManualAddressChange('city', text)}
                  />
                </View>

                {/* Province and Postal Code */}
                <View style={styles.addressGrid}>
                  <View style={styles.halfInput}>
                    <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                      Province / State <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="ON"
                      placeholderTextColor={secondaryTextColor}
                      value={manualAddress.province}
                      onChangeText={(text) => handleManualAddressChange('province', text)}
                      autoCapitalize="characters"
                    />
                  </View>

                  <View style={styles.halfInput}>
                    <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                      Postal Code <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                      placeholder="M5V 2T6"
                      placeholderTextColor={secondaryTextColor}
                      value={manualAddress.postalCode}
                      onChangeText={(text) => handleManualAddressChange('postalCode', text)}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {/* Country */}
                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                    Country
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="Canada"
                    placeholderTextColor={secondaryTextColor}
                    value={manualAddress.country}
                    onChangeText={(text) => handleManualAddressChange('country', text)}
                  />
                </View>
              </>
            )}

            {/* Address Line 2 (Optional) - Only show if not in manual mode (manual mode has unit field) */}
            {!manualAddressMode && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                  Apartment, Suite, Unit, etc. (Optional)
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="e.g., Apt 4B, Suite 200"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.address2}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, address2: text }))}
                />
              </View>
            )}

            {/* Display parsed address fields (read-only feedback) */}
            {(structuredAddress.city || manualAddress.city) && (
              <View style={[styles.addressPreview, { backgroundColor: isDark ? '#1a242d' : '#f0f9ff', borderColor: primaryColor }]}>
                <MaterialCommunityIcons name="check-circle" size={18} color={primaryColor} />
                <View style={styles.addressPreviewContent}>
                  <ThemedText style={[styles.addressPreviewLabel, { color: secondaryTextColor }]}>
                    Address Summary:
                  </ThemedText>
                  <ThemedText style={[styles.addressPreviewText, { color: textColor }]}>
                    {structuredAddress.formattedAddress || 
                      `${manualAddress.streetNumber} ${manualAddress.streetName}, ${manualAddress.city}, ${manualAddress.province} ${manualAddress.postalCode}`.trim()}
                  </ThemedText>
                  <View style={styles.addressDetails}>
                    <ThemedText style={[styles.addressDetailText, { color: secondaryTextColor }]}>
                      City: {structuredAddress.city || manualAddress.city}
                    </ThemedText>
                    <ThemedText style={[styles.addressDetailText, { color: secondaryTextColor }]}>
                      Province: {structuredAddress.province || manualAddress.province}
                    </ThemedText>
                    <ThemedText style={[styles.addressDetailText, { color: secondaryTextColor }]}>
                      Postal: {structuredAddress.postalCode || manualAddress.postalCode}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Rental Setup - 4 Radio Buttons */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Rental Setup</ThemedText>
            <View style={styles.radioGrid}>
              {[
                { value: 'single_unit', label: 'Single Unit' },
                { value: 'multi_unit', label: 'Multi-Unit' },
                { value: 'commercial', label: 'Commercial' },
                { value: 'parking', label: 'Parking' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.radioButton,
                    { borderColor, backgroundColor: inputBgColor },
                    formData.propertyType === option.value && {
                      borderColor: primaryColor,
                      backgroundColor: `${primaryColor}10`,
                    },
                  ]}
                  onPress={() => setFormData(prev => ({ 
                    ...prev, 
                    propertyType: option.value as any 
                  }))}
                >
                  <View style={[
                    styles.radioCircle,
                    { borderColor: formData.propertyType === option.value ? primaryColor : borderColor },
                  ]}>
                    {formData.propertyType === option.value && (
                      <View style={[styles.radioCircleInner, { backgroundColor: primaryColor }]} />
                    )}
                  </View>
                  <ThemedText style={[styles.radioLabel, { color: textColor }]}>
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Landlord Name */}
          <View style={styles.section}>
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                Landlord Name (Optional)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Enter landlord name"
                placeholderTextColor={secondaryTextColor}
                value={formData.landlordName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, landlordName: text }))}
              />
            </View>
          </View>

          {/* Rent Complete Property (Only for non-multi-unit) */}
          {!isMultiUnit && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setFormData(prev => ({
                  ...prev,
                  rentCompleteProperty: !prev.rentCompleteProperty
                }))}
              >
                <View style={[styles.checkbox, { borderColor }]}>
                  {formData.rentCompleteProperty && (
                    <MaterialCommunityIcons name="check" size={18} color={primaryColor} />
                  )}
                </View>
                <ThemedText style={[styles.checkboxLabel, { color: textColor }]}>
                  Do you want to rent the complete property?
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                Description (Optional)
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Enter property description..."
                placeholderTextColor={secondaryTextColor}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              Photos (Optional)
            </ThemedText>
            <View style={styles.photosGrid}>
              {formData.photos.map((photo, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri: photo }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhoto(index)}
                  >
                    <MaterialCommunityIcons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.photoAdd, { borderColor, backgroundColor: inputBgColor }]}
                onPress={pickImages}
              >
                <MaterialCommunityIcons name="camera-plus" size={32} color={primaryColor} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Parking Included (Only for non-multi-unit) */}
          {!isMultiUnit && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setFormData(prev => ({
                  ...prev,
                  parkingIncluded: !prev.parkingIncluded
                }))}
              >
                <View style={[styles.checkbox, { borderColor }]}>
                  {formData.parkingIncluded && (
                    <MaterialCommunityIcons name="check" size={18} color={primaryColor} />
                  )}
                </View>
                <ThemedText style={[styles.checkboxLabel, { color: textColor }]}>
                  Parking Included
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Rent Amount (Only for non-multi-unit) */}
          {!isMultiUnit && formData.rentCompleteProperty === true && (
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                  Rent Amount (Optional)
                </ThemedText>
                <View style={styles.currencyInputContainer}>
                  <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                  <TextInput
                    style={[styles.currencyInput, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="0.00"
                    placeholderTextColor={secondaryTextColor}
                    value={formData.rentAmount}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, rentAmount: text }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Utilities Section */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Utilities</ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: secondaryTextColor }]}>
              Who pays for utilities?
            </ThemedText>
            
            {[
              { key: 'electricity', label: 'Electricity' },
              { key: 'heatGas', label: 'Heat / Gas' },
              { key: 'water', label: 'Water' },
              { key: 'wifi', label: 'Wi-Fi' },
              { key: 'rentalEquipments', label: 'Rental Equipments' },
            ].map((utility) => (
              <View key={utility.key} style={styles.utilityRow}>
                <ThemedText style={[styles.utilityLabel, { color: textColor }]}>
                  {utility.label}
                </ThemedText>
                <View style={styles.utilityButtons}>
                  <TouchableOpacity
                    style={[
                      styles.utilityButton,
                      { borderColor, backgroundColor: inputBgColor },
                      formData.utilities[utility.key as keyof typeof formData.utilities] === 'landlord' && {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                      },
                    ]}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      utilities: {
                        ...prev.utilities,
                        [utility.key]: 'landlord',
                      },
                    }))}
                  >
                    <ThemedText style={[
                      styles.utilityButtonText,
                      { color: formData.utilities[utility.key as keyof typeof formData.utilities] === 'landlord' ? '#fff' : textColor },
                    ]}>
                      Landlord
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.utilityButton,
                      { borderColor, backgroundColor: inputBgColor },
                      formData.utilities[utility.key as keyof typeof formData.utilities] === 'tenant' && {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                      },
                    ]}
                    onPress={() => setFormData(prev => ({
                      ...prev,
                      utilities: {
                        ...prev.utilities,
                        [utility.key]: 'tenant',
                      },
                    }))}
                  >
                    <ThemedText style={[
                      styles.utilityButtonText,
                      { color: formData.utilities[utility.key as keyof typeof formData.utilities] === 'tenant' ? '#fff' : textColor },
                    ]}>
                      Tenant
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: bgColor, borderTopColor: borderColor }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: primaryColor, opacity: isSubmitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color="#fff" />
              <ThemedText style={styles.submitButtonText}>Saving Property...</ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.submitButtonText}>Submit</ThemedText>
          )}
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      <Modal visible={isSubmitting} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: cardBgColor }]}>
            <ActivityIndicator size="large" color={primaryColor} />
            <ThemedText style={[styles.loadingText, { color: textColor }]}>
              Saving property...
            </ThemedText>
            <ThemedText style={[styles.loadingSubtext, { color: secondaryTextColor }]}>
              {formData.photos.length > 0 ? 'Uploading images...' : 'Please wait'}
            </ThemedText>
          </View>
        </View>
      </Modal>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleModeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  manualHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  manualHintText: {
    fontSize: 12,
  },
  addressGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 14,
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
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  addressPreview: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: 'flex-start',
  },
  addressPreviewContent: {
    flex: 1,
  },
  addressPreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  addressPreviewText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  addressDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  addressDetailText: {
    fontSize: 12,
  },
  radioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    minWidth: '48%',
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  photoAdd: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    position: 'absolute',
    left: 16,
    fontSize: 16,
    fontWeight: '600',
    zIndex: 1,
  },
  currencyInput: {
    flex: 1,
    height: 48,
    paddingLeft: 36,
    paddingRight: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  utilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  utilityLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  utilityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  utilityButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  utilityButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 14,
  },
});
