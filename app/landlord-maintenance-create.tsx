/**
 * landlord-maintenance-create.tsx
 * Create a maintenance request as a landlord or manager.
 * Address selection uses PropertyAddressSelector (property → unit → sub-unit steps).
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { fmtDateTime } from '@/lib/dateUtils';
import { usePropertyStore } from '@/store/propertyStore';
import PropertyAddressSelector, { SelectedPropertyData } from '@/components/PropertyAddressSelector';
import { FormInput } from '@/components/maintenance/FormInput';
import { CategoryDropdown } from '@/components/maintenance/CategoryDropdown';
import { UploadButton, UploadedFile } from '@/components/maintenance/UploadButton';
import { FilePreview } from '@/components/maintenance/FilePreview';
import { ProgressHeader } from '@/components/maintenance/ProgressHeader';
import type { MaintenanceCreatorRole } from '@/lib/maintenancePermissions';
import { useAppTheme } from '@/hooks/use-app-theme';

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

interface SelectedAddress {
  displayLabel: string;
  propertyId: string;
  propertyAddress: string;
  unitId?: string;
  subUnitId?: string;
  unitName?: string;
}

export default function LandlordMaintenanceCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addRequest } = useMaintenanceStore();
  const { user } = useAuth();
  const { loadFromSupabase: loadProperties } = usePropertyStore();
  const t = useAppTheme();

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

  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);

  // Load property store so PropertyAddressSelector has data
  useEffect(() => {
    if (user?.id) loadProperties(user.id);
  }, [user?.id]);

  const handleAddressSelect = (data: SelectedPropertyData) => {
    const addressParts = [
      data.property.address1,
      data.property.city,
      data.property.state,
    ].filter(Boolean);
    const propertyAddress = addressParts.join(', ') || data.property.name || 'Property';

    let unitName: string | undefined;
    let displayLabel: string;

    if (data.subUnit) {
      const u = data.unit?.name || '';
      const s = data.subUnit.name || '';
      unitName = [u, s].filter(Boolean).join(' · ');
      displayLabel = `${propertyAddress} · ${unitName}`;
    } else if (data.unit) {
      unitName = data.unit.name;
      displayLabel = `${propertyAddress} · ${unitName}`;
    } else {
      displayLabel = `${propertyAddress} · Main Address`;
    }

    setSelectedAddress({
      displayLabel,
      propertyId: data.property.id,
      propertyAddress,
      unitId: data.unit?.id,
      subUnitId: data.subUnit?.id,
      unitName,
    });
  };

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
    if (!selectedAddress) {
      Alert.alert('Missing Address', 'Please select an address for this request.');
      return;
    }

    setSubmitting(true);
    try {
      const id = await addRequest(
        {
          tenantId: user.id, // landlord is the reporter for property-initiated requests
          landlordId: user.id,
          propertyId: selectedAddress.propertyId,
          unitId: selectedAddress.unitId,
          subUnitId: selectedAddress.subUnitId,
          createdById: user.id,
          createdByRole: callerRole,
          tenantName: 'N/A',
          property: selectedAddress.propertyAddress,
          unit: selectedAddress.unitName || 'N/A',
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

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.appBarTitle, { color: t.text }]}>New Maintenance Request</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ProgressHeader
          title="Log a maintenance issue"
          subtitle="Select the address and describe the issue."
          step={1}
          totalSteps={1}
        />

        {/* Address — step-by-step: property → unit → sub-unit */}
        <View style={styles.addressGroup}>
          <Text style={[styles.addressLabel, { color: t.textSecondary }]}>ADDRESS</Text>
          <PropertyAddressSelector
            onSelect={handleAddressSelect}
            selectedPropertyId={selectedAddress?.propertyId}
            selectedUnitId={selectedAddress?.unitId}
            selectedSubUnitId={selectedAddress?.subUnitId}
            label=""
            placeholder="Select an address..."
          />
        </View>

        <View style={[styles.card, { backgroundColor: t.card }]}>
          <FormInput label="Category">
            <CategoryDropdown value={category} onSelect={setCategory} options={categoryOptions} />
          </FormInput>

          <FormInput label="Title" description="Short summary of the issue">
            <TextInput
              style={[styles.input, { backgroundColor: t.subtle, borderColor: t.border, color: t.text }]}
              placeholder="E.g., Broken heater in bedroom"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor={t.textSecondary}
            />
          </FormInput>

          <FormInput label="Description">
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: t.subtle, borderColor: t.border, color: t.text }]}
              placeholder="Describe the issue in detail"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={t.textSecondary}
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
                    style={[styles.urgencyCard, { backgroundColor: active ? t.accent : t.card, borderColor: active ? t.accent : t.border }]}
                    onPress={() => setUrgency(level.value as any)}>
                    <MaterialCommunityIcons
                      name={level.icon as any}
                      size={20}
                      color={active ? t.onAccent : t.text}
                    />
                    <Text style={[styles.urgencyLabel, { color: active ? t.onAccent : t.text }]}>
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormInput>

          <FormInput label="Availability" description="When can maintenance access the unit?">
            <TouchableOpacity
              style={[styles.availabilityButton, { borderColor: t.border, backgroundColor: t.subtle }]}
              onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar-clock" size={20} color={t.text} />
              <Text style={[styles.availabilityText, { color: t.text }]}>
                {fmtDateTime(availabilityDate.toISOString())}
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

          <View style={[styles.permissionCard, { backgroundColor: t.subtle }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.permissionTitle, { color: t.text }]}>Permission to Enter</Text>
              <Text style={[styles.permissionDescription, { color: t.textSecondary }]}>
                Maintenance may enter if tenant is not home.
              </Text>
            </View>
            <Switch
              value={permissionToEnter}
              onValueChange={setPermissionToEnter}
              trackColor={{ false: t.chip, true: t.success }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: t.card, borderTopColor: t.border }]}>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: t.accent }, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}>
          <Text style={[styles.submitText, { color: t.onAccent }]}>
            {submitting ? 'Submitting…' : 'Create Request'}
          </Text>
        </TouchableOpacity>
      </View>
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
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
    marginBottom: 4,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  urgencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  urgencyCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  permissionTitle: { fontSize: 15, fontWeight: '600' },
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
  submitButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '700' },
});
