import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePropertyStore } from '@/store/propertyStore';
import { useAuthStore } from '@/store/authStore';

const ROOM_AMENITIES = [
  'Private Bathroom',
  'Furnished',
  'Walk-in Closet',
];

const SHARED_SPACES = [
  'Kitchen',
  'Living Room',
  'Laundry',
];

export default function AddRoomScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId, unitId, roomId } = useLocalSearchParams<{ 
    propertyId: string; 
    unitId?: string; 
    roomId?: string;
  }>();
  
  const { addSubUnit, addRoomToSingleUnit, updateSubUnit, getPropertyById, loadFromSupabase } = usePropertyStore();
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
    area: '',
    rentPrice: '',
    availabilityDate: '',
    photos: [] as string[],
    amenities: [] as string[],
    sharedSpaces: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString();
  };

  useEffect(() => {
    // If roomId is provided, we're editing an existing room
    if (roomId && propertyId && unitId) {
      const property = getPropertyById(propertyId);
      if (property) {
        const unit = property.units.find(u => u.id === unitId);
        if (unit) {
          const room = unit.subUnits.find(su => su.id === roomId);
          if (room) {
            setIsEditing(true);
            setFormData({
              name: room.name,
              description: '',
              area: room.area?.toString() || '',
              rentPrice: room.rentPrice?.toString() || '',
              availabilityDate: room.availabilityDate || '',
              photos: room.photos || [],
              amenities: room.amenities || [],
              sharedSpaces: room.sharedSpaces || [],
            });
          }
        }
      }
    }
  }, [roomId, propertyId, unitId, getPropertyById]);

  const pickImage = async () => {
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
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const toggleSharedSpace = (space: string) => {
    setFormData(prev => ({
      ...prev,
      sharedSpaces: prev.sharedSpaces.includes(space)
        ? prev.sharedSpaces.filter(s => s !== space)
        : [...prev.sharedSpaces, space],
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a room number');
      return;
    }

    if (!propertyId) {
      Alert.alert('Error', 'Property ID is missing');
      return;
    }

    setIsSubmitting(true);

    try {
      const roomData = {
        name: formData.name.trim(),
        type: 'bedroom' as const, // Default to bedroom, can be changed later
        rentPrice: formData.rentPrice ? parseFloat(formData.rentPrice) : undefined,
        area: formData.area ? parseInt(formData.area) : undefined,
        availabilityDate: formData.availabilityDate || undefined,
        photos: formData.photos.length > 0 ? formData.photos : undefined,
        amenities: formData.amenities.length > 0 ? formData.amenities : undefined,
        sharedSpaces: formData.sharedSpaces.length > 0 ? formData.sharedSpaces : undefined,
      };

      if (isEditing && roomId && unitId) {
        // Update existing room
        await updateSubUnit(propertyId, unitId, roomId, roomData);
      } else if (unitId) {
        // Add room to specific unit (multi-unit property)
        await addSubUnit(propertyId, unitId, roomData);
      } else {
        // Add room to single unit property
        await addRoomToSingleUnit(propertyId, roomData);
      }

      // Reload property data from Supabase to refresh UI
      if (user?.id) {
        await loadFromSupabase(user.id);
      }

      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save room. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={primaryColor} />
          <ThemedText style={[styles.backButtonText, { color: primaryColor }]}>Cancel</ThemedText>
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          {isEditing ? 'Edit Room' : 'Add New Room'}
        </ThemedText>
        <TouchableOpacity
          style={[styles.saveHeaderButton, { backgroundColor: primaryColor }]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          <ThemedText style={styles.saveHeaderButtonText}>Save</ThemedText>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Room Number */}
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                Room Number <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="e.g., 1, 2, 3"
                placeholderTextColor={secondaryTextColor}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                keyboardType="default"
              />
              <ThemedText style={[styles.inputHint, { color: secondaryTextColor }]}>
                Use numbers only. Room details can be added in the lease form.
              </ThemedText>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                Description (optional)
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Enter a description for the room..."
                placeholderTextColor={secondaryTextColor}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Area and Rent */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Area (SqFt)</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="e.g., 150"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.area}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, area: text }))}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: secondaryTextColor }]}>Rent Price</ThemedText>
                <View style={styles.currencyInput}>
                  <ThemedText style={[styles.currencySymbol, { color: secondaryTextColor }]}>$</ThemedText>
                  <TextInput
                    style={[styles.input, styles.inputWithCurrency, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder="800"
                    placeholderTextColor={secondaryTextColor}
                    value={formData.rentPrice}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, rentPrice: text }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            {/* Availability Date */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                Availability Date
              </ThemedText>
              <TouchableOpacity
                style={[styles.dateInput, { backgroundColor: inputBgColor, borderColor }]}
                onPress={() => setShowDatePicker(true)}>
                <MaterialCommunityIcons name="calendar" size={20} color={primaryColor} />
                <ThemedText style={[styles.dateButtonText, { color: formData.availabilityDate ? textColor : secondaryTextColor }]}>
                  {formData.availabilityDate ? formatDate(formData.availabilityDate) : 'Select date'}
                </ThemedText>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={formData.availabilityDate ? new Date(formData.availabilityDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (date) setFormData(prev => ({ ...prev, availabilityDate: date.toISOString().split('T')[0] }));
                  }}
                />
              )}
              {showDatePicker && Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.dateConfirm, { backgroundColor: primaryColor }]}
                  onPress={() => setShowDatePicker(false)}>
                  <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Done</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Photos */}
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              Photos (optional)
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
              <View style={styles.photosRow}>
                <TouchableOpacity
                  style={[styles.addPhotoButton, { borderColor }]}
                  onPress={pickImage}
                >
                  <MaterialCommunityIcons name="camera-plus" size={32} color={primaryColor} />
                </TouchableOpacity>
                {formData.photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image source={{ uri: photo }} style={styles.photo} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(index)}
                    >
                      <MaterialCommunityIcons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Room Amenities */}
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              Room-Specific Amenities
            </ThemedText>
            <View style={styles.amenitiesList}>
              {ROOM_AMENITIES.map((amenity) => (
                <TouchableOpacity
                  key={amenity}
                  style={[
                    styles.amenityRow,
                    { borderBottomColor: borderColor },
                  ]}
                  onPress={() => toggleAmenity(amenity)}
                >
                  <ThemedText style={[styles.amenityLabel, { color: textColor }]}>
                    {amenity}
                  </ThemedText>
                  <View style={[
                    styles.checkbox,
                    { borderColor: formData.amenities.includes(amenity) ? primaryColor : borderColor },
                  ]}>
                    {formData.amenities.includes(amenity) && (
                      <MaterialCommunityIcons name="check" size={16} color={primaryColor} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Shared Spaces */}
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              Shared Spaces Access
            </ThemedText>
            <View style={styles.amenitiesList}>
              {SHARED_SPACES.map((space) => (
                <TouchableOpacity
                  key={space}
                  style={[
                    styles.amenityRow,
                    { borderBottomColor: borderColor },
                  ]}
                  onPress={() => toggleSharedSpace(space)}
                >
                  <ThemedText style={[styles.amenityLabel, { color: textColor }]}>
                    {space}
                  </ThemedText>
                  <View style={[
                    styles.checkbox,
                    { borderColor: formData.sharedSpaces.includes(space) ? primaryColor : borderColor },
                  ]}>
                    {formData.sharedSpaces.includes(space) && (
                      <MaterialCommunityIcons name="check" size={16} color={primaryColor} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  saveHeaderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveHeaderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  input: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    position: 'absolute',
    left: 12,
    fontSize: 16,
    zIndex: 1,
  },
  inputWithCurrency: {
    paddingLeft: 28,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
  },
  dateButtonText: { fontSize: 15, flex: 1 },
  dateConfirm: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  photosScroll: {
    marginTop: 8,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenitiesList: {
    marginTop: 8,
  },
  amenityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  amenityLabel: {
    fontSize: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputHint: {
    fontSize: 12,
    marginTop: 4,
  },
});

