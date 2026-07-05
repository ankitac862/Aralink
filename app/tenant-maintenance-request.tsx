import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/dateUtils';
import { FormInput } from '@/components/maintenance/FormInput';
import { CategoryDropdown } from '@/components/maintenance/CategoryDropdown';
import { UploadButton, UploadedFile } from '@/components/maintenance/UploadButton';
import { FilePreview } from '@/components/maintenance/FilePreview';
import { ProgressHeader } from '@/components/maintenance/ProgressHeader';

const categoryOptions = [
  { label: 'Plumbing', value: 'plumbing', icon: 'water-pump' },
  { label: 'Electrical', value: 'electrical', icon: 'flash' },
  { label: 'HVAC', value: 'hvac', icon: 'air-conditioner' },
  { label: 'Appliance', value: 'appliance', icon: 'fridge' },
  { label: 'WiFi / Internet', value: 'wifi', icon: 'wifi' },
  { label: 'Utilities', value: 'utilities', icon: 'lightning-bolt' },
  { label: 'General Repair', value: 'general', icon: 'wrench' },
  { label: 'Others', value: 'others', icon: 'dots-horizontal' },
];

const urgencyLevels = [
  { label: 'Low', value: 'low', icon: 'arrow-down' },
  { label: 'Medium', value: 'medium', icon: 'alert' },
  { label: 'High', value: 'high', icon: 'arrow-up' },
  { label: 'Emergency', value: 'emergency', icon: 'medical-bag' },
];

interface AddressOption {
  id: string;
  displayLabel: string;
  propertyAddress: string;
  unitName?: string;
  propertyId: string;
  landlordId: string;
  unitId?: string;
  subUnitId?: string;
}

// One entry per unique property — holds all selectable options (main + units)
interface PropertyGroup {
  propertyId: string;
  propertyAddress: string;
  landlordId: string;
  options: AddressOption[]; // [0] = main address, rest = unit/sub-unit options
}

export default function TenantMaintenanceRequestScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRequest } = useMaintenanceStore();
  const { user } = useAuth();

  const [category, setCategory] = useState('plumbing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'emergency'>('low');
  const [availabilityDate, setAvailabilityDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [permissionToEnter, setPermissionToEnter] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Address state
  const [propertyGroups, setPropertyGroups] = useState<PropertyGroup[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressOption | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(true);

  // Modal state — 2 steps: pick property → pick unit
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'property' | 'unit'>('property');
  const [pendingGroup, setPendingGroup] = useState<PropertyGroup | null>(null);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const subText = isDark ? '#9BA1A6' : '#6E7377';
  const border = isDark ? '#26282C' : '#E5E5E7';
  const subtle = isDark ? '#141517' : '#F7F7F8';
  const chipBg = isDark ? '#26282C' : '#E8E8EA';
  const accent = isDark ? '#FFFFFF' : '#111315';
  const onAccent = isDark ? '#0B0B0C' : '#FFFFFF';

  // Load tenant's linked properties, build hierarchical groups
  useEffect(() => {
    async function loadAddresses() {
      if (!user?.id) { setLoadingAddress(false); return; }

      try {
        // Step 1: tenant_property_links.tenant_id = tenants.id, NOT auth user id
        // Find the tenant record first
        const { data: tenantRecords } = await supabase
          .from('tenants')
          .select('id, status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        let tenantIdToUse: string = user.id; // fallback for legacy direct-link records

        if (tenantRecords && tenantRecords.length > 0) {
          const active = tenantRecords.find(t => t.status === 'active') || tenantRecords[0];
          tenantIdToUse = active.id;
        }

        // Step 2: fetch all active property links for this tenant
        let { data: allLinks } = await supabase
          .from('tenant_property_links')
          .select('*')
          .eq('tenant_id', tenantIdToUse)
          .eq('status', 'active');

        // Fallback: if nothing found with tenants.id, try auth user.id directly (legacy)
        if ((!allLinks || allLinks.length === 0) && tenantIdToUse !== user.id) {
          const { data: fallbackLinks } = await supabase
            .from('tenant_property_links')
            .select('*')
            .eq('tenant_id', user.id)
            .eq('status', 'active');
          if (fallbackLinks && fallbackLinks.length > 0) allLinks = fallbackLinks;
        }

        if (!allLinks || allLinks.length === 0) {
          Alert.alert(
            'No Property Found',
            'You need to be associated with a property to submit maintenance requests. Please contact your landlord.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          setLoadingAddress(false);
          return;
        }

        const groupMap = new Map<string, PropertyGroup>();

        for (const link of allLinks) {
          const { data: property } = await supabase
            .from('properties')
            .select('id, name, address1, city, state, zip_code, user_id')
            .eq('id', link.property_id)
            .single();

          if (!property) continue;

          const addressParts = [property.address1, property.city, property.state, property.zip_code].filter(Boolean);
          const propertyAddress = addressParts.length > 0
            ? addressParts.join(', ')
            : (property.name || 'Property');
          const landlordId = property.user_id;

          // Ensure the group exists with a main-address entry
          if (!groupMap.has(property.id)) {
            groupMap.set(property.id, {
              propertyId: property.id,
              propertyAddress,
              landlordId,
              options: [
                {
                  id: `main-${property.id}`,
                  displayLabel: `${propertyAddress} · Main Address`,
                  propertyAddress,
                  propertyId: property.id,
                  landlordId,
                },
              ],
            });
          }

          // Add the specific unit/sub-unit this link points to
          if (link.unit_id || link.sub_unit_id) {
            let unitLabel = '';

            if (link.unit_id) {
              const { data: unit } = await supabase
                .from('units')
                .select('name')
                .eq('id', link.unit_id)
                .maybeSingle();
              if (unit) unitLabel = unit.name;
            }

            if (link.sub_unit_id) {
              const { data: sub } = await supabase
                .from('sub_units')
                .select('name')
                .eq('id', link.sub_unit_id)
                .maybeSingle();
              if (sub) unitLabel = unitLabel ? `${unitLabel} · ${sub.name}` : sub.name;
            }

            const optId = `unit-${property.id}-${link.unit_id || ''}-${link.sub_unit_id || ''}`;
            const group = groupMap.get(property.id)!;

            if (!group.options.some(o => o.id === optId)) {
              group.options.push({
                id: optId,
                displayLabel: `${propertyAddress}${unitLabel ? ` · ${unitLabel}` : ''}`,
                propertyAddress,
                unitName: unitLabel || undefined,
                propertyId: property.id,
                landlordId,
                unitId: link.unit_id || undefined,
                subUnitId: link.sub_unit_id || undefined,
              });
            }
          }
        }

        const groups = [...groupMap.values()];
        setPropertyGroups(groups);

        // Auto-select: if only one property and one option, select it silently
        if (groups.length === 1 && groups[0].options.length === 1) {
          setSelectedAddress(groups[0].options[0]);
        } else if (groups.length === 1) {
          // One property but multiple units — pre-select the most specific unit option
          const best = groups[0].options.find(o => o.unitId || o.subUnitId) || groups[0].options[0];
          setSelectedAddress(best);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', 'Failed to load property information: ' + msg);
      } finally {
        setLoadingAddress(false);
      }
    }

    loadAddresses();
  }, [user]);

  const closeModal = () => {
    setModalOpen(false);
    setModalStep('property');
    setPendingGroup(null);
  };

  const handlePropertySelect = (group: PropertyGroup) => {
    // If only the main address (no specific units) → select immediately
    if (group.options.length === 1) {
      setSelectedAddress(group.options[0]);
      closeModal();
      return;
    }
    // Otherwise proceed to unit step
    setPendingGroup(group);
    setModalStep('unit');
  };

  const handleUnitSelect = (option: AddressOption) => {
    setSelectedAddress(option);
    closeModal();
  };

  const formattedAvailability = useMemo(() => fmtDateTime(availabilityDate.toISOString()), [availabilityDate]);

  const handleUpload = async (file: UploadedFile) => {
    setAttachments(prev => [...prev, file]);
  };

  const handleRemoveFile = (uri: string) => {
    setAttachments(prev => prev.filter(f => f.uri !== uri));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Details', 'Please add a title and description.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to submit a maintenance request.');
      return;
    }
    if (!selectedAddress) {
      Alert.alert('Error', 'Please select an address for this request.');
      return;
    }

    setSubmitting(true);
    try {
      const id = await addRequest({
        tenantId: user.id,
        landlordId: selectedAddress.landlordId,
        propertyId: selectedAddress.propertyId,
        unitId: selectedAddress.unitId,
        subUnitId: selectedAddress.subUnitId,
        tenantName: user.name || user.email || 'Tenant',
        property: selectedAddress.propertyAddress,
        unit: selectedAddress.unitName || 'N/A',
        category: category as any,
        title,
        description,
        urgency,
        availability: availabilityDate.toISOString(),
        permissionToEnter,
        attachments: attachments.map(a => ({ uri: a.uri, type: a.mimeType || 'application/octet-stream' })),
      });

      if (!id) {
        const errorState = useMaintenanceStore.getState().error;
        Alert.alert('Submission Failed', errorState || 'Could not submit request. Please try again.');
        return;
      }

      router.push({ pathname: '/tenant-maintenance-confirmation', params: { id } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', 'Could not submit request: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAddress) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ color: textColor, marginTop: 16, fontSize: 16 }}>Loading property information...</Text>
      </View>
    );
  }

  const allOptions = propertyGroups.flatMap(g => g.options);
  const hasMultipleChoices = allOptions.length > 1;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.appBarTitle, { color: textColor }]}>New Maintenance Request</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ProgressHeader
          title="Tell us about the issue"
          subtitle="Provide as much detail as possible to help the property team resolve it quickly."
          step={1}
          totalSteps={2}
        />

        {/* ADDRESS — always visible, tappable when choices exist */}
        <View style={styles.addressGroup}>
          <Text style={styles.addressLabel}>ADDRESS</Text>
          <TouchableOpacity
            style={[styles.addressSelector, { backgroundColor: cardColor, borderColor: border }]}
            onPress={() => { if (hasMultipleChoices) setModalOpen(true); }}
            activeOpacity={hasMultipleChoices ? 0.7 : 1}>
            <MaterialCommunityIcons name="home-city" size={20} color={subText} />
            <Text
              style={[styles.addressSelectorText, { color: selectedAddress ? textColor : subText }]}
              numberOfLines={1}>
              {selectedAddress ? selectedAddress.displayLabel : 'Select an address…'}
            </Text>
            {hasMultipleChoices && (
              <MaterialCommunityIcons name="chevron-down" size={20} color={subText} />
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: cardColor }]}>
          <FormInput label="Category">
            <CategoryDropdown value={category} onSelect={setCategory} options={categoryOptions} />
          </FormInput>

          <FormInput label="Title" description="Give this request a short title">
            <TextInput
              style={[styles.input, { backgroundColor: subtle, borderColor: border, color: textColor }]}
              placeholder="E.g., Leaky faucet in bathroom"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#94a3b8"
            />
          </FormInput>

          <FormInput label="Describe the issue" description="The more details the better.">
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: subtle, borderColor: border, color: textColor }]}
              placeholder="What happened? When did you notice it? Any previous fixes attempted?"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={5}
            />
          </FormInput>

          <FormInput label="Urgency">
            <View style={styles.urgencyRow}>
              {urgencyLevels.map(level => {
                const active = urgency === level.value;
                return (
                  <TouchableOpacity
                    key={level.value}
                    style={[styles.urgencyCard, { backgroundColor: active ? accent : cardColor, borderColor: active ? accent : border }]}
                    onPress={() => setUrgency(level.value as any)}>
                    <MaterialCommunityIcons name={level.icon as any} size={22} color={active ? onAccent : textColor} />
                    <Text style={[styles.urgencyLabel, { color: active ? onAccent : textColor }]}>{level.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormInput>

          <FormInput label="Availability" description="When can maintenance access the unit?">
            <TouchableOpacity style={[styles.availabilityButton, { borderColor: border, backgroundColor: subtle }]} onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar-clock" size={20} color={textColor} />
              <Text style={[styles.availabilityText, { color: textColor }]}>{formattedAvailability}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={availabilityDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (date) setAvailabilityDate(date);
                }}
              />
            )}
          </FormInput>

          <FormInput label="Add Photos / Video" description="Optional, up to 1 MB each.">
            <UploadButton onUpload={handleUpload} />
            <FilePreview files={attachments} onRemove={handleRemoveFile} />
          </FormInput>

          <View style={[styles.permissionCard, { backgroundColor: subtle }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.permissionTitle, { color: textColor }]}>Permission to Enter</Text>
              <Text style={[styles.permissionDescription, { color: subText }]}>Allow maintenance to enter if I'm not home.</Text>
            </View>
            <Switch
              value={permissionToEnter}
              onValueChange={setPermissionToEnter}
              trackColor={{ false: chipBg, true: isDark ? '#4ADE80' : '#15803D' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: cardColor, borderTopColor: border }]}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Request'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Address picker — stepped: property → unit/sub-unit ── */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}>
        <View style={[styles.modalContainer, { backgroundColor: bgColor }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { backgroundColor: cardColor, borderBottomColor: border }]}>
            {modalStep === 'unit' ? (
              <TouchableOpacity
                style={styles.modalBackBtn}
                onPress={() => { setModalStep('property'); setPendingGroup(null); }}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={textColor} />
              </TouchableOpacity>
            ) : (
              <View style={styles.modalBackBtn} />
            )}
            <Text style={[styles.modalTitle, { color: textColor }]}>
              {modalStep === 'property' ? 'Select Property' : 'Select Unit'}
            </Text>
            <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
              <MaterialCommunityIcons name="close" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Breadcrumb (shown on unit step) */}
          {modalStep === 'unit' && pendingGroup && (
            <View style={[styles.breadcrumb, { backgroundColor: subtle, borderBottomColor: border }]}>
              <MaterialCommunityIcons name="home" size={14} color={subText} />
              <Text style={[styles.breadcrumbText, { color: subText }]} numberOfLines={1}>
                {pendingGroup.propertyAddress}
              </Text>
            </View>
          )}

          {/* Step 1 — properties */}
          {modalStep === 'property' && (
            <FlatList
              data={propertyGroups}
              keyExtractor={g => g.propertyId}
              contentContainerStyle={styles.listContent}
              renderItem={({ item: group }) => (
                <TouchableOpacity
                  style={[styles.listItem, { backgroundColor: cardColor, borderBottomColor: border }]}
                  onPress={() => handlePropertySelect(group)}>
                  <View style={[styles.listItemIcon, { backgroundColor: chipBg }]}>
                    <MaterialCommunityIcons name="home" size={22} color={textColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listItemTitle, { color: textColor }]}>{group.propertyAddress}</Text>
                    <Text style={[styles.listItemSub, { color: subText }]}>
                      {group.options.length - 1 > 0
                        ? `${group.options.length - 1} unit${group.options.length - 1 > 1 ? 's' : ''}`
                        : 'Whole property'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={subText} />
                </TouchableOpacity>
              )}
            />
          )}

          {/* Step 2 — units/sub-units for the chosen property */}
          {modalStep === 'unit' && pendingGroup && (
            <FlatList
              data={pendingGroup.options}
              keyExtractor={o => o.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item: option }) => {
                const isMain = option.id.startsWith('main-');
                const active = selectedAddress?.id === option.id;
                return (
                  <TouchableOpacity
                    style={[styles.listItem, { backgroundColor: cardColor, borderBottomColor: border }]}
                    onPress={() => handleUnitSelect(option)}>
                    <View style={[styles.listItemIcon, { backgroundColor: active ? accent : chipBg }]}>
                      <MaterialCommunityIcons
                        name={isMain ? 'home' : 'door'}
                        size={22}
                        color={active ? onAccent : subText}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listItemTitle, { color: textColor }]}>
                        {isMain ? 'Main Address' : option.unitName || option.displayLabel}
                      </Text>
                      <Text style={[styles.listItemSub, { color: subText }]}>
                        {isMain ? 'Whole property' : option.propertyAddress}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={active ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={22}
                      color={active ? accent : border}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconPlaceholder: { width: 40 },
  appBarTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  card: { borderRadius: 18, padding: 20, gap: 12 },

  // Address selector
  addressGroup: { marginBottom: 0 },
  addressLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  addressSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  addressSelectorText: { flex: 1, fontSize: 16 },

  // Form fields
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  urgencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  urgencyCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urgencyLabel: { fontWeight: '600' },
  availabilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  availabilityText: { fontWeight: '600' },
  permissionCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionTitle: { fontSize: 16, fontWeight: '600' },
  permissionDescription: { fontSize: 13 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  submitButton: { backgroundColor: '#16a34a', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalBackBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalCloseBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  breadcrumbText: { fontSize: 13, flex: 1 },
  listContent: { paddingBottom: 40 },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  listItemSub: { fontSize: 12 },
});
