/**
 * landlord-maintenance-create.tsx
 * Create a maintenance request as a landlord or manager.
 * Allows selecting tenant + property + unit manually.
 */
import React, { useEffect, useState } from 'react';
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

import { useMaintenanceStore } from '@/store/maintenanceStore';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { FormInput } from '@/components/maintenance/FormInput';
import { CategoryDropdown } from '@/components/maintenance/CategoryDropdown';
import { UploadButton, UploadedFile } from '@/components/maintenance/UploadButton';
import { FilePreview } from '@/components/maintenance/FilePreview';
import { ProgressHeader } from '@/components/maintenance/ProgressHeader';
import type { MaintenanceCreatorRole } from '@/lib/maintenancePermissions';

const categoryOptions = [
  { label: 'Plumbing', value: 'plumbing', icon: 'water-pump' },
  { label: 'Electrical', value: 'electrical', icon: 'flash' },
  { label: 'HVAC', value: 'hvac', icon: 'air-conditioner' },
  { label: 'Appliance', value: 'appliance', icon: 'fridge' },
  { label: 'General Repair', value: 'general', icon: 'wrench' },
];

const urgencyLevels = [
  { label: 'Low', value: 'low', icon: 'arrow-down' },
  { label: 'Medium', value: 'medium', icon: 'alert' },
  { label: 'High', value: 'high', icon: 'arrow-up' },
  { label: 'Emergency', value: 'emergency', icon: 'medical-bag' },
];

interface TenantOption {
  id: string;          // tenants.id — used for display/selection
  profileId?: string;  // profiles.id — required for maintenance_requests.tenant_id FK
  label: string;
  email?: string;
  propertyId: string;
  landlordId: string;
  unitId?: string;
  subUnitId?: string;
  propertyAddress: string;
  unitName?: string;
}

