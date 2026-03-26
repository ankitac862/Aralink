import React, { useState, useMemo, useEffect } from 'react';
import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  View, 
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore, Property } from '@/store/propertyStore';

export default function PropertiesScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Get user from auth store
  const { user } = useAuthStore();

  // Get properties and filter state from store
  const { 
    properties, 
    selectedPropertyIds, 
    togglePropertySelection, 
    clearPropertySelection,
    setSelectedPropertyIds,
    loadFromSupabase,
    isLoading,
  } = usePropertyStore();

  // Load properties from API on mount
  useEffect(() => {
    if (user?.id) {
      loadFromSupabase(user.id);
    }
  }, [user?.id]);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101622' : '#f6f6f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#4b5563' : '#e0e0e0';
  const textColor = isDark ? '#f3f4f6' : '#4a4a4a';
  const secondaryTextColor = isDark ? '#9ca3af' : '#9ca3af';
  const successColor = '#50E3C2';
  const dangerColor = '#D0021B';
  const primaryColor = '#137fec';
  const modalBgColor = isDark ? '#1a242d' : '#ffffff';
  const overlayColor = 'rgba(0, 0, 0, 0.5)';

  // Filter properties based on search and selected filters
  const filteredProperties = useMemo(() => {
    let result = properties;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        (p.address1 || '').toLowerCase().includes(query) ||
        (p.name || '').toLowerCase().includes(query) ||
        p.city.toLowerCase().includes(query) ||
        p.state.toLowerCase().includes(query)
      );
    }
    
    // Apply property selection filter
    if (selectedPropertyIds.length > 0) {
      result = result.filter((p) => selectedPropertyIds.includes(p.id));
    }
    
    return result;
  }, [properties, searchQuery, selectedPropertyIds]);

  // Get full address for display
  const getFullAddress = (property: Property) => {
    const address = property.address1 || 'Unknown Address';
    return `${address}, ${property.city}`;
  };

  // Get occupancy stats
  const getOccupancyStats = (property: Property) => {
    const totalUnits = property.units.length;
    const occupiedUnits = property.units.filter(u => u.isOccupied).length;
    return { totalUnits, occupiedUnits };
  };

  const PropertyCard = ({ property }: { property: Property }) => {
    const statusColor = property.status === 'active' ? successColor : dangerColor;
    const { totalUnits, occupiedUnits } = getOccupancyStats(property);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/property-detail?id=${property.id}`)}
        style={[styles.propertyCard, { backgroundColor: cardBgColor, borderColor }]}>
        {property.photos && property.photos.length > 0 ? (
          <Image 
            source={{ uri: property.photos[0] }} 
            style={styles.propertyImage} 
          />
        ) : (
          <View style={[styles.propertyImage, styles.propertyImagePlaceholder, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
            <MaterialCommunityIcons name="home-outline" size={48} color={secondaryTextColor} />
          </View>
        )}
        <View style={styles.propertyContent}>
          <View style={styles.propertyHeader}>
            <ThemedText type="subtitle" style={[styles.propertyTitle, { color: textColor }]}>
              {property.address1 || 'Unknown Address'}
            </ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <ThemedText
                style={[styles.statusText, { color: statusColor, fontSize: 12, fontWeight: '500' }]}>
                {property.status === 'active' ? 'Active' : 'Inactive'}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.cityText, { color: secondaryTextColor }]}>
            {property.city}, {property.state} {property.zipCode}
          </ThemedText>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="home-group" size={14} color={secondaryTextColor} />
              <ThemedText style={[styles.unitsText, { color: textColor }]}>
                {totalUnits} {totalUnits === 1 ? 'Unit' : 'Units'}
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="account-group" size={14} color={secondaryTextColor} />
              <ThemedText style={[styles.unitsText, { color: textColor }]}>
                {occupiedUnits} Occupied
              </ThemedText>
            </View>
          </View>
          <View style={[styles.propertyTypeBadge, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
            <ThemedText style={[styles.propertyTypeText, { color: secondaryTextColor }]}>
              {property.propertyType === 'single_unit' ? 'Single Unit' : 'Multi-Unit'}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Filter Modal Component
  const FilterModal = () => {
    const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(selectedPropertyIds);

    const handleToggle = (id: string) => {
      setTempSelectedIds(prev => 
        prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
      );
    };

    const handleApply = () => {
      setSelectedPropertyIds(tempSelectedIds);
      setShowFilterModal(false);
    };

    const handleReset = () => {
      setTempSelectedIds([]);
    };

    return (
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowFilterModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: modalBgColor }]}>
            {/* Handle bar */}
            <View style={styles.modalHandleContainer}>
              <View style={[styles.modalHandle, { backgroundColor: isDark ? '#4b5563' : '#d1d5db' }]} />
            </View>
            
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>
                Filter by Property
              </ThemedText>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                onPress={() => setShowFilterModal(false)}
              >
                <MaterialCommunityIcons name="close" size={18} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Property List */}
            <ScrollView style={styles.modalList}>
              {properties.map((property) => (
                <TouchableOpacity
                  key={property.id}
                  style={styles.filterItem}
                  onPress={() => handleToggle(property.id)}
                >
                  <ThemedText style={[styles.filterItemText, { color: textColor }]}>
                    {getFullAddress(property)}
                  </ThemedText>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: tempSelectedIds.includes(property.id) ? primaryColor : borderColor,
                        backgroundColor: tempSelectedIds.includes(property.id) ? primaryColor : 'transparent',
                      },
                    ]}
                  >
                    {tempSelectedIds.includes(property.id) && (
                      <MaterialCommunityIcons name="check" size={14} color="white" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
              <TouchableOpacity
                style={[styles.footerButton, styles.resetButton, { borderColor }]}
                onPress={handleReset}
              >
                <ThemedText style={[styles.resetButtonText, { color: textColor }]}>Reset</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerButton, styles.applyButton, { backgroundColor: primaryColor }]}
                onPress={handleApply}
              >
                <ThemedText style={styles.applyButtonText}>Apply Filters</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Top App Bar */}
      <View style={[styles.topBar, { borderBottomColor: borderColor, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: textColor }]}>
          My Properties
        </ThemedText>
        <View style={styles.iconButton} />
      </View>

      {/* Search Bar with Filter */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              borderColor,
            },
          ]}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={secondaryTextColor}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search properties..."
            placeholderTextColor={secondaryTextColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              borderColor: selectedPropertyIds.length > 0 ? primaryColor : borderColor,
            },
          ]}
          onPress={() => setShowFilterModal(true)}
        >
          <MaterialCommunityIcons 
            name="filter-variant" 
            size={22} 
            color={selectedPropertyIds.length > 0 ? primaryColor : secondaryTextColor} 
          />
          {selectedPropertyIds.length > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: primaryColor }]}>
              <ThemedText style={styles.filterBadgeText}>{selectedPropertyIds.length}</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filters indicator */}
      {selectedPropertyIds.length > 0 && (
        <View style={styles.activeFiltersContainer}>
          <ThemedText style={[styles.activeFiltersText, { color: secondaryTextColor }]}>
            Showing {filteredProperties.length} of {properties.length} properties
          </ThemedText>
          <TouchableOpacity onPress={clearPropertySelection}>
            <ThemedText style={[styles.clearFiltersText, { color: primaryColor }]}>
              Clear filters
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {/* Properties List */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredProperties.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="home-search" size={64} color={secondaryTextColor} />
            <ThemedText style={[styles.emptyStateText, { color: secondaryTextColor }]}>
              No properties found
            </ThemedText>
            <ThemedText style={[styles.emptyStateSubtext, { color: secondaryTextColor }]}>
              {searchQuery || selectedPropertyIds.length > 0 
                ? 'Try adjusting your search or filters'
                : 'Add your first property to get started'}
            </ThemedText>
          </View>
        ) : (
          filteredProperties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primaryColor }]}
        onPress={() => router.push('/add-property')}>
        <MaterialCommunityIcons name="plus" size={28} color="white" />
      </TouchableOpacity>

      {/* Filter Modal */}
      <FilterModal />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  activeFiltersText: {
    fontSize: 12,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  propertyCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  propertyImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#e0e0e0',
  },
  propertyImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyContent: {
    padding: 12,
    gap: 6,
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  propertyTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cityText: {
    fontSize: 12,
    fontWeight: '400',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unitsText: {
    fontSize: 12,
    fontWeight: '500',
  },
  propertyTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  propertyTypeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#137fec',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHandleContainer: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  filterItemText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  applyButton: {},
  applyButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
});
