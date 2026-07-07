import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Alert,
  AlertButton,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { checkEntityHasTenant, createLease, DbLease, deleteImage, fetchLeasesByProperty, replaceLeaseDocument, STORAGE_BUCKETS, uploadLeaseDocument, uploadMultipleImages } from '@/lib/supabase';
import { useTenantStore } from '@/store/tenantStore';
import { useAuthStore } from '@/store/authStore';
import { Property, SubUnit, Unit, usePropertyStore } from '@/store/propertyStore';
import { fmtDate } from '@/lib/dateUtils';

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
    deleteUnit,
    deleteSubUnit,
    loadFromSupabase,
  } = usePropertyStore();
  const { getTenantsByProperty, loadFromSupabase: loadTenants } = useTenantStore();

  const [property, setProperty] = useState<Property | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<SubUnit | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedRoomUnitId, setSelectedRoomUnitId] = useState<string | undefined>(undefined);
  const [propertyLeases, setPropertyLeases] = useState<DbLease[]>([]);
  const [isUpdatingPhotos, setIsUpdatingPhotos] = useState(false);
  const [isUploadingLease, setIsUploadingLease] = useState(false);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    visible: boolean;
    entityType: 'property' | 'unit' | 'subunit';
    entityId: string;
    entityName: string;
    hasTenant: boolean;
    tenantName: string | null;
    tenantCount: number;
    isLoading: boolean;
  }>({
    visible: false,
    entityType: 'property',
    entityId: '',
    entityName: '',
    hasTenant: false,
    tenantName: null,
    tenantCount: 0,
    isLoading: false,
  });
  const scrollViewRef = useRef<ScrollView>(null);
  const imageScrollRef = useRef<FlatList>(null);
  
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const secondaryTextColor = isDark ? '#9BA1A6' : '#6E7377';
  const inputBgColor = isDark ? '#141517' : '#F7F7F8';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  // Load property from Supabase and local store
  const loadProperty = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      if (user?.id) {
        await Promise.all([loadFromSupabase(user.id), loadTenants(user.id)]);
      }
      const fetchedProperty = getPropertyById(id);
      if (fetchedProperty) {
        setProperty(fetchedProperty);
      }
      // Load leases for this property so the room modal can show "View Lease"
      const leases = await fetchLeasesByProperty(id);
      setPropertyLeases(leases);
    } catch (error) {
      console.error('Error loading property:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, user?.id, loadFromSupabase, loadTenants, getPropertyById]);

  useEffect(() => {
    loadProperty();
  }, [loadProperty]);

  // Keep selectedUnit in sync whenever the property refreshes (e.g. after adding a room)
  useEffect(() => {
    if (selectedUnit && property) {
      const updated = property.units.find(u => u.id === selectedUnit.id);
      if (updated) setSelectedUnit(updated);
    }
  }, [property]);

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

  const openDeleteDialog = async (
    entityType: 'property' | 'unit' | 'subunit',
    entityId: string,
    entityName: string
  ) => {
    const check = await checkEntityHasTenant(entityType, entityId);
    setDeleteDialog({
      visible: true,
      entityType,
      entityId,
      entityName,
      hasTenant: check.hasTenant,
      tenantName: check.tenantName,
      tenantCount: check.tenantCount,
      isLoading: false,
    });
  };

  const handleDeleteProperty = () => {
    if (!property) return;
    openDeleteDialog('property', property.id, property.address1 || 'this property');
  };

  const handleDeleteUnit = (unit: Unit) => {
    openDeleteDialog('unit', unit.id, unit.name);
  };

  const handleDeleteRoom = (room: SubUnit) => {
    openDeleteDialog('subunit', room.id, room.name);
  };

  const handleConfirmDelete = async () => {
    if (!user?.id) return;
    setDeleteDialog((d) => ({ ...d, isLoading: true }));

    let result: { deleted: boolean; error?: string } = { deleted: false };

    if (deleteDialog.entityType === 'property' && property) {
      result = await deleteProperty(property.id, user.id);
    } else if (deleteDialog.entityType === 'unit' && property) {
      result = await deleteUnit(property.id, deleteDialog.entityId, user.id);
    } else if (deleteDialog.entityType === 'subunit' && property) {
      const unitId = property.units.find((u) =>
        u.subUnits.some((su) => su.id === deleteDialog.entityId)
      )?.id ?? '';
      result = await deleteSubUnit(property.id, unitId, deleteDialog.entityId, user.id);
    }

    setDeleteDialog((d) => ({ ...d, isLoading: false, visible: false }));

    if (result.deleted) {
      if (deleteDialog.entityType === 'property') {
        router.back();
      } else {
        setShowUnitModal(false);
        setShowRoomModal(false);
        loadFromSupabase(user.id, true);
      }
    } else {
      Alert.alert('Delete Failed', result.error || 'Something went wrong. Please try again.');
    }
  };

  const handleTenantDetail = () => {
    if (!property) return;
    const tenants = getTenantsByProperty(property.id);
    if (tenants.length === 0) {
      Alert.alert('No Tenant', 'No tenant is currently assigned to this property.');
      return;
    }
    if (tenants.length === 1) {
      router.push(`/tenant-detail?id=${tenants[0].id}` as any);
      return;
    }
    router.push('/tenants' as any);
  };

  const handleUpdateProperty = (updates: Partial<Property>) => {
    if (!property) return;
    updateProperty(property.id, updates);
    // Update local state immediately for instant UI feedback
    setProperty(prev => prev ? { ...prev, ...updates } : null);
    // Also refresh from store to ensure consistency
    refreshProperty();
  };

  const handlePropertyTypeChange = (newType: Property['propertyType']) => {
    if (!isEditMode || !property) return;
    if (newType === property.propertyType) return;
    const hasExistingRooms = property.propertyType === 'single_unit'
      ? (property.units[0]?.subUnits?.length ?? 0) > 0
      : property.units.length > 0;
    if (hasExistingRooms) {
      Alert.alert(
        'Cannot Change Rental Type',
        'This property already has rooms/units created. Please delete all rooms/units first, or delete the entire property and recreate it.',
        [{ text: 'OK' }]
      );
      return;
    }
    handleUpdateProperty({ propertyType: newType });
  };

  const handleRentCompleteToggle = (val: boolean) => {
    if (!isEditMode || !property) return;
    if (val && (property.units[0]?.subUnits?.length ?? 0) > 0) {
      Alert.alert(
        'Cannot Switch to Entire Property',
        'This property already has rooms created. Please delete all rooms first, or delete the property and recreate it.',
        [{ text: 'OK' }]
      );
      return;
    }
    handleUpdateProperty({ rentCompleteProperty: val });
  };

  // Shared helper: pick a PDF, create a new lease record, upload, then navigate
  const doCreateLeaseUpload = async (unitId?: string) => {
    if (!property || !user?.id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setIsUploadingLease(true);
      const today = new Date().toISOString().split('T')[0];
      const draft = await createLease({
        user_id: user.id,
        property_id: property.id,
        ...(unitId ? { unit_id: unitId } : {}),
        status: 'uploaded',
        version: 1,
        effective_date: today,
      });
      if (!draft) {
        Alert.alert('Error', 'Failed to create lease record. Please try again.');
        return;
      }
      const uploadResult = await uploadLeaseDocument(result.assets[0].uri, draft.id, user.id);
      if (!uploadResult.success) {
        Alert.alert('Error', uploadResult.error || 'Failed to upload document.');
        return;
      }
      const leases = await fetchLeasesByProperty(property.id);
      setPropertyLeases(leases);
      router.push(`/lease-detail?id=${draft.id}` as any);
    } catch {
      Alert.alert('Error', 'Failed to upload lease. Please try again.');
    } finally {
      setIsUploadingLease(false);
    }
  };

  // Shared helper: pick a PDF, replace document on an existing lease, then navigate
  const doReplaceLeaseUpload = async (existingLease: DbLease) => {
    if (!property || !user?.id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setIsUploadingLease(true);
      const rep = await replaceLeaseDocument(existingLease, result.assets[0].uri, user.id);
      if (!rep.success) {
        Alert.alert('Error', rep.error || 'Failed to replace lease document.');
        return;
      }
      const leases = await fetchLeasesByProperty(property.id);
      setPropertyLeases(leases);
      router.push(`/lease-detail?id=${existingLease.id}` as any);
    } catch {
      Alert.alert('Error', 'Failed to replace lease. Please try again.');
    } finally {
      setIsUploadingLease(false);
    }
  };

  const handleUploadLeaseFor = (unitId?: string, subUnitId?: string) => {
    if (!property || !user?.id) return;

    // Step 1: Multi-unit — ask which unit first
    if (!unitId && property.propertyType !== 'single_unit' && property.units.length > 0) {
      const unitBtns: AlertButton[] = [
        ...property.units.map(u => ({ text: u.name, onPress: () => handleUploadLeaseFor(u.id) })),
        { text: 'Cancel', style: 'cancel' },
      ];
      Alert.alert('Select Unit', 'Which unit do you want to upload a lease for?', unitBtns);
      return;
    }

    // Step 2: After unit is known, check if it has rooms — applies to both property types
    const targetUnit = unitId
      ? property.units.find(u => u.id === unitId)
      : property.units[0]; // single_unit has exactly one unit
    const rooms = targetUnit?.subUnits ?? [];
    const effectiveUnitId = unitId ?? targetUnit?.id;

    if (!subUnitId && rooms.length > 0) {
      const roomBtns: AlertButton[] = [
        ...rooms.map(r => ({
          text: `Room ${r.name}`,
          onPress: () => handleUploadLeaseFor(effectiveUnitId, r.id),
        })),
        { text: 'Cancel', style: 'cancel' },
      ];
      Alert.alert('Select Room', 'Which room do you want to upload a lease for?', roomBtns);
      return;
    }

    // Step 3: Scope tenants by unit and optionally sub-unit
    const allTenants = getTenantsByProperty(property.id);
    let scopedTenants = effectiveUnitId
      ? allTenants.filter(t => t.unitId === effectiveUnitId)
      : allTenants;
    if (subUnitId) scopedTenants = scopedTenants.filter(t => t.subUnitId === subUnitId);
    const activeTenants = scopedTenants.filter(t => t.status === 'active');

    if (activeTenants.length === 0) {
      Alert.alert(
        'No Active Tenant',
        effectiveUnitId
          ? 'There is no active tenant for this unit. Add a tenant first, then upload the lease.'
          : 'There is no active tenant for this property. Add a tenant first, then upload the lease.',
      );
      return;
    }

    // Step 4: Check for an existing lease for this unit
    const existingLease = propertyLeases.find(l => {
      const unitMatch = effectiveUnitId ? l.unit_id === effectiveUnitId : !l.unit_id;
      return unitMatch && l.status !== 'terminated' && l.status !== 'rejected';
    });

    if (existingLease) {
      const t = activeTenants[0];
      const tenantName = `${t.firstName} ${t.lastName}`.trim();
      Alert.alert(
        'Lease Already Exists',
        `There is already an active lease for ${tenantName}. Do you want to replace it with a new document?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', onPress: () => doReplaceLeaseUpload(existingLease) },
        ],
      );
      return;
    }

    // Step 5: No existing lease — upload new
    doCreateLeaseUpload(effectiveUnitId);
  };

  const handleAddPhotos = async () => {
    if (!property || !user?.id) return;

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

    if (result.canceled || !result.assets?.length) return;

    setIsUpdatingPhotos(true);
    try {
      const folder = `properties/${user.id}`;
      const newUrls = await uploadMultipleImages(
        result.assets.map(asset => asset.uri),
        STORAGE_BUCKETS.PROPERTY_IMAGES,
        folder
      );

      if (newUrls.length === 0) {
        Alert.alert('Error', 'Failed to upload photos. Please try again.');
        return;
      }

      const updatedPhotos = [...(property.photos || []), ...newUrls];
      await updateProperty(property.id, { photos: updatedPhotos });
      setProperty(prev => prev ? { ...prev, photos: updatedPhotos } : null);
      refreshProperty();
    } catch (error) {
      console.error('Error adding property photos:', error);
      Alert.alert('Error', 'Failed to upload photos. Please try again.');
    } finally {
      setIsUpdatingPhotos(false);
    }
  };

  const handleDeletePhoto = (photoUrl: string) => {
    if (!property) return;

    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsUpdatingPhotos(true);
            try {
              if (photoUrl.startsWith('http')) {
                await deleteImage(photoUrl, STORAGE_BUCKETS.PROPERTY_IMAGES);
              }
              const updatedPhotos = (property.photos || []).filter(p => p !== photoUrl);
              await updateProperty(property.id, { photos: updatedPhotos });
              setProperty(prev => prev ? { ...prev, photos: updatedPhotos } : null);
              refreshProperty();
            } catch (error) {
              console.error('Error removing property photo:', error);
              Alert.alert('Error', 'Failed to remove photo. Please try again.');
            } finally {
              setIsUpdatingPhotos(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllPhotos = () => {
    if (!property || !property.photos?.length) return;

    Alert.alert(
      'Remove All Photos',
      'Are you sure you want to remove all photos for this property?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: async () => {
            setIsUpdatingPhotos(true);
            try {
              const photos = property.photos || [];
              await Promise.all(
                photos
                  .filter(p => p.startsWith('http'))
                  .map(p => deleteImage(p, STORAGE_BUCKETS.PROPERTY_IMAGES))
              );
              await updateProperty(property.id, { photos: [] });
              setProperty(prev => prev ? { ...prev, photos: [] } : null);
              setCurrentImageIndex(0);
              refreshProperty();
            } catch (error) {
              console.error('Error removing property photos:', error);
              Alert.alert('Error', 'Failed to remove photos. Please try again.');
            } finally {
              setIsUpdatingPhotos(false);
            }
          },
        },
      ]
    );
  };

  const handleAddRoom = () => {
    if (!property) return;

    if (property.propertyType === 'single_unit') {
      if (property.rentCompleteProperty) {
        Alert.alert(
          'Not Allowed',
          'This property is set to rent as a whole. To add rooms, edit the property and uncheck "Rent complete property".'
        );
        return;
      }
      router.push(`/add-room?propertyId=${property.id}`);
    } else {
      router.push(`/add-unit?propertyId=${property.id}`);
    }
  };

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProperty();
    }, [loadProperty])
  );


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
        <TouchableOpacity onPress={handleDeleteProperty} style={{ marginLeft: 4 }}>
          <MaterialCommunityIcons name="trash-can-outline" size={22} color="#ef4444" />
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

        {/* Quick-action chips */}
        <View style={styles.quickChipsRow}>
          <TouchableOpacity
            style={[styles.quickChip, { backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}40` }]}
            onPress={handleTenantDetail}
          >
            <MaterialCommunityIcons name="account-details" size={14} color={primaryColor} />
            <ThemedText style={[styles.quickChipText, { color: primaryColor }]}>Tenant Detail</ThemedText>
          </TouchableOpacity>

          {(property.propertyType === 'multi_unit' || property.propertyType === 'commercial' || property.propertyType === 'parking') && (
            <TouchableOpacity
              style={[styles.quickChip, { backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}40` }]}
              onPress={() => router.push(`/property-detail?id=${property.id}#units` as any)}
            >
              <MaterialCommunityIcons name="office-building-outline" size={14} color={primaryColor} />
              <ThemedText style={[styles.quickChipText, { color: primaryColor }]}>Units</ThemedText>
            </TouchableOpacity>
          )}

          {property.propertyType === 'single_unit' && !property.rentCompleteProperty && (
            <TouchableOpacity
              style={[styles.quickChip, { backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}40` }]}
              onPress={() => scrollViewRef.current?.scrollTo({ y: 800, animated: true })}
            >
              <MaterialCommunityIcons name="door-open" size={14} color={primaryColor} />
              <ThemedText style={[styles.quickChipText, { color: primaryColor }]}>Rooms</ThemedText>
            </TouchableOpacity>
          )}
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
              keyExtractor={(_item, index) => `image-${index}`}
              renderItem={({ item: photo }) => (
                <Image source={{ uri: photo }} style={styles.propertyImage} />
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
                        backgroundColor: index === currentImageIndex ? primaryColor : (isDark ? '#26282C' : '#E5E5E7'),
                      },
                    ]}
                  />
                ))}
            </View>
            )}
          </View>
        )}

        {/* Manage Photos (edit mode) */}
        {isEditMode && (
          <View style={styles.photoManageSection}>
            <View style={styles.photoManageHeader}>
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Photos</ThemedText>
              {propertyImages.length > 0 && (
                <TouchableOpacity onPress={handleDeleteAllPhotos} disabled={isUpdatingPhotos}>
                  <ThemedText style={[styles.removeAllText, { color: '#ef4444' }]}>Remove All</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoManageRow}
            >
              {propertyImages.map((photo, index) => (
                <View key={`manage-photo-${index}`} style={styles.photoManageThumbWrapper}>
                  <Image source={{ uri: photo }} style={styles.photoManageThumb} />
                  <TouchableOpacity
                    style={styles.photoRemoveBadge}
                    onPress={() => handleDeletePhoto(photo)}
                    disabled={isUpdatingPhotos}
                  >
                    <MaterialCommunityIcons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.photoAddTile, { borderColor, backgroundColor: inputBgColor }]}
                onPress={handleAddPhotos}
                disabled={isUpdatingPhotos}
              >
                {isUpdatingPhotos ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera-plus-outline" size={24} color={primaryColor} />
                    <ThemedText style={[styles.photoAddText, { color: primaryColor }]}>Add Photos</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
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
              onPress={() => handlePropertyTypeChange('single_unit')}
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
              onPress={() => handlePropertyTypeChange('multi_unit')}
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
              onPress={() => handlePropertyTypeChange('commercial')}
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
              onPress={() => handlePropertyTypeChange('parking')}
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

          {/* Rent entire property toggle — only for single-unit */}
          {property.propertyType === 'single_unit' && (
            <View style={styles.rentToggleRow}>
              <View style={styles.rentToggleInfo}>
                <ThemedText style={[styles.inputLabel, { color: textColor }]}>Rent Entire Property</ThemedText>
                <ThemedText style={{ fontSize: 12, color: secondaryTextColor }}>
                  {property.rentCompleteProperty
                    ? 'Renting as a whole unit'
                    : 'Renting room by room'}
                </ThemedText>
              </View>
              <Switch
                value={!!property.rentCompleteProperty}
                onValueChange={handleRentCompleteToggle}
                disabled={!isEditMode}
                trackColor={{ false: borderColor, true: primaryColor }}
                thumbColor="#fff"
              />
            </View>
          )}
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
                    { color: property.utilities?.[utility.key as keyof typeof property.utilities] === 'landlord' ? onPrimaryColor : textColor },
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
                    { color: property.utilities?.[utility.key as keyof typeof property.utilities] === 'tenant' ? onPrimaryColor : textColor },
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
            {/* Hide "Add Room" when the single-unit property is rented as a whole */}
            {!(property.propertyType === 'single_unit' && property.rentCompleteProperty) && (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: `${primaryColor}20` }]}
                onPress={handleAddRoom}
              >
                <MaterialCommunityIcons name="plus" size={16} color={primaryColor} />
                <ThemedText style={[styles.addButtonText, { color: primaryColor }]}>
                  {property.propertyType === 'single_unit' ? 'Add Room' : 'Add Unit'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

          {/* Single unit — rented as a whole: show banner */}
          {property.propertyType === 'single_unit' && property.rentCompleteProperty && (
            <View style={[styles.emptyState, { backgroundColor: isDark ? '#141517' : '#F7F7F8', borderRadius: 12, padding: 16 }]}>
              <MaterialCommunityIcons name="home-outline" size={40} color={secondaryTextColor} />
              <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                Rented as a whole
              </ThemedText>
              <ThemedText style={[styles.emptySubText, { color: secondaryTextColor }]}>
                This property is configured to rent as a complete unit. Rooms cannot be added.
              </ThemedText>
            </View>
          )}

          {/* Single unit — rented by room: show room list */}
          {property.propertyType === 'single_unit' && !property.rentCompleteProperty && (
            <View style={styles.roomsList}>
              {rooms.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="door-open" size={48} color={secondaryTextColor} />
                  <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                    No rooms added yet
                  </ThemedText>
                  <ThemedText style={[styles.emptySubText, { color: secondaryTextColor }]}>
                    Tap "Add Room" above to add individual rooms to this property.
                  </ThemedText>
                </View>
              ) : (
                rooms.map((room) => (
                  <TouchableOpacity
                    key={room.id}
                    style={[styles.roomCard, { backgroundColor: cardBgColor, borderColor }]}
                    onPress={() => {
                      setSelectedRoomUnitId(property.units[0]?.id);
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
          )}

          {/* Multi-unit: show units list */}
          {property.propertyType !== 'single_unit' && (
            // Multi-Unit - Show Units
            <View style={styles.unitsList}>
          {property.units.length === 0 ? (
                <View style={styles.emptyState}>
              <MaterialCommunityIcons name="home-plus-outline" size={48} color={secondaryTextColor} />
              <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                No units added yet
              </ThemedText>
              <ThemedText style={[styles.emptySubText, { color: secondaryTextColor }]}>
                Tap "Add Unit" above to add each unit (e.g. Unit 101, Unit 102) to this property.
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
                          {unit.rentEntireUnit
                            ? `Entire unit${unit.defaultRentPrice ? ` • $${unit.defaultRentPrice.toLocaleString()}/mo` : ''}`
                            : `${unit.subUnits.length} room${unit.subUnits.length !== 1 ? 's' : ''}`}
                          {unit.isOccupied ? ' • Occupied' : ' • Vacant'}
                        </ThemedText>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={24} color={secondaryTextColor} />
                  </TouchableOpacity>
                    {!unit.rentEntireUnit && (
                    <TouchableOpacity
                      style={[styles.addRoomButton, { backgroundColor: `${primaryColor}20` }]}
                      onPress={() => handleAddRoomToUnit(unit.id)}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color={primaryColor} />
                      <ThemedText style={[styles.addRoomButtonText, { color: primaryColor }]}>
                        Add Room
                      </ThemedText>
                    </TouchableOpacity>
                    )}
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
                    ? 'Manage leases for each unit'
                    : 'Manage lease agreements'}
                </ThemedText>
                <ThemedText style={[styles.leaseCardDescription, { color: secondaryTextColor }]}>
                  Upload, generate, or view lease agreements
                </ThemedText>
              </View>
            </View>

            {/* Top row: Upload | Generate */}
            <View style={styles.leaseActions}>
              <TouchableOpacity
                style={[styles.leaseActionButton, { backgroundColor: `${primaryColor}15`, borderWidth: 1, borderColor: primaryColor }]}
                onPress={() => handleUploadLeaseFor()}
                disabled={isUploadingLease}
              >
                <MaterialCommunityIcons name="upload" size={18} color={primaryColor} />
                <ThemedText style={[styles.leaseActionButtonText, { color: primaryColor }]}>
                  {isUploadingLease ? 'Uploading…' : 'Upload Lease'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.leaseActionButton, { backgroundColor: primaryColor }]}
                onPress={() => router.push(`/lease-wizard?propertyId=${property.id}` as any)}
              >
                <MaterialCommunityIcons name="plus" size={18} color={onPrimaryColor} />
                <ThemedText style={[styles.leaseActionButtonText, { color: onPrimaryColor }]}>Generate Lease</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Bottom row: View Leases — full width */}
            <TouchableOpacity
              style={[styles.leaseViewButton, { borderColor: primaryColor }]}
              onPress={() => router.push(`/leases?propertyId=${property.id}` as any)}
            >
              <MaterialCommunityIcons name="file-search-outline" size={18} color={primaryColor} />
              <ThemedText style={[styles.leaseViewButtonText, { color: primaryColor }]}>View Leases</ThemedText>
            </TouchableOpacity>
          </View>
          
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
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowUnitModal(false);
                    router.push(`/add-unit?propertyId=${property.id}&unitId=${selectedUnit?.id}`);
                  }}
                >
                  <MaterialCommunityIcons name="pencil" size={22} color={primaryColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (selectedUnit) {
                      setShowUnitModal(false);
                      handleDeleteUnit(selectedUnit);
                    }
                  }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowUnitModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={textColor} />
                </TouchableOpacity>
              </View>
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

                {/* Rooms — hidden when the unit is rented as a whole */}
                {selectedUnit.rentEntireUnit ? (
                  <View style={[styles.modalSection, { backgroundColor: isDark ? '#141517' : '#F7F7F8', borderRadius: 10, padding: 12 }]}>
                    <MaterialCommunityIcons name="information-outline" size={18} color={secondaryTextColor} />
                    <ThemedText style={[styles.modalEmptyText, { color: secondaryTextColor, marginTop: 4 }]}>
                      This unit is rented as a whole. Rooms cannot be added.
                    </ThemedText>
                  </View>
                ) : (
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
                        style={[styles.modalRoomItem, { backgroundColor: isDark ? '#141517' : '#F7F7F8', borderColor }]}
                        onPress={() => {
                          setShowUnitModal(false);
                          setSelectedRoomUnitId(selectedUnit?.id);
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
                )}
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
                        {fmtDate(selectedRoom.availabilityDate)}
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
                {(() => {
                  const roomLease = selectedRoom.tenantId
                    ? propertyLeases.find(l => l.tenant_id === selectedRoom.tenantId)
                    : null;
                  const unitId = selectedRoomUnitId ?? property?.units[0]?.id;
                  const wizardUrl = unitId
                    ? `/lease-wizard?propertyId=${property?.id}&unitId=${unitId}&roomId=${selectedRoom.id}${selectedRoom.tenantName ? `&tenantName=${encodeURIComponent(selectedRoom.tenantName)}` : ''}`
                    : `/lease-wizard?propertyId=${property?.id}${selectedRoom.tenantName ? `&tenantName=${encodeURIComponent(selectedRoom.tenantName)}` : ''}`;
                  return (
                    <View style={styles.modalActionSection}>
                      {/* Top row: Upload | Generate */}
                      <View style={styles.modalLeaseRow}>
                        <TouchableOpacity
                          style={[styles.modalLeaseHalfButton, { backgroundColor: `${primaryColor}15`, borderWidth: 1, borderColor: primaryColor }]}
                          onPress={() => { setShowRoomModal(false); handleUploadLeaseFor(unitId, selectedRoom.id); }}
                        >
                          <MaterialCommunityIcons name="upload" size={16} color={primaryColor} />
                          <ThemedText style={[styles.modalButtonText, { color: primaryColor }]}>Upload Lease</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modalLeaseHalfButton, { backgroundColor: primaryColor }]}
                          onPress={() => { setShowRoomModal(false); router.push(wizardUrl as any); }}
                        >
                          <MaterialCommunityIcons name="file-document-edit-outline" size={16} color={onPrimaryColor} />
                          <ThemedText style={[styles.modalButtonText, { color: onPrimaryColor }]}>Generate Lease</ThemedText>
                        </TouchableOpacity>
                      </View>
                      {/* Bottom row: View Leases (full width) */}
                      <TouchableOpacity
                        style={[styles.modalViewLeasesButton, { borderColor: '#10b981' }]}
                        onPress={() => {
                          setShowRoomModal(false);
                          if (roomLease) {
                            router.push(`/lease-detail?id=${roomLease.id}` as any);
                          } else {
                            router.push(`/leases?propertyId=${property?.id}` as any);
                          }
                        }}
                      >
                        <MaterialCommunityIcons name="file-search-outline" size={16} color="#10b981" />
                        <ThemedText style={[styles.modalButtonText, { color: '#10b981' }]}>
                          {roomLease ? 'View Lease' : 'View Leases'}
                        </ThemedText>
                      </TouchableOpacity>
                      {/* Edit Room */}
                      <TouchableOpacity
                        style={[styles.modalEditButton, { backgroundColor: primaryColor }]}
                        onPress={() => {
                          setShowRoomModal(false);
                          if (property && unitId) {
                            router.push(`/add-room?propertyId=${property.id}&unitId=${unitId}&roomId=${selectedRoom.id}` as any);
                          }
                        }}
                      >
                        <MaterialCommunityIcons name="pencil" size={18} color={onPrimaryColor} />
                        <ThemedText style={[styles.modalButtonText, { color: onPrimaryColor }]}>Edit Room</ThemedText>
                      </TouchableOpacity>
                      {/* Delete Room */}
                      <TouchableOpacity
                        style={[styles.modalEditButton, { backgroundColor: '#ef4444', marginTop: 8 }]}
                        onPress={() => {
                          setShowRoomModal(false);
                          handleDeleteRoom(selectedRoom);
                        }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#fff" />
                        <ThemedText style={styles.modalButtonText}>Delete Room</ThemedText>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
      </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Archive-Delete confirmation dialog */}
      <DeleteConfirmDialog
        visible={deleteDialog.visible}
        entityType={deleteDialog.entityType}
        entityName={deleteDialog.entityName}
        hasTenant={deleteDialog.hasTenant}
        tenantName={deleteDialog.tenantName}
        tenantCount={deleteDialog.tenantCount}
        isLoading={deleteDialog.isLoading}
        onCancel={() => setDeleteDialog((d) => ({ ...d, visible: false }))}
        onConfirm={handleConfirmDelete}
      />

      {/* Save Button Footer - Only shows in edit mode */}
      {isEditMode && (
        <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: bgColor, paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: isDark ? '#26282C' : '#E5E5E7' }]}
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
              <ActivityIndicator size="small" color={onPrimaryColor} />
            ) : (
              <ThemedText style={[styles.saveButtonText, { color: onPrimaryColor }]}>Save Changes</ThemedText>
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
    marginTop: 20,
    marginBottom: 16,
  },
  propertyName: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 6,
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
  photoManageSection: {
    marginTop: 16,
    gap: 12,
  },
  photoManageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  photoManageRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
  },
  photoManageThumbWrapper: {
    position: 'relative',
  },
  photoManageThumb: {
    width: 84,
    height: 84,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  photoRemoveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddTile: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 10,
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
  emptySubText: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
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
  rentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
  },
  rentToggleInfo: {
    flex: 1,
    gap: 2,
    marginRight: 12,
  },
  leaseViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  leaseViewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  unitLeaseCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  roomLeaseBlock: {
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  modalActionSection: {
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  modalLeaseRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalLeaseHalfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalViewLeasesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
