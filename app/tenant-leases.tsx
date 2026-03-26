/**
 * Tenant Leases Screen
 * 
 * Shows all leases for the tenant:
 * - Leases pending signature
 * - Signed leases
 * - Can view, download, and sign leases
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { fetchLeasesByTenant, DbLease } from '@/lib/supabase';

export default function TenantLeasesScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [leases, setLeases] = useState<DbLease[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';
  const successColor = '#10b981';
  const warningColor = '#f59e0b';
  const errorColor = '#ef4444';

  useEffect(() => {
    loadLeases();
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadLeases();
      }
    }, [user?.id])
  );

  const loadLeases = async () => {
    if (!user?.id) {
      console.log('⚠️ No user ID available for loading leases');
      return;
    }

    console.log('📋 [Tenant Leases] Loading leases for user:', user.id);
    setIsLoading(true);
    try {
      const data = await fetchLeasesByTenant(user.id);
      console.log('✅ [Tenant Leases] Loaded leases:', data.length);
      console.log('📄 [Tenant Leases] Lease details:', JSON.stringify(data.map(l => ({
        id: l.id,
        status: l.status,
        tenant_id: l.tenant_id,
        application_id: l.application_id
      })), null, 2));
      setLeases(data);
    } catch (error) {
      console.error('❌ [Tenant Leases] Error loading leases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLeases();
    setIsRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return secondaryTextColor;
      case 'generated':
      case 'uploaded':
        return primaryColor;
      case 'sent':
        return warningColor;
      case 'signed':
        return warningColor;
      case 'signed_pending_move_in':
        return successColor;
      case 'active':
        return successColor;
      default:
        return secondaryTextColor;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return 'file-document-outline';
      case 'generated':
      case 'uploaded':
        return 'file-document';
      case 'sent':
        return 'email-outline';
      case 'signed':
        return 'clock-outline';
      case 'signed_pending_move_in':
        return 'file-document-check';
      case 'active':
        return 'home-variant';
      default:
        return 'file-document-outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'generated':
        return 'Created';
      case 'uploaded':
        return 'Uploaded';
      case 'sent':
        return 'Waiting for your signature';
      case 'signed':
        return 'Waiting for landlord approval';
      case 'signed_pending_move_in':
        return 'Lease fully signed';
      case 'active':
        return 'Active';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPropertyAddress = (lease: DbLease) => {
    if (lease.form_data?.unitAddress) {
      const addr = lease.form_data.unitAddress;
      return `${addr.unit ? `Unit ${addr.unit}, ` : ''}${addr.streetNumber} ${addr.streetName}, ${addr.city}`;
    }
    return 'Property Address';
  };

  const renderLeaseCard = (lease: DbLease) => {
    const needsSignature = lease.status === 'sent';
    const awaitingLandlord = lease.status === 'signed';

    return (
      <TouchableOpacity
        key={lease.id}
        style={[
          styles.leaseCard,
          { backgroundColor: cardBgColor, borderColor },
          (needsSignature || awaitingLandlord) && { borderColor: warningColor, borderWidth: 2 },
        ]}
        onPress={() => router.push(`/tenant-lease-detail?id=${lease.id}`)}
      >
        {/* Status Badge */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(lease.status)}20` }]}>
            <MaterialCommunityIcons
              name={getStatusIcon(lease.status)}
              size={14}
              color={getStatusColor(lease.status)}
            />
            <ThemedText style={[styles.statusText, { color: getStatusColor(lease.status) }]}>
              {getStatusLabel(lease.status)}
            </ThemedText>
          </View>

          {needsSignature && (
            <View style={[styles.actionBadge, { backgroundColor: `${warningColor}20` }]}>
              <MaterialCommunityIcons name="alert-circle" size={14} color={warningColor} />
              <ThemedText style={[styles.actionText, { color: warningColor }]}>
                Action Required
              </ThemedText>
            </View>
          )}
          {!needsSignature && awaitingLandlord && (
            <View style={[styles.actionBadge, { backgroundColor: `${warningColor}20` }]}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={warningColor} />
              <ThemedText style={[styles.actionText, { color: warningColor }]}>
                Waiting on landlord
              </ThemedText>
            </View>
          )}
        </View>

        {/* Property Address */}
        <ThemedText style={[styles.propertyAddress, { color: textColor }]}>
          {getPropertyAddress(lease)}
        </ThemedText>

        {/* Dates */}
        <View style={styles.dateRow}>
          <View style={styles.dateItem}>
            <MaterialCommunityIcons name="calendar-start" size={16} color={secondaryTextColor} />
            <ThemedText style={[styles.dateLabel, { color: secondaryTextColor }]}>Start:</ThemedText>
            <ThemedText style={[styles.dateValue, { color: textColor }]}>
              {formatDate(lease.effective_date || '')}
            </ThemedText>
          </View>

          {lease.expiry_date && (
            <View style={styles.dateItem}>
              <MaterialCommunityIcons name="calendar-end" size={16} color={secondaryTextColor} />
              <ThemedText style={[styles.dateLabel, { color: secondaryTextColor }]}>End:</ThemedText>
              <ThemedText style={[styles.dateValue, { color: textColor }]}>
                {formatDate(lease.expiry_date)}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <ThemedText style={[styles.createdDate, { color: secondaryTextColor }]}>
            Created {formatDate(lease.created_at)}
          </ThemedText>
          <MaterialCommunityIcons name="chevron-right" size={20} color={secondaryTextColor} />
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
          Loading your leases...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>My Leases</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {leases.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        >
          <MaterialCommunityIcons name="file-document-outline" size={64} color={secondaryTextColor} />
          <ThemedText style={[styles.emptyTitle, { color: textColor }]}>No Leases Yet</ThemedText>
          <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
            Your leases will appear here once they're sent to you
          </ThemedText>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        >
          {/* Pending Signatures Section */}
          {leases.some(l => l.status === 'sent') && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: warningColor }]}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={warningColor} />
                {' '}Awaiting Your Signature
              </ThemedText>
              {leases.filter(l => l.status === 'sent').map(renderLeaseCard)}
            </View>
          )}

          {/* Waiting on landlord */}
          {leases.some(l => l.status === 'signed') && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: warningColor }]}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={warningColor} />
                {' '}Waiting for Landlord Approval
              </ThemedText>
              {leases.filter(l => l.status === 'signed').map(renderLeaseCard)}
            </View>
          )}

          {/* Fully signed */}
          {leases.some(l => l.status === 'signed_pending_move_in' || l.status === 'active') && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: successColor }]}>
                <MaterialCommunityIcons name="check-circle" size={18} color={successColor} />
                {' '}Fully Signed / Active
              </ThemedText>
              {leases
                .filter(l => l.status === 'signed_pending_move_in' || l.status === 'active')
                .map(renderLeaseCard)}
            </View>
          )}

          {/* Other Leases Section */}
          {leases.some(
            l =>
              !['sent', 'signed', 'signed_pending_move_in', 'active'].includes(l.status)
          ) && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Other Leases
              </ThemedText>
              {leases
                .filter(
                  l =>
                    !['sent', 'signed', 'signed_pending_move_in', 'active'].includes(l.status)
                )
                .map(renderLeaseCard)}
            </View>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  propertyAddress: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  createdDate: {
    fontSize: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
  },
});
