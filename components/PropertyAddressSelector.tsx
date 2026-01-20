/**
 * PropertyAddressSelector Component
 * 
 * A hierarchical property selector that shows:
 * 1. Main property addresses
 * 2. Units (for multi-unit properties)
 * 3. Sub-units/Rooms (for properties with rooms)
 * 
 * Used in lease wizard to select which property/unit/room the lease is for.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePropertyStore, Property, Unit, SubUnit } from '@/store/propertyStore';
import { useAuthStore } from '@/store/authStore';

export interface SelectedPropertyData {
  property: Property;
  unit?: Unit;
  subUnit?: SubUnit;
  // Computed fields for convenience
  fullAddress: string;
  rentAmount?: number;
  parkingIncluded?: boolean;
}

interface PropertyAddressSelectorProps {
  onSelect: (data: SelectedPropertyData) => void;
  selectedPropertyId?: string;
  selectedUnitId?: string;
  selectedSubUnitId?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

export default function PropertyAddressSelector({
  onSelect,
  selectedPropertyId,
  selectedUnitId,
  selectedSubUnitId,
  label = 'Property',
  required = false,
  placeholder = 'Select a property...',
}: PropertyAddressSelectorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { user } = useAuthStore();
  const { properties, loadFromSupabase, isLoading } = usePropertyStore();

  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<'property' | 'unit' | 'subunit'>('property');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Theme colors
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const inputBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  // Load properties on mount
  useEffect(() => {
    if (user?.id && properties.length === 0) {
      loadFromSupabase(user.id);
    }
  }, [user?.id]);

  // Pre-select if IDs provided
  useEffect(() => {
    if (selectedPropertyId) {
      const prop = properties.find(p => p.id === selectedPropertyId);
      if (prop) {
        setSelectedProperty(prop);
        if (selectedUnitId) {
          const unit = prop.units?.find(u => u.id === selectedUnitId);
          if (unit) {
            setSelectedUnit(unit);
          }
        }
      }
    }
  }, [selectedPropertyId, selectedUnitId, properties]);

  // Build display text
  const displayText = useMemo(() => {
    if (!selectedProperty) return '';
    
    let text = selectedProperty.address1 || selectedProperty.name || 'Unknown Property';
    
    if (selectedProperty.city) {
      text += `, ${selectedProperty.city}`;
    }
    
    if (selectedUnit) {
      text += ` - ${selectedUnit.name || `Unit ${selectedUnit.unitNumber}`}`;
    }
    
    return text;
  }, [selectedProperty, selectedUnit]);

  // Get full address helper
  const getFullAddress = (property: Property): string => {
    const parts = [property.address1];
    if (property.address2) parts.push(property.address2);
    if (property.city) parts.push(property.city);
    if (property.state) parts.push(property.state);
    if (property.zipCode) parts.push(property.zipCode);
    return parts.filter(Boolean).join(', ');
  };

  // Handle property selection
  const handlePropertySelect = (property: Property) => {
    setSelectedProperty(property);
    
    // Check if property has units
    const hasUnits = property.units && property.units.length > 0;
    const isMultiUnit = property.propertyType === 'multi_unit';
    
    if (hasUnits && (isMultiUnit || property.units!.length > 1)) {
      // Show unit selection
      setStep('unit');
    } else if (hasUnits && property.units!.length === 1) {
      // Single unit - check for sub-units
      const unit = property.units![0];
      const hasSubUnits = unit.subUnits && unit.subUnits.length > 0;
      
      if (hasSubUnits) {
        setSelectedUnit(unit);
        setStep('subunit');
      } else {
        // Complete selection with the single unit
        completeSelection(property, unit);
      }
    } else {
      // No units - complete selection at property level
      completeSelection(property);
    }
  };

  // Handle unit selection
  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    
    // Check for sub-units
    const hasSubUnits = unit.subUnits && unit.subUnits.length > 0;
    
    if (hasSubUnits) {
      setStep('subunit');
    } else {
      // Complete selection at unit level
      completeSelection(selectedProperty!, unit);
    }
  };

  // Handle sub-unit selection
  const handleSubUnitSelect = (subUnit: SubUnit) => {
    completeSelection(selectedProperty!, selectedUnit!, subUnit);
  };

  // Complete the selection and call callback
  const completeSelection = (property: Property, unit?: Unit, subUnit?: SubUnit) => {
    // Calculate rent amount based on level
    let rentAmount: number | undefined;
    if (subUnit?.rentAmount) {
      rentAmount = subUnit.rentAmount;
    } else if (unit?.rentAmount) {
      rentAmount = unit.rentAmount;
    } else if (property.rentAmount) {
      rentAmount = property.rentAmount;
    }

    const data: SelectedPropertyData = {
      property,
      unit,
      subUnit,
      fullAddress: getFullAddress(property),
      rentAmount,
      parkingIncluded: unit?.parkingIncluded ?? property.parkingIncluded,
    };

    onSelect(data);
    setShowModal(false);
    setStep('property');
  };

  // Reset and go back
  const handleBack = () => {
    if (step === 'subunit') {
      setStep('unit');
      setSelectedUnit(null);
    } else if (step === 'unit') {
      setStep('property');
      setSelectedProperty(null);
    }
  };

  // Render property item
  const renderPropertyItem = ({ item }: { item: Property }) => (
    <TouchableOpacity
      style={[styles.listItem, { borderBottomColor: borderColor }]}
      onPress={() => handlePropertySelect(item)}
    >
      <View style={styles.listItemIcon}>
        <MaterialCommunityIcons 
          name={item.propertyType === 'multi_unit' ? 'office-building' : 'home'} 
          size={24} 
          color={primaryColor} 
        />
      </View>
      <View style={styles.listItemContent}>
        <ThemedText style={[styles.listItemTitle, { color: textColor }]}>
          {item.address1 || item.name || 'Unnamed Property'}
        </ThemedText>
        <ThemedText style={[styles.listItemSubtitle, { color: secondaryTextColor }]}>
          {item.city}{item.state ? `, ${item.state}` : ''} {item.zipCode}
        </ThemedText>
        {item.rentAmount && (
          <ThemedText style={[styles.listItemMeta, { color: primaryColor }]}>
            ${item.rentAmount}/mo
          </ThemedText>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={secondaryTextColor} />
    </TouchableOpacity>
  );

  // Render unit item
  const renderUnitItem = ({ item }: { item: Unit }) => (
    <TouchableOpacity
      style={[styles.listItem, { borderBottomColor: borderColor }]}
      onPress={() => handleUnitSelect(item)}
    >
      <View style={styles.listItemIcon}>
        <MaterialCommunityIcons name="door" size={24} color={primaryColor} />
      </View>
      <View style={styles.listItemContent}>
        <ThemedText style={[styles.listItemTitle, { color: textColor }]}>
          {item.name || `Unit ${item.unitNumber}`}
        </ThemedText>
        {item.bedrooms && (
          <ThemedText style={[styles.listItemSubtitle, { color: secondaryTextColor }]}>
            {item.bedrooms} bed, {item.bathrooms || 1} bath
          </ThemedText>
        )}
        {item.rentAmount && (
          <ThemedText style={[styles.listItemMeta, { color: primaryColor }]}>
            ${item.rentAmount}/mo
          </ThemedText>
        )}
      </View>
      {item.subUnits && item.subUnits.length > 0 && (
        <View style={[styles.badge, { backgroundColor: primaryColor }]}>
          <ThemedText style={styles.badgeText}>
            {item.subUnits.length} rooms
          </ThemedText>
        </View>
      )}
      <MaterialCommunityIcons name="chevron-right" size={24} color={secondaryTextColor} />
    </TouchableOpacity>
  );

  // Render sub-unit item
  const renderSubUnitItem = ({ item }: { item: SubUnit }) => (
    <TouchableOpacity
      style={[styles.listItem, { borderBottomColor: borderColor }]}
      onPress={() => handleSubUnitSelect(item)}
    >
      <View style={styles.listItemIcon}>
        <MaterialCommunityIcons name="bed" size={24} color={primaryColor} />
      </View>
      <View style={styles.listItemContent}>
        <ThemedText style={[styles.listItemTitle, { color: textColor }]}>
          {item.name || `Room ${item.id.slice(-4)}`}
        </ThemedText>
        {item.rentAmount && (
          <ThemedText style={[styles.listItemMeta, { color: primaryColor }]}>
            ${item.rentAmount}/mo
          </ThemedText>
        )}
      </View>
      <MaterialCommunityIcons name="check" size={24} color={primaryColor} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <ThemedText style={[styles.label, { color: textColor }]}>
            {label}
            {required && <ThemedText style={{ color: '#ef4444' }}> *</ThemedText>}
          </ThemedText>
        </View>
      )}

      {/* Selector Button */}
      <TouchableOpacity
        style={[styles.selectorButton, { backgroundColor: inputBgColor, borderColor }]}
        onPress={() => setShowModal(true)}
      >
        <MaterialCommunityIcons name="home-city" size={20} color={secondaryTextColor} />
        <ThemedText 
          style={[
            styles.selectorText, 
            { color: displayText ? textColor : secondaryTextColor }
          ]}
          numberOfLines={1}
        >
          {displayText || placeholder}
        </ThemedText>
        <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
      </TouchableOpacity>

      {/* Selection Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: bgColor }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            {step !== 'property' && (
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
              </TouchableOpacity>
            )}
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>
              {step === 'property' && 'Select Property'}
              {step === 'unit' && 'Select Unit'}
              {step === 'subunit' && 'Select Room'}
            </ThemedText>
            <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Breadcrumb */}
          {(step === 'unit' || step === 'subunit') && (
            <View style={[styles.breadcrumb, { backgroundColor: inputBgColor, borderBottomColor: borderColor }]}>
              <MaterialCommunityIcons name="home" size={16} color={secondaryTextColor} />
              <ThemedText style={[styles.breadcrumbText, { color: secondaryTextColor }]} numberOfLines={1}>
                {selectedProperty?.address1}
                {selectedUnit && ` → ${selectedUnit.name || `Unit ${selectedUnit.unitNumber}`}`}
              </ThemedText>
            </View>
          )}

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
              <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
                Loading properties...
              </ThemedText>
            </View>
          ) : (
            <>
              {step === 'property' && (
                <FlatList
                  data={properties}
                  keyExtractor={(item) => item.id}
                  renderItem={renderPropertyItem}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons name="home-off" size={48} color={secondaryTextColor} />
                      <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                        No properties found
                      </ThemedText>
                    </View>
                  }
                />
              )}

              {step === 'unit' && selectedProperty?.units && (
                <FlatList
                  data={selectedProperty.units}
                  keyExtractor={(item) => item.id}
                  renderItem={renderUnitItem}
                  contentContainerStyle={styles.listContent}
                  ListHeaderComponent={
                    <TouchableOpacity
                      style={[styles.listItem, { borderBottomColor: borderColor, backgroundColor: isDark ? '#1a2636' : '#f0f9ff' }]}
                      onPress={() => completeSelection(selectedProperty)}
                    >
                      <View style={styles.listItemIcon}>
                        <MaterialCommunityIcons name="home" size={24} color={primaryColor} />
                      </View>
                      <View style={styles.listItemContent}>
                        <ThemedText style={[styles.listItemTitle, { color: textColor }]}>
                          Entire Property
                        </ThemedText>
                        <ThemedText style={[styles.listItemSubtitle, { color: secondaryTextColor }]}>
                          Use property-level address only
                        </ThemedText>
                      </View>
                      <MaterialCommunityIcons name="check" size={24} color={primaryColor} />
                    </TouchableOpacity>
                  }
                />
              )}

              {step === 'subunit' && selectedUnit?.subUnits && (
                <FlatList
                  data={selectedUnit.subUnits}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSubUnitItem}
                  contentContainerStyle={styles.listContent}
                  ListHeaderComponent={
                    <TouchableOpacity
                      style={[styles.listItem, { borderBottomColor: borderColor, backgroundColor: isDark ? '#1a2636' : '#f0f9ff' }]}
                      onPress={() => completeSelection(selectedProperty!, selectedUnit)}
                    >
                      <View style={styles.listItemIcon}>
                        <MaterialCommunityIcons name="door" size={24} color={primaryColor} />
                      </View>
                      <View style={styles.listItemContent}>
                        <ThemedText style={[styles.listItemTitle, { color: textColor }]}>
                          Entire Unit
                        </ThemedText>
                        <ThemedText style={[styles.listItemSubtitle, { color: secondaryTextColor }]}>
                          {selectedUnit.name || `Unit ${selectedUnit.unitNumber}`} - No specific room
                        </ThemedText>
                      </View>
                      <MaterialCommunityIcons name="check" size={24} color={primaryColor} />
                    </TouchableOpacity>
                  }
                />
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  breadcrumbText: {
    fontSize: 13,
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 13,
  },
  listItemMeta: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
});
