import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useMaintenanceStore } from '@/store/maintenanceStore';
import { StatusChip } from '@/components/maintenance/StatusChip';
import { VendorList, Vendor } from '@/components/maintenance/VendorList';

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
  const { requests, updateRequestStatus, assignVendor, addResolutionNotes } = useMaintenanceStore();
  const request = useMemo(() => requests.find((req) => req.id === id) ?? requests[0], [requests, id]);

  const [notes, setNotes] = useState(request?.resolutionNotes ?? '');
  const [selectedVendor, setSelectedVendor] = useState<string | undefined>(request?.vendor);
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (status: string) => {
    const success = await updateRequestStatus(request.id, status as any);
    if (success) {
      Alert.alert('Updated', `Status changed to ${status.replace('_', ' ')}.`);
    } else {
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  const handleAssignVendor = async (vendorId: string) => {
    setSelectedVendor(vendorId);
    const vendor = vendorOptions.find((v) => v.id === vendorId);
    if (vendor) {
      const success = await assignVendor(request.id, vendor.name);
      if (!success) {
        Alert.alert('Error', 'Failed to assign vendor. Please try again.');
      }
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    const success = await addResolutionNotes(request.id, notes);
    setSaving(false);
    if (success) {
      Alert.alert('Notes Saved', 'Resolution notes updated.');
    } else {
      Alert.alert('Error', 'Failed to save notes. Please try again.');
    }
  };

  const handleAddExpense = () => {
    // Navigate to add transaction/expense page with pre-filled data
    router.push({
      pathname: '/add-transaction',
      params: {
        type: 'expense',
        category: 'maintenance',
        description: `Maintenance: ${request.title}`,
        maintenanceRequestId: request.id,
        propertyId: request.property, // TODO: Get actual property ID
      },
    });
  };

  const handleAcceptRequest = async () => {
    Alert.alert(
      'Accept Request',
      'Do you want to accept this maintenance request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            const success = await updateRequestStatus(request.id, 'in_progress');
            if (success) {
              Alert.alert('Request Accepted', 'The maintenance request has been accepted.');
            } else {
              Alert.alert('Error', 'Failed to accept request.');
            }
          },
        },
      ]
    );
  };

  const handleRejectRequest = async () => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this maintenance request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const success = await updateRequestStatus(request.id, 'cancelled');
            if (success) {
              Alert.alert('Request Rejected', 'The maintenance request has been cancelled.');
              router.back();
            } else {
              Alert.alert('Error', 'Failed to reject request.');
            }
          },
        },
      ]
    );
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
        {/* Request Information */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{request.title}</Text>
              <Text style={styles.subtitle}>
                {request.property} • {request.unit}
              </Text>
              <Text style={styles.tenant}>Tenant: {request.tenantName}</Text>
            </View>
            <StatusChip status={request.status} />
          </View>
          <Text style={styles.description}>{request.description}</Text>
        </View>

        {/* Action Buttons for New/Under Review Requests */}
        {(request.status === 'new' || request.status === 'under_review') && (
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

        {/* Add Expense Button (only show if request is accepted/in progress) */}
        {(request.status === 'in_progress' || request.status === 'waiting_vendor' || request.status === 'resolved') && (
          <TouchableOpacity style={styles.expenseButton} onPress={handleAddExpense}>
            <MaterialCommunityIcons name="receipt-text" size={20} color="#2563eb" />
            <Text style={styles.expenseButtonText}>Add Expense / Upload Invoice</Text>
          </TouchableOpacity>
        )}

        {/* Manage Status */}
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
                  <Text style={[styles.statusText, active && { color: '#fff' }]}>{action.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Assign Vendor */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Assign Vendor</Text>
          <VendorList vendors={vendorOptions} selectedVendor={selectedVendor} onSelect={handleAssignVendor} />
        </View>

        {/* Resolution Notes */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resolution Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add notes about the repair, parts ordered, follow-up etc."
            multiline
            value={notes}
            onChangeText={setNotes}
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveNotes} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Notes'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    color: '#475569',
    fontWeight: '600',
  },
  tenant: {
    color: '#64748b',
    fontSize: 13,
  },
  description: {
    color: '#475569',
    fontSize: 14,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
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
  acceptButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
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
  rejectButtonText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 15,
  },
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
  expenseButtonText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  statusText: {
    fontWeight: '600',
    color: '#1e293b',
  },
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
  saveButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});

