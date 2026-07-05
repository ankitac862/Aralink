import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAraPartnerStore, PayoutRecord } from '@/store/araPartnerStore';

type Filter = 'paid' | 'approved' | 'cancelled';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'paid', label: 'Paid' },
  { key: 'approved', label: 'Approved' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function Payouts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { payouts, loadPayouts, isLoading } = useAraPartnerStore();
  const [filter, setFilter] = useState<Filter>('paid');

  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBg = isDark ? '#1A1B1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const subText = isDark ? '#9BA1A6' : '#6E7377';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const PRIMARY = isDark ? '#FFFFFF' : '#111315';

  useFocusEffect(useCallback(() => { loadPayouts(); }, []));

  const totalPaid = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = payouts.filter((p) => p.status === 'pending' || p.status === 'approved').reduce((s, p) => s + p.amount, 0);
  const filtered = payouts.filter((p) => p.status === filter);

  const renderItem = ({ item }: { item: PayoutRecord }) => (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.address, { color: textColor }]} numberOfLines={1}>
            {item.referral?.propertyAddress || '—'}
          </ThemedText>
          <ThemedText style={[styles.landlord, { color: subText }]}>
            {item.referral?.landlordName || ''}
          </ThemedText>
        </View>
        <View style={[styles.badge, { backgroundColor: payoutStatusColor(item.status) + '22' }]}>
          <ThemedText style={[styles.badgeText, { color: payoutStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.row}>
          <ThemedText style={[styles.month, { color: subText }]}>
            {new Date(item.payoutMonth).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}
          </ThemedText>
          <ThemedText style={[styles.amount, { color: item.status === 'paid' ? '#10B981' : textColor }]}>
            CAD ${item.amount.toFixed(2)}
          </ThemedText>
        </View>
        <ThemedText style={[styles.detail, { color: subText }]}>
          ${item.subscriptionFeeSnapshot.toFixed(2)} × {item.commissionPercentSnapshot}%
          {item.paidAt ? ` · Paid ${new Date(item.paidAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}` : ''}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>Payout History</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
          <ThemedText style={[styles.summaryValue, { color: '#10B981' }]}>${totalPaid.toFixed(2)}</ThemedText>
          <ThemedText style={[styles.summaryLabel, { color: subText }]}>Total Paid</ThemedText>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
          <ThemedText style={[styles.summaryValue, { color: '#F59E0B' }]}>${totalPending.toFixed(2)}</ThemedText>
          <ThemedText style={[styles.summaryLabel, { color: subText }]}>Pending</ThemedText>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
          <ThemedText style={[styles.summaryValue, { color: PRIMARY }]}>{payouts.length}</ThemedText>
          <ThemedText style={[styles.summaryLabel, { color: subText }]}>Total Records</ThemedText>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterRow, { borderBottomColor: borderColor }]}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && { borderBottomColor: PRIMARY, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f.key)}
          >
            <ThemedText style={[styles.filterLabel, { color: filter === f.key ? PRIMARY : subText }]}>
              {f.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="cash-remove" size={48} color={subText} />
              <ThemedText style={[styles.emptyText, { color: subText }]}>
                No {filter} payouts.
              </ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

function payoutStatusColor(status: string) {
  if (status === 'paid') return '#10B981';
  if (status === 'cancelled') return '#EF4444';
  if (status === 'approved') return '#8E959B';
  return '#F59E0B';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 4 },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 10, marginTop: 2 },
  list: { padding: 20, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  address: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  landlord: { fontSize: 12 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardBottom: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  month: { fontSize: 13 },
  amount: { fontSize: 16, fontWeight: '800' },
  detail: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  filterRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: 20, marginTop: 8 },
  filterTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterLabel: { fontSize: 13, fontWeight: '600' },
});
