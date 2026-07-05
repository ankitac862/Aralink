import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StatusChip } from '@/components/maintenance/StatusChip';
import { canApprove, canChangeStatus, canAssignVendor, canAddResolutionNotes } from '@/lib/maintenancePermissions';
import type { MaintenanceCreatorRole } from '@/lib/maintenancePermissions';
import type { Vendor } from '@/constants/vendors';
import { fetchVendors } from '@/services/vendorService';
import { fmtDateTime } from '@/lib/dateUtils';

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
  isDark?: boolean;
}

function Dropdown({ label, placeholder, value, options, isOpen, onToggle, onSelect, required, isDark = false }: DropdownProps) {
  const textPrimary = isDark ? '#FFFFFF' : '#111315';
  const accentC     = isDark ? '#FFFFFF' : '#111315';
  const onAccentC   = isDark ? '#0B0B0C' : '#FFFFFF';
  const textSub     = isDark ? '#9BA1A6' : '#6E7377';
  const border      = isDark ? '#26282C' : '#E5E5E7';
  const inputBg     = isDark ? '#141517' : '#F7F7F8';
  const listBg      = isDark ? '#1A1B1E' : '#FFFFFF';

  return (
    <View style={dd.wrapper}>
      <Text style={[dd.label, { color: textSub }]}>
        {label}
        {required && <Text style={{ color: '#ef4444' }}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[dd.trigger, { backgroundColor: inputBg, borderColor: isOpen ? accentC : border }]}
        onPress={onToggle}>
        <Text style={[dd.triggerText, { color: value ? textPrimary : '#94a3b8' }]}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={textSub} />
      </TouchableOpacity>
      {isOpen && (
        <View style={[dd.list, { backgroundColor: listBg, borderColor: border }]}>
          {value && (
            <TouchableOpacity
              style={[dd.item, { borderBottomColor: isDark ? '#3b1515' : '#fee2e2' }, dd.clearItem]}
              onPress={() => { onSelect(null); onToggle(); }}>
              <MaterialCommunityIcons name="close-circle-outline" size={15} color="#ef4444" />
              <Text style={dd.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[dd.item, { borderBottomColor: border }, value === opt && { backgroundColor: isDark ? '#222428' : '#EDEDEF' }]}
              onPress={() => { onSelect(opt); onToggle(); }}>
              <Text style={[dd.itemText, { color: value === opt ? accentC : textPrimary }, value === opt && { fontWeight: '600' }]}>{opt}</Text>
              {value === opt && <MaterialCommunityIcons name="check" size={16} color={accentC} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const dd = StyleSheet.create({
  wrapper: { gap: 4, zIndex: 10 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
  },
  triggerText: { fontSize: 14, fontWeight: '500' },
  list: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginTop: 2 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1,
  },
  itemText: { fontSize: 14 },
  clearItem: { gap: 6 },
  clearText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function LandlordMaintenanceRequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { requests, updateRequestStatus, assignVendor, addResolutionNotes, addComment, setMarketplaceVendor } = useMaintenanceStore();

  const bg          = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBg      = isDark ? '#1A1B1E' : '#FFFFFF';
  const subBg       = isDark ? '#141517' : '#F7F7F8';
  const textPrimary = isDark ? '#FFFFFF' : '#111315';
  const accentC     = isDark ? '#FFFFFF' : '#111315';
  const onAccentC   = isDark ? '#0B0B0C' : '#FFFFFF';
  const textSub     = isDark ? '#9BA1A6' : '#6E7377';
  const textMuted   = isDark ? '#9BA1A6' : '#6E7377';
  const border      = isDark ? '#26282C' : '#E5E5E7';
  const inputBg     = isDark ? '#141517' : '#F7F7F8';
  const modalBg     = isDark ? '#1A1B1E' : '#FFFFFF';

  const request = useMemo(() => requests.find((r) => r.id === id) ?? requests[0], [requests, id]);

  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [resolutionModalVisible, setResolutionModalVisible] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [vendorModalVisible, setVendorModalVisible] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
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

  const availableCities = useMemo(() => [...new Set(vendors.map((v) => v.city))].sort(), [vendors]);

  const filteredVendors = useMemo(() => {
    if (!filterCity) return [];
    return vendors.filter((v) => v.city === filterCity && (!filterCategory || v.category === filterCategory));
  }, [vendors, filterCity, filterCategory]);

  const availableCategories = useMemo(() => {
    if (!filterCity) return [...new Set(vendors.map((v) => v.category))].sort();
    return [...new Set(vendors.filter((v) => v.city === filterCity).map((v) => v.category))].sort();
  }, [vendors, filterCity]);

  const activityLog = useMemo(
    () => (request?.activity ?? []).filter((a) => a.type !== 'comment'),
    [request?.activity]
  );

  const openVendorModal = () => {
    setFilterCity(null); setFilterCategory(null);
    setCityDropOpen(false); setCatDropOpen(false);
    setVendorModalVisible(true);
    if (vendors.length === 0) {
      setVendorsLoading(true);
      fetchVendors().then((data) => { setVendors(data); setVendorsLoading(false); });
    }
  };

  const handleSelectVendor = async (vendor: Vendor) => {
    if (!request) return;
    setAssigningVendor(true);
    await assignVendor(request.id, vendor.name, callerRole);
    setMarketplaceVendor(request.id, {
      id: vendor.id, name: vendor.name, phone: vendor.phone,
      email: vendor.email, category: vendor.category, city: vendor.city, address: vendor.address,
    });
    setAssigningVendor(false);
    setVendorModalVisible(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!permitted.changeStatus) { Alert.alert('Permission Denied', 'You are not allowed to change the request status.'); return; }
    if (request.status === 'resolved' && status === 'cancelled') { Alert.alert('Not Allowed', 'A resolved request cannot be cancelled.'); return; }
    if (status === 'resolved') { setResolutionNote(''); setResolutionModalVisible(true); return; }
    setStatusChanging(true);
    const actor = callerRole === 'manager' ? 'manager' : 'landlord';
    const success = await updateRequestStatus(request.id, status as any, actor, callerRole);
    setStatusChanging(false);
    if (success) Alert.alert('Updated', `Status changed to ${status.replace(/_/g, ' ')}.`);
    else Alert.alert('Error', 'Failed to update status. Please try again.');
  };

  const handleCompleteWithResolution = async () => {
    if (!resolutionNote.trim()) { Alert.alert('Required', 'Please enter a resolution note before completing this request.'); return; }
    setSavingResolution(true);
    const actor = callerRole === 'manager' ? 'manager' : 'landlord';
    await addResolutionNotes(request.id, resolutionNote.trim(), callerRole);
    const success = await updateRequestStatus(request.id, 'resolved', actor, callerRole);
    setSavingResolution(false);
    if (success) { setResolutionModalVisible(false); Alert.alert('Completed', 'Maintenance request has been marked as resolved.'); }
    else Alert.alert('Error', 'Failed to complete request. Please try again.');
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setAddingComment(true);
    const creatorName = user?.name || user?.email || callerRole;
    const success = await addComment(request.id, commentText.trim(), creatorName, callerRole);
    if (success) setCommentText('');
    else Alert.alert('Error', 'Failed to add comment. Please try again.');
    setAddingComment(false);
  };

  const handleAcceptRequest = async () => {
    if (!permitted.approve) { Alert.alert('Permission Denied', 'You are not allowed to approve requests.'); return; }
    Alert.alert('Accept Request', 'Accept this maintenance request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          const actor = callerRole === 'manager' ? 'manager' : 'landlord';
          const success = await updateRequestStatus(request.id, 'in_progress', actor, callerRole);
          if (success) Alert.alert('Accepted', 'The maintenance request has been accepted.');
          else Alert.alert('Error', 'Failed to accept request.');
        },
      },
    ]);
  };

  const handleRejectRequest = async () => {
    if (!permitted.approve) { Alert.alert('Permission Denied', 'You are not allowed to reject requests.'); return; }
    Alert.alert('Reject Request', 'Are you sure you want to reject this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          const actor = callerRole === 'manager' ? 'manager' : 'landlord';
          const success = await updateRequestStatus(request.id, 'cancelled', actor, callerRole);
          if (success) { Alert.alert('Rejected', 'The maintenance request has been cancelled.'); router.back(); }
          else Alert.alert('Error', 'Failed to reject request.');
        },
      },
    ]);
  };

  const handleAddExpense = () => {
    router.push({
      pathname: '/add-transaction',
      params: {
        type: 'expense', category: 'maintenance',
        description: `Maintenance: ${request.title}`,
        maintenanceRequestId: request.id, propertyId: request.propertyId,
      },
    });
  };

  if (!request) {
    return (
      <View style={[s.container, { backgroundColor: bg }]}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: textPrimary }]}>Request Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.emptyContainer}>
          <Text style={[s.emptyText, { color: textMuted }]}>Request not found</Text>
        </View>
      </View>
    );
  }

  const mv = request.marketplaceVendor;
  const hasVendorDetails = !!mv;

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: textPrimary }]}>Request Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 60}>
        <ScrollView contentContainerStyle={s.content}>

          {/* ── Request Info ── */}
          <View style={[s.card, { backgroundColor: cardBg }]}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, { color: textPrimary }]}>{request.title}</Text>
                <Text style={[s.subtitle, { color: textSub }]}>{request.property} • {request.unit}</Text>
                <Text style={[s.tenant, { color: textMuted }]}>
                  {request.createdByRole === 'landlord' ? 'Landlord'
                    : request.createdByRole === 'manager' ? 'Property Manager' : 'Tenant'}
                  {': '}{request.tenantName}
                </Text>
              </View>
              <StatusChip status={request.status} />
            </View>
            <Text style={[s.description, { color: textSub }]}>{request.description}</Text>
          </View>

          {/* ── Accept / Reject ── */}
          {permitted.approve && (request.status === 'new' || request.status === 'under_review') && (
            <View style={s.actionButtonsContainer}>
              <TouchableOpacity style={s.acceptButton} onPress={handleAcceptRequest}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                <Text style={s.acceptButtonText}>Accept Request</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.rejectButton, { backgroundColor: cardBg, borderColor: '#ef4444' }]} onPress={handleRejectRequest}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#ef4444" />
                <Text style={s.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Add Expense ── */}
          {(request.status === 'in_progress' || request.status === 'waiting_vendor' || request.status === 'resolved') && (
            <TouchableOpacity style={[s.expenseButton, { backgroundColor: isDark ? '#222428' : '#EDEDEF', borderColor: border }]} onPress={handleAddExpense}>
              <MaterialCommunityIcons name="receipt-text" size={20} color={textPrimary} />
              <Text style={[s.expenseButtonText, { color: textPrimary }]}>Add Expense / Upload Invoice</Text>
            </TouchableOpacity>
          )}

          {/* ── Manage Status ── */}
          {permitted.changeStatus && !isResolved && (
            <View style={[s.card, { backgroundColor: cardBg }]}>
              <Text style={[s.sectionTitle, { color: textPrimary }]}>Manage Status</Text>
              <View style={s.statusGrid}>
                {STATUS_ACTIONS.map((action) => {
                  const active = request.status === action.value;
                  const isResolve = action.value === 'resolved';
                  return (
                    <TouchableOpacity
                      key={action.value}
                      style={[
                        s.statusButton,
                        { borderColor: border },
                        active && (isResolve ? s.statusButtonResolve : { backgroundColor: accentC, borderColor: accentC }),
                      ]}
                      onPress={() => handleStatusChange(action.value)}
                      disabled={statusChanging}>
                      {isResolve && (
                        <MaterialCommunityIcons name="check-circle-outline" size={14} color={active ? '#fff' : '#16a34a'} />
                      )}
                      <Text style={[
                        s.statusText,
                        { color: active ? (isResolve ? '#fff' : onAccentC) : (!isResolve ? textPrimary : '#16a34a') },
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
            <View style={[s.card, { backgroundColor: cardBg }]}>
              <View style={s.sectionTitleRow}>
                <Text style={[s.sectionTitle, { color: textPrimary }]}>Vendor</Text>
                <TouchableOpacity style={[s.selectVendorBtn, { backgroundColor: isDark ? '#222428' : '#EDEDEF' }]} onPress={openVendorModal}>
                  <MaterialCommunityIcons name="store-search" size={14} color={textPrimary} />
                  <Text style={[s.selectVendorBtnText, { color: textPrimary }]}>{hasVendorDetails || request.vendor ? 'Change Vendor' : 'Select Vendor'}</Text>
                </TouchableOpacity>
              </View>
              {hasVendorDetails ? (
                <View style={[s.vendorCard, { backgroundColor: subBg, borderColor: border }]}>
                  <View style={s.vendorCardHeader}>
                    <MaterialCommunityIcons name="account-hard-hat" size={20} color={textPrimary} />
                    <Text style={[s.vendorName, { color: textPrimary }]}>{mv!.name}</Text>
                  </View>
                  {[
                    { icon: 'tag-outline', text: `${mv!.category} · ${mv!.city}` },
                    { icon: 'phone-outline', text: mv!.phone },
                    { icon: 'email-outline', text: mv!.email },
                    { icon: 'map-marker-outline', text: mv!.address },
                  ].map((row) => (
                    <View key={row.icon} style={s.vendorDetail}>
                      <MaterialCommunityIcons name={row.icon as any} size={13} color={textMuted} />
                      <Text style={[s.vendorDetailText, { color: textSub }]}>{row.text}</Text>
                    </View>
                  ))}
                </View>
              ) : request.vendor ? (
                <View style={[s.vendorCard, { backgroundColor: subBg, borderColor: border }]}>
                  <View style={s.vendorCardHeader}>
                    <MaterialCommunityIcons name="account-hard-hat" size={20} color={textPrimary} />
                    <Text style={[s.vendorName, { color: textPrimary }]}>{request.vendor}</Text>
                  </View>
                </View>
              ) : (
                <Text style={[s.emptyVendorText, { color: textMuted }]}>No vendor assigned yet.</Text>
              )}
            </View>
          )}

          {/* ── Assigned vendor (after resolved) ── */}
          {isResolved && (hasVendorDetails || request.vendor) && (
            <View style={[s.card, { backgroundColor: cardBg }]}>
              <Text style={[s.sectionTitle, { color: textPrimary }]}>Assigned Vendor</Text>
              <View style={[s.vendorCard, { backgroundColor: subBg, borderColor: border }]}>
                <View style={s.vendorCardHeader}>
                  <MaterialCommunityIcons name="account-hard-hat" size={20} color={textPrimary} />
                  <Text style={[s.vendorName, { color: textPrimary }]}>{mv?.name ?? request.vendor}</Text>
                </View>
                {mv && (
                  <>
                    <View style={s.vendorDetail}>
                      <MaterialCommunityIcons name="tag-outline" size={13} color={textMuted} />
                      <Text style={[s.vendorDetailText, { color: textSub }]}>{mv.category} · {mv.city}</Text>
                    </View>
                    <View style={s.vendorDetail}>
                      <MaterialCommunityIcons name="phone-outline" size={13} color={textMuted} />
                      <Text style={[s.vendorDetailText, { color: textSub }]}>{mv.phone}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* ── Comments (pre-resolved only) ── */}
          {!isResolved && (
            <View style={[s.card, { backgroundColor: cardBg }]}>
              <Text style={[s.sectionTitle, { color: textPrimary }]}>Comments</Text>
              <TextInput
                style={[s.commentInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                placeholder="Add a comment…"
                placeholderTextColor={textMuted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[s.addCommentBtn, { backgroundColor: accentC }, (!commentText.trim() || addingComment) && { opacity: 0.5 }]}
                onPress={handleAddComment}
                disabled={!commentText.trim() || addingComment}>
                <MaterialCommunityIcons name="send" size={15} color={onAccentC} />
                <Text style={[s.addCommentBtnText, { color: onAccentC }]}>{addingComment ? 'Adding…' : 'Add Comment'}</Text>
              </TouchableOpacity>
              {request.comments.length > 0 ? (
                <View style={s.commentList}>
                  {[...request.comments].reverse().map((comment) => (
                    <View key={comment.id} style={[s.commentItem, { backgroundColor: subBg, borderColor: border }]}>
                      <View style={s.commentHeader}>
                        <View style={[s.commentAvatar, { backgroundColor: isDark ? '#222428' : '#EDEDEF' }]}>
                          <MaterialCommunityIcons name="account" size={14} color={textSub} />
                        </View>
                        <Text style={[s.commentAuthor, { color: textPrimary }]}>{comment.createdBy}</Text>
                        <Text style={[s.commentTime, { color: textMuted }]}>{fmtDateTime(comment.createdAt)}</Text>
                      </View>
                      <Text style={[s.commentText, { color: textSub }]}>{comment.commentText}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[s.noCommentsText, { color: textMuted }]}>No comments yet.</Text>
              )}
            </View>
          )}

          {/* ── Resolution Note (after resolved) ── */}
          {isResolved && request.resolutionNotes && (
            <View style={[s.card, s.resolutionCard, { backgroundColor: cardBg }]}>
              <View style={s.resolutionHeader}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#16a34a" />
                <Text style={s.resolutionTitle}>Resolution Note</Text>
              </View>
              <Text style={[s.resolutionText, { color: isDark ? '#4ade80' : '#166534' }]}>{request.resolutionNotes}</Text>
            </View>
          )}

          {/* ── Activity Log ── */}
          {activityLog.length > 0 && (
            <View style={[s.card, { backgroundColor: cardBg }]}>
              <Text style={[s.sectionTitle, { color: textPrimary }]}>Activity</Text>
              {activityLog.map((item) => (
                <View key={item.id} style={s.activityRow}>
                  <MaterialCommunityIcons name="checkbox-blank-circle" size={8} color={textSub} style={{ marginTop: 5 }} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[s.activityMessage, { color: textPrimary }]}>{item.message}</Text>
                    <Text style={[s.activityMeta, { color: textMuted }]}>{fmtDateTime(item.timestamp)} · {item.actor}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Vendor Selection Modal ── */}
      <Modal visible={vendorModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVendorModalVisible(false)}>
        <View style={[vm.container, { paddingTop: insets.top, backgroundColor: bg }]}>
          <View style={[vm.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
            <Text style={[vm.headerTitle, { color: textPrimary }]}>Select Vendor</Text>
            <TouchableOpacity onPress={() => setVendorModalVisible(false)} style={vm.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={[vm.filters, { backgroundColor: cardBg, borderBottomColor: border }]}>
            <Dropdown label="Location" placeholder="Select city…" value={filterCity} options={availableCities} isOpen={cityDropOpen} required isDark={isDark}
              onToggle={() => { setCityDropOpen((o) => !o); setCatDropOpen(false); }}
              onSelect={(v) => { setFilterCity(v); setFilterCategory(null); }} />
            <Dropdown label="Category" placeholder="All categories" value={filterCategory} options={availableCategories as unknown as string[]} isOpen={catDropOpen} isDark={isDark}
              onToggle={() => { setCatDropOpen((o) => !o); setCityDropOpen(false); }}
              onSelect={setFilterCategory} />
          </View>

          {filterCity && (
            <Text style={[vm.resultsLabel, { color: textSub }]}>
              {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}
              {filterCategory ? ` · ${filterCategory}` : ''} in {filterCity}
            </Text>
          )}

          {vendorsLoading ? (
            <View style={vm.emptyState}>
              <ActivityIndicator size="large" color={textPrimary} />
              <Text style={[vm.emptyText, { color: textMuted }]}>Loading vendors…</Text>
            </View>
          ) : !filterCity ? (
            <View style={vm.emptyState}>
              <MaterialCommunityIcons name="city-variant-outline" size={52} color={textMuted} />
              <Text style={[vm.emptyText, { color: textMuted }]}>Select a city to see available vendors.</Text>
            </View>
          ) : filteredVendors.length === 0 ? (
            <View style={vm.emptyState}>
              <MaterialCommunityIcons name="store-off-outline" size={52} color={textMuted} />
              <Text style={[vm.emptyText, { color: textMuted }]}>No vendors found for this filter.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredVendors}
              keyExtractor={(item) => item.id}
              contentContainerStyle={vm.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item: vendor }) => (
                <View style={[vm.vendorCard, { backgroundColor: cardBg, borderColor: vendor.isSponsored ? '#fbbf24' : border }, vendor.isSponsored && { backgroundColor: isDark ? '#2d1f0a' : '#fffbeb' }]}>
                  {vendor.isSponsored && (
                    <View style={vm.sponsoredBadge}>
                      <MaterialCommunityIcons name="star" size={11} color="#92400e" />
                      <Text style={vm.sponsoredText}>Sponsored</Text>
                    </View>
                  )}
                  <View style={vm.vendorHeader}>
                    <View style={[vm.iconCircle, { backgroundColor: vendor.isSponsored ? (isDark ? '#3d2a05' : '#fef3c7') : (isDark ? '#222428' : '#EDEDEF') }]}>
                      <MaterialCommunityIcons name={(CATEGORY_ICONS[vendor.category] || 'wrench') as any} size={20} color={vendor.isSponsored ? '#b45309' : textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[vm.vendorName, { color: textPrimary }]}>{vendor.name}</Text>
                      <Text style={[vm.vendorMeta, { color: textMuted }]}>{vendor.category} · {vendor.city}</Text>
                    </View>
                  </View>
                  <View style={[vm.vendorDetails, { borderTopColor: border }]}>
                    {[
                      { icon: 'phone-outline', text: vendor.phone },
                      { icon: 'email-outline', text: vendor.email },
                      { icon: 'map-marker-outline', text: vendor.address },
                    ].map((row) => (
                      <View key={row.icon} style={vm.detailRow}>
                        <MaterialCommunityIcons name={row.icon as any} size={13} color={textMuted} />
                        <Text style={[vm.detailText, { color: textSub }]}>{row.text}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[vm.selectBtn, { backgroundColor: accentC }, vendor.isSponsored && vm.selectBtnSponsored, assigningVendor && { opacity: 0.6 }]}
                    onPress={() => handleSelectVendor(vendor)}
                    disabled={assigningVendor}>
                    <MaterialCommunityIcons name="check" size={15} color={vendor.isSponsored ? '#fff' : onAccentC} />
                    <Text style={[vm.selectBtnText, { color: vendor.isSponsored ? '#fff' : onAccentC }]}>{assigningVendor ? 'Assigning…' : 'Select Vendor'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ── Resolution Note Modal ── */}
      <Modal visible={resolutionModalVisible} transparent animationType="slide" onRequestClose={() => setResolutionModalVisible(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalKAV}>
            <View style={[s.modalContent, { backgroundColor: modalBg }]}>
              <View style={s.modalHeader}>
                <MaterialCommunityIcons name="check-decagram" size={24} color="#16a34a" />
                <Text style={[s.modalTitle, { color: textPrimary }]}>Add Resolution Note</Text>
              </View>
              <Text style={[s.modalSubtitle, { color: textSub }]}>
                Describe what was done to resolve this request. Required before completing.
              </Text>
              <TextInput
                style={[s.notesInput, { backgroundColor: inputBg, borderColor: !resolutionNote.trim() ? '#f59e0b' : border, color: textPrimary }]}
                placeholder="e.g., Replaced faulty pipe, tested water pressure — all clear."
                placeholderTextColor={textMuted}
                multiline
                value={resolutionNote}
                onChangeText={setResolutionNote}
                autoFocus
              />
              <View style={s.modalButtons}>
                <TouchableOpacity style={[s.modalCancelBtn, { backgroundColor: isDark ? '#26282C' : '#E8E8EA' }]} onPress={() => setResolutionModalVisible(false)} disabled={savingResolution}>
                  <Text style={[s.modalCancelText, { color: textSub }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalSaveBtn, (!resolutionNote.trim() || savingResolution) && { opacity: 0.5 }]}
                  onPress={handleCompleteWithResolution}
                  disabled={!resolutionNote.trim() || savingResolution}>
                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  <Text style={s.modalSaveText}>{savingResolution ? 'Saving…' : 'Save & Complete'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const vm = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 36, alignItems: 'flex-end' },
  filters: { padding: 16, gap: 12, borderBottomWidth: 1, zIndex: 20 },
  resultsLabel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 13, fontWeight: '600' },
  list: { padding: 16, paddingTop: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  vendorCard: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 10 },
  sponsoredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  sponsoredText: { fontSize: 11, fontWeight: '700', color: '#92400e' },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  vendorName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  vendorMeta: { fontSize: 12 },
  vendorDetails: { gap: 4, paddingTop: 6, borderTopWidth: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, flex: 1 },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 12, paddingVertical: 12, marginTop: 4,
  },
  selectBtnSponsored: { backgroundColor: '#b45309' },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontWeight: '600', marginTop: 2 },
  tenant: { fontSize: 13, marginTop: 2 },
  description: { fontSize: 14 },
  actionButtonsContainer: { flexDirection: 'row', gap: 12 },
  acceptButton: {
    flex: 1, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  acceptButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rejectButton: {
    flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  rejectButtonText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  expenseButton: {
    borderRadius: 12, paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1,
  },
  expenseButtonText: { fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  
  statusButtonResolve: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  statusText: { fontWeight: '600' },
  selectVendorBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  selectVendorBtnText: { fontSize: 12, fontWeight: '700' },
  vendorCard: { borderRadius: 12, padding: 12, gap: 6, borderWidth: 1 },
  vendorCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vendorName: { fontSize: 15, fontWeight: '700' },
  vendorDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vendorDetailText: { fontSize: 13, flex: 1 },
  emptyVendorText: { fontSize: 13, fontStyle: 'italic' },
  commentInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 14 },
  addCommentBtn: {
    borderRadius: 10, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  addCommentBtnText: { fontWeight: '700', fontSize: 13 },
  commentList: { gap: 10, paddingTop: 4 },
  commentItem: { borderRadius: 10, padding: 10, gap: 6, borderWidth: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  commentAuthor: { fontSize: 12, fontWeight: '700', flex: 1 },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 20 },
  noCommentsText: { fontSize: 13, fontStyle: 'italic' },
  resolutionCard: { borderWidth: 1.5, borderColor: '#bbf7d0' },
  resolutionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resolutionTitle: { fontSize: 15, fontWeight: '700', color: '#16a34a' },
  resolutionText: { fontSize: 14, lineHeight: 20 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start' },
  activityMessage: { fontSize: 14 },
  activityMeta: { fontSize: 12, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalKAV: { justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSubtitle: { fontSize: 13, lineHeight: 18 },
  notesInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 120, textAlignVertical: 'top', fontSize: 14 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelText: { fontWeight: '700', fontSize: 15 },
  modalSaveBtn: {
    flex: 2, backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
