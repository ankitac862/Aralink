import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useMaintenanceStore } from '@/store/maintenanceStore';
import { StatusChip } from '@/components/maintenance/StatusChip';
import { useAuth } from '@/hooks/use-auth';
import { fmtDate } from '@/lib/dateUtils';
import { useColorScheme } from '@/hooks/use-color-scheme';

const VIEWED_KEY = 'maintenance_viewed_ids';

const OPEN_STATUSES = ['new', 'under_review', 'in_progress', 'waiting_vendor'];

const FILTERS = [
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

export default function LandlordMaintenanceOverviewScreen() {
  const { requests, fetchRequests } = useMaintenanceStore();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bg        = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBg    = isDark ? '#1A1B1E' : '#FFFFFF';
  const textPrimary   = isDark ? '#FFFFFF' : '#111315';
  const textSecondary = isDark ? '#9BA1A6' : '#6E7377';
  const border    = isDark ? '#26282C' : '#E5E5E7';
  const chipBg    = isDark ? '#26282C' : '#E5E5E7';
  const chipText  = isDark ? '#9BA1A6' : '#6E7377';
  const inputBg   = isDark ? '#1A1B1E' : '#FFFFFF';
  const unseenCardBg = isDark ? '#222428' : '#EDEDEF';
  const accent = isDark ? '#FFFFFF' : '#111315';
  const onAccent = isDark ? '#0B0B0C' : '#FFFFFF';

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [refreshing, setRefreshing] = useState(false);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  // Load viewed IDs from storage
  useEffect(() => {
    AsyncStorage.getItem(VIEWED_KEY).then((raw) => {
      if (raw) setViewedIds(new Set(JSON.parse(raw)));
    });
  }, []);

  // Fetch requests on focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchRequests(user.id, 'landlord');
    }, [user?.id])
  );

  const handleRefresh = async () => {
    if (user?.id) {
      setRefreshing(true);
      await fetchRequests(user.id, 'landlord');
      setRefreshing(false);
    }
  };

  const markViewed = async (id: string) => {
    const updated = new Set(viewedIds).add(id);
    setViewedIds(updated);
    await AsyncStorage.setItem(VIEWED_KEY, JSON.stringify([...updated]));
  };

  // A request is "unseen" if the landlord has never tapped on it
  const isUnseen = (id: string) => !viewedIds.has(id);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const searchTerm = query.toLowerCase();
      const matchSearch =
        req.title.toLowerCase().includes(searchTerm) ||
        req.property.toLowerCase().includes(searchTerm) ||
        req.id.toLowerCase().includes(searchTerm);

      let matchStatus: boolean;
      if (statusFilter === 'all') {
        matchStatus = true;
      } else if (statusFilter === 'open') {
        matchStatus = OPEN_STATUSES.includes(req.status);
      } else if (statusFilter === 'new') {
        matchStatus = req.status === 'new' || isUnseen(req.id);
      } else {
        matchStatus = req.status === statusFilter;
      }

      return matchStatus && matchSearch;
    });
  }, [requests, query, statusFilter, viewedIds]);

  // Count for the "New" badge
  const newCount = useMemo(
    () => requests.filter((r) => r.status === 'new' || isUnseen(r.id)).length,
    [requests, viewedIds]
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Maintenance Queue</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchField, { backgroundColor: inputBg, borderColor: border }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={textSecondary} />
          <TextInput
            placeholder="Search by request, tenant or property"
            placeholderTextColor={textSecondary}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: textPrimary }]}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active = statusFilter === filter.value;
          const showBadge = filter.value === 'new' && newCount > 0 && !active;
          return (
            <TouchableOpacity
              key={filter.value}
              style={[styles.filterChip, { backgroundColor: active ? accent : chipBg }]}
              onPress={() => setStatusFilter(filter.value)}>
              <Text style={[styles.filterText, { color: active ? onAccent : chipText }]}>
                {filter.label}
              </Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{newCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => {
          const unseen = isUnseen(item.id);
          return (
            <TouchableOpacity
              style={[
                styles.card,
                { backgroundColor: unseen ? unseenCardBg : cardBg },
                unseen && { borderLeftWidth: 3, borderLeftColor: accent },
              ]}
              onPress={() => {
                markViewed(item.id);
                router.push({ pathname: '/landlord-maintenance-detail', params: { id: item.id } });
              }}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  {unseen && <View style={styles.unseenDot} />}
                  <Text style={[styles.cardTitle, { color: textPrimary }]} numberOfLines={1}>{item.title}</Text>
                </View>
                <StatusChip status={item.status} />
              </View>
              <Text style={[styles.cardSubtitle, { color: textSecondary }]}>
                {item.property} • {item.unit}
              </Text>
              <Text style={[styles.cardTenant, { color: textSecondary }]}>
                {item.createdByRole === 'landlord'
                  ? 'Landlord'
                  : item.createdByRole === 'manager'
                  ? 'Property Manager'
                  : 'Tenant'}
                {': '}{item.tenantName}
              </Text>
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="calendar" size={16} color={textSecondary} />
                <Text style={[styles.metaText, { color: textSecondary }]}>
                  Submitted {fmtDate(item.createdAt)} at{' '}
                  {new Date(item.createdAt).toLocaleTimeString()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={48} color={textSecondary} />
            <Text style={[styles.emptyText, { color: textSecondary }]}>No requests found</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24, backgroundColor: accent, shadowColor: accent }]}
        onPress={() => router.push('/landlord-maintenance-create' as any)}
        activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color={onAccent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  searchRow: { paddingHorizontal: 16, paddingBottom: 12 },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterText: { fontWeight: '600' },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  unseenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8E959B',
    flexShrink: 0,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  cardSubtitle: { fontWeight: '600' },
  cardTenant: { fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
