import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useMaintenanceStore } from '@/store/maintenanceStore';
import { StatusChip } from '@/components/maintenance/StatusChip';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';

const statusFilters = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

export default function TenantMaintenanceStatusScreen() {
  const { requests, fetchRequests, loading } = useMaintenanceStore();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch requests when screen loads
  useEffect(() => {
    if (user?.id) {
      fetchRequests(user.id, 'tenant');
    }
  }, [user]);

  const handleRefresh = async () => {
    if (user?.id) {
      setRefreshing(true);
      await fetchRequests(user.id, 'tenant');
      setRefreshing(false);
    }
  };

  const tenantRequests = useMemo(() => {
    // Filter by the actual logged-in user's ID
    const list = requests.filter((req) => req.tenantId === user?.id);
    if (filter === 'all') return list;
    return list.filter((req) => req.status === filter);
  }, [requests, filter, user]);

  const bgColor = colorScheme === 'dark' ? '#0f172a' : '#f8fafc';
  const cardColor = colorScheme === 'dark' ? '#142033' : '#ffffff';
  const textColor = colorScheme === 'dark' ? '#f8fafc' : '#111827';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Maintenance Requests</Text>
        <TouchableOpacity onPress={() => router.push('/tenant-maintenance-request')}>
          <MaterialCommunityIcons name="plus-circle-outline" size={22} color={textColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {statusFilters.map((item) => {
          const active = filter === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(item.value)}>
              <Text style={[styles.filterText, active && { color: '#fff' }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={tenantRequests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: cardColor }]}
            onPress={() => router.push({ pathname: '/tenant-maintenance-detail', params: { id: item.id } })}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <StatusChip status={item.status} />
            </View>
            <Text style={styles.cardSubtitle}>
              {item.property} • {item.unit}
            </Text>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#94a3b8" />
              <Text style={styles.metaText}>
                Updated {new Date(item.updatedAt).toLocaleDateString()} {new Date(item.updatedAt).toLocaleTimeString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptySubtitle}>Submit your first maintenance request to get started.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
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
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    color: '#475569',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

