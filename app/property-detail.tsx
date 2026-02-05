import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { Property, SubUnit, Unit, usePropertyStore } from '@/store/propertyStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PropertyDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const { user } = useAuthStore();
  const { 
    getPropertyById, 
    updateProperty, 
    deleteProperty,
    addUnit, 
    deleteUnit,
    addRoomToSingleUnit,
    loadFromSupabase,
  } = usePropertyStore();

  const [property, setProperty] = useState<Property | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<SubUnit | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const imageScrollRef = useRef<FlatList>(null);
  
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1A2831' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#0d141b';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const inputBgColor = isDark ? '#1a242d' : '#f9fafb';
  const primaryColor = '#137fec';

  // Load property from Supabase and local store
  const loadProperty = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // If user is logged in, refresh from Supabase first
      if (user?.id) {
        await loadFromSupabase(user.id);
      }
      // Then get from local store (which is now synced)
      const fetchedProperty = getPropertyById(id);
      if (fetchedProperty) {
        setProperty(fetchedProperty);
      }
    } catch (error) {
      console.error('Error loading property:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, user?.id, loadFromSupabase, getPropertyById]);

  useEffect(() => {
    loadProperty();
  }, [loadProperty]);

  const refreshProperty = () => {
    if (id) {
      const updated = getPropertyById(id);
      if (updated) setProperty(updated);
    }
  };

  const handleImageScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    setCurrentImageIndex(index);
  };

  const handleDeleteProperty = () => {
    if (!property) return;
    
    Alert.alert(
      'Delete Property',
      'Are you sure you want to delete this property? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProperty(property.id);
    router.back();
          },
        },
      ]
    );
  };

  const handleUpdateProperty = (updates: Partial<Property>) => {
    if (!property) return;
    updateProperty(property.id, updates);
    // Update local state immediately for instant UI feedback
    setProperty(prev => prev ? { ...prev, ...updates } : null);
    // Also refresh from store to ensure consistency
    refreshProperty();
  };

  const handleAddRoom = () => {
    if (!property) return;
    
    if (property.propertyType === 'single_unit') {
      // For single unit, navigate to add room screen
      router.push(`/add-room?propertyId=${property.id}`);
    } else {
      // For multi-unit, navigate to add unit screen
      router.push(`/add-unit?propertyId=${property.id}`);
    }
  };

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProperty();
    }, [loadProperty])
  );

  const handleRoomPress = (unit: Unit, subUnit: SubUnit) => {
    // Navigate to room detail or edit screen only in edit mode
    if (isEditMode) {
      router.push(`/add-room?propertyId=${property?.id}&unitId=${unit.id}&roomId=${subUnit.id}`);
    }
  };

  const handleUnitPress = (unit: Unit) => {
    // Show unit details in modal
    setSelectedUnit(unit);
    setShowUnitModal(true);
  };

  const handleAddRoomToUnit = (unitId: string) => {
    setShowUnitModal(false);
    router.push(`/add-room?propertyId=${property?.id}&unitId=${unitId}`);
  };

  if (isLoading || !property) {
  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>Property Details</ThemedText>
        <View style={{ width: 24 }} />
      </View>
        <View style={styles.loadingContainer}>
          {isLoading ? (
            <>
              <ActivityIndicator size="large" color={primaryColor} />
              <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
                Loading property...
              </ThemedText>
            </>
          ) : (
          <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
            Property not found
          </ThemedText>
          )}
        </View>
          </ThemedView>
    );
  }

  const propertyImages = property.photos && property.photos.length > 0 
    ? property.photos 
    : [];

  // Get rooms for single unit property
  const rooms = property.propertyType === 'single_unit' && property.units.length > 0
    ? property.units[0].subUnits
    : [];

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>Property Details</ThemedText>
        <View style={styles.headerActions}>
          {!isEditMode && (
            <TouchableOpacity 
              onPress={() => setIsEditMode(true)}
              style={[styles.editButton, { backgroundColor: 'transparent' }]}
            >
              <MaterialCommunityIcons 
                name="pencil" 
                size={20} 
                color={textColor} 
              />
            </TouchableOpacity>
          )}
        <TouchableOpacity onPress={handleDeleteProperty}>
            <MaterialCommunityIcons name="dots-horizontal" size={24} color={textColor} />
        </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: isEditMode ? insets.bottom + 100 : insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Property Name and Location */}
        <View style={styles.titleSection}>
          <ThemedText style={[styles.propertyName, { color: textColor }]}>
            {property.name || `${property.address1}`}
          </ThemedText>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={16} color={secondaryTextColor} />
            <ThemedText style={[styles.locationText, { color: secondaryTextColor }]}>
              {property.city}, {property.state}
            </ThemedText>
          </View>
        </View>

        {/* Image Carousel */}
        {propertyImages.length > 0 && (
          <View style={styles.imageContainer}>
            <FlatList
              ref={imageScrollRef}
              data={propertyImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleImageScroll}
              keyExtractor={(item, index) => `image-${index}`}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.propertyImage} />
              )}
            />
            {/* Image Indicators */}
            {propertyImages.length > 1 && (
              <View style={styles.imageIndicators}>
                {propertyImages.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.indicator,
                      {
                        backgroundColor: index === currentImageIndex ? primaryColor : (isDark ? '#475569' : '#cbd5e1'),
                      },
                    ]}
                  />
                ))}
            </View>
            )}
          </View>
        )}

        {/* Landlord and Address Info */}
        <View style={[styles.infoSection, { borderBottomColor: borderColor }]}>
          {property.landlordName && (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Landlord</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{property.landlordName}</ThemedText>
            </View>
          )}
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Property Address</ThemedText>
            <ThemedText style={[styles.infoValue, { color: textColor }]}>
              {property.address1}
              {property.address2 ? `, ${property.address2}` : ''}, {property.city}, {property.state} {property.zipCode}
            </ThemedText>
          </View>
          </View>

        {/* Rental Setup */}
        <View style={[styles.section, !isEditMode && styles.readOnlySection]}>
          <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Rental Setup</ThemedText>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[styles.radioOption, !isEditMode && styles.disabledOption]}
              onPress={() => isEditMode && handleUpdateProperty({ propertyType: 'single_unit' })}
              disabled={!isEditMode}
            >
              <View style={[
                styles.radioButton,
                { borderColor: property.propertyType === 'single_unit' ? primaryColor : borderColor },
              ]}>
                {property.propertyType === 'single_unit' && (
                  <View style={[styles.radioDot, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <ThemedText style={[styles.radioLabel, { color: textColor }]}>Single Unit</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioOption, !isEditMode && styles.disabledOption]}
              onPress={() => isEditMode && handleUpdateProperty({ propertyType: 'multi_unit' })}
              disabled={!isEditMode}
            >
              <View style={[
                styles.radioButton,
                { borderColor: property.propertyType === 'multi_unit' ? primaryColor : borderColor },
              ]}>
                {property.propertyType === 'multi_unit' && (
                  <View style={[styles.radioDot, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <ThemedText style={[styles.radioLabel, { color: textColor }]}>Multi-Unit</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioOption, !isEditMode && styles.disabledOption]}
              onPress={() => isEditMode && handleUpdateProperty({ propertyType: 'commercial' })}
              disabled={!isEditMode}
            >
              <View style={[
                styles.radioButton,
                { borderColor: property.propertyType === 'commercial' ? primaryColor : borderColor },
              ]}>
                {property.propertyType === 'commercial' && (
                  <View style={[styles.radioDot, { backgroundColor: primaryColor }]} />
                )}
            </View>
              <ThemedText style={[styles.radioLabel, { color: textColor }]}>Commercial</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioOption, !isEditMode && styles.disabledOption]}
              onPress={() => isEditMode && handleUpdateProperty({ propertyType: 'parking' })}
              disabled={!isEditMode}
            >
              <View style={[
                styles.radioButton,
                { borderColor: property.propertyType === 'parking' ? primaryColor : borderColor },
              ]}>
                {property.propertyType === 'parking' && (
                  <View style={[styles.radioDot, { backgroundColor: primaryColor }]} />
                )}
              </View>
              <ThemedText style={[styles.radioLabel, { color: textColor }]}>Parking</ThemedText>
            </TouchableOpacity>
              </View>
            </View>

        {/* Utilities Section */}
        <View style={[styles.section, !isEditMode && styles.readOnlySection]}>
          <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Utilities</ThemedText>
          <ThemedText style={[styles.inputLabel, { color: secondaryTextColor, marginBottom: 12 }]}>
            Who pays for each utility?
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
                    property.utilities?.[utility.key as keyof typeof property.utilities] === 'landlord' && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                    !isEditMode && styles.disabledButton,
                  ]}
                  onPress={() => isEditMode && handleUpdateProperty({
                    utilities: {
                      ...(property.utilities || {
                        electricity: 'landlord',
                        heatGas: 'landlord',
                        water: 'landlord',
                        wifi: 'landlord',
                        rentalEquipments: 'landlord',
                      }),
                      [utility.key]: 'landlord',
                    }
                  })}
                  disabled={!isEditMode}
                >
                  <ThemedText style={[
                    styles.utilityButtonText,
                    { color: property.utilities?.[utility.key as keyof typeof property.utilities] === 'landlord' ? '#fff' : textColor },
                  ]}>
                    Landlord
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.utilityButton,
                    { borderColor, backgroundColor: inputBgColor },
                    property.utilities?.[utility.key as keyof typeof property.utilities] === 'tenant' && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                    !isEditMode && styles.disabledButton,
                  ]}
                  onPress={() => isEditMode && handleUpdateProperty({
                    utilities: {
                      ...(property.utilities || {
                        electricity: 'landlord',
                        heatGas: 'landlord',
                        water: 'landlord',
                        wifi: 'landlord',
                        rentalEquipments: 'landlord',
                      }),
                      [utility.key]: 'tenant',
                    }
                  })}
                  disabled={!isEditMode}
                >
                  <ThemedText style={[
                    styles.utilityButtonText,
                    { color: property.utilities?.[utility.key as keyof typeof property.utilities] === 'tenant' ? '#fff' : textColor },
                  ]}>
                    Tenant
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Manage Rooms/Units */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
              {property.propertyType === 'single_unit' ? 'Manage Rooms' : 'Manage Units'}
            </ThemedText>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: `${primaryColor}20` }]}
              onPress={handleAddRoom}
            >
              <MaterialCommunityIcons name="plus" size={16} color={primaryColor} />
              <ThemedText style={[styles.addButtonText, { color: primaryColor }]}>
                {property.propertyType === 'single_unit' ? 'Add Room' : 'Add Unit'}
          </ThemedText>
            </TouchableOpacity>
        </View>

          {property.propertyType === 'single_unit' ? (
            // Single Unit - Show Rooms
            <View style={styles.roomsList}>
              {rooms.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="door-open" size={48} color={secondaryTextColor} />
                  <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                    No rooms added yet
              </ThemedText>
            </View>
              ) : (
                rooms.map((room) => (
            <TouchableOpacity 
                    key={room.id}
                    style={[styles.roomCard, { backgroundColor: cardBgColor, borderColor }]}
                    onPress={() => {
                      setSelectedRoom(room);
                      setShowRoomModal(true);
                    }}
                  >
                    <View style={styles.roomInfo}>
                      <ThemedText style={[styles.roomName, { color: textColor }]}>
                        Room {room.name}
                      </ThemedText>
                      <ThemedText style={[styles.roomDetails, { color: secondaryTextColor }]}>
                        {room.rentPrice ? `$${room.rentPrice.toLocaleString()}/mo` : 'No rent set'}
                        {room.tenantName && ` • ${room.tenantName}`}
                      </ThemedText>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={secondaryTextColor} />
            </TouchableOpacity>
                ))
              )}
          </View>
          ) : (
            // Multi-Unit - Show Units
            <View style={styles.unitsList}>
          {property.units.length === 0 ? (
                <View style={styles.emptyState}>
              <MaterialCommunityIcons name="home-plus-outline" size={48} color={secondaryTextColor} />
              <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                No units added yet
              </ThemedText>
            </View>
          ) : (
            property.units.map((unit) => (
                  <View
                    key={unit.id}
                    style={[styles.roomCard, { backgroundColor: cardBgColor, borderColor }]}
                  >
                <TouchableOpacity 
                      style={styles.roomInfoContainer}
                      onPress={() => handleUnitPress(unit)}
                    >
                      <View style={styles.roomInfo}>
                        <ThemedText style={[styles.roomName, { color: textColor }]}>
                        {unit.name}
                      </ThemedText>
                        <ThemedText style={[styles.roomDetails, { color: secondaryTextColor }]}>
                          {unit.subUnits.length} room{unit.subUnits.length !== 1 ? 's' : ''}
                          {unit.isOccupied ? ' • Occupied' : ' • Vacant'}
                        </ThemedText>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={24} color={secondaryTextColor} />
                  </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.addRoomButton, { backgroundColor: `${primaryColor}20` }]}
                      onPress={() => handleAddRoomToUnit(unit.id)}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color={primaryColor} />
                      <ThemedText style={[styles.addRoomButtonText, { color: primaryColor }]}>
                        Add Room
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ))
                )}
              </View>
          )}
        </View>

        {/* Lease Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
              Lease Management
            </ThemedText>
          </View>
          
          <View style={[styles.leaseCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.leaseCardContent}>
              <MaterialCommunityIcons name="file-document-outline" size={40} color={primaryColor} />
              <View style={styles.leaseCardText}>
                <ThemedText style={[styles.leaseCardTitle, { color: textColor }]}>
                  {property.propertyType === 'multi_unit' 
                    ? 'Generate leases for each unit' 
                    : 'Generate Ontario Standard Lease'}
                </ThemedText>
                <ThemedText style={[styles.leaseCardDescription, { color: secondaryTextColor }]}>
                  Create or upload lease agreements for your tenants
                </ThemedText>
              </View>
            </View>
            
            <View style={styles.leaseActions}>
              <TouchableOpacity
                style={[styles.leaseActionButton, { backgroundColor: primaryColor }]}
                onPress={() => router.push(`/lease-wizard?propertyId=${property.id}`)}
              >
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <ThemedText style={styles.leaseActionButtonText}>Generate Lease</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.leaseActionButtonOutline, { borderColor: primaryColor }]}
                onPress={() => router.push(`/leases?propertyId=${property.id}`)}
              >
                <MaterialCommunityIcons name="file-search-outline" size={18} color={primaryColor} />
                <ThemedText style={[styles.leaseActionButtonOutlineText, { color: primaryColor }]}>
                  View Leases
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* For multi-unit: show unit-level OR room-level lease actions */}
          {property.propertyType === 'multi_unit' && property.units.length > 0 && (
            <View style={styles.unitLeasesList}>
              <ThemedText style={[styles.unitLeasesTitle, { color: secondaryTextColor }]}>
                Unit Leases
              </ThemedText>
              {property.units.map((unit) => (
                <View key={unit.id}>
                  {/* If unit is rented completely, show lease button at unit level */}
                  {unit.rentEntireUnit ? (
                    <View 
                      style={[styles.unitLeaseRow, { backgroundColor: inputBgColor, borderColor }]}
                    >
                      <View style={styles.unitLeaseInfo}>
                        <ThemedText style={[styles.unitLeaseName, { color: textColor }]}>
                          {unit.name}
                        </ThemedText>
                        <ThemedText style={[styles.unitLeaseStatus, { color: secondaryTextColor }]}>
                          {unit.isOccupied ? 'Occupied' : 'Vacant'} • Entire Unit
                        </ThemedText>
                      </View>
                      <TouchableOpacity
                        style={[styles.unitLeaseButton, { backgroundColor: `${primaryColor}15` }]}
                        onPress={() => router.push(`/lease-wizard?propertyId=${property.id}&unitId=${unit.id}`)}
                      >
                        <MaterialCommunityIcons name="file-document-edit-outline" size={16} color={primaryColor} />
                        <ThemedText style={[styles.unitLeaseButtonText, { color: primaryColor }]}>
                          Lease
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* If unit is rented room-by-room, show lease button for each room */
                    <View style={[styles.unitGroupContainer, { backgroundColor: inputBgColor, borderColor }]}>
                      <View style={styles.unitGroupHeader}>
                        <ThemedText style={[styles.unitGroupName, { color: textColor }]}>
                          {unit.name}
                        </ThemedText>
                        <ThemedText style={[styles.unitGroupInfo, { color: secondaryTextColor }]}>
                          Room-by-room rental • {unit.subUnits?.length || 0} rooms
                        </ThemedText>
                      </View>
                      
                      {unit.subUnits && unit.subUnits.length > 0 ? (
                        <View style={styles.roomLeasesList}>
                          {unit.subUnits.map((room) => (
                            <View 
                              key={room.id}
                              style={[styles.roomLeaseRow, { borderTopColor: borderColor }]}
                            >
                              <View style={styles.roomLeaseInfo}>
                                <ThemedText style={[styles.roomLeaseName, { color: textColor }]}>
                                  Room {room.name}
                                </ThemedText>
                                {room.rentPrice && (
                                  <ThemedText style={[styles.roomLeaseRent, { color: secondaryTextColor }]}>
                                    ${room.rentPrice.toLocaleString()}/mo
                                  </ThemedText>
                                )}
                              </View>
                              <TouchableOpacity
                                style={[styles.roomLeaseButton, { backgroundColor: `${primaryColor}15` }]}
                                onPress={() => router.push(`/lease-wizard?propertyId=${property.id}&unitId=${unit.id}&roomId=${room.id}`)}
                              >
                                <MaterialCommunityIcons name="file-document-edit-outline" size={14} color={primaryColor} />
                                <ThemedText style={[styles.roomLeaseButtonText, { color: primaryColor }]}>
                                  Lease
                                </ThemedText>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.roomLeasesEmpty}>
                          <ThemedText style={[styles.roomLeasesEmptyText, { color: secondaryTextColor }]}>
                            No rooms added yet. Add rooms to generate leases.
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>

      {/* Unit Detail Modal */}
      <Modal
        visible={showUnitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowUnitModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: cardBgColor }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>
                {selectedUnit?.name}
            </ThemedText>
              <TouchableOpacity onPress={() => setShowUnitModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
            
            {selectedUnit && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Unit Photos */}
                {selectedUnit.photos && selectedUnit.photos.length > 0 && (
                  <View style={styles.modalSection}>
                    <ThemedText style={[styles.modalSectionTitle, { color: textColor }]}>Photos</ThemedText>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.modalPhotosScroll}
                    >
                      {selectedUnit.photos.map((photo, index) => (
                        <Image 
                          key={index}
                          source={{ uri: photo }} 
                          style={styles.modalPhoto}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.modalSection}>
                  <ThemedText style={[styles.modalSectionTitle, { color: textColor }]}>Details</ThemedText>
                  <View style={[styles.modalInfoRow, { borderBottomColor: borderColor }]}>
                    <ThemedText style={[styles.modalInfoLabel, { color: secondaryTextColor }]}>Status</ThemedText>
                    <ThemedText style={[styles.modalInfoValue, { color: textColor }]}>
                      {selectedUnit.isOccupied ? 'Occupied' : 'Vacant'}
                    </ThemedText>
                  </View>
                  {selectedUnit.bedrooms && (
                    <View style={[styles.modalInfoRow, { borderBottomColor: borderColor }]}>
                      <ThemedText style={[styles.modalInfoLabel, { color: secondaryTextColor }]}>Bedrooms</ThemedText>
                      <ThemedText style={[styles.modalInfoValue, { color: textColor }]}>
                        {selectedUnit.bedrooms}
                      </ThemedText>
                    </View>
                  )}
                  {selectedUnit.defaultRentPrice && (
                    <View style={[styles.modalInfoRow, { borderBottomColor: borderColor }]}>
                      <ThemedText style={[styles.modalInfoLabel, { color: secondaryTextColor }]}>Default Rent</ThemedText>
                      <ThemedText style={[styles.modalInfoValue, { color: textColor }]}>
                        ${selectedUnit.defaultRentPrice.toLocaleString()}/mo
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.modalSection}>
                  <View style={styles.modalSectionHeader}>
                    <ThemedText style={[styles.modalSectionTitle, { color: textColor }]}>
                      Rooms ({selectedUnit.subUnits.length})
                    </ThemedText>
              <TouchableOpacity 
                      style={[styles.modalAddButton, { backgroundColor: `${primaryColor}20` }]}
                      onPress={() => handleAddRoomToUnit(selectedUnit.id)}
              >
                      <MaterialCommunityIcons name="plus" size={16} color={primaryColor} />
                      <ThemedText style={[styles.modalAddButtonText, { color: primaryColor }]}>
                        Add Room
                      </ThemedText>
              </TouchableOpacity>
                  </View>
                  {selectedUnit.subUnits.length === 0 ? (
                    <View style={styles.modalEmptyState}>
                      <MaterialCommunityIcons name="door-open" size={48} color={secondaryTextColor} />
                      <ThemedText style={[styles.modalEmptyText, { color: secondaryTextColor }]}>
                        No rooms added yet
                      </ThemedText>
                    </View>
                  ) : (
                    selectedUnit.subUnits.map((room) => (
              <TouchableOpacity 
                        key={room.id}
                        style={[styles.modalRoomItem, { backgroundColor: isDark ? '#1a242d' : '#f9fafb', borderColor }]}
                        onPress={() => {
                          setShowUnitModal(false);
                          setSelectedRoom(room);
                          setShowRoomModal(true);
                        }}
                      >
                        <View style={styles.modalRoomInfo}>
                          <ThemedText style={[styles.modalRoomName, { color: textColor }]}>
                            Room {room.name}
                          </ThemedText>
                          {room.rentPrice && (
                            <ThemedText style={[styles.modalRoomRent, { color: secondaryTextColor }]}>
                              ${room.rentPrice.toLocaleString()}/mo
                            </ThemedText>
                          )}
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={secondaryTextColor} />
              </TouchableOpacity>
                    ))
                  )}
            </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Room Detail Modal */}
      <Modal
        visible={showRoomModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRoomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowRoomModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: cardBgColor }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>
                {selectedRoom?.name ? `Room ${selectedRoom.name}` : 'Room Details'}
            </ThemedText>
              <TouchableOpacity onPress={() => setShowRoomModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
            
            {selectedRoom && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Room Photos */}
                {selectedRoom.photos && selectedRoom.photos.length > 0 && (
                  <View style={styles.modalSection}>
                    <ThemedText style={[styles.modalSectionTitle, { color: textColor }]}>Photos</ThemedText>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.modalPhotosScroll}
                    >
                      {selectedRoom.photos.map((photo, index) => (
                        <Image 
                          key={index}
                          source={{ uri: photo }} 
                          style={styles.modalPhoto}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.modalSection}>
                  <ThemedText style={[styles.modalSectionTitle, { color: textColor }]}>Details</ThemedText>
                  
                  <View style={[styles.modalInfoRow, { borderBottomColor: borderColor }]}>
                    <ThemedText style={[styles.modalInfoLabel, { color: secondaryTextColor }]}>Type</ThemedText>
                    <ThemedText style={[styles.modalInfoValue, { color: textColor }]}>
                      {selectedRoom.type ? selectedRoom.type.charAt(0).toUpperCase() + selectedRoom.type.slice(1).replace('_', ' ') : 'Room'}
                    </ThemedText>
                  </View>

                  {selectedRoom.rentPrice && (
                    <View style={[styles.modalInfoRow, { borderBottomColor: borderColor }]}>
                      <ThemedText style={[styles.modalInfoLabel, { color: secondaryTextColor }]}>Rent</ThemedText>
                      <ThemedText style={[styles.modalInfoValue, { color: textColor }]}>
                        ${selectedRoom.rentPrice.toLocaleString()}/mo
                      </ThemedText>
                    </View>
                  )}

                  {selectedRoom.area && (
                    <View style={[styles.modalInfoRow, { borderBottomColor: borderColor }]}>
                      <ThemedText style={[styles.modalInfoLabel, { color: secondaryTextColor }]}>Area</ThemedText>
                      <ThemedText style={[styles.modalInfoValue, { color: textColor }]}>
                        {selectedRoom.area} sq ft
                      </ThemedText>
                    </View>
                  )}

                  {selectedRoom.tenantName && (
                    <View style={[styles.modalInfoRow, { borderBottomColor: borderColor }]}>
                      <ThemedText style={[styles.modalInfoLabel, { color: secondaryTextColor }]}>Tenant</ThemedText>
                      <ThemedText style={[styles.modalInfoValue, { color: textColor }]}>
                        {selectedRoom.tenantName}
                      </ThemedText>
                    </View>
                  )}

                  {selectedRoom.availabilityDate && (
                    <View style={[styles.modalInfoRow, { borderBottomColor: borderColor }]}>
                      <ThemedText style={[styles.modalInfoLabel, { color: secondaryTextColor }]}>Available From</ThemedText>
                      <ThemedText style={[styles.modalInfoValue, { color: textColor }]}>
                        {new Date(selectedRoom.availabilityDate).toLocaleDateString()}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {/* Amenities */}
                {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                  <View style={styles.modalSection}>
                    <ThemedText style={[styles.modalSectionTitle, { color: textColor }]}>Amenities</ThemedText>
                    <View style={styles.modalAmenitiesGrid}>
                      {selectedRoom.amenities.map((amenity, index) => (
                        <View 
                          key={index} 
                          style={[styles.modalAmenityTag, { backgroundColor: `${primaryColor}15` }]}
                        >
                          <MaterialCommunityIcons name="check-circle" size={14} color={primaryColor} />
                          <ThemedText style={[styles.modalAmenityText, { color: textColor }]}>
                            {amenity}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Shared Spaces */}
                {selectedRoom.sharedSpaces && selectedRoom.sharedSpaces.length > 0 && (
                  <View style={styles.modalSection}>
                    <ThemedText style={[styles.modalSectionTitle, { color: textColor }]}>Shared Spaces</ThemedText>
                    <View style={styles.modalAmenitiesGrid}>
                      {selectedRoom.sharedSpaces.map((space, index) => (
                        <View 
                          key={index} 
                          style={[styles.modalAmenityTag, { backgroundColor: `${secondaryTextColor}15` }]}
                        >
                          <MaterialCommunityIcons name="home-group" size={14} color={secondaryTextColor} />
                          <ThemedText style={[styles.modalAmenityText, { color: textColor }]}>
                            {space}
                  </ThemedText>
                        </View>
              ))}
            </View>
                  </View>
                )}
            
                {/* Action Buttons */}
                <View style={styles.modalActionButtons}>
          <TouchableOpacity
                    style={[styles.modalLeaseButton, { backgroundColor: '#10b981' }]}
                    onPress={() => { 
                      setShowRoomModal(false);
                      // Navigate to lease wizard with room context
                      if (property && property.units.length > 0) {
                        router.push(`/lease-wizard?propertyId=${property.id}&unitId=${property.units[0].id}&roomId=${selectedRoom.id}${selectedRoom.tenantName ? `&tenantName=${encodeURIComponent(selectedRoom.tenantName)}` : ''}`);
                      } else {
                        router.push(`/lease-wizard?propertyId=${property?.id}${selectedRoom.tenantName ? `&tenantName=${encodeURIComponent(selectedRoom.tenantName)}` : ''}`);
                      }
                    }}
                  >
                    <MaterialCommunityIcons name="file-document-edit-outline" size={18} color="#fff" />
                    <ThemedText style={styles.modalButtonText}>Generate Lease</ThemedText>
          </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalEditButton, { backgroundColor: primaryColor }]}
                    onPress={() => { 
                      setShowRoomModal(false);
                      if (property && property.units.length > 0) {
                        router.push(`/add-room?propertyId=${property.id}&unitId=${property.units[0].id}&roomId=${selectedRoom.id}`);
                      }
                    }}
                  >
                    <MaterialCommunityIcons name="pencil" size={18} color="#fff" />
                    <ThemedText style={styles.modalButtonText}>Edit Room</ThemedText>
                  </TouchableOpacity>
                </View>
      </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Save Button Footer - Only shows in edit mode */}
      {isEditMode && (
        <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: bgColor, paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}
            onPress={() => {
              setIsEditMode(false);
              // Reload to discard unsaved changes
              loadProperty();
                }}
              >
                <ThemedText style={[styles.cancelButtonText, { color: textColor }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: primaryColor, opacity: isSaving ? 0.7 : 1 }]}
            onPress={async () => {
              setIsSaving(true);
              try {
                // Changes are already saved via handleUpdateProperty
                // Just reload from API to confirm sync
                await loadProperty();
                setIsEditMode(false);
              } catch (error) {
                console.error('Error saving changes:', error);
                Alert.alert('Error', 'Failed to save changes. Please try again.');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
            )}
              </TouchableOpacity>
            </View>
      )}
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  titleSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  propertyName: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 16,
  },
  imageContainer: {
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  propertyImage: {
    width: SCREEN_WIDTH - 32,
    height: (SCREEN_WIDTH - 32) * 0.5625, // 16:9 aspect ratio
    backgroundColor: '#e5e7eb',
  },
  imageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  infoSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingVertical: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  propertyTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  roomsList: {
    gap: 8,
  },
  unitsList: {
    gap: 8,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  roomInfo: {
    flex: 1,
    gap: 4,
  },
  roomName: {
    fontSize: 14,
    fontWeight: '700',
  },
  roomDetails: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  utilitiesExclusionContainer: {
    marginTop: 12,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  textInput: {
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  addRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  addRoomButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalScroll: {
    paddingHorizontal: 16,
  },
  modalSection: {
    paddingVertical: 16,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalAddButton: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  modalAddButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalInfoLabel: {
    fontSize: 14,
  },
  modalInfoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  modalEmptyText: {
    fontSize: 14,
  },
  modalRoomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalRoomInfo: {
    flex: 1,
  },
  modalRoomName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalRoomRent: {
    fontSize: 12,
  },
  modalPhotosScroll: {
    marginTop: 8,
  },
  modalPhoto: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  modalAmenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  modalAmenityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  modalAmenityText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  modalLeaseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  modalEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalEditButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  // Edit mode styles
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  saveButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  readOnlySection: {
    opacity: 0.8,
  },
  disabledOption: {
    opacity: 0.6,
  },
  disabledButton: {
    opacity: 0.6,
  },
  // Lease section styles
  leaseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  leaseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leaseCardText: {
    flex: 1,
    gap: 4,
  },
  leaseCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  leaseCardDescription: {
    fontSize: 13,
  },
  leaseActions: {
    flexDirection: 'row',
    gap: 12,
  },
  leaseActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  leaseActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  leaseActionButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  leaseActionButtonOutlineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  unitLeasesList: {
    marginTop: 16,
    gap: 8,
  },
  unitLeasesTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  unitLeaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  unitLeaseInfo: {
    flex: 1,
    gap: 2,
  },
  unitLeaseName: {
    fontSize: 14,
    fontWeight: '600',
  },
  unitLeaseStatus: {
    fontSize: 12,
  },
  unitLeaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  unitLeaseButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Room-by-room lease styles
  unitGroupContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  unitGroupHeader: {
    padding: 12,
    gap: 4,
  },
  unitGroupName: {
    fontSize: 14,
    fontWeight: '600',
  },
  unitGroupInfo: {
    fontSize: 12,
  },
  roomLeasesList: {
    gap: 0,
  },
  roomLeaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingLeft: 20,
    borderTopWidth: 1,
  },
  roomLeaseInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roomLeaseName: {
    fontSize: 13,
    fontWeight: '500',
  },
  roomLeaseRent: {
    fontSize: 12,
  },
  roomLeaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  roomLeaseButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  roomLeasesEmpty: {
    padding: 16,
    paddingLeft: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  roomLeasesEmptyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
