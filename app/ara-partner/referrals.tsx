import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAraPartnerStore, Referral } from '@/store/araPartnerStore';

const PRIMARY = '#2A64F5';

export default function MyReferrals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { referrals, loadReferrals, isLoading } = useAraPartnerStore();

  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBg = isDark ? '#1a202c' : '#ffffff';
  const textColor = isDark ? '#F4F6F8' : '#111827';
  const subText = isDark ? '#94a3b8' : '#6B7280';

  useFocusEffect(useCallback(() => { loadReferrals(); }, []));

  const renderItem = ({ item }: { item: Referral }) => {
    const activeRule = item.commissionRules?.find((r) => !r.endDate);
    return (
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.address, { color: textColor }]} numberOfLines={2}>
              {item.propertyAddress}
            </ThemedText>
            <ThemedText style={[styles.landlord, { color: subText }]}>
              {item.landlordName}
            </ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '22' }]}>
            <ThemedText style={[styles.badgeText, { color: statusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardBottom}>
          {item.landlordPhone && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone" size={13} color={subText} />
              <ThemedText style={[styles.infoText, { color: subText }]}>{item.landlordPhone}</ThemedText>
            </View>
          )}
          {item.landlordEmail && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="email" size={13} color={subText} />
              <ThemedText style={[styles.infoText, { color: subText }]}>{item.landlordEmail}</ThemedText>
            </View>
          )}
          {activeRule && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="percent" size={13} color={PRIMARY} />
              <ThemedText style={[styles.infoText, { color: PRIMARY }]}>
                {activeRule.commissionPercent}% commission
                {activeRule.endDate ? ` until ${activeRule.endDate}` : ''}
              </ThemedText>
            </View>
          )}
          <ThemedText style={[styles.date, { color: subText }]}>
            Submitted {new Date(item.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>My Referrals</ThemedText>
        <TouchableOpacity onPress={() => router.push('/ara-partner/submit-referral' as any)}>
          <MaterialCommunityIcons name="plus" size={26} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={referrals}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="clipboard-text-off" size={48} color={subText} />
              <ThemedText style={[styles.emptyText, { color: subText }]}>No referrals yet</ThemedText>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/ara-partner/submit-referral' as any)}
              >
                <ThemedText style={styles.emptyBtnText}>Submit Your First Referral</ThemedText>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

function statusColor(status: string) {
  if (status === 'approved') return '#10B981';
  if (status === 'rejected') return '#EF4444';
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
  address: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  landlord: { fontSize: 13 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardBottom: { gap: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 12 },
  date: { fontSize: 11, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16 },
  emptyBtn: {
    backgroundColor: '#2A64F5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
