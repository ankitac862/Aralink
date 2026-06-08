import React, { useState, useMemo } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { VENDORS, VENDOR_CITIES, VENDOR_CATEGORIES, Vendor } from '@/constants/vendors';
import { useMaintenanceStore } from '@/store/maintenanceStore';
import { useAuth } from '@/hooks/use-auth';
import type { MaintenanceCreatorRole } from '@/lib/maintenancePermissions';

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

  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const callerRole: MaintenanceCreatorRole = (user?.role as MaintenanceCreatorRole) ?? 'landlord';

  const filteredVendors = useMemo(() => {
    if (!selectedCity) return [];
    return VENDORS.filter((v) => {
      const cityMatch = v.city === selectedCity;
      const categoryMatch = !selectedCategory || v.category === selectedCategory;
      return cityMatch && categoryMatch;
    }).sort((a, b) => (b.isSponsored ? 1 : 0) - (a.isSponsored ? 1 : 0));
  }, [selectedCity, selectedCategory]);

  const availableCategories = useMemo(() => {
    if (!selectedCity) return [];
    const cats = new Set(VENDORS.filter((v) => v.city === selectedCity).map((v) => v.category));
    return VENDOR_CATEGORIES.filter((c) => cats.has(c));
  }, [selectedCity]);

  const handleSelectVendor = async (vendor: Vendor) => {
    if (!requestId) {
      Alert.alert('Error', 'No maintenance request selected.');
      return;
    }
    setAssigning(true);
    try {
      // Persist vendor name to Supabase via existing assignVendor service
      await assignVendor(requestId, vendor.name, callerRole);

      // Store full vendor details locally in Zustand
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Vendor</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Step 1: City Filter */}
        <View style={styles.section}>
          <Text style={styles.stepLabel}>STEP 1 — SELECT CITY</Text>
          <Text style={styles.stepHint}>Required</Text>
          <View style={styles.chipRow}>
            {VENDOR_CITIES.map((city) => {
              const active = selectedCity === city;
              return (
                <TouchableOpacity
                  key={city}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    setSelectedCity(active ? null : city);
                    setSelectedCategory(null);
                  }}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{city}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Step 2: Category Filter (only once city is selected) */}
        {selectedCity && (
          <View style={styles.section}>
            <Text style={styles.stepLabel}>STEP 2 — FILTER BY CATEGORY</Text>
            <Text style={styles.stepHint}>Optional</Text>
            <View style={styles.chipRow}>
              {availableCategories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedCategory(active ? null : cat)}>
                    <MaterialCommunityIcons
                      name={(CATEGORY_ICONS[cat] || 'wrench') as any}
                      size={13}
                      color={active ? '#fff' : '#2563eb'}
                    />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Vendor Results */}
        {selectedCity && (
          <View style={styles.section}>
            <Text style={styles.resultsLabel}>
              {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} found
              {selectedCategory ? ` · ${selectedCategory}` : ''}
              {' in '}
              {selectedCity}
            </Text>

            {filteredVendors.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="store-off-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptyText}>No vendors found for this filter.</Text>
              </View>
            ) : (
              filteredVendors.map((vendor) => (
                <View
                  key={vendor.id}
                  style={[styles.vendorCard, vendor.isSponsored && styles.vendorCardSponsored]}>
                  {vendor.isSponsored && (
                    <View style={styles.sponsoredBadge}>
                      <MaterialCommunityIcons name="star" size={11} color="#92400e" />
                      <Text style={styles.sponsoredText}>Sponsored</Text>
                    </View>
                  )}
                  <View style={styles.vendorHeader}>
                    <View
                      style={[
                        styles.iconCircle,
                        vendor.isSponsored && styles.iconCircleSponsored,
                      ]}>
                      <MaterialCommunityIcons
                        name={(CATEGORY_ICONS[vendor.category] || 'wrench') as any}
                        size={20}
                        color={vendor.isSponsored ? '#b45309' : '#2563eb'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vendorName}>{vendor.name}</Text>
                      <View style={styles.vendorMeta}>
                        <Text style={styles.vendorCategory}>{vendor.category}</Text>
                        <Text style={styles.vendorCity}>{vendor.city}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.vendorDetails}>
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="map-marker-outline" size={13} color="#64748b" />
                      <Text style={styles.detailText}>{vendor.address}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="phone-outline" size={13} color="#64748b" />
                      <Text style={styles.detailText}>{vendor.phone}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="email-outline" size={13} color="#64748b" />
                      <Text style={styles.detailText}>{vendor.email}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.selectBtn,
                      vendor.isSponsored && styles.selectBtnSponsored,
                      assigning && { opacity: 0.6 },
                    ]}
                    onPress={() => handleSelectVendor(vendor)}
                    disabled={assigning}>
                    <MaterialCommunityIcons name="check" size={16} color="#fff" />
                    <Text style={styles.selectBtnText}>
                      {assigning ? 'Assigning…' : 'Select Vendor'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {!selectedCity && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="city-variant-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>Select a city to see available vendors.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
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
  content: { padding: 16, gap: 16 },

  section: { gap: 10 },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  stepHint: { fontSize: 12, color: '#64748b', marginTop: -6 },
  resultsLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  chipTextActive: { color: '#fff' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },

  vendorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    marginBottom: 12,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSponsored: { backgroundColor: '#fef3c7' },
  vendorName: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  vendorMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vendorCategory: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  vendorCity: { fontSize: 12, color: '#64748b' },

  vendorDetails: { gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: '#475569', flex: 1 },

  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  selectBtnSponsored: { backgroundColor: '#b45309' },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
