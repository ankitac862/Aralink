import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useMaintenanceStore } from '@/store/maintenanceStore';
import { StatusChip } from '@/components/maintenance/StatusChip';
import { useAuth } from '@/hooks/use-auth';

const FILTERS = [
  { label: 'New', value: 'new' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

export default function LandlordMaintenanceOverviewScreen() {
  const { requests, fetchRequests } = useMaintenanceStore();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('new');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch landlord's maintenance requests when screen loads
  useEffect(() => {
    if (user?.id) {
      console.log('📡 Fetching maintenance requests for landlord:', user.id);
      fetchRequests(user.id, 'landlord');
    }
  }, [user]);

  const handleRefresh = async () => {
    if (user?.id) {
      setRefreshing(true);
      await fetchRequests(user.id, 'landlord');
      setRefreshing(false);
    }
  };

  const filteredRequests = useMemo(() => {
    console.log('🔍 Total requests in store:', requests.length);
    console.log('🔍 Filtering by status:', statusFilter);
    
    return requests.filter((req) => {
      const matchStatus = statusFilter ? req.status === statusFilter : true;
      const searchTerm = query.toLowerCase();
      const matchSearch =
        req.title.toLowerCase().includes(searchTerm) ||
        req.property.toLowerCase().includes(searchTerm) ||
        req.id.toLowerCase().includes(searchTerm);
      return matchStatus && matchSearch;
    });
  }, [requests, query, statusFilter]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maintenance Queue</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <MaterialCommunityIcons name="magnify" size={18} color="#94a3b8" />
          <TextInput
            placeholder="Search by request, tenant or property"
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active = statusFilter === filter.value;
          return (
            <TouchableOpacity
              key={filter.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatusFilter(filter.value)}>
              <Text style={[styles.filterText, active && { color: '#fff' }]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/landlord-maintenance-detail', params: { id: item.id } })}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <StatusChip status={item.status} />
            </View>
            <Text style={styles.cardSubtitle}>
              {item.property} • {item.unit}
            </Text>
            <Text style={styles.cardTenant}>Tenant: {item.tenantName}</Text>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="calendar" size={16} color="#94a3b8" />
              <Text style={styles.metaText}>
                Submitted {new Date(item.createdAt).toLocaleDateString()} at{' '}
                {new Date(item.createdAt).toLocaleTimeString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontWeight: '600',
    color: '#1e293b',
  },
  card: {
    backgroundColor: '#fff',
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 12,
  },
  cardSubtitle: {
    color: '#475569',
    fontWeight: '600',
  },
  cardTenant: {
    fontSize: 13,
    color: '#475569',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#94a3b8',
  },
});

