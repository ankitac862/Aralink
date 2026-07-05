import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import PropertyAddressSelector, { SelectedPropertyData } from '@/components/PropertyAddressSelector';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore } from '@/store/propertyStore';
import { createTransaction, findActiveLease } from '@/lib/supabase';
import { linkExpenseToRequest } from '@/services/maintenanceService';
import { fetchVendors } from '@/services/vendorService';
import type { Vendor } from '@/constants/vendors';

type TransactionType = 'income' | 'expense';

const MAINTENANCE_SERVICE_TYPES = [
  { label: 'Plumbing', value: 'plumbing', icon: 'water-pump' },
  { label: 'Electrical', value: 'electrical', icon: 'flash' },
  { label: 'HVAC', value: 'hvac', icon: 'air-conditioner' },
  { label: 'Appliance Repair', value: 'appliance', icon: 'fridge' },
  { label: 'WiFi / Internet', value: 'wifi', icon: 'wifi' },
  { label: 'Utilities', value: 'utilities', icon: 'lightning-bolt' },
  { label: 'General Repair', value: 'general', icon: 'wrench' },
  { label: 'Cleaning', value: 'cleaning', icon: 'broom' },
  { label: 'Pest Control', value: 'pest', icon: 'bug' },
  { label: 'Others', value: 'others', icon: 'dots-horizontal' },
] as const;

interface FormData {
  type: TransactionType;
  amount: string;
  date: Date;
  propertyId: string;
  unitId: string;
  subunitId: string;
  tenantId: string;
  leaseId: string;
  category: string;
  serviceType: string;
  vendor: string;
  description: string;
}

const INCOME_CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'garage', label: 'Garage' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' },
];

const EXPENSE_CATEGORIES = [
  { value: 'utility', label: 'Utility Bill' },
  { value: 'maintenance', label: 'Maintenance/Service' },
  { value: 'other', label: 'Other' },
];

