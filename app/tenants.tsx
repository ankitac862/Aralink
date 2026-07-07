import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { useTenantStore } from '@/store/tenantStore';
import { usePropertyStore } from '@/store/propertyStore';

export default function TenantsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const { tenants, loadFromSupabase } = useTenantStore();
  const { getPropertyById, getUnitById, loadFromSupabase: loadProperties } = usePropertyStore();
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadFromSupabase(user.id);
        loadProperties(user.id);
      }
    }, [user?.id])
  );

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const secondaryTextColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';

  // When opened from a property, only show tenants linked to that property
  // (units / sub-units under the same property all share the same propertyId)
  const scopedTenants = propertyId
    ? tenants.filter(t => String(t.propertyId) === String(propertyId))
    : tenants;

  const displayTenants = scopedTenants.map(tenant => {
    const property = getPropertyById(tenant.propertyId);
    const unit = tenant.unitId ? getUnitById(tenant.unitId) : null;

    let locationParts: string[] = [];
    if (property) {
      const propertyLabel = property.name || `${property.address1}${property.address2 ? ', ' + property.address2 : ''}`;

      if (property.propertyType === 'commercial' || property.propertyType === 'parking') {
        locationParts.push(`${propertyLabel} (${property.propertyType})`);
      } else if (property.propertyType === 'multi_unit') {
        locationParts.push(propertyLabel);
        if (unit) locationParts.push(`Unit ${unit.name || unit.id}`);
        if (tenant.subUnitName) locationParts.push(`Room ${tenant.subUnitName}`);
      } else {
        locationParts.push(propertyLabel);
        if (tenant.subUnitName) locationParts.push(`Room ${tenant.subUnitName}`);
      }
    }

    return {
      id: tenant.id,
      name: `${tenant.firstName} ${tenant.lastName}`,
      email: tenant.email,
      location: locationParts.join(' / ') || 'Unknown',
      image: tenant.photo || 'https://via.placeholder.com/150',
    };
  });

  const filteredTenants = displayTenants.filter((t) => {
    return !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.location.toLowerCase().includes(searchQuery.toLowerCase());
  });

  interface DisplayTenant {
    id: string;
    name: string;
    email: string;
    location: string;
    image: string;
  }

  const TenantCard = ({ tenant }: { tenant: DisplayTenant }) => (
    <TouchableOpacity
      style={[styles.tenantCard, { backgroundColor: cardBgColor }]}
      onPress={() => router.push(`/tenant-detail?id=${tenant.id}`)}>
      <View style={styles.tenantHeader}>
        <View style={styles.tenantLeft}>
          <Image source={{ uri: tenant.image }} style={styles.tenantAvatar} />
          <View style={styles.tenantInfo}>
            <ThemedText style={[styles.tenantName, { color: textColor }]}>
              {tenant.name}
            </ThemedText>
            <ThemedText style={[styles.tenantUnit, { color: secondaryTextColor }]}>
              {tenant.location}
            </ThemedText>
          </View>
        </View>
      </View>
      <View style={[styles.divider, { borderTopColor: borderColor }]} />
      <View style={styles.emailRow}>
        <MaterialCommunityIcons name="email-outline" size={14} color={secondaryTextColor} />
        <ThemedText style={[styles.emailText, { color: secondaryTextColor }]}>
          {tenant.email}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Top App Bar */}
      <View style={[styles.topBar, { borderBottomColor: borderColor, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: textColor }]}>
          {propertyId ? 'Property Tenants' : 'Manage Tenants'}
        </ThemedText>
        <View style={styles.iconButton} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: cardBgColor, borderColor }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={secondaryTextColor} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search tenants"
            placeholderTextColor={secondaryTextColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Tenants List */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredTenants.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group-outline" size={64} color={secondaryTextColor} />
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>No tenants found</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: secondaryTextColor }]}>
              {searchQuery
                ? 'Try adjusting your search'
                : propertyId
                ? 'No tenants are assigned to this property yet'
                : 'Add your first tenant to get started'}
            </ThemedText>
          </View>
        ) : (
          filteredTenants.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: primaryColor }]} onPress={() => router.push('/add-tenant')}>
        <MaterialCommunityIcons name="plus" size={28} color={onPrimaryColor} />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  listContainer: { flex: 1, paddingHorizontal: 16 },
  tenantCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tenantHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tenantLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  tenantAvatar: { width: 48, height: 48, borderRadius: 24 },
  tenantInfo: { flex: 1 },
  tenantName: { fontSize: 16, fontWeight: '500' },
  tenantUnit: { fontSize: 12, marginTop: 4 },
  divider: { borderTopWidth: 1, marginVertical: 12 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emailText: { fontSize: 11 },
  emptyState: { alignItems: 'center' as const, paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const },
  emptySubtitle: { fontSize: 14, textAlign: 'center' as const },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
