import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePropertyStore } from '@/store/propertyStore';
import { useAuthStore } from '@/store/authStore';

export default function AddUnitScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  
  const { addUnit, getPropertyById, loadFromSupabase } = usePropertyStore();
  const { user } = useAuthStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#0d141b';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const inputBgColor = isDark ? '#1a242d' : '#f9fafb';
  const primaryColor = '#137fec';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bedrooms: '',
    bathrooms: '',
    area: '',
    rentEntireUnit: false,
    defaultRentPrice: '',
    availabilityDate: '',
    leaseStartDate: '',
    leaseEndDate: '',
    photos: [] as string[],
    amenities: {
      inUnitLaundry: false,
      balcony: false,
      dishwasher: false,
      parkingIncluded: false,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState<'availability' | 'leaseStart' | 'leaseEnd' | null>(null);

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const handleDateChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(null);
    if (!date || !showDatePicker) return;
    const iso = date.toISOString().split('T')[0];
    if (showDatePicker === 'availability') setFormData(prev => ({ ...prev, availabilityDate: iso }));
    else if (showDatePicker === 'leaseStart') setFormData(prev => ({ ...prev, leaseStartDate: iso }));
    else if (showDatePicker === 'leaseEnd') setFormData(prev => ({ ...prev, leaseEndDate: iso }));
  };

  const getDateValue = (iso: string) => iso ? new Date(iso) : new Date();

  const pickImage = async () => {
    try {
      const { status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
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

  const toggleAmenity = (amenity: keyof typeof formData.amenities) => {
    setFormData(prev => ({
      ...prev,
      amenities: {
        ...prev.amenities,
        [amenity]: !prev.amenities[amenity],
      },
    }));
  };

  const handleSubmit = async () => {
    if (!propertyId) {
      Alert.alert('Error', 'Property ID is missing');
      return;
    }

    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter unit name');
      return;
    }

    if (formData.rentEntireUnit && !formData.defaultRentPrice) {
      Alert.alert('Error', 'Please enter default rent price');
      return;
    }

    setIsSubmitting(true);

    try {
      await addUnit(propertyId, {
        name: formData.name,
        description: formData.description || undefined,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) : undefined,
        area: formData.area ? parseFloat(formData.area) : undefined,
        rentEntireUnit: formData.rentEntireUnit,
        defaultRentPrice: formData.rentEntireUnit && formData.defaultRentPrice
          ? parseFloat(formData.defaultRentPrice)
          : undefined,
        availabilityDate: formData.availabilityDate || undefined,
        leaseStartDate: formData.leaseStartDate || undefined,
        leaseEndDate: formData.leaseEndDate || undefined,
        photos: formData.photos.length > 0 ? formData.photos : undefined,
        amenities: formData.amenities,
      });

      // Reload property data from Supabase to refresh UI
      if (user?.id) {
        await loadFromSupabase(user.id);
      }

      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to add unit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>Add Unit</ThemedText>
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
        >
          {/* Unit Name */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Unit Information</ThemedText>
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Unit Name <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="e.g., Unit 101"
                placeholderTextColor={secondaryTextColor}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                Description (Optional)
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Enter unit description..."
                placeholderTextColor={secondaryTextColor}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Bedrooms and Bathrooms */}
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                  Bedrooms (Optional)
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="0"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.bedrooms}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, bedrooms: text }))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                  Bathrooms (Optional)
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="0"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.bathrooms}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, bathrooms: text }))}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Area */}
          <View style={styles.section}>
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                Area (sq ft) - Optional
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="0"
                placeholderTextColor={secondaryTextColor}
                value={formData.area}
                onChangeText={(text) => setFormData(prev => ({ ...prev, area: text }))}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Rent Entire Unit Toggle */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setFormData(prev => ({
                ...prev,
                rentEntireUnit: !prev.rentEntireUnit,
                defaultRentPrice: !prev.rentEntireUnit ? prev.defaultRentPrice : '',
              }))}
            >
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.label, { color: textColor }]}>
                  Will you be renting the entire unit?
                </ThemedText>
                <ThemedText style={[styles.helperText, { color: secondaryTextColor }]}>
                  Enable this if you want to rent the unit as a whole
                </ThemedText>
              </View>
              <View style={[
                styles.toggle,
                { backgroundColor: formData.rentEntireUnit ? primaryColor : borderColor },
              ]}>
                <View style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: formData.rentEntireUnit ? 20 : 0 }] },
                ]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Default Rent Price (Only if toggle is ON) */}
          {formData.rentEntireUnit && (
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>
                  Default Rent Price <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
                </ThemedText>
                <View style={styles.currencyInputContainer}>
                  <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                  <TextInput
                    style={[styles.currencyInput, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="0.00"
                    placeholderTextColor={secondaryTextColor}
                    value={formData.defaultRentPrice}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, defaultRentPrice: text }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Dates */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Dates</ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                Availability Date (Optional)
              </ThemedText>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: inputBgColor, borderColor }]}
                onPress={() => setShowDatePicker('availability')}>
                <MaterialCommunityIcons name="calendar" size={20} color={primaryColor} />
                <ThemedText style={[styles.dateButtonText, { color: formData.availabilityDate ? textColor : secondaryTextColor }]}>
                  {formData.availabilityDate ? formatDate(formData.availabilityDate) : 'Select date'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                  Lease Start (Optional)
                </ThemedText>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: inputBgColor, borderColor }]}
                  onPress={() => setShowDatePicker('leaseStart')}>
                  <MaterialCommunityIcons name="calendar-start" size={20} color={primaryColor} />
                  <ThemedText style={[styles.dateButtonText, { color: formData.leaseStartDate ? textColor : secondaryTextColor }]}>
                    {formData.leaseStartDate ? formatDate(formData.leaseStartDate) : 'Select'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                  Lease End (Optional)
                </ThemedText>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: inputBgColor, borderColor }]}
                  onPress={() => setShowDatePicker('leaseEnd')}>
                  <MaterialCommunityIcons name="calendar-end" size={20} color={primaryColor} />
                  <ThemedText style={[styles.dateButtonText, { color: formData.leaseEndDate ? textColor : secondaryTextColor }]}>
                    {formData.leaseEndDate ? formatDate(formData.leaseEndDate) : 'Select'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={getDateValue(
                  showDatePicker === 'availability' ? formData.availabilityDate :
                  showDatePicker === 'leaseStart' ? formData.leaseStartDate :
                  formData.leaseEndDate
                )}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                onTouchCancel={() => setShowDatePicker(null)}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.dateConfirm, { backgroundColor: primaryColor }]}
                onPress={() => setShowDatePicker(null)}>
                <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Done</ThemedText>
              </TouchableOpacity>
            )}
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
                onPress={pickImage}
              >
                <MaterialCommunityIcons name="camera-plus" size={32} color={primaryColor} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Unit Specific Amenities */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
              Unit Specific Amenities
            </ThemedText>
            
            {[
              { key: 'inUnitLaundry', label: 'In-Unit Laundry', icon: 'washing-machine' },
              { key: 'balcony', label: 'Balcony', icon: 'balcony' },
              { key: 'dishwasher', label: 'Dishwasher', icon: 'dishwasher' },
              { key: 'parkingIncluded', label: 'Parking Included', icon: 'car' },
            ].map((amenity) => (
              <TouchableOpacity
                key={amenity.key}
                style={styles.checkboxRow}
                onPress={() => toggleAmenity(amenity.key as keyof typeof formData.amenities)}
              >
                <View style={[styles.checkbox, { borderColor }]}>
                  {formData.amenities[amenity.key as keyof typeof formData.amenities] && (
                    <MaterialCommunityIcons name="check" size={18} color={primaryColor} />
                  )}
                </View>
                <MaterialCommunityIcons name={amenity.icon as any} size={20} color={secondaryTextColor} />
                <ThemedText style={[styles.checkboxLabel, { color: textColor }]}>
                  {amenity.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: bgColor, borderTopColor: borderColor }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: primaryColor }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <ThemedText style={styles.submitButtonText}>
            {isSubmitting ? 'Submitting...' : 'Add Unit'}
          </ThemedText>
        </TouchableOpacity>
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
  helperText: {
    fontSize: 12,
    marginTop: 4,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  currencyInputContainer: {
    position: 'relative',
  },
  currencySymbol: {
    position: 'absolute',
    left: 16,
    top: 14,
    fontSize: 16,
    fontWeight: '600',
    zIndex: 1,
  },
  currencyInput: {
    height: 48,
    paddingLeft: 36,
    paddingRight: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
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
  dateButton: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButtonText: { fontSize: 15, flex: 1 },
  dateConfirm: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
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
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
