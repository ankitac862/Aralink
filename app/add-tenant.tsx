import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
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
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { inviteTenantToProperty, uploadImage, STORAGE_BUCKETS, getApplicationById } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore, Property, Unit, SubUnit } from '@/store/propertyStore';
import { useTenantStore } from '@/store/tenantStore';

export default function AddTenantScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, applicationId } = useLocalSearchParams<{ id?: string; applicationId?: string }>();
  const { properties, loadFromSupabase: loadProperties } = usePropertyStore();
  const { addTenant, updateTenant, getTenantById } = useTenantStore();
  const { user } = useAuthStore();
  
  const isEditing = !!id;
  const existingTenant = id ? getTenantById(id) : null;

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#0d141b';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const inputBgColor = isDark ? '#1a242d' : '#f9fafb';
  const primaryColor = '#137fec';
  const infoBgColor = isDark ? '#1e3a5f' : '#eff6ff';
  const infoTextColor = isDark ? '#93c5fd' : '#1e40af';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    propertyId: '',
    unitId: '',
    subUnitId: '',
    startDate: '',
    endDate: '',
    rentAmount: '',
    photo: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showSubUnitDropdown, setShowSubUnitDropdown] = useState(false);

  // Load properties from Supabase on mount
  useEffect(() => {
    if (user?.id) {
      loadProperties(user.id);
    }
  }, [user?.id]);

  // Load application data if applicationId is provided
  useEffect(() => {
    if (applicationId && properties.length > 0) {
      loadApplicationData();
    }
  }, [applicationId, properties.length]);

  const loadApplicationData = async () => {
    if (!applicationId) return;
    
    try {
      console.log('📄 Loading application data:', applicationId);
      const application = await getApplicationById(applicationId as string);
      
      if (application) {
        console.log('📄 Application loaded:', application);
        
        // Parse name (assuming format: "First Last")
        const nameParts = application.applicant_name?.split(' ') || [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Find the property to get unit details
        const property = properties.find(p => p.id === application.property_id);
        let rentAmount = '';
        
        if (property) {
          console.log('📄 Found property:', property.address1);
          
          // Determine rent amount based on selection
          if (application.sub_unit_id) {
            // Find the subunit and get its rent
            const unit = property.units?.find(u => u.id === application.unit_id);
            const subUnit = unit?.subUnits?.find(su => su.id === application.sub_unit_id);
            if (subUnit?.rentPrice) {
              rentAmount = subUnit.rentPrice.toString();
              console.log('📄 Using subunit rent:', rentAmount);
            }
          } else if (application.unit_id) {
            // Find the unit and get its rent
            const unit = property.units?.find(u => u.id === application.unit_id);
            if (unit?.defaultRentPrice) {
              rentAmount = unit.defaultRentPrice.toString();
              console.log('📄 Using unit rent:', rentAmount);
            }
          } else if (property.rentAmount) {
            // Use property rent
            rentAmount = property.rentAmount.toString();
            console.log('📄 Using property rent:', rentAmount);
          }
        }
        
        // Prefill form with application data
        setFormData(prev => ({
          ...prev,
          firstName,
          lastName,
          email: application.applicant_email || '',
          phone: application.applicant_phone || '',
          propertyId: application.property_id || '',
          unitId: application.unit_id || '',
          subUnitId: application.sub_unit_id || '',
          rentAmount,
        }));
        
        console.log('✅ Form prefilled with application data:', {
          propertyId: application.property_id,
          unitId: application.unit_id,
          subUnitId: application.sub_unit_id,
          rentAmount
        });
      }
    } catch (error) {
      console.error('Error loading application data:', error);
    }
  };

  // Populate form when editing
  useEffect(() => {
    if (existingTenant) {
      setFormData({
        firstName: existingTenant.firstName,
        lastName: existingTenant.lastName,
        email: existingTenant.email,
        phone: existingTenant.phone,
        propertyId: existingTenant.propertyId,
        unitId: existingTenant.unitId || '',
        subUnitId: '', // TODO: Add subUnitId to tenant if needed
        startDate: existingTenant.startDate || '',
        endDate: existingTenant.endDate || '',
        rentAmount: existingTenant.rentAmount?.toString() || '',
        photo: existingTenant.photo || '',
      });
    }
  }, [existingTenant]);

  // Get selected property
  const selectedProperty = useMemo(() => 
    properties.find(p => p.id === formData.propertyId),
    [properties, formData.propertyId]
  );

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

  // Get sub-units (rooms) for selected unit (only if rentEntireUnit is false)
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

  // Determine what rental info to show
  const rentalInfo = useMemo(() => {
    if (selectedSubUnit) {
      return {
        type: 'room',
        name: selectedSubUnit.name,
        rent: selectedSubUnit.rentPrice,
      };
    }
    if (selectedUnit) {
      return {
        type: selectedUnit.rentEntireUnit ? 'unit' : 'select_room',
        name: selectedUnit.name,
        rent: selectedUnit.rentEntireUnit ? selectedUnit.defaultRentPrice : undefined,
      };
    }
    if (selectedProperty) {
      if (selectedProperty.propertyType === 'single_unit') {
        return {
          type: 'property',
          name: selectedProperty.address1,
          rent: selectedProperty.rentAmount,
        };
      }
      return {
        type: 'select_unit',
        name: selectedProperty.address1,
        rent: undefined,
      };
    }
    return null;
  }, [selectedProperty, selectedUnit, selectedSubUnit]);

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
      rentAmount: '',
    }));
    setShowPropertyDropdown(false);

    // Auto-set rent for single unit properties
    if (property?.propertyType === 'single_unit' && property.rentAmount) {
      setFormData(prev => ({ ...prev, rentAmount: property.rentAmount?.toString() || '' }));
    }
  };

  // Reset sub-unit when unit changes
  const handleUnitChange = (unitId: string) => {
    setFormData(prev => ({
      ...prev,
      unitId,
      subUnitId: '',
      rentAmount: '',
    }));
    setShowUnitDropdown(false);

    // Auto-set rent if rentEntireUnit is true
    const unit = availableUnits.find(u => u.id === unitId);
    if (unit?.rentEntireUnit && unit.defaultRentPrice) {
      setFormData(prev => ({ ...prev, rentAmount: unit.defaultRentPrice?.toString() || '' }));
    }
  };

  // Set rent when sub-unit changes
  const handleSubUnitChange = (subUnitId: string) => {
    setFormData(prev => ({
      ...prev,
      subUnitId,
      rentAmount: '',
    }));
    setShowSubUnitDropdown(false);

    // Auto-set rent for room
    const subUnit = availableSubUnits.find(s => s.id === subUnitId);
    if (subUnit?.rentPrice) {
      setFormData(prev => ({ ...prev, rentAmount: subUnit.rentPrice?.toString() || '' }));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData(prev => ({ ...prev, photo: result.assets[0].uri }));
    }
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
    
    // Validate unit selection for multi-unit properties
    if (selectedProperty?.propertyType === 'multi_unit' && !formData.unitId) {
      Alert.alert('Error', 'Please select a unit');
      return;
    }
    
    // Validate room selection if unit is rented by room
    if (selectedUnit && !selectedUnit.rentEntireUnit && availableSubUnits.length > 0 && !formData.subUnitId) {
      Alert.alert('Error', 'Please select a room');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upload photo to Supabase Storage if it's a local file
      let photoUrl = formData.photo;
      if (formData.photo && !formData.photo.startsWith('http') && user?.id) {
        const folder = `tenants/${user.id}`;
        const result = await uploadImage(
          formData.photo, 
          STORAGE_BUCKETS.TENANT_PHOTOS, 
          folder
        );
        if (result.success && result.url) {
          photoUrl = result.url;
        } else {
          console.warn('Image upload failed:', result.error);
        }
      }

      // Build unit name for display
      let unitName = '';
      if (selectedSubUnit) {
        unitName = `${selectedUnit?.name} - ${selectedSubUnit.name}`;
      } else if (selectedUnit) {
        unitName = selectedUnit.name;
      }

      if (isEditing && id) {
        // Update existing tenant
        await updateTenant(id, {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          propertyId: formData.propertyId,
          unitId: formData.unitId || undefined,
          unitName: unitName || undefined,
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
          rentAmount: formData.rentAmount ? parseFloat(formData.rentAmount) : undefined,
          photo: photoUrl || undefined,
        });
      } else {
        if (!user?.id) {
          Alert.alert('Error', 'You must be signed in to invite a tenant.');
          setIsSubmitting(false);
          return;
        }

        // If this tenant was added from an application, delete it
        if (applicationId) {
          const { supabase } = await import('@/lib/supabase');
          
          console.log('🔄 Processing application conversion for applicationId:', applicationId);
          
          // Get application details BEFORE deleting
          const { data: application } = await supabase
            .from('applications')
            .select('id, applicant_email, applicant_name, property_id')
            .eq('id', applicationId)
            .maybeSingle();
          
          console.log('📧 Application to delete:', application);
          
          if (!application) {
            console.error('❌ Application not found with ID:', applicationId);
          } else {
            // Delete the application record
            const { error: deleteError, count } = await supabase
              .from('applications')
              .delete({ count: 'exact' })
              .eq('id', applicationId);
            
            if (deleteError) {
              console.error('❌ Error deleting application:', deleteError);
            } else {
              console.log('✅ Application deleted successfully. Rows deleted:', count);
            }
            
            // Verify deletion
            const { data: checkDeleted } = await supabase
              .from('applications')
              .select('id')
              .eq('id', applicationId)
              .maybeSingle();
            
            if (checkDeleted) {
              console.error('⚠️ WARNING: Application still exists after delete!', checkDeleted);
            } else {
              console.log('✅ VERIFIED: Application', applicationId, 'no longer exists in database');
            }
            
            // Log what we deleted
            console.log('🗑️ DELETED APPLICATION:', {
              id: applicationId,
              email: application.applicant_email,
              name: application.applicant_name
            });
            
            // Try to update applicant status (silently, don't fail if RLS blocks it)
            await supabase
              .from('applicants')
              .update({ status: 'converted_to_tenant', updated_at: new Date().toISOString() })
              .eq('email', application.applicant_email.toLowerCase())
              .eq('property_id', application.property_id);
            console.log('ℹ️ Attempted to update applicant status for:', application.applicant_email);
          }
        }

        console.log('🔧 Calling inviteTenantToProperty with params:', {
          propertyId: formData.propertyId,
          tenantEmail: formData.email.trim(),
          tenantName: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
          unitId: formData.unitId || undefined,
          subUnitId: formData.subUnitId || undefined,
          autoActivate: true,
          rentAmount: formData.rentAmount ? parseFloat(formData.rentAmount) : undefined,
        });

        const inviteResult = await inviteTenantToProperty({
          propertyId: formData.propertyId,
          tenantEmail: formData.email.trim(),
          tenantName: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
          unitId: formData.unitId || undefined,
          subUnitId: formData.subUnitId || undefined,
          autoActivate: true, // Always auto-activate when landlord manually adds tenant
          rentAmount: formData.rentAmount ? parseFloat(formData.rentAmount) : undefined,
        });

        console.log('🔧 inviteTenantToProperty result:', inviteResult);

        if (!inviteResult) {
          Alert.alert('Error', 'Failed to send invite. Please try again.');
          setIsSubmitting(false);
          return;
        }

        if (inviteResult.error) {
          Alert.alert('Error', inviteResult.error);
          setIsSubmitting(false);
          return;
        }

        // Success: Either email sent or notification queued
        if (!inviteResult.inviteId) {
          Alert.alert('Error', 'Failed to create invite. Please try again.');
          setIsSubmitting(false);
          return;
        }

        // Add new tenant
        await addTenant({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          propertyId: formData.propertyId,
          unitId: formData.unitId || undefined,
          unitName: unitName || undefined,
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
          rentAmount: formData.rentAmount ? parseFloat(formData.rentAmount) : undefined,
          photo: photoUrl || undefined,
        }, user?.id);

        // Force refresh property store to show new tenant immediately
        await usePropertyStore.getState().loadFromSupabase(user?.id!, true);
        console.log('🔄 Property store force refreshed after tenant addition');

        // Show success message - tenant is always auto-activated when added via this form
        const successMessage = inviteResult.notificationQueued
          ? 'Tenant has been assigned to the property. They can now view their property details in the app.'
          : 'Tenant has been assigned to the property and will receive an email confirmation.';
        
        Alert.alert('Success', successMessage, [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back and trigger refresh
              router.back();
            }
          }
        ]);
        return;
      }
      
      // Edit mode - no success alert, just navigate back
      setTimeout(() => {
        router.back();
      }, 100);
    } catch (error) {
      console.error('Error saving tenant:', error);
      Alert.alert('Error', 'Failed to save tenant. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build property options
  const propertyOptions = properties.map(p => ({
    id: p.id,
    label: `${p.address1 || 'Unknown'}, ${p.city}`,
    type: p.propertyType,
  }));

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          {isEditing ? 'Edit Tenant' : 'New Tenant'}
        </ThemedText>
        <View style={{ width: 24 }} />
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
          {/* Photo Upload */}
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={pickImage} style={styles.photoContainer}>
              {formData.photo ? (
                <Image source={{ uri: formData.photo }} style={styles.photo} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: isDark ? '#374151' : '#e5e7eb', borderColor }]}>
                  <MaterialCommunityIcons name="camera-plus" size={48} color={secondaryTextColor} />
                </View>
              )}
            </TouchableOpacity>
            <ThemedText style={[styles.photoLabel, { color: secondaryTextColor }]}>
              Upload Photo (Optional)
            </ThemedText>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* First Name and Last Name */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: textColor }]}>First Name *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="Enter first name"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.firstName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, firstName: text }))}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: textColor }]}>Last Name *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="Enter last name"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.lastName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, lastName: text }))}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>Email *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Enter email address"
                placeholderTextColor={secondaryTextColor}
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>Phone</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Enter phone number"
                placeholderTextColor={secondaryTextColor}
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />
            </View>

            {/* Separator */}
            <View style={[styles.separator, { backgroundColor: borderColor }]} />

            {/* CASCADING PROPERTY SELECTION */}
            
            {/* Property Selection */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>Property Address *</ThemedText>
              <TouchableOpacity
                style={[styles.select, { backgroundColor: inputBgColor, borderColor }]}
                onPress={() => {
                  setShowPropertyDropdown(!showPropertyDropdown);
                  setShowUnitDropdown(false);
                  setShowSubUnitDropdown(false);
                }}
              >
                <ThemedText style={[styles.selectText, { color: formData.propertyId ? textColor : secondaryTextColor }]}>
                  {selectedProperty 
                    ? `${selectedProperty.address1}, ${selectedProperty.city}` 
                    : 'Select a property'}
                </ThemedText>
                <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
              </TouchableOpacity>
              {showPropertyDropdown && (
                <View style={[styles.dropdown, { backgroundColor: cardBgColor, borderColor }]}>
                  {propertyOptions.length === 0 ? (
                    <View style={[styles.dropdownItem, { borderBottomWidth: 0 }]}>
                      <ThemedText style={[styles.dropdownItemText, { color: secondaryTextColor }]}>
                        No properties available. Add a property first.
                      </ThemedText>
                    </View>
                  ) : (
                    propertyOptions.map((option, index) => (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.dropdownItem, 
                          { borderBottomColor: borderColor },
                          index === propertyOptions.length - 1 && { borderBottomWidth: 0 }
                        ]}
                        onPress={() => handlePropertyChange(option.id)}
                      >
                        <View style={styles.dropdownItemContent}>
                          <ThemedText style={[styles.dropdownItemText, { color: textColor }]}>
                            {option.label}
                          </ThemedText>
                          <View style={[styles.propertyTypeBadge, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
                            <ThemedText style={[styles.propertyTypeText, { color: secondaryTextColor }]}>
                              {option.type === 'single_unit' ? 'Single' : 'Multi'}
                            </ThemedText>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>

            {/* Unit Selection (only for multi-unit properties) */}
            {selectedProperty?.propertyType === 'multi_unit' && availableUnits.length > 0 && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>Select Unit *</ThemedText>
                <TouchableOpacity
                  style={[styles.select, { backgroundColor: inputBgColor, borderColor }]}
                  onPress={() => {
                    setShowUnitDropdown(!showUnitDropdown);
                    setShowPropertyDropdown(false);
                    setShowSubUnitDropdown(false);
                  }}
                >
                  <ThemedText style={[styles.selectText, { color: formData.unitId ? textColor : secondaryTextColor }]}>
                    {selectedUnit ? selectedUnit.name : 'Select a unit'}
                  </ThemedText>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
                </TouchableOpacity>
                {showUnitDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: cardBgColor, borderColor }]}>
                    {availableUnits.map((unit, index) => (
                      <TouchableOpacity
                        key={unit.id}
                        style={[
                          styles.dropdownItem, 
                          { borderBottomColor: borderColor },
                          index === availableUnits.length - 1 && { borderBottomWidth: 0 }
                        ]}
                        onPress={() => handleUnitChange(unit.id)}
                      >
                        <View style={styles.dropdownItemContent}>
                          <View>
                            <ThemedText style={[styles.dropdownItemText, { color: textColor }]}>
                              {unit.name}
                            </ThemedText>
                            {unit.bedrooms && (
                              <ThemedText style={[styles.dropdownItemSubtext, { color: secondaryTextColor }]}>
                                {unit.bedrooms} bed • {unit.bathrooms || 1} bath
                              </ThemedText>
                            )}
                          </View>
                          <View style={[styles.propertyTypeBadge, { backgroundColor: unit.rentEntireUnit ? '#dcfce7' : '#fef3c7' }]}>
                            <ThemedText style={[styles.propertyTypeText, { color: unit.rentEntireUnit ? '#166534' : '#92400e' }]}>
                              {unit.rentEntireUnit ? 'Entire Unit' : 'By Room'}
                            </ThemedText>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Sub-Unit/Room Selection (only if unit is rented by room) */}
            {selectedUnit && (!selectedUnit.rentEntireUnit || isByRoomProperty) && availableSubUnits.length > 0 && (
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: textColor }]}>Select Room *</ThemedText>
                <TouchableOpacity
                  style={[styles.select, { backgroundColor: inputBgColor, borderColor }]}
                  onPress={() => {
                    setShowSubUnitDropdown(!showSubUnitDropdown);
                    setShowPropertyDropdown(false);
                    setShowUnitDropdown(false);
                  }}
                >
                  <ThemedText style={[styles.selectText, { color: formData.subUnitId ? textColor : secondaryTextColor }]}>
                    {selectedSubUnit ? selectedSubUnit.name : 'Select a room'}
                  </ThemedText>
                  <MaterialCommunityIcons name="chevron-down" size={20} color={secondaryTextColor} />
                </TouchableOpacity>
                {showSubUnitDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: cardBgColor, borderColor }]}>
                    {availableSubUnits.map((subUnit, index) => (
                      <TouchableOpacity
                        key={subUnit.id}
                        style={[
                          styles.dropdownItem, 
                          { borderBottomColor: borderColor },
                          index === availableSubUnits.length - 1 && { borderBottomWidth: 0 }
                        ]}
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

            {/* Info Box showing what's selected */}
            {rentalInfo && rentalInfo.type !== 'select_unit' && rentalInfo.type !== 'select_room' && (
              <View style={[styles.infoBox, { backgroundColor: infoBgColor }]}>
                <MaterialCommunityIcons name="information-outline" size={20} color={infoTextColor} />
                <View style={styles.infoContent}>
                  <ThemedText style={[styles.infoTitle, { color: infoTextColor }]}>
                    Assigning to: {rentalInfo.name}
                  </ThemedText>
                  {rentalInfo.rent && (
                    <ThemedText style={[styles.infoText, { color: infoTextColor }]}>
                      Monthly Rent: ${rentalInfo.rent}
                    </ThemedText>
                  )}
                </View>
              </View>
            )}

            {/* Separator */}
            <View style={[styles.separator, { backgroundColor: borderColor }]} />

            {/* Start Date and End Date */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: textColor }]}>Lease Start</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.startDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, startDate: text }))}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <ThemedText style={[styles.label, { color: textColor }]}>Lease End</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.endDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, endDate: text }))}
                />
              </View>
            </View>

            {/* Rent Amount */}
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>Rent Amount</ThemedText>
              <View style={styles.currencyInput}>
                <MaterialCommunityIcons name="currency-usd" size={20} color={secondaryTextColor} style={styles.currencyIcon} />
                <TextInput
                  style={[styles.input, styles.inputWithCurrency, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={secondaryTextColor}
                  value={formData.rentAmount}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, rentAmount: text }))}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Submit Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: borderColor, backgroundColor: isDark ? bgColor : 'rgba(246, 247, 248, 0.95)' }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: primaryColor, opacity: isSubmitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color="#fff" />
              <ThemedText style={styles.submitButtonText}>Saving...</ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.submitButtonText}>
              {isEditing ? 'Save Changes' : 'Add Tenant'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      <Modal visible={isSubmitting} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: cardBgColor }]}>
            <ActivityIndicator size="large" color={primaryColor} />
            <ThemedText style={[styles.loadingText, { color: textColor }]}>
              Saving tenant...
            </ThemedText>
            <ThemedText style={[styles.loadingSubtext, { color: secondaryTextColor }]}>
              {formData.photo ? 'Uploading photo...' : 'Please wait'}
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
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  photoContainer: {
    marginBottom: 12,
  },
  photo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: '#fff',
  },
  photoPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  formSection: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  select: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    flex: 1,
  },
  dropdown: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 250,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 16,
  },
  dropdownItemSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  propertyTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  propertyTypeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 13,
    marginTop: 2,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  currencyIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  inputWithCurrency: {
    flex: 1,
    paddingLeft: 48,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
