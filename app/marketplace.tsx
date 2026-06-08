import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { VENDORS, Vendor } from '@/constants/vendors';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

function VendorCard({ vendor }: { vendor: Vendor }) {
  const icon = CATEGORY_ICONS[vendor.category] || 'wrench';

  return (
    <View style={[styles.card, vendor.isSponsored && styles.cardSponsored]}>
      {vendor.isSponsored && (
        <View style={styles.sponsoredBadge}>
          <MaterialCommunityIcons name="star" size={11} color="#92400e" />
          <Text style={styles.sponsoredText}>Sponsored</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, vendor.isSponsored && styles.iconCircleSponsored]}>
          <MaterialCommunityIcons
            name={icon as any}
            size={22}
            color={vendor.isSponsored ? '#b45309' : '#2563eb'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vendorName}>{vendor.name}</Text>
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{vendor.category}</Text>
            </View>
            <Text style={styles.cityText}>{vendor.city}</Text>
          </View>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748b" />
          <Text style={styles.detailText}>{vendor.address}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="phone-outline" size={14} color="#64748b" />
          <Text style={styles.detailText}>{vendor.phone}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="email-outline" size={14} color="#64748b" />
          <Text style={styles.detailText}>{vendor.email}</Text>
        </View>
      </View>
    </View>
  );
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const sponsored = VENDORS.filter((v) => v.isSponsored);
  const regular = VENDORS.filter((v) => !v.isSponsored);
  const sorted = [...sponsored, ...regular];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#101922' : '#f8fafc' }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketplace</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VendorCard vendor={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <MaterialCommunityIcons name="store" size={18} color="#2563eb" />
            <Text style={styles.listHeaderText}>{VENDORS.length} vendors available</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
      />
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
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  list: { padding: 16 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  listHeaderText: { fontSize: 13, color: '#64748b', fontWeight: '500' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  cardSponsored: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
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

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSponsored: { backgroundColor: '#fef3c7' },
  vendorName: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  cityText: { fontSize: 12, color: '#64748b' },

  detailsGrid: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: '#475569', flex: 1 },
});
