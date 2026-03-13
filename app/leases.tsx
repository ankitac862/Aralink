/**
 * Leases List Screen
 * 
 * Displays all leases for a property or all properties.
 * Allows viewing, downloading, and managing lease documents.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { 
  DbLease, 
  fetchLeases, 
  fetchLeasesByProperty,
  sendLeaseToTenant,
} from '@/lib/supabase';
import { usePropertyStore } from '@/store/propertyStore';

const STATUS_COLORS = {
  draft: '#6b7280',
  generated: '#f59e0b',
  uploaded: '#3b82f6',
  sent: '#8b5cf6',
  signed: '#10b981',
};

const STATUS_LABELS = {
  draft: 'Draft',
  generated: 'Generated',
  uploaded: 'Uploaded',
  sent: 'Sent to Tenant',
  signed: 'Signed',
};

export default function LeasesScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ propertyId?: string }>();
  
  const { user } = useAuthStore();
  const { getPropertyById } = usePropertyStore();
  
  const [leases, setLeases] = useState<DbLease[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  const property = params.propertyId ? getPropertyById(params.propertyId) : null;

  useEffect(() => {
    loadLeases();
  }, [user?.id, params.propertyId]);

  const loadLeases = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      let data: DbLease[];
      if (params.propertyId) {
        data = await fetchLeasesByProperty(params.propertyId);
      } else {
        data = await fetchLeases(user.id);
      }
      setLeases(data);
    } catch (error) {
      console.error('Error loading leases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLease = (lease: DbLease) => {
    if (lease.document_url) {
      Linking.openURL(lease.document_url);
    } else {
      Alert.alert('No Document', 'This lease does not have a document attached yet.');
    }
  };

  const handleSendToTenant = async (lease: DbLease) => {
    if (!lease.tenant_id && !lease.application_id) {
      Alert.alert('No Tenant', 'Please assign a tenant or applicant to this lease first.');
      return;
    }

    console.log('📤 Sending lease from list:', {
      leaseId: lease.id,
      tenant_id: lease.tenant_id,
      application_id: lease.application_id,
      status: lease.status
    });

    try {
      const result = await sendLeaseToTenant(lease.id, lease.tenant_id || null);
      if (result) {
        Alert.alert(
          'Success', 
          lease.application_id 
            ? 'Lease has been sent to the applicant.'
            : 'Lease has been sent to the tenant.'
        );
        loadLeases(); // Refresh
      } else {
        Alert.alert('Error', 'Failed to send lease. Please try again.');
      }
    } catch (error) {
      console.error('Error sending lease:', error);
      Alert.alert('Error', 'An error occurred while sending the lease.');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPropertyAddress = (lease: DbLease) => {
    const prop = getPropertyById(lease.property_id);
    return prop ? `${prop.address1}, ${prop.city}` : 'Unknown Property';
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          {property ? `Leases - ${property.address1}` : 'All Leases'}
        </ThemedText>
        <TouchableOpacity 
          onPress={() => router.push(params.propertyId 
            ? `/lease-wizard?propertyId=${params.propertyId}` 
            : '/lease-wizard'
          )}
        >
          <MaterialCommunityIcons name="plus" size={24} color={primaryColor} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
            Loading leases...
          </ThemedText>
        </View>
      ) : leases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color={secondaryTextColor} />
          <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
            No Leases Yet
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
            Create your first lease by tapping the + button
          </ThemedText>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: primaryColor }]}
            onPress={() => router.push(params.propertyId 
              ? `/lease-wizard?propertyId=${params.propertyId}` 
              : '/properties'
            )}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <ThemedText style={styles.createButtonText}>Create Lease</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        >
          {leases.map((lease) => (
            <View 
            key={lease.id}
              style={[styles.leaseCard, { backgroundColor: cardBgColor, borderColor }]}
            >
            <View style={styles.leaseHeader}>
                <View style={styles.leaseInfo}>
                  <ThemedText style={[styles.leaseAddress, { color: textColor }]}>
                    {getPropertyAddress(lease)}
                </ThemedText>
                  <View style={[
                  styles.statusBadge,
                    { backgroundColor: `${STATUS_COLORS[lease.status]}20` }
                  ]}>
                    <View style={[
                      styles.statusDot, 
                      { backgroundColor: STATUS_COLORS[lease.status] }
                    ]} />
                    <ThemedText style={[
                    styles.statusText,
                      { color: STATUS_COLORS[lease.status] }
                  ]}>
                      {STATUS_LABELS[lease.status]}
                </ThemedText>
              </View>
            </View>
                <MaterialCommunityIcons 
                  name="chevron-right" 
                  size={24} 
                  color={secondaryTextColor} 
                />
              </View>

              <View style={[styles.leaseDates, { borderTopColor: borderColor }]}>
                <View style={styles.dateItem}>
                  <ThemedText style={[styles.dateLabel, { color: secondaryTextColor }]}>
                    Start
                  </ThemedText>
                  <ThemedText style={[styles.dateValue, { color: textColor }]}>
                    {formatDate(lease.effective_date)}
                  </ThemedText>
                </View>
                <View style={styles.dateItem}>
                  <ThemedText style={[styles.dateLabel, { color: secondaryTextColor }]}>
                    End
                  </ThemedText>
                  <ThemedText style={[styles.dateValue, { color: textColor }]}>
                    {formatDate(lease.expiry_date)}
                  </ThemedText>
                </View>
                <View style={styles.dateItem}>
                  <ThemedText style={[styles.dateLabel, { color: secondaryTextColor }]}>
                    Created
                </ThemedText>
                  <ThemedText style={[styles.dateValue, { color: textColor }]}>
                    {formatDate(lease.created_at)}
                </ThemedText>
                </View>
              </View>

              <View style={styles.leaseActions}>
                {lease.document_url && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: `${primaryColor}15` }]}
                    onPress={() => handleViewLease(lease)}
                  >
                    <MaterialCommunityIcons name="eye-outline" size={18} color={primaryColor} />
                    <ThemedText style={[styles.actionButtonText, { color: primaryColor }]}>
                      View
                    </ThemedText>
                  </TouchableOpacity>
                )}
                
                {lease.document_url && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: `${primaryColor}15` }]}
                    onPress={() => Linking.openURL(lease.document_url!)}
                  >
                    <MaterialCommunityIcons name="download" size={18} color={primaryColor} />
                    <ThemedText style={[styles.actionButtonText, { color: primaryColor }]}>
                      Download
                </ThemedText>
                  </TouchableOpacity>
                )}

                {(lease.status === 'generated' || lease.status === 'uploaded') && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#8b5cf615' }]}
                    onPress={() => handleSendToTenant(lease)}
                  >
                    <MaterialCommunityIcons name="send" size={18} color="#8b5cf6" />
                    <ThemedText style={[styles.actionButtonText, { color: '#8b5cf6' }]}>
                      Send
                </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
        ))}
      </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  leaseCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  leaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  leaseInfo: {
    flex: 1,
    gap: 8,
  },
  leaseAddress: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  leaseDates: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 24,
  },
  dateItem: {
    gap: 2,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  leaseActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
