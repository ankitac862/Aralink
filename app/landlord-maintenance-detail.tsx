import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { canApprove, canChangeStatus, canAssignVendor, canAddResolutionNotes } from '@/lib/maintenancePermissions';
import type { MaintenanceCreatorRole } from '@/lib/maintenancePermissions';
import { VENDORS, VENDOR_CITIES, VENDOR_CATEGORIES, type Vendor } from '@/constants/vendors';

const STATUS_ACTIONS = [
  { label: 'Under Review', value: 'under_review' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Waiting Vendor', value: 'waiting_vendor' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Mark as Resolved', value: 'resolved' },
];

const CATEGORY_ICONS: Record<string, string> = {
  Plumbing: 'water-pump',
  Electrical: 'flash',
  HVAC: 'air-conditioner',
  Cleaning: 'broom',
  'Appliance Repair': 'fridge',
  Painting: 'brush',
  Carpentry: 'hammer',
  Landscaping: 'tree',
  'Pest Control': 'bug',
  'General Repair': 'wrench',
};

// ── Reusable inline dropdown ──────────────────────────────────────────────────
interface DropdownProps {
  label: string;
  placeholder: string;
  value: string | null;
  options: string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (v: string | null) => void;
  required?: boolean;
}

function Dropdown({ label, placeholder, value, options, isOpen, onToggle, onSelect, required }: DropdownProps) {
  return (
    <View style={dd.wrapper}>
      <Text style={dd.label}>
        {label}
        {required && <Text style={{ color: '#ef4444' }}> *</Text>}
      </Text>
      <TouchableOpacity style={[dd.trigger, isOpen && dd.triggerOpen]} onPress={onToggle}>
        <Text style={[dd.triggerText, !value && dd.placeholder]}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#64748b"
        />
      </TouchableOpacity>
      {isOpen && (
        <View style={dd.list}>
          {value && (
            <TouchableOpacity
              style={[dd.item, dd.clearItem]}
              onPress={() => { onSelect(null); onToggle(); }}>
              <MaterialCommunityIcons name="close-circle-outline" size={15} color="#ef4444" />
              <Text style={dd.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[dd.item, value === opt && dd.itemActive]}
              onPress={() => { onSelect(opt); onToggle(); }}>
              <Text style={[dd.itemText, value === opt && dd.itemTextActive]}>{opt}</Text>
              {value === opt && (
                <MaterialCommunityIcons name="check" size={16} color="#2563eb" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const dd = StyleSheet.create({
  wrapper: { gap: 4, zIndex: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#f9fafb',
  },
  triggerOpen: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  triggerText: { fontSize: 14, fontWeight: '500', color: '#0f172a' },
  placeholder: { color: '#94a3b8' },
  list: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginTop: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemActive: { backgroundColor: '#eff6ff' },
  itemText: { fontSize: 14, color: '#0f172a' },
  itemTextActive: { color: '#2563eb', fontWeight: '600' },
  clearItem: { borderBottomWidth: 1, borderBottomColor: '#fee2e2', gap: 6 },
  clearText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function LandlordMaintenanceRequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { requests, updateRequestStatus, assignVendor, addResolutionNotes, addComment, setMarketplaceVendor } = useMaintenanceStore();

  const request = useMemo(() => requests.find((r) => r.id === id) ?? requests[0], [requests, id]);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Resolution modal state
  const [resolutionModalVisible, setResolutionModalVisible] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);

  const [statusChanging, setStatusChanging] = useState(false);

  // Vendor selection modal state
  const [vendorModalVisible, setVendorModalVisible] = useState(false);
  const [filterCity, setFilterCity] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [cityDropOpen, setCityDropOpen] = useState(false);
  const [catDropOpen, setCatDropOpen] = useState(false);
  const [assigningVendor, setAssigningVendor] = useState(false);

  const callerRole: MaintenanceCreatorRole = (user?.role as MaintenanceCreatorRole) ?? 'landlord';

  const permitted = {
    approve: canApprove(callerRole),
    changeStatus: canChangeStatus(callerRole),
    assignVendor: canAssignVendor(callerRole),
    addNotes: canAddResolutionNotes(callerRole),
  };

  const isResolved = request?.status === 'resolved';

  // Filtered vendors for the inline modal
  const filteredVendors = useMemo(() => {
    if (!filterCity) return [];
    return VENDORS.filter((v) => {
      const cityMatch = v.city === filterCity;
      const catMatch = !filterCategory || v.category === filterCategory;
      return cityMatch && catMatch;
    }).sort((a, b) => (b.isSponsored ? 1 : 0) - (a.isSponsored ? 1 : 0));
  }, [filterCity, filterCategory]);

  // Categories available for the selected city
  const availableCategories = useMemo(() => {
    if (!filterCity) return [...VENDOR_CATEGORIES];
    const cats = new Set(VENDORS.filter((v) => v.city === filterCity).map((v) => v.category));
    return VENDOR_CATEGORIES.filter((c) => cats.has(c));
  }, [filterCity]);

  // Activity entries that are NOT comments
  const activityLog = useMemo(
    () => (request?.activity ?? []).filter((a) => a.type !== 'comment'),
    [request?.activity]
  );

  const openVendorModal = () => {
    setFilterCity(null);
    setFilterCategory(null);
    setCityDropOpen(false);
    setCatDropOpen(false);
    setVendorModalVisible(true);
  };

  const handleSelectVendor = async (vendor: Vendor) => {
    if (!request) return;
    setAssigningVendor(true);
    await assignVendor(request.id, vendor.name, callerRole);
    setMarketplaceVendor(request.id, {
      id: vendor.id,
      name: vendor.name,
      phone: vendor.phone,
      email: vendor.email,
      category: vendor.category,
      city: vendor.city,
      address: vendor.address,
    });
    setAssigningVendor(false);
    setVendorModalVisible(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!permitted.changeStatus) {
      Alert.alert('Permission Denied', 'You are not allowed to change the request status.');
      return;
    }
    if (request.status === 'resolved' && status === 'cancelled') {
      Alert.alert('Not Allowed', 'A resolved request cannot be cancelled.');
      return;
    }
    if (status === 'resolved') {
      setResolutionNote('');
      setResolutionModalVisible(true);
      return;
    }
    setStatusChanging(true);
    const actor = callerRole === 'manager' ? 'manager' : 'landlord';
    const success = await updateRequestStatus(request.id, status as any, actor, callerRole);
    setStatusChanging(false);
    if (success) {
      Alert.alert('Updated', `Status changed to ${status.replace(/_/g, ' ')}.`);
    } else {
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  const handleCompleteWithResolution = async () => {
    if (!resolutionNote.trim()) {
      Alert.alert('Required', 'Please enter a resolution note before completing this request.');
      return;
    }
    setSavingResolution(true);
    const actor = callerRole === 'manager' ? 'manager' : 'landlord';
    await addResolutionNotes(request.id, resolutionNote.trim(), callerRole);
    const success = await updateRequestStatus(request.id, 'resolved', actor, callerRole);
    setSavingResolution(false);
    if (success) {
      setResolutionModalVisible(false);
      Alert.alert('Completed', 'Maintenance request has been marked as resolved.');
    } else {
      Alert.alert('Error', 'Failed to complete request. Please try again.');
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setAddingComment(true);
    const creatorName = user?.name || user?.email || callerRole;
    const success = await addComment(request.id, commentText.trim(), creatorName, callerRole);
    if (success) {
      setCommentText('');
    } else {
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    }
    setAddingComment(false);
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

  const handleAddExpense = () => {
    router.push({
      pathname: '/add-transaction',
      params: {
        type: 'expense',
        category: 'maintenance',
        description: `Maintenance: ${request.title}`,
        maintenanceRequestId: request.id,
        propertyId: request.propertyId,
      },
    });
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

  const mv = request.marketplaceVendor;
  const hasVendorDetails = !!mv;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}>
        <ScrollView contentContainerStyle={styles.content}>

          {/* ── Request Info ── */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{request.title}</Text>
                <Text style={styles.subtitle}>{request.property} • {request.unit}</Text>
                <Text style={styles.tenant}>
                  {request.createdByRole === 'landlord' ? 'Landlord'
                    : request.createdByRole === 'manager' ? 'Property Manager'
                    : 'Tenant'}
                  {': '}{request.tenantName}
                </Text>
              </View>
              <StatusChip status={request.status} />
            </View>
            <Text style={styles.description}>{request.description}</Text>
          </View>

          {/* ── Accept / Reject ── */}
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

          {/* ── Add Expense ── */}
          {(request.status === 'in_progress' || request.status === 'waiting_vendor' || request.status === 'resolved') && (
            <TouchableOpacity style={styles.expenseButton} onPress={handleAddExpense}>
              <MaterialCommunityIcons name="receipt-text" size={20} color="#2563eb" />
              <Text style={styles.expenseButtonText}>Add Expense / Upload Invoice</Text>
            </TouchableOpacity>
          )}

          {/* ── Manage Status ── */}
          {permitted.changeStatus && !isResolved && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Manage Status</Text>
              <View style={styles.statusGrid}>
                {STATUS_ACTIONS.map((action) => {
                  const active = request.status === action.value;
                  const isResolve = action.value === 'resolved';
                  return (
                    <TouchableOpacity
                      key={action.value}
                      style={[
                        styles.statusButton,
                        active && (isResolve ? styles.statusButtonResolve : styles.statusButtonActive),
                      ]}
                      onPress={() => handleStatusChange(action.value)}
                      disabled={statusChanging}>
                      {isResolve && (
                        <MaterialCommunityIcons
                          name="check-circle-outline"
                          size={14}
                          color={active ? '#fff' : '#16a34a'}
                        />
                      )}
                      <Text style={[
                        styles.statusText,
                        active && { color: '#fff' },
                        !active && isResolve && { color: '#16a34a' },
                      ]}>
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Vendor Section (pre-resolved) ── */}
          {permitted.assignVendor && !isResolved && (
            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Vendor</Text>
                <TouchableOpacity style={styles.selectVendorBtn} onPress={openVendorModal}>
                  <MaterialCommunityIcons name="store-search" size={14} color="#2563eb" />
                  <Text style={styles.selectVendorBtnText}>
                    {hasVendorDetails || request.vendor ? 'Change Vendor' : 'Select Vendor'}
                  </Text>
                </TouchableOpacity>
              </View>

              {hasVendorDetails ? (
                <View style={styles.vendorCard}>
                  <View style={styles.vendorCardHeader}>
                    <MaterialCommunityIcons name="account-hard-hat" size={20} color="#2563eb" />
                    <Text style={styles.vendorName}>{mv!.name}</Text>
                  </View>
                  <View style={styles.vendorDetail}>
                    <MaterialCommunityIcons name="tag-outline" size={13} color="#64748b" />
                    <Text style={styles.vendorDetailText}>{mv!.category} · {mv!.city}</Text>
                  </View>
                  <View style={styles.vendorDetail}>
                    <MaterialCommunityIcons name="phone-outline" size={13} color="#64748b" />
                    <Text style={styles.vendorDetailText}>{mv!.phone}</Text>
                  </View>
                  <View style={styles.vendorDetail}>
                    <MaterialCommunityIcons name="email-outline" size={13} color="#64748b" />
                    <Text style={styles.vendorDetailText}>{mv!.email}</Text>
                  </View>
                  <View style={styles.vendorDetail}>
                    <MaterialCommunityIcons name="map-marker-outline" size={13} color="#64748b" />
                    <Text style={styles.vendorDetailText}>{mv!.address}</Text>
                  </View>
                </View>
              ) : request.vendor ? (
                <View style={styles.vendorCard}>
                  <View style={styles.vendorCardHeader}>
                    <MaterialCommunityIcons name="account-hard-hat" size={20} color="#2563eb" />
                    <Text style={styles.vendorName}>{request.vendor}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyVendorText}>No vendor assigned yet.</Text>
              )}
            </View>
          )}

          {/* ── Assigned vendor (after resolved) ── */}
          {isResolved && (hasVendorDetails || request.vendor) && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Assigned Vendor</Text>
              <View style={styles.vendorCard}>
                <View style={styles.vendorCardHeader}>
                  <MaterialCommunityIcons name="account-hard-hat" size={20} color="#2563eb" />
                  <Text style={styles.vendorName}>{mv?.name ?? request.vendor}</Text>
                </View>
                {mv && (
                  <>
                    <View style={styles.vendorDetail}>
                      <MaterialCommunityIcons name="tag-outline" size={13} color="#64748b" />
                      <Text style={styles.vendorDetailText}>{mv.category} · {mv.city}</Text>
                    </View>
                    <View style={styles.vendorDetail}>
                      <MaterialCommunityIcons name="phone-outline" size={13} color="#64748b" />
                      <Text style={styles.vendorDetailText}>{mv.phone}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* ── Comments (pre-resolved only) ── */}
          {!isResolved && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Comments</Text>
              <View>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment…"
                  placeholderTextColor="#94a3b8"
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                />
              </View>
              <TouchableOpacity
                style={[styles.addCommentBtn, (!commentText.trim() || addingComment) && { opacity: 0.5 }]}
                onPress={handleAddComment}
                disabled={!commentText.trim() || addingComment}>
                <MaterialCommunityIcons name="send" size={15} color="#fff" />
                <Text style={styles.addCommentBtnText}>
                  {addingComment ? 'Adding…' : 'Add Comment'}
                </Text>
              </TouchableOpacity>
              {request.comments.length > 0 ? (
                <View style={styles.commentList}>
                  {[...request.comments].reverse().map((comment) => (
                    <View key={comment.id} style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <View style={styles.commentAvatar}>
                          <MaterialCommunityIcons name="account" size={14} color="#2563eb" />
                        </View>
                        <Text style={styles.commentAuthor}>{comment.createdBy}</Text>
                        <Text style={styles.commentTime}>
                          {new Date(comment.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.commentText}>{comment.commentText}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noCommentsText}>No comments yet.</Text>
              )}
            </View>
          )}

          {/* ── Resolution Note (after resolved) ── */}
          {isResolved && request.resolutionNotes && (
            <View style={[styles.card, styles.resolutionCard]}>
              <View style={styles.resolutionHeader}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#16a34a" />
                <Text style={styles.resolutionTitle}>Resolution Note</Text>
              </View>
              <Text style={styles.resolutionText}>{request.resolutionNotes}</Text>
            </View>
          )}

          {/* ── Activity Log ── */}
          {activityLog.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Activity</Text>
              {activityLog.map((item) => (
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
      </KeyboardAvoidingView>

      {/* ════════════════════════════════════════════════════════════════════
          VENDOR SELECTION MODAL  (inline — no navigation)
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={vendorModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVendorModalVisible(false)}>
        <View style={[vm.container, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={vm.header}>
            <Text style={vm.headerTitle}>Select Vendor</Text>
            <TouchableOpacity onPress={() => setVendorModalVisible(false)} style={vm.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={vm.filters}>
            {/* City dropdown */}
            <Dropdown
              label="Location"
              placeholder="Select city…"
              value={filterCity}
              options={[...VENDOR_CITIES]}
              isOpen={cityDropOpen}
              required
              onToggle={() => {
                setCityDropOpen((o) => !o);
                setCatDropOpen(false);
              }}
              onSelect={(v) => {
                setFilterCity(v);
                setFilterCategory(null);
              }}
            />
            {/* Category dropdown */}
            <Dropdown
              label="Category"
              placeholder="All categories"
              value={filterCategory}
              options={availableCategories as unknown as string[]}
              isOpen={catDropOpen}
              onToggle={() => {
                setCatDropOpen((o) => !o);
                setCityDropOpen(false);
              }}
              onSelect={setFilterCategory}
            />
          </View>

          {/* Divider + results count */}
          {filterCity && (
            <Text style={vm.resultsLabel}>
              {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}
              {filterCategory ? ` · ${filterCategory}` : ''} in {filterCity}
            </Text>
          )}

          {/* Vendor list */}
          {!filterCity ? (
            <View style={vm.emptyState}>
              <MaterialCommunityIcons name="city-variant-outline" size={52} color="#cbd5e1" />
              <Text style={vm.emptyText}>Select a city to see available vendors.</Text>
            </View>
          ) : filteredVendors.length === 0 ? (
            <View style={vm.emptyState}>
              <MaterialCommunityIcons name="store-off-outline" size={52} color="#cbd5e1" />
              <Text style={vm.emptyText}>No vendors found for this filter.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredVendors}
              keyExtractor={(item) => item.id}
              contentContainerStyle={vm.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item: vendor }) => (
                <View style={[vm.vendorCard, vendor.isSponsored && vm.vendorCardSponsored]}>
                  {vendor.isSponsored && (
                    <View style={vm.sponsoredBadge}>
                      <MaterialCommunityIcons name="star" size={11} color="#92400e" />
                      <Text style={vm.sponsoredText}>Sponsored</Text>
                    </View>
                  )}
                  <View style={vm.vendorHeader}>
                    <View style={[vm.iconCircle, vendor.isSponsored && vm.iconCircleSponsored]}>
                      <MaterialCommunityIcons
                        name={(CATEGORY_ICONS[vendor.category] || 'wrench') as any}
                        size={20}
                        color={vendor.isSponsored ? '#b45309' : '#2563eb'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={vm.vendorName}>{vendor.name}</Text>
                      <Text style={vm.vendorMeta}>{vendor.category} · {vendor.city}</Text>
                    </View>
                  </View>
                  <View style={vm.vendorDetails}>
                    <View style={vm.detailRow}>
                      <MaterialCommunityIcons name="phone-outline" size={13} color="#64748b" />
                      <Text style={vm.detailText}>{vendor.phone}</Text>
                    </View>
                    <View style={vm.detailRow}>
                      <MaterialCommunityIcons name="email-outline" size={13} color="#64748b" />
                      <Text style={vm.detailText}>{vendor.email}</Text>
                    </View>
                    <View style={vm.detailRow}>
                      <MaterialCommunityIcons name="map-marker-outline" size={13} color="#64748b" />
                      <Text style={vm.detailText}>{vendor.address}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[vm.selectBtn, vendor.isSponsored && vm.selectBtnSponsored, assigningVendor && { opacity: 0.6 }]}
                    onPress={() => handleSelectVendor(vendor)}
                    disabled={assigningVendor}>
                    <MaterialCommunityIcons name="check" size={15} color="#fff" />
                    <Text style={vm.selectBtnText}>{assigningVendor ? 'Assigning…' : 'Select Vendor'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════
          RESOLUTION NOTE MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={resolutionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setResolutionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKAV}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <MaterialCommunityIcons name="check-decagram" size={24} color="#16a34a" />
                <Text style={styles.modalTitle}>Add Resolution Note</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                Describe what was done to resolve this request. Required before completing.
              </Text>
              <TextInput
                style={[styles.notesInput, !resolutionNote.trim() && styles.notesInputWarning]}
                placeholder="e.g., Replaced faulty pipe, tested water pressure — all clear."
                placeholderTextColor="#94a3b8"
                multiline
                value={resolutionNote}
                onChangeText={setResolutionNote}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setResolutionModalVisible(false)}
                  disabled={savingResolution}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, (!resolutionNote.trim() || savingResolution) && { opacity: 0.5 }]}
                  onPress={handleCompleteWithResolution}
                  disabled={!resolutionNote.trim() || savingResolution}>
                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  <Text style={styles.modalSaveText}>{savingResolution ? 'Saving…' : 'Save & Complete'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// ── Vendor modal styles ───────────────────────────────────────────────────────
const vm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  closeBtn: { width: 36, alignItems: 'flex-end' },

  filters: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 20,
  },
  resultsLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },

  list: { padding: 16, paddingTop: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },

  vendorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  vendorCardSponsored: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },

  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sponsoredText: { fontSize: 11, fontWeight: '700', color: '#92400e' },

  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  iconCircleSponsored: { backgroundColor: '#fef3c7' },
  vendorName: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  vendorMeta: { fontSize: 12, color: '#64748b' },

  vendorDetails: { gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: '#475569', flex: 1 },

  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, marginTop: 4,
  },
  selectBtnSponsored: { backgroundColor: '#b45309' },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// ── Main screen styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
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
  description: { color: '#475569', fontSize: 14 },

  actionButtonsContainer: { flexDirection: 'row', gap: 12 },
  acceptButton: {
    flex: 1, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  acceptButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rejectButton: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ef4444',
    borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  rejectButtonText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },

  expenseButton: {
    backgroundColor: '#eff6ff', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  expenseButtonText: { color: '#2563eb', fontWeight: '700', fontSize: 15 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  statusButtonActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  statusButtonResolve: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  statusText: { fontWeight: '600', color: '#1e293b' },

  selectVendorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  selectVendorBtnText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  vendorCard: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, gap: 6,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  vendorCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vendorName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  vendorDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vendorDetailText: { fontSize: 13, color: '#475569', flex: 1 },
  emptyVendorText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },

  commentInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12,
    minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: '#0f172a', backgroundColor: '#f9fafb',
  },
  addCommentBtn: {
    backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  addCommentBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentList: { gap: 10, paddingTop: 4 },
  commentItem: {
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, gap: 6,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentAvatar: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#dbeafe',
    alignItems: 'center', justifyContent: 'center',
  },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#1e293b', flex: 1 },
  commentTime: { fontSize: 11, color: '#94a3b8' },
  commentText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  noCommentsText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },

  resolutionCard: { borderWidth: 1.5, borderColor: '#bbf7d0' },
  resolutionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resolutionTitle: { fontSize: 15, fontWeight: '700', color: '#16a34a' },
  resolutionText: { fontSize: 14, color: '#166534', lineHeight: 20 },

  activityRow: { flexDirection: 'row', alignItems: 'flex-start' },
  activityMessage: { fontSize: 14, color: '#111827' },
  activityMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalKAV: { justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 14,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  modalSubtitle: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  notesInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12,
    minHeight: 120, textAlignVertical: 'top', fontSize: 14, color: '#0f172a',
  },
  notesInputWarning: { borderColor: '#f59e0b' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalCancelText: { fontWeight: '700', color: '#475569', fontSize: 15 },
  modalSaveBtn: {
    flex: 2, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
