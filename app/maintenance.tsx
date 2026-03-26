import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface MaintenanceRequest {
  id: string;
  title: string;
  unit: string;
  address: string;
  status: 'new' | 'in-progress' | 'resolved' | 'urgent';
  icon: string;
  submittedDate: string;
}

const MOCK_REQUESTS: MaintenanceRequest[] = [
  {
    id: '1024',
    title: 'Leaky Kitchen Faucet',
    unit: 'Unit 4B',
    address: '123 Main St',
    status: 'in-progress',
    icon: 'faucet',
    submittedDate: 'Oct 26',
  },
  {
    id: '1023',
    title: 'Broken AC Unit',
    unit: 'Unit 12A',
    address: '456 Oak Ave',
    status: 'resolved',
    icon: 'ac-unit',
    submittedDate: 'Oct 25',
  },
  {
    id: '1025',
    title: 'Living Room Light Flickering',
    unit: 'Unit 7C',
    address: '789 Pine Ln',
    status: 'new',
    icon: 'lightbulb',
    submittedDate: 'Oct 27',
  },
  {
    id: '1026',
    title: 'Water Heater Leaking',
    unit: 'Unit 2F',
    address: '321 Elm St',
    status: 'urgent',
    icon: 'water-opacity',
    submittedDate: 'Oct 27',
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'resolved':
      return '#10b981';
    case 'in-progress':
      return '#f59e0b';
    case 'urgent':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

export default function MaintenanceScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101622' : '#f6f6f8';
  const cardBgColor = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const secondaryTextColor = isDark ? '#94a3b8' : '#475569';
  const primaryColor = '#137fec';

  const filteredRequests = MOCK_REQUESTS.filter((r) => {
    const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filter === 'all' || r.status === filter;
    return matchSearch && matchFilter;
  });

  const RequestCard = ({ request }: { request: MaintenanceRequest }) => {
    const statusColor = getStatusColor(request.status);
    const isBorder = request.status === 'urgent';

    return (
      <TouchableOpacity
        style={[
          styles.requestCard,
          {
            backgroundColor: cardBgColor,
            borderColor: isBorder ? statusColor : borderColor,
            borderWidth: isBorder ? 1.5 : 1,
          },
        ]}
        onPress={() => router.push('/maintenance-detail')}>
        <View style={styles.requestLeft}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: isBorder ? statusColor + '20' : primaryColor + '10' },
            ]}>
            <MaterialCommunityIcons
              name={request.icon as any}
              size={24}
              color={isBorder ? statusColor : primaryColor}
            />
          </View>
          <View style={styles.requestContent}>
            <ThemedText style={[styles.requestTitle, { color: textColor }]}>
              {request.title}
            </ThemedText>
            <ThemedText style={[styles.requestLocation, { color: secondaryTextColor }]}>
              {request.unit} • {request.address}
            </ThemedText>
            <ThemedText style={[styles.requestId, { color: secondaryTextColor }]}>
              #REQ-{request.id} • Submitted: {request.submittedDate}
            </ThemedText>
          </View>
        </View>
        <View style={styles.statusBadgeContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <ThemedText style={[styles.statusText, { color: statusColor, fontSize: 11 }]}>
              {request.status === 'in-progress'
                ? 'In Progress'
                : request.status.charAt(0).toUpperCase() + request.status.slice(1)}
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
        <TouchableOpacity style={styles.iconButton}>
          <MaterialCommunityIcons name="menu" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>Maintenance Requests</ThemedText>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/alerts')}>
          <MaterialCommunityIcons name="bell" size={24} color={textColor} />
        </TouchableOpacity>
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
            placeholder="Search by request ID or unit"
            placeholderTextColor={secondaryTextColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}>
          {['all', 'new', 'in-progress', 'resolved'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.chip,
                filter === status
                  ? [styles.chipActive, { backgroundColor: primaryColor }]
                  : [styles.chipInactive, { backgroundColor: cardBgColor, borderColor }],
              ]}
              onPress={() => setFilter(status)}>
              <ThemedText
                style={[
                  styles.chipText,
                  filter === status
                    ? { color: 'white', fontWeight: '600' }
                    : { color: textColor, fontWeight: '500' },
                ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </ThemedText>
              {status === 'new' && (
                <View
                  style={[
                    styles.chipBadge,
                    { backgroundColor: filter === status ? 'rgba(255,255,255,0.3)' : (isDark ? 'rgba(148,163,184,0.2)' : 'rgba(107,114,128,0.2)') },
                  ]}>
                  <ThemedText
                    style={{
                      color: filter === status ? 'white' : secondaryTextColor,
                      fontSize: 9,
                      fontWeight: '600',
                    }}>
                    3
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Requests List */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredRequests.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primaryColor }]}
        onPress={() => router.push('/maintenance-detail')}>
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
    borderRadius: 12,
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
  chipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipsContent: {
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
  },
  chipActive: {
    borderWidth: 0,
  },
  chipInactive: {
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chipBadge: {
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  requestLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestContent: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestLocation: {
    fontSize: 13,
    marginTop: 4,
  },
  requestId: {
    fontSize: 12,
    marginTop: 4,
  },
  statusBadgeContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
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
    shadowColor: '#137fec',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
