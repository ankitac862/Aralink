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
import { useAppTheme } from '@/hooks/use-app-theme';

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
  const t = useAppTheme();
  return (
    <View style={dd.wrapper}>
      <Text style={[dd.label, { color: t.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[dd.trigger, { backgroundColor: t.subtle, borderColor: isOpen ? t.accent : t.border }]}
        onPress={onToggle}>
        <Text style={[dd.triggerText, { color: value ? t.text : t.textSecondary }]}>{value || placeholder}</Text>
        <MaterialCommunityIcons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={t.textSecondary} />
      </TouchableOpacity>
      {isOpen && (
        <View style={[dd.list, { backgroundColor: t.card, borderColor: t.border }]}>
          {value && (
            <TouchableOpacity
              style={[dd.item, dd.clearItem, { borderBottomColor: t.border }]}
              onPress={() => { onSelect(null); onToggle(); }}>
              <MaterialCommunityIcons name="close-circle-outline" size={14} color={t.danger} />
              <Text style={[dd.clearText, { color: t.danger }]}>Clear</Text>
            </TouchableOpacity>
          )}
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[dd.item, { borderBottomColor: t.border }, value === opt && { backgroundColor: t.chip }]}
              onPress={() => { onSelect(opt); onToggle(); }}>
              <Text style={[dd.itemText, { color: t.text }, value === opt && { fontWeight: '600' }]}>{opt}</Text>
              {value === opt && <MaterialCommunityIcons name="check" size={15} color={t.accent} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const dd = StyleSheet.create({
  wrapper: { flex: 1, gap: 4, zIndex: 10 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 10,
  },
  triggerText: { fontSize: 13, fontWeight: '500', flex: 1 },
  list: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1 },
  itemText: { fontSize: 13 },
  clearItem: { gap: 6 },
  clearText: { fontSize: 12, fontWeight: '600' },
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Vendor Card ───────────────────────────────────────────────────────────────
function VendorCard({ vendor }: { vendor: Vendor }) {
  const t = useAppTheme();
  const icon = CATEGORY_ICONS[vendor.category] || 'wrench';
  const sponsoredBg = t.isDark ? '#3A2E10' : '#FEF3C7';
  const sponsoredText = t.isDark ? '#FCD34D' : '#92400E';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.card, borderColor: t.border },
        vendor.isSponsored && { borderColor: t.isDark ? '#7C5E10' : '#FBBF24' },
      ]}>
      {vendor.isSponsored && (
        <View style={[styles.sponsoredBadge, { backgroundColor: sponsoredBg }]}>
          <MaterialCommunityIcons name="star" size={11} color={sponsoredText} />
          <Text style={[styles.sponsoredText, { color: sponsoredText }]}>Sponsored</Text>
        </View>
      )}

      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: vendor.isSponsored ? sponsoredBg : t.chip }]}>
          <MaterialCommunityIcons
            name={icon as any}
            size={22}
            color={vendor.isSponsored ? sponsoredText : t.text}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.vendorName, { color: t.text }]}>{vendor.name}</Text>
          <View style={styles.categoryRow}>
            <View style={[styles.categoryBadge, { backgroundColor: t.chip }]}>
              <Text style={[styles.categoryText, { color: t.text }]}>{vendor.category}</Text>
            </View>
            <Text style={[styles.cityText, { color: t.textSecondary }]}>{vendor.city}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.detailsGrid, { borderTopColor: t.border }]}>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color={t.textSecondary} />
          <Text style={[styles.detailText, { color: t.textSecondary }]}>{vendor.address}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="phone-outline" size={14} color={t.textSecondary} />
          <Text style={[styles.detailText, { color: t.textSecondary }]}>{vendor.phone}</Text>
        </View>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="email-outline" size={14} color={t.textSecondary} />
          <Text style={[styles.detailText, { color: t.textSecondary }]}>{vendor.email}</Text>
        </View>
        {vendor.website ? (
          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => Linking.openURL(vendor.website!)}>
            <MaterialCommunityIcons name="web" size={14} color={t.text} />
            <Text style={[styles.detailText, styles.websiteLink, { color: t.text }]} numberOfLines={1}>
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
  const t = useAppTheme();

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
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Marketplace</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: t.card, borderBottomColor: t.border }]}>
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
        <View style={[styles.activeFilters, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
          {filterCity && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: t.chip, borderColor: t.border }]}
              onPress={() => { setFilterCity(null); setFilterCategory(null); }}>
              <MaterialCommunityIcons name="city-variant-outline" size={13} color={t.text} />
              <Text style={[styles.chipText, { color: t.text }]}>{filterCity}</Text>
              <MaterialCommunityIcons name="close" size={12} color={t.text} />
            </TouchableOpacity>
          )}
          {filterCategory && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: t.chip, borderColor: t.border }]}
              onPress={() => setFilterCategory(null)}>
              <MaterialCommunityIcons
                name={(CATEGORY_ICONS[filterCategory] || 'wrench') as any}
                size={13} color={t.text}
              />
              <Text style={[styles.chipText, { color: t.text }]}>{filterCategory}</Text>
              <MaterialCommunityIcons name="close" size={12} color={t.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.clearAll}
            onPress={() => { setFilterCity(null); setFilterCategory(null); }}>
            <Text style={[styles.clearAllText, { color: t.textSecondary }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={t.text} />
          <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading vendors…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VendorCard vendor={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListHeaderComponent={
            <Text style={[styles.resultsLabel, { color: t.textSecondary }]}>
              {filtered.length} vendor{filtered.length !== 1 ? 's' : ''}
              {hasFilters ? ' found' : ' available'}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="store-off-outline" size={52} color={t.textSecondary} />
              <Text style={[styles.emptyText, { color: t.textSecondary }]}>No vendors match your filters.</Text>
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
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  filterBar: {
    flexDirection: 'row', gap: 10, padding: 12,
    borderBottomWidth: 1,
    zIndex: 20,
  },

  activeFilters: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  clearAll: { marginLeft: 4 },
  clearAllText: { fontSize: 12, fontWeight: '600' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  resultsLabel: { fontSize: 13, fontWeight: '600', marginBottom: 12, paddingTop: 4 },
  list: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, textAlign: 'center' },

  card: {
    borderRadius: 16, padding: 14,
    borderWidth: 1, gap: 10,
  },
  sponsoredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  sponsoredText: { fontSize: 11, fontWeight: '700' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vendorName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  categoryBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  categoryText: { fontSize: 11, fontWeight: '600' },
  cityText: { fontSize: 12 },

  detailsGrid: { gap: 5, paddingTop: 4, borderTopWidth: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, flex: 1 },
  websiteLink: { textDecorationLine: 'underline' },
});
