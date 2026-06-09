import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { fetchVendors } from '@/services/vendorService';
import type { Vendor } from '@/constants/vendors';

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

// ── Dropdown ─────────────────────────────────────────────────────────────────
interface DropdownProps {
  label: string;
  placeholder: string;
  value: string | null;
  options: string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (v: string | null) => void;
}

function Dropdown({ label, placeholder, value, options, isOpen, onToggle, onSelect }: DropdownProps) {
  return (
    <View style={dd.wrapper}>
      <Text style={dd.label}>{label}</Text>
      <TouchableOpacity style={[dd.trigger, isOpen && dd.triggerOpen]} onPress={onToggle}>
        <Text style={[dd.triggerText, !value && dd.placeholder]}>{value || placeholder}</Text>
        <MaterialCommunityIcons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
      </TouchableOpacity>
      {isOpen && (
        <View style={dd.list}>
          {value && (
            <TouchableOpacity style={[dd.item, dd.clearItem]} onPress={() => { onSelect(null); onToggle(); }}>
              <MaterialCommunityIcons name="close-circle-outline" size={14} color="#ef4444" />
              <Text style={dd.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[dd.item, value === opt && dd.itemActive]}
              onPress={() => { onSelect(opt); onToggle(); }}>
              <Text style={[dd.itemText, value === opt && dd.itemTextActive]}>{opt}</Text>
              {value === opt && <MaterialCommunityIcons name="check" size={15} color="#2563eb" />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const dd = StyleSheet.create({
  wrapper: { flex: 1, gap: 4, zIndex: 10 },
  label: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 10, backgroundColor: '#f9fafb',
  },
  triggerOpen: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  triggerText: { fontSize: 13, fontWeight: '500', color: '#0f172a', flex: 1 },
  placeholder: { color: '#94a3b8' },
  list: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden', marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemActive: { backgroundColor: '#eff6ff' },
  itemText: { fontSize: 13, color: '#0f172a' },
  itemTextActive: { color: '#2563eb', fontWeight: '600' },
  clearItem: { gap: 6, borderBottomColor: '#fee2e2' },
  clearText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Vendor Card ───────────────────────────────────────────────────────────────
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
        {vendor.website ? (
          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => Linking.openURL(vendor.website!)}>
            <MaterialCommunityIcons name="web" size={14} color="#2563eb" />
            <Text style={[styles.detailText, styles.websiteLink]} numberOfLines={1}>
              {vendor.website.replace(/^https?:\/\//, '')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function MarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterCity, setFilterCity] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [cityDropOpen, setCityDropOpen] = useState(false);
  const [catDropOpen, setCatDropOpen] = useState(false);

  useEffect(() => {
    fetchVendors().then((data) => {
      setAllVendors(data);
      setLoading(false);
    });
  }, []);

  const availableCities = useMemo(
    () => [...new Set(allVendors.map((v) => v.city))].sort(),
    [allVendors]
  );

  const availableCategories = useMemo(() => {
    const base = filterCity
      ? allVendors.filter((v) => v.city === filterCity)
      : allVendors;
    return [...new Set(base.map((v) => v.category))].sort();
  }, [allVendors, filterCity]);

  const filtered = useMemo(() => {
    return allVendors.filter((v) => {
      const cityOk = !filterCity || v.city === filterCity;
      const catOk = !filterCategory || v.category === filterCategory;
      return cityOk && catOk;
    });
  }, [allVendors, filterCity, filterCategory]);

  const hasFilters = filterCity || filterCategory;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketplace</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <Dropdown
          label="Location"
          placeholder="All cities"
          value={filterCity}
          options={availableCities}
          isOpen={cityDropOpen}
          onToggle={() => { setCityDropOpen((o) => !o); setCatDropOpen(false); }}
          onSelect={(v) => { setFilterCity(v); setFilterCategory(null); }}
        />
        <Dropdown
          label="Category"
          placeholder="All categories"
          value={filterCategory}
          options={availableCategories}
          isOpen={catDropOpen}
          onToggle={() => { setCatDropOpen((o) => !o); setCityDropOpen(false); }}
          onSelect={setFilterCategory}
        />
      </View>

      {/* Active filter chips */}
      {hasFilters && (
        <View style={styles.activeFilters}>
          {filterCity && (
            <TouchableOpacity style={styles.chip} onPress={() => { setFilterCity(null); setFilterCategory(null); }}>
              <MaterialCommunityIcons name="city-variant-outline" size={13} color="#2563eb" />
              <Text style={styles.chipText}>{filterCity}</Text>
              <MaterialCommunityIcons name="close" size={12} color="#2563eb" />
            </TouchableOpacity>
          )}
          {filterCategory && (
            <TouchableOpacity style={styles.chip} onPress={() => setFilterCategory(null)}>
              <MaterialCommunityIcons
                name={(CATEGORY_ICONS[filterCategory] || 'wrench') as any}
                size={13} color="#2563eb"
              />
              <Text style={styles.chipText}>{filterCategory}</Text>
              <MaterialCommunityIcons name="close" size={12} color="#2563eb" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.clearAll}
            onPress={() => { setFilterCity(null); setFilterCategory(null); }}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading vendors…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VendorCard vendor={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <Text style={styles.resultsLabel}>
              {filtered.length} vendor{filtered.length !== 1 ? 's' : ''}
              {hasFilters ? ' found' : ' available'}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="store-off-outline" size={52} color="#cbd5e1" />
              <Text style={styles.emptyText}>No vendors match your filters.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },

  filterBar: {
    flexDirection: 'row', gap: 10, padding: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    zIndex: 20,
  },

  activeFilters: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  clearAll: { marginLeft: 4 },
  clearAllText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#64748b' },

  resultsLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 12, paddingTop: 4 },
  list: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0', gap: 10,
  },
  cardSponsored: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },
  sponsoredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: '#fef3c7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  sponsoredText: { fontSize: 11, fontWeight: '700', color: '#92400e' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  iconCircleSponsored: { backgroundColor: '#fef3c7' },
  vendorName: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryBadge: { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  cityText: { fontSize: 12, color: '#64748b' },

  detailsGrid: { gap: 5, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: '#475569', flex: 1 },
  websiteLink: { color: '#2563eb', textDecorationLine: 'underline' },
});
