import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { fetchVendors } from '@/services/vendorService';
import type { Vendor } from '@/constants/vendors';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import { useAuth } from '@/hooks/use-auth';
import type { MaintenanceCreatorRole } from '@/lib/maintenancePermissions';
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

export default function VendorSelectScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { assignVendor, setMarketplaceVendor } = useMaintenanceStore();
  const t = useAppTheme();
  const sponsoredBg = t.isDark ? '#3A2E10' : '#FEF3C7';
  const sponsoredFg = t.isDark ? '#FCD34D' : '#92400E';

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const callerRole: MaintenanceCreatorRole = (user?.role as MaintenanceCreatorRole) ?? 'landlord';

  useEffect(() => {
    fetchVendors().then((data) => {
      setVendors(data);
      setLoading(false);
    });
  }, []);

  // Derive cities and categories from live data
  const availableCities = useMemo(
    () => [...new Set(vendors.map((v) => v.city))].sort(),
    [vendors]
  );

  const availableCategories = useMemo(() => {
    if (!selectedCity) return [];
    const cats = new Set(vendors.filter((v) => v.city === selectedCity).map((v) => v.category));
    return [...cats].sort();
  }, [vendors, selectedCity]);

  const filteredVendors = useMemo(() => {
    if (!selectedCity) return [];
    return vendors.filter((v) => {
      return v.city === selectedCity && (!selectedCategory || v.category === selectedCategory);
    });
  }, [vendors, selectedCity, selectedCategory]);

  const handleSelectVendor = async (vendor: Vendor) => {
    if (!requestId) {
      Alert.alert('Error', 'No maintenance request selected.');
      return;
    }
    setAssigning(true);
    try {
      await assignVendor(requestId, vendor.name, callerRole);
      setMarketplaceVendor(requestId, {
        id: vendor.id,
        name: vendor.name,
        phone: vendor.phone,
        email: vendor.email,
        category: vendor.category,
        city: vendor.city,
        address: vendor.address,
      });
    } finally {
      setAssigning(false);
    }
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: t.bg }]}>
      <View style={[styles.header, { backgroundColor: t.card, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Select Vendor</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={t.text} />
          <Text style={[styles.loadingText, { color: t.textSecondary }]}>Loading vendors…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          {/* City chips */}
          <View style={styles.section}>
            <Text style={[styles.stepLabel, { color: t.textSecondary }]}>STEP 1 — SELECT CITY</Text>
            <Text style={[styles.stepHint, { color: t.textSecondary }]}>Required</Text>
            <View style={styles.chipRow}>
              {availableCities.map((city) => {
                const active = selectedCity === city;
                return (
                  <TouchableOpacity
                    key={city}
                    style={[styles.chip, { backgroundColor: active ? t.accent : t.card, borderColor: active ? t.accent : t.border }]}
                    onPress={() => {
                      setSelectedCity(active ? null : city);
                      setSelectedCategory(null);
                    }}>
                    <Text style={[styles.chipText, { color: active ? t.onAccent : t.text }]}>{city}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Category chips */}
          {selectedCity && (
            <View style={styles.section}>
              <Text style={[styles.stepLabel, { color: t.textSecondary }]}>STEP 2 — FILTER BY CATEGORY</Text>
              <Text style={[styles.stepHint, { color: t.textSecondary }]}>Optional</Text>
              <View style={styles.chipRow}>
                {availableCategories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, { backgroundColor: active ? t.accent : t.card, borderColor: active ? t.accent : t.border }]}
                      onPress={() => setSelectedCategory(active ? null : cat)}>
                      <MaterialCommunityIcons
                        name={(CATEGORY_ICONS[cat] || 'wrench') as any}
                        size={13}
                        color={active ? t.onAccent : t.text}
                      />
                      <Text style={[styles.chipText, { color: active ? t.onAccent : t.text }]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Vendor results */}
          {selectedCity && (
            <View style={styles.section}>
              <Text style={[styles.resultsLabel, { color: t.textSecondary }]}>
                {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}
                {selectedCategory ? ` · ${selectedCategory}` : ''} in {selectedCity}
              </Text>
              {filteredVendors.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="store-off-outline" size={40} color={t.textSecondary} />
                  <Text style={[styles.emptyText, { color: t.textSecondary }]}>No vendors found for this filter.</Text>
                </View>
              ) : (
                filteredVendors.map((vendor) => (
                  <View key={vendor.id} style={[styles.vendorCard, { backgroundColor: t.card, borderColor: vendor.isSponsored ? (t.isDark ? '#7C5E10' : '#FBBF24') : t.border }]}>
                    {vendor.isSponsored && (
                      <View style={[styles.sponsoredBadge, { backgroundColor: sponsoredBg }]}>
                        <MaterialCommunityIcons name="star" size={11} color={sponsoredFg} />
                        <Text style={[styles.sponsoredText, { color: sponsoredFg }]}>Sponsored</Text>
                      </View>
                    )}
                    <View style={styles.vendorHeader}>
                      <View style={[styles.iconCircle, { backgroundColor: vendor.isSponsored ? sponsoredBg : t.chip }]}>
                        <MaterialCommunityIcons
                          name={(CATEGORY_ICONS[vendor.category] || 'wrench') as any}
                          size={20}
                          color={vendor.isSponsored ? sponsoredFg : t.text}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.vendorName, { color: t.text }]}>{vendor.name}</Text>
                        <View style={styles.vendorMeta}>
                          <Text style={[styles.vendorCategory, { color: t.textSecondary }]}>{vendor.category}</Text>
                          <Text style={[styles.vendorCity, { color: t.textSecondary }]}>{vendor.city}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.vendorDetails, { borderTopColor: t.border }]}>
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="map-marker-outline" size={13} color={t.textSecondary} />
                        <Text style={[styles.detailText, { color: t.textSecondary }]}>{vendor.address}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="phone-outline" size={13} color={t.textSecondary} />
                        <Text style={[styles.detailText, { color: t.textSecondary }]}>{vendor.phone}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="email-outline" size={13} color={t.textSecondary} />
                        <Text style={[styles.detailText, { color: t.textSecondary }]}>{vendor.email}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.selectBtn, { backgroundColor: t.accent }, vendor.isSponsored && styles.selectBtnSponsored, assigning && { opacity: 0.6 }]}
                      onPress={() => handleSelectVendor(vendor)}
                      disabled={assigning}>
                      <MaterialCommunityIcons name="check" size={16} color={vendor.isSponsored ? '#fff' : t.onAccent} />
                      <Text style={[styles.selectBtnText, { color: vendor.isSponsored ? '#fff' : t.onAccent }]}>{assigning ? 'Assigning…' : 'Select Vendor'}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {!selectedCity && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="city-variant-outline" size={48} color={t.textSecondary} />
              <Text style={[styles.emptyText, { color: t.textSecondary }]}>Select a city to see available vendors.</Text>
            </View>
          )}
        </ScrollView>
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  content: { padding: 16, gap: 16 },
  section: { gap: 10 },
  stepLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  stepHint: { fontSize: 12, marginTop: -6 },
  resultsLabel: { fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  vendorCard: {
    borderRadius: 16, padding: 14,
    borderWidth: 1, gap: 10, marginBottom: 12,
  },
  sponsoredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  sponsoredText: { fontSize: 11, fontWeight: '700' },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  vendorName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  vendorMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vendorCategory: { fontSize: 12, fontWeight: '600' },
  vendorCity: { fontSize: 12 },
  vendorDetails: { gap: 4, paddingTop: 6, borderTopWidth: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, flex: 1 },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 12, paddingVertical: 12, marginTop: 4,
  },
  selectBtnSponsored: { backgroundColor: '#b45309' },
  selectBtnText: { fontWeight: '700', fontSize: 14 },
});