export default function AddTransactionScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth(); // For createTransaction
  const { user } = useAuthStore(); // For loading properties - same as properties page
  const { properties, loadFromSupabase: loadProperties, isLoading: isLoadingProperties } = usePropertyStore();
  
  // Load properties on mount - same pattern as properties.tsx
  useEffect(() => {
    if (user?.id) {
      console.log('Loading properties for user:', user.id);
      loadProperties(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Get route params for prefill
  const params = useLocalSearchParams<{
    type?: string;
    category?: string;
    propertyId?: string;
    unitId?: string;
    subunitId?: string;
    tenantId?: string;
    maintenanceRequestId?: string;
    description?: string;
  }>();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const inputBgColor = isDark ? '#141517' : '#F7F7F8';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const secondaryTextColor = isDark ? '#9BA1A6' : '#6E7377';
  const placeholderColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  // Ensure we always have an array for properties
  const safeProperties = Array.isArray(properties) ? properties : [];

  // Debug: Log properties when they load
  useEffect(() => {
    console.log('=== ADD TRANSACTION DEBUG ===');
    console.log('User ID:', user?.id);
    console.log('Auth User ID:', authUser?.id);
    console.log('Properties loaded:', safeProperties.length);
    console.log('Loading state:', isLoadingProperties);
    if (safeProperties.length > 0) {
      console.log('First property:', safeProperties[0]);
    } else {
      console.log('No properties found in store');
    }
    console.log('============================');
  }, [safeProperties, isLoadingProperties, user?.id, authUser?.id]);

  const [formData, setFormData] = useState<FormData>({
    type: (params.type as TransactionType) || 'income',
    amount: '',
    date: new Date(),
    propertyId: params.propertyId || '',
    unitId: params.unitId || '',
    subunitId: params.subunitId || '',
    tenantId: params.tenantId || '',
    leaseId: '',
    category: params.category || 'rent',
    serviceType: '',
    vendor: '',
    description: params.description || '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showSubunitModal, setShowSubunitModal] = useState(false);
  const [showServiceTypeModal, setShowServiceTypeModal] = useState(false);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [vendorQuery, setVendorQuery] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  const vendorSuggestions = useMemo(() => {
    if (!vendorQuery.trim()) return [];
    return allVendors
      .filter(v => v.name.toLowerCase().includes(vendorQuery.toLowerCase()))
      .slice(0, 6);
  }, [allVendors, vendorQuery]);

  useEffect(() => {
    fetchVendors().then(setAllVendors).catch(() => {});
  }, []);

  // Handle property selection
  const handlePropertySelect = (data: SelectedPropertyData) => {
    setFormData(prev => ({
      ...prev,
      propertyId: data.property.id,
      unitId: data.unit?.id || '',
      subunitId: data.subUnit?.id || '',
    }));
  };

  const categories = formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Get selected property details
  const selectedProperty = safeProperties.find(p => p.id === formData.propertyId);
  const availableUnits = selectedProperty?.units || [];
  const selectedUnit = availableUnits.find(u => u.id === formData.unitId);
  const availableSubunits = selectedUnit?.subUnits || [];

  // Auto-select if only one option
  useEffect(() => {
    if (selectedProperty && availableUnits.length === 1 && !formData.unitId) {
      setFormData(prev => ({ ...prev, unitId: availableUnits[0].id }));
    }
  }, [selectedProperty, availableUnits, formData.unitId]);

  useEffect(() => {
    if (selectedUnit && availableSubunits.length === 1 && !formData.subunitId) {
      setFormData(prev => ({ ...prev, subunitId: availableSubunits[0].id }));
    }
  }, [selectedUnit, availableSubunits, formData.subunitId]);

  // Auto-map tenant for Rent transactions
  useEffect(() => {
    const autoMapTenant = async () => {
      if (formData.category === 'rent' && formData.propertyId && !params.tenantId) {
        const lease = await findActiveLease(
          formData.propertyId,
          formData.unitId || undefined,
          formData.subunitId || undefined
        );
        
        if (lease && lease.tenant_id) {
          setFormData(prev => ({
            ...prev,
            tenantId: lease.tenant_id || '',
            leaseId: lease.id,
          }));
        }
      }
    };

    autoMapTenant();
  }, [formData.category, formData.propertyId, formData.unitId, formData.subunitId]);

  const handleSubmit = async () => {
    if (!authUser) {
      Alert.alert('Error', 'You must be logged in to add a transaction');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await createTransaction({
        user_id: authUser.id,
        type: formData.type,
        category: formData.category as any,
        amount: parseFloat(formData.amount),
        date: formData.date.toISOString(),
        property_id: formData.propertyId || undefined,
        unit_id: formData.unitId || undefined,
        subunit_id: formData.subunitId || undefined,
        tenant_id: formData.tenantId || undefined,
        lease_id: formData.leaseId || undefined,
        description: formData.description || undefined,
        service_type: formData.serviceType || undefined,
        vendor: formData.vendor || undefined,
        status: 'paid',
      });

      if (result) {
        // If this transaction was created from a maintenance request, link them
        if (params.maintenanceRequestId && result.id) {
          await linkExpenseToRequest(params.maintenanceRequestId, result.id);
        }
        Alert.alert('Success', 'Transaction added successfully');
        router.back();
      } else {
        Alert.alert('Error', 'Failed to save transaction. Please try again.');
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      Alert.alert('Error', 'Failed to save transaction');
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
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Add New Transaction
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Income/Expense Toggle */}
          <View style={[styles.toggleWrapper, { backgroundColor: isDark ? '#26282C' : '#E5E5E7' }]}>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                formData.type === 'income' && [styles.toggleActive, { backgroundColor: cardBgColor }],
              ]}
              onPress={() => setFormData(prev => ({ ...prev, type: 'income', category: 'rent' }))}
            >
              <ThemedText 
                style={[
                  styles.toggleText,
                  { 
                    color: formData.type === 'income' ? primaryColor : secondaryTextColor,
                    fontWeight: formData.type === 'income' ? '700' : '500',
                  },
                ]}
              >
                Income
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                formData.type === 'expense' && [styles.toggleActive, { backgroundColor: cardBgColor }],
              ]}
              onPress={() => setFormData(prev => ({ ...prev, type: 'expense', category: 'maintenance' }))}
            >
              <ThemedText 
                style={[
                  styles.toggleText,
                  { 
                    color: formData.type === 'expense' ? primaryColor : secondaryTextColor,
                    fontWeight: formData.type === 'expense' ? '700' : '500',
                  },
                ]}
              >
                Expense
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              AMOUNT
            </ThemedText>
            <View style={[styles.amountInputContainer, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={[styles.currencySymbol, { color: textColor }]}>$</ThemedText>
              <TextInput
                style={[styles.amountInput, { color: textColor }]}
                placeholder="0.00"
                placeholderTextColor={placeholderColor}
                keyboardType="decimal-pad"
                value={formData.amount}
                onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
              />
            </View>
          </View>

          {/* Date Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              DATE
            </ThemedText>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: cardBgColor, borderColor }]}
              onPress={() => setShowDatePicker(true)}
            >
              <ThemedText style={[styles.inputText, { color: textColor }]}>
                {formData.date.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </ThemedText>
              <MaterialCommunityIcons name="calendar" size={20} color={secondaryTextColor} />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={formData.date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  setFormData(prev => ({ ...prev, date: selectedDate }));
                }
              }}
            />
          )}

          {/* Property Selection */}
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              PROPERTY
            </ThemedText>
            <PropertyAddressSelector
              onSelect={handlePropertySelect}
              selectedPropertyId={formData.propertyId}
              selectedUnitId={formData.unitId}
              label=""
              required
              placeholder="Select a property..."
            />
          </View>

          {/* Unit Selection (if property has units) */}
          {formData.propertyId && availableUnits.length > 0 && (
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                UNIT {availableUnits.length === 1 && '(Auto-selected)'}
              </ThemedText>
                <TouchableOpacity
                style={[styles.input, { backgroundColor: cardBgColor, borderColor }]}
                onPress={() => setShowUnitModal(true)}
              >
                <ThemedText 
                  style={[
                    styles.inputText, 
                    { color: formData.unitId ? textColor : placeholderColor }
                  ]}
                >
                  {formData.unitId 
                    ? `Unit ${availableUnits.find(u => u.id === formData.unitId)?.name || ''}`
                    : 'Select Unit'}
                  </ThemedText>
                <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
                </TouchableOpacity>
            </View>
          )}

          {/* Subunit Selection (if unit has subunits) */}
          {formData.propertyId && formData.unitId && availableSubunits.length > 0 && (
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                ROOM {availableSubunits.length === 1 && '(Auto-selected)'}
              </ThemedText>
                  <TouchableOpacity
                style={[styles.input, { backgroundColor: cardBgColor, borderColor }]}
                onPress={() => setShowSubunitModal(true)}
                  >
                    <ThemedText 
                      style={[
                    styles.inputText, 
                    { color: formData.subunitId ? textColor : placeholderColor }
                      ]}
                    >
                  {formData.subunitId 
                    ? `Room ${availableSubunits.find(s => s.id === formData.subunitId)?.name || ''}`
                    : 'Select Room'}
                    </ThemedText>
                <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
                  </TouchableOpacity>
            </View>
          )}

          {/* Category Selection */}
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              CATEGORY
            </ThemedText>
            <View style={styles.categoryOptions}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryOption,
                    formData.category === cat.value 
                      ? { backgroundColor: primaryColor }
                      : { backgroundColor: cardBgColor, borderColor, borderWidth: 1 },
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                >
                  <ThemedText 
                    style={[
                      styles.categoryOptionText,
                      { color: formData.category === cat.value ? onPrimaryColor : textColor },
                    ]}
                  >
                    {cat.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Service Type (for expense) */}
          {formData.type === 'expense' && (
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                SERVICE TYPE
              </ThemedText>
              <TouchableOpacity
                style={[styles.textInput, styles.dropdownBtn, { backgroundColor: cardBgColor, borderColor }]}
                onPress={() => setShowServiceTypeModal(true)}
              >
                <ThemedText style={{ color: formData.serviceType ? textColor : placeholderColor, fontSize: 15, fontWeight: '500', flex: 1 }}>
                  {formData.serviceType
                    ? MAINTENANCE_SERVICE_TYPES.find(s => s.value === formData.serviceType)?.label ?? formData.serviceType
                    : 'Select service type…'}
                </ThemedText>
                <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
              </TouchableOpacity>
            </View>
          )}

          {/* Vendor */}
          {formData.type === 'expense' && (
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
                VENDOR / SERVICE PROVIDER
              </ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: cardBgColor, borderColor, color: textColor }]}
                placeholder="Type to search or enter vendor name…"
                placeholderTextColor={placeholderColor}
                value={vendorQuery || formData.vendor}
                onChangeText={(text) => {
                  setVendorQuery(text);
                  setFormData(prev => ({ ...prev, vendor: text }));
                  setShowVendorDropdown(text.trim().length > 0);
                }}
                onBlur={() => setTimeout(() => setShowVendorDropdown(false), 150)}
              />
              {showVendorDropdown && vendorSuggestions.length > 0 && (
                <View style={[styles.vendorDropdown, { backgroundColor: cardBgColor, borderColor }]}>
                  {vendorSuggestions.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.vendorSuggestion, { borderBottomColor: borderColor }]}
                      onPress={() => {
                        setFormData(prev => ({ ...prev, vendor: v.name }));
                        setVendorQuery('');
                        setShowVendorDropdown(false);
                      }}
                    >
                      <ThemedText style={[styles.vendorSuggestionName, { color: textColor }]}>{v.name}</ThemedText>
                      <ThemedText style={[styles.vendorSuggestionMeta, { color: secondaryTextColor }]}>{v.category} · {v.city}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Description */}
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: secondaryTextColor }]}>
              DESCRIPTION / NOTES
            </ThemedText>
            <TextInput
              style={[styles.textArea, { backgroundColor: cardBgColor, borderColor, color: textColor }]}
              placeholder="Add details..."
              placeholderTextColor={placeholderColor}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Unit Selection Modal */}
      <Modal
        visible={showUnitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUnitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBgColor }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>Select Unit</ThemedText>
              <TouchableOpacity onPress={() => setShowUnitModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {availableUnits.map((unit) => (
                <TouchableOpacity
                  key={unit.id}
                  style={[styles.modalItem, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, unitId: unit.id, subunitId: '' }));
                    setShowUnitModal(false);
                  }}
                >
                  <ThemedText style={[styles.modalItemText, { color: formData.unitId === unit.id ? primaryColor : textColor }]}>
                    {unit.name}
                  </ThemedText>
                  {formData.unitId === unit.id && (
                    <MaterialCommunityIcons name="check" size={20} color={primaryColor} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Subunit Selection Modal */}
      <Modal
        visible={showSubunitModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubunitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBgColor }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>Select Room</ThemedText>
              <TouchableOpacity onPress={() => setShowSubunitModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {availableSubunits.map((subunit) => (
                <TouchableOpacity
                  key={subunit.id}
                  style={[styles.modalItem, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, subunitId: subunit.id }));
                    setShowSubunitModal(false);
                  }}
                >
                  <ThemedText style={[styles.modalItemText, { color: formData.subunitId === subunit.id ? primaryColor : textColor }]}>
                    Room {subunit.name}
                  </ThemedText>
                  {formData.subunitId === subunit.id && (
                    <MaterialCommunityIcons name="check" size={20} color={primaryColor} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Service Type Modal */}
      <Modal
        visible={showServiceTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServiceTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBgColor }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>Select Service Type</ThemedText>
              <TouchableOpacity onPress={() => setShowServiceTypeModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {MAINTENANCE_SERVICE_TYPES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.modalItem, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, serviceType: s.value }));
                    setShowServiceTypeModal(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <MaterialCommunityIcons name={s.icon as any} size={20} color={formData.serviceType === s.value ? primaryColor : secondaryTextColor} />
                    <ThemedText style={[styles.modalItemText, { color: formData.serviceType === s.value ? primaryColor : textColor }]}>
                      {s.label}
                    </ThemedText>
                  </View>
                  {formData.serviceType === s.value && (
                    <MaterialCommunityIcons name="check" size={20} color={primaryColor} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom Buttons */}
      <View
        style={[
          styles.bottomButtons,
          {
            backgroundColor: cardBgColor,
            borderTopColor: borderColor,
            paddingBottom: insets.bottom + 16,
          }
        ]}
      >
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: isDark ? '#26282C' : '#E8E8EA' }]}
          onPress={() => router.back()}
        >
          <ThemedText style={[styles.cancelButtonText, { color: textColor }]}>
            Cancel
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: primaryColor, opacity: isSubmitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <ThemedText style={[styles.saveButtonText, { color: onPrimaryColor }]}>
            {isSubmitting ? 'Saving...' : 'Save'}
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
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
    padding: 16,
    gap: 24,
    paddingBottom: 120,
  },
  toggleWrapper: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    height: 48,
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '700',
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    paddingVertical: 16,
    paddingLeft: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputText: {
    fontSize: 15,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalList: {
    maxHeight: 420,
  },
  modalListContent: {
    paddingBottom: 20,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalItemSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  modalEmptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 100,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vendorDropdown: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  vendorSuggestion: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  vendorSuggestionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  vendorSuggestionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});

