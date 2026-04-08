import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useMaintenanceStore } from '@/store/maintenanceStore';
import { useAuth } from '@/hooks/use-auth';
import { StatusChip } from '@/components/maintenance/StatusChip';
import { VendorList, Vendor } from '@/components/maintenance/VendorList';
import { canApprove, canChangeStatus, canAssignVendor, canAddResolutionNotes } from '@/lib/maintenancePermissions';
import type { MaintenanceCreatorRole } from '@/lib/maintenancePermissions';

const vendorOptions: Vendor[] = [
  { id: 'vendor-1', name: 'FlowPro Plumbing', specialty: 'Plumbing', rating: 4.9, eta: '2-4 hrs' },
  { id: 'vendor-2', name: 'BrightSpark Electric', specialty: 'Electrical', rating: 4.7, eta: 'Same day' },
  { id: 'vendor-3', name: 'ClimateCare HVAC', specialty: 'HVAC', rating: 4.8, eta: 'Next business day' },
];

const statusActions = [
  { label: 'Under Review', value: 'under_review' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Waiting Vendor', value: 'waiting_vendor' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function LandlordMaintenanceRequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { requests, updateRequestStatus, assignVendor, addResolutionNotes } = useMaintenanceStore();

  const request = useMemo(() => requests.find((r) => r.id === id) ?? requests[0], [requests, id]);

  const [notes, setNotes] = useState(request?.resolutionNotes ?? '');
  const [selectedVendor, setSelectedVendor] = useState<string | undefined>(request?.vendor);
  const [saving, setSaving] = useState(false);

  // Derive caller role from auth user
  const callerRole: MaintenanceCreatorRole =
    (user?.role as MaintenanceCreatorRole) ?? 'landlord';

  const permitted = {
    approve: canApprove(callerRole),
    changeStatus: canChangeStatus(callerRole),
    assignVendor: canAssignVendor(callerRole),
    addNotes: canAddResolutionNotes(callerRole),
  };

  const handleStatusChange = async (status: string) => {
    if (!permitted.changeStatus) {
      Alert.alert('Permission Denied', 'You are not allowed to change the request status.');
      return;
    }
    const actor = callerRole === 'manager' ? 'manager' : 'landlord';
    const success = await updateRequestStatus(request.id, status as any, actor, callerRole);
    if (success) {
      Alert.alert('Updated', `Status changed to ${status.replace(/_/g, ' ')}.`);
    } else {
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  const handleAssignVendor = async (vendorId: string) => {
    if (!permitted.assignVendor) {
      Alert.alert('Permission Denied', 'You are not allowed to assign vendors.');
      return;
    }
    setSelectedVendor(vendorId);
    const vendor = vendorOptions.find((v) => v.id === vendorId);
    if (vendor) {
      const success = await assignVendor(request.id, vendor.name, callerRole);
      if (!success) {
        Alert.alert('Error', 'Failed to assign vendor. Please try again.');
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!permitted.addNotes) {
      Alert.alert('Permission Denied', 'You are not allowed to add resolution notes.');
      return;
    }
    setSaving(true);
    const success = await addResolutionNotes(request.id, notes, callerRole);
    setSaving(false);
    if (success) {
      Alert.alert('Notes Saved', 'Resolution notes updated.');
    } else {
      Alert.alert('Error', 'Failed to save notes. Please try again.');
    }
  };

  const handleAddExpense = () => {
    router.push({
      pathname: '/add-transaction',
      params: {
        type: 'expense',
        category: 'maintenance',
        description: `Maintenance: ${request.title}`,
        maintenanceRequestId: request.id,
        propertyId: request.propertyId, // Fixed: was request.property (the name)
      },
    });
  };

  const handleAcceptRequest = async () => {
    if (!permitted.approve) {
      Alert.alert('Permission Denied', 'You are not allowed to approve requests.');
      return;
    }
    Alert.alert('Accept Request', 'Accept this maintenance request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          const actor = callerRole === 'manager' ? 'manager' : 'landlord';
          const success = await updateRequestStatus(request.id, 'in_progress', actor, callerRole);
          if (success) {
            Alert.alert('Accepted', 'The maintenance request has been accepted.');
          } else {
            Alert.alert('Error', 'Failed to accept request.');
          }
        },
      },
    ]);
  };

  const handleRejectRequest = async () => {
    if (!permitted.approve) {
      Alert.alert('Permission Denied', 'You are not allowed to reject requests.');
      return;
    }
    Alert.alert('Reject Request', 'Are you sure you want to reject this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          const actor = callerRole === 'manager' ? 'manager' : 'landlord';
          const success = await updateRequestStatus(request.id, 'cancelled', actor, callerRole);
          if (success) {
            Alert.alert('Rejected', 'The maintenance request has been cancelled.');
            router.back();
          } else {
            Alert.alert('Error', 'Failed to reject request.');
          }
        },
      },
    ]);
  };

  if (!request) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Request not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Request Info */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{request.title}</Text>
              <Text style={styles.subtitle}>
                {request.property} • {request.unit}
              </Text>
              <Text style={styles.tenant}>Tenant: {request.tenantName}</Text>
              {request.createdByRole !== 'tenant' && (
                <View style={styles.creatorBadge}>
                  <MaterialCommunityIcons name="account-hard-hat" size={13} color="#7c3aed" />
                  <Text style={styles.creatorBadgeText}>
                    Created by {request.createdByRole}
                  </Text>
                </View>
              )}
            </View>
            <StatusChip status={request.status} />
          </View>
          <Text style={styles.description}>{request.description}</Text>
        </View>

        {/* Accept / Reject — only for new/under_review and permitted roles */}
        {permitted.approve && (request.status === 'new' || request.status === 'under_review') && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptRequest}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
              <Text style={styles.acceptButtonText}>Accept Request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectButton} onPress={handleRejectRequest}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#ef4444" />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Add Expense */}
        {(request.status === 'in_progress' ||
          request.status === 'waiting_vendor' ||
          request.status === 'resolved') && (
          <TouchableOpacity style={styles.expenseButton} onPress={handleAddExpense}>
            <MaterialCommunityIcons name="receipt-text" size={20} color="#2563eb" />
            <Text style={styles.expenseButtonText}>Add Expense / Upload Invoice</Text>
          </TouchableOpacity>
        )}

        {/* Manage Status */}
        {permitted.changeStatus && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Manage Status</Text>
            <View style={styles.statusGrid}>
              {statusActions.map((action) => {
                const active = request.status === action.value;
                return (
                  <TouchableOpacity
                    key={action.value}
                    style={[styles.statusButton, active && styles.statusButtonActive]}
                    onPress={() => handleStatusChange(action.value)}>
                    <Text style={[styles.statusText, active && { color: '#fff' }]}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Assign Vendor */}
        {permitted.assignVendor && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Assign Vendor</Text>
            <VendorList
              vendors={vendorOptions}
              selectedVendor={selectedVendor}
              onSelect={handleAssignVendor}
            />
          </View>
        )}

        {/* Resolution Notes */}
        {permitted.addNotes && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Resolution Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes about the repair, parts ordered, follow-up etc."
              multiline
              value={notes}
              onChangeText={setNotes}
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveNotes}
              disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Notes'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Activity Log */}
        {request.activity.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Activity</Text>
            {request.activity.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <MaterialCommunityIcons name="checkbox-blank-circle" size={8} color="#2563eb" style={{ marginTop: 5 }} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.activityMessage}>{item.message}</Text>
                  <Text style={styles.activityMeta}>
                    {new Date(item.timestamp).toLocaleString()} · {item.actor}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 16, color: '#64748b', textAlign: 'center' },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { color: '#475569', fontWeight: '600', marginTop: 2 },
  tenant: { color: '#64748b', fontSize: 13, marginTop: 2 },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#f3e8ff',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  creatorBadgeText: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },
  description: { color: '#475569', fontSize: 14 },
  actionButtonsContainer: { flexDirection: 'row', gap: 12 },
  acceptButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rejectButtonText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  expenseButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  expenseButtonText: { color: '#2563eb', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  statusText: { fontWeight: '600', color: '#1e293b' },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#0f172a',
  },
  saveButton: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start' },
  activityMessage: { fontSize: 14, color: '#111827' },
  activityMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
});
