import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { useTenantStore } from '@/store/tenantStore';
import { usePropertyStore } from '@/store/propertyStore';
import { getTenantLeaseStatus } from '@/lib/supabase';

export default function TenantsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { tenants, loadFromSupabase, isLoading } = useTenantStore();
  const { getPropertyById, getUnitById, loadFromSupabase: loadProperties } = usePropertyStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [leaseStatuses, setLeaseStatuses] = useState<Record<string, 'active' | 'inactive' | 'pending'>>({});

  // Load tenants from Supabase on mount
  useEffect(() => {
    if (user?.id) {
      loadFromSupabase(user.id);
      loadProperties(user.id);
    }
  }, [user?.id]);

  // Load lease statuses for all tenants
  useEffect(() => {
    const loadLeaseStatuses = async () => {
      const statuses: Record<string, 'active' | 'inactive' | 'pending'> = {};
      for (const tenant of tenants) {
        const status = await getTenantLeaseStatus(tenant.id);
        statuses[tenant.id] = status;
      }
      setLeaseStatuses(statuses);
    };

    if (tenants.length > 0) {
      loadLeaseStatuses();
    }
  }, [tenants]);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101622' : '#f4f6f8';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e0e0e0';
  const textColor = isDark ? '#e0e0e0' : '#212529';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6c757d';
  const primaryColor = '#005a9c';
  const successColor = '#28a745';

  // Transform tenants for display
  const displayTenants = tenants.map(tenant => {
    const property = getPropertyById(tenant.propertyId);
    const unit = tenant.unitId ? getUnitById(tenant.unitId) : null;
    
    // Build location string based on property type
    let locationParts: string[] = [];
    if (property) {
      // Use property name if available, otherwise use address
      const propertyLabel = property.name || `${property.address1}${property.address2 ? ', ' + property.address2 : ''}`;
      
      // For commercial/parking properties, just show the property
      if (property.propertyType === 'commercial' || property.propertyType === 'parking') {
        locationParts.push(`${propertyLabel} (${property.propertyType})`);
      } else if (property.propertyType === 'multi_unit') {
        // For multi-unit, show property and unit/room
        locationParts.push(propertyLabel);
        if (unit) {
          locationParts.push(`Unit ${unit.name || unit.id}`);
        }
        if (tenant.unitName) {
          locationParts.push(`Room ${tenant.unitName}`);
        }
      } else {
        // For single_unit properties
        locationParts.push(propertyLabel);
        if (tenant.unitName) {
          locationParts.push(`Room ${tenant.unitName}`);
        }
      }
    }
    
    return {
      id: tenant.id,
      name: `${tenant.firstName} ${tenant.lastName}`,
      email: tenant.email,
      location: locationParts.join(' / ') || 'Unknown',
      status: leaseStatuses[tenant.id] || 'inactive',
      image: tenant.photo || 'https://via.placeholder.com/150',
    };
  });

  const filteredTenants = displayTenants.filter((t) => {
    const matchSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  interface DisplayTenant {
    id: string;
    name: string;
    email: string;
    location: string;
    status: 'active' | 'inactive' | 'pending';
    image: string;
  }

  const TenantCard = ({ tenant }: { tenant: DisplayTenant }) => {
    return (
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
        <View style={styles.statusRow}>
          <View style={styles.emailContainer}>
            <MaterialCommunityIcons name="email-outline" size={14} color={secondaryTextColor} />
            <ThemedText style={[styles.emailText, { color: secondaryTextColor }]}>
              {tenant.email}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: 
                  tenant.status === 'active' ? `${successColor}19` : 
                  tenant.status === 'pending' ? '#fef3c7' : '#f0f0f0',
              },
            ]}>
            <ThemedText
              style={[
                styles.statusBadgeText,
                { 
                  color: 
                    tenant.status === 'active' ? successColor : 
                    tenant.status === 'pending' ? '#f59e0b' : secondaryTextColor 
                },
              ]}>
              {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Top App Bar */}
      <View style={[styles.topBar, { borderBottomColor: borderColor, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: textColor }]}>
          Manage Tenants
        </ThemedText>
        <View style={styles.iconButton} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: cardBgColor, borderColor }]}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={secondaryTextColor}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search tenants"
            placeholderTextColor={secondaryTextColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: isDark ? '#1a2332' : '#f4f6f8' }]}>
        {(['all', 'active', 'pending', 'inactive'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filterStatus === status && [styles.filterButtonActive, { backgroundColor: cardBgColor }],
              filterStatus !== status && { backgroundColor: cardBgColor },
            ]}
            onPress={() => setFilterStatus(status)}>
            <ThemedText
              style={[
                styles.filterButtonText,
                filterStatus === status && { color: primaryColor, fontWeight: '600' },
              ]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tenants List */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredTenants.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group-outline" size={64} color={secondaryTextColor} />
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
              No tenants found
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: secondaryTextColor }]}>
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
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
        <MaterialCommunityIcons name="plus" size={28} color="white" />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
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
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tenantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tenantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '500',
  },
  tenantUnit: {
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  emailText: {
    fontSize: 11,
    fontWeight: '400',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
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