export default function LandlordMaintenanceCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRequest } = useMaintenanceStore();
  const { user } = useAuth();

  const callerRole: MaintenanceCreatorRole =
    (user?.role as MaintenanceCreatorRole) ?? 'landlord';

  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'emergency'>('low');
  const [availabilityDate, setAvailabilityDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [permissionToEnter, setPermissionToEnter] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  // Load tenants linked to this landlord's properties.
  // Fix: PostgREST does not support .eq() on joined table columns.
  // Instead: fetch the landlord's property IDs first, then query
  // tenant_property_links using .in() on those IDs.
  useEffect(() => {
    async function loadTenants() {
      if (!user?.id) { setLoadingTenants(false); return; }
      try {
        // Step 1: get all property IDs owned by this landlord
        const { data: ownedProps, error: propErr } = await supabase
          .from('properties')
          .select('id, address1, city, state, zip_code')
          .eq('user_id', user.id);

        if (propErr || !ownedProps || ownedProps.length === 0) {
          setLoadingTenants(false);
          return;
        }

        const propIds = ownedProps.map((p: any) => p.id);
        const propMap: Record<string, any> = {};
        ownedProps.forEach((p: any) => { propMap[p.id] = p; });

        // Step 2: get active tenant_property_links for those properties
        const { data: links, error: linkErr } = await supabase
          .from('tenant_property_links')
          .select('tenant_id, property_id, unit_id, sub_unit_id, status')
          .in('property_id', propIds)
          .eq('status', 'active');

        if (linkErr || !links || links.length === 0) {
          setLoadingTenants(false);
          return;
        }

        // Step 3: fetch tenant names from tenants table
        // tenant_property_links.tenant_id references tenants.id (not profiles.id)
        const tenantIds = [...new Set(links.map((l: any) => l.tenant_id))];
        const { data: tenantRows } = await supabase
          .from('tenants')
          .select('id, first_name, last_name, email')
          .in('id', tenantIds);

        const tenantMap: Record<string, any> = {};
        (tenantRows || []).forEach((t: any) => { tenantMap[t.id] = t; });

        // Step 3b: fetch profiles.id by email so we can use it for the FK
        const tenantEmails = (tenantRows || []).map((t: any) => t.email).filter(Boolean);
        const { data: profileRows } = tenantEmails.length > 0
          ? await supabase.from('profiles').select('id, email').in('email', tenantEmails)
          : { data: [] };

        const profileIdByEmail: Record<string, string> = {};
        (profileRows || []).forEach((p: any) => {
          if (p.email) profileIdByEmail[p.email] = p.id;
        });

        // Step 4: fetch unit/subunit names in parallel
        const unitIds = [...new Set(links.map((l: any) => l.unit_id).filter(Boolean))];
        const subUnitIds = [...new Set(links.map((l: any) => l.sub_unit_id).filter(Boolean))];

        const [{ data: unitsData }, { data: subUnitsData }] = await Promise.all([
          unitIds.length > 0
            ? supabase.from('units').select('id, name').in('id', unitIds)
            : Promise.resolve({ data: [] }),
          subUnitIds.length > 0
            ? supabase.from('sub_units').select('id, name').in('id', subUnitIds)
            : Promise.resolve({ data: [] }),
        ]);

        const unitMap: Record<string, string> = {};
        (unitsData || []).forEach((u: any) => { unitMap[u.id] = u.name; });
        const subUnitMap: Record<string, string> = {};
        (subUnitsData || []).forEach((s: any) => { subUnitMap[s.id] = s.name; });

        // Step 5: build options using tenants table for names
        const options: TenantOption[] = links.map((link: any) => {
          const property = propMap[link.property_id] || {};
          const tenant = tenantMap[link.tenant_id] || {};
          const addressParts = [property.address1, property.city, property.state].filter(Boolean);
          const propertyAddress = addressParts.join(', ') || 'Unknown property';

          const unitName = link.sub_unit_id
            ? subUnitMap[link.sub_unit_id]
            : link.unit_id
            ? unitMap[link.unit_id]
            : undefined;

          const firstName = (tenant.first_name || '').trim();
          const lastName = (tenant.last_name || '').trim();
          const displayName = [firstName, lastName].filter(Boolean).join(' ') || tenant.email || link.tenant_id;

          return {
            id: link.tenant_id,
            profileId: tenant.email ? profileIdByEmail[tenant.email] : undefined,
            email: tenant.email,
            label: displayName,
            propertyId: link.property_id,
            landlordId: user.id,
            unitId: link.unit_id || undefined,
            subUnitId: link.sub_unit_id || undefined,
            propertyAddress,
            unitName,
          };
        });

        setTenants(options);
      } catch (err) {
        console.error('Error loading tenants:', err);
      } finally {
        setLoadingTenants(false);
      }
    }
    loadTenants();
  }, [user?.id]);

  const handleUpload = (file: UploadedFile) => setAttachments((prev) => [...prev, file]);
  const handleRemoveFile = (uri: string) =>
    setAttachments((prev) => prev.filter((f) => f.uri !== uri));

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Details', 'Please add a title and description.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }
    if (!selectedTenant) {
      Alert.alert('Missing Tenant', 'Please select a tenant for this request.');
      return;
    }

    setSubmitting(true);
    try {
      // Use profileId for the FK constraint (maintenance_requests.tenant_id → profiles.id)
      // Fall back to selectedTenant.id if no profile found (edge case)
      const tenantProfileId = selectedTenant.profileId || selectedTenant.id;

      if (!selectedTenant.profileId) {
        Alert.alert(
          'Tenant Not Found',
          'This tenant does not have a Aaralink account yet. They need to accept their invite before a maintenance request can be logged.'
        );
        setSubmitting(false);
        return;
      }

      const id = await addRequest(
        {
          tenantId: tenantProfileId,
          landlordId: selectedTenant.landlordId || user.id,
          propertyId: selectedTenant.propertyId,
          unitId: selectedTenant.unitId,
          subUnitId: selectedTenant.subUnitId,
          createdById: user.id,
          createdByRole: callerRole,
          tenantName: selectedTenant.label,
          property: selectedTenant.propertyAddress,
          unit: selectedTenant.unitName || 'N/A',
          category: category as any,
          title,
          description,
          urgency,
          availability: availabilityDate.toISOString(),
          permissionToEnter,
          attachments: attachments.map((a) => ({
            uri: a.uri,
            type: a.mimeType || 'application/octet-stream',
          })),
        },
        callerRole
      );

      if (!id) {
        Alert.alert('Submission Failed', 'Could not create maintenance request. Please try again.');
        return;
      }

      Alert.alert('Request Created', 'Maintenance request has been logged successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTenants) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: '#64748b', marginTop: 12 }}>Loading tenants…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>New Maintenance Request</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ProgressHeader
          title="Log a maintenance issue"
          subtitle="You are creating this request on behalf of a tenant."
          step={1}
          totalSteps={1}
        />

        <View style={styles.card}>
          {/* Tenant dropdown */}
          <FormInput label="Tenant" description="Select the tenant this request is for">
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => tenants.length > 0 && setTenantDropdownOpen(true)}
              activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                {selectedTenant ? (
                  <>
                    <Text style={styles.dropdownSelectedName}>{selectedTenant.label}</Text>
                    <Text style={styles.dropdownSelectedSub}>
                      {selectedTenant.propertyAddress}
                      {selectedTenant.unitName ? ` · ${selectedTenant.unitName}` : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.dropdownPlaceholder}>
                    {tenants.length === 0 ? 'No active tenants found' : 'Select a tenant…'}
                  </Text>
                )}
              </View>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#64748b" />
            </TouchableOpacity>
          </FormInput>

          <FormInput label="Category">
            <CategoryDropdown value={category} onSelect={setCategory} options={categoryOptions} />
          </FormInput>

          <FormInput label="Title" description="Short summary of the issue">
            <TextInput
              style={styles.input}
              placeholder="E.g., Broken heater in bedroom"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#94a3b8"
            />
          </FormInput>

          <FormInput label="Description">
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the issue in detail"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
            />
          </FormInput>

          <FormInput label="Urgency">
            <View style={styles.urgencyRow}>
              {urgencyLevels.map((level) => {
                const active = urgency === level.value;
                return (
                  <TouchableOpacity
                    key={level.value}
                    style={[styles.urgencyCard, active && styles.urgencyActive]}
                    onPress={() => setUrgency(level.value as any)}>
                    <MaterialCommunityIcons
                      name={level.icon as any}
                      size={20}
                      color={active ? '#fff' : '#2563eb'}
                    />
                    <Text style={[styles.urgencyLabel, active && { color: '#fff' }]}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormInput>

          <FormInput label="Availability" description="When can maintenance access the unit?">
            <TouchableOpacity
              style={styles.availabilityButton}
              onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar-clock" size={20} color="#2563eb" />
              <Text style={styles.availabilityText}>
                {availabilityDate.toLocaleString()}
              </Text>
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

          <FormInput label="Photos / Video" description="Optional, up to 5 MB each.">
            <UploadButton onUpload={handleUpload} />
            <FilePreview files={attachments} onRemove={handleRemoveFile} />
          </FormInput>

          <View style={styles.permissionCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.permissionTitle}>Permission to Enter</Text>
              <Text style={styles.permissionDescription}>
                Maintenance may enter if tenant is not home.
              </Text>
            </View>
            <Switch
              value={permissionToEnter}
              onValueChange={setPermissionToEnter}
              trackColor={{ false: '#CBD5F5', true: '#2563eb' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}>
          <Text style={styles.submitText}>
            {submitting ? 'Submitting…' : 'Create Request'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tenant picker modal */}
      <Modal
        visible={tenantDropdownOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTenantDropdownOpen(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTenantDropdownOpen(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Tenant</Text>
            <FlatList
              data={tenants}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const active = selectedTenant?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, active && styles.modalItemActive]}
                    onPress={() => {
                      setSelectedTenant(item);
                      setTenantDropdownOpen(false);
                    }}>
                    <View style={styles.modalItemAvatar}>
                      <Text style={styles.modalItemAvatarText}>
                        {item.label.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalItemName, active && { color: '#2563eb' }]}>
                        {item.label}
                      </Text>
                      <Text style={styles.modalItemSub}>
                        {item.propertyAddress}
                        {item.unitName ? ` · ${item.unitName}` : ''}
                      </Text>
                    </View>
                    {active && (
                      <MaterialCommunityIcons name="check-circle" size={20} color="#2563eb" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconPlaceholder: { width: 40 },
  appBarTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, gap: 12 },
  // Tenant dropdown trigger
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  dropdownPlaceholder: { fontSize: 15, color: '#94a3b8' },
  dropdownSelectedName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  dropdownSelectedSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  // Tenant picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  separator: { height: 1, backgroundColor: '#f1f5f9' },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  modalItemActive: { backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8 },
  modalItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemAvatarText: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  modalItemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  modalItemSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#111827',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  urgencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  urgencyCard: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
  },
  urgencyActive: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  urgencyLabel: { fontWeight: '600', color: '#2563eb' },
  availabilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
  },
  availabilityText: { fontWeight: '600', color: '#111827' },
  permissionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  permissionDescription: { fontSize: 13, color: '#475569' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
