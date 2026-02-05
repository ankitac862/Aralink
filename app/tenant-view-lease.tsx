/**
 * Tenant View Lease Screen
 * 
 * Allows tenants to view and download lease documents sent to them.
 * Read-only view - tenants cannot modify or send leases.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { fetchLeasesByTenant, DbLease } from '@/lib/supabase';
import { canViewLease } from '@/services/lease-generation-service';

export default function TenantViewLeaseScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: leaseId } = useLocalSearchParams<{ id?: string }>();
  
  const { user } = useAuthStore();
  
  const [leases, setLeases] = useState<DbLease[]>([]);
  const [selectedLease, setSelectedLease] = useState<DbLease | null>(null);
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

  useEffect(() => {
    loadLeases();
  }, [user?.id]);

  useEffect(() => {
    // If a specific lease ID is provided, find and select it
    if (leaseId && leases.length > 0) {
      const lease = leases.find(l => l.id === leaseId);
      if (lease) {
        setSelectedLease(lease);
      }
    }
  }, [leaseId, leases]);

  const loadLeases = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch leases where this user is the tenant
      const tenantLeases = await fetchLeasesByTenant(user.id);
      
      // Filter to only show sent/signed leases
      const viewableLeases = tenantLeases.filter(
        lease => ['sent', 'signed'].includes(lease.status)
      );
      
      setLeases(viewableLeases);
      
      // Auto-select if only one lease or if specific ID provided
      if (viewableLeases.length === 1) {
        setSelectedLease(viewableLeases[0]);
      } else if (leaseId) {
        const lease = viewableLeases.find(l => l.id === leaseId);
        if (lease) {
          setSelectedLease(lease);
        }
      }
    } catch (error) {
      console.error('Error loading leases:', error);
      Alert.alert('Error', 'Failed to load leases');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLeases();
    setIsRefreshing(false);
  };

  const handleViewDocument = async (documentUrl: string) => {
    try {
      const canOpen = await Linking.canOpenURL(documentUrl);
      if (canOpen) {
        await Linking.openURL(documentUrl);
      } else {
        Alert.alert('Error', 'Cannot open document');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
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

  if (leases.length === 0) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>
            My Leases
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.centerContent, { flex: 1 }]}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color={secondaryTextColor} />
          <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
            No Leases Yet
          </ThemedText>
          <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
            You don't have any lease documents yet.{'\n'}
            Your landlord will send you a lease when ready.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // If we have a selected lease, show its details
  if (selectedLease) {
    const formData = selectedLease.form_data;
    const totalRent = (formData?.baseRent || 0) + (formData?.parkingRent || 0) + (formData?.otherServicesRent || 0);

    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => {
            if (leases.length > 1) {
              setSelectedLease(null);
            } else {
              router.back();
            }
          }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>
            Lease Agreement
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: `${successColor}15` }]}>
            <MaterialCommunityIcons name="check-circle" size={24} color={successColor} />
            <View style={styles.statusContent}>
              <ThemedText style={[styles.statusLabel, { color: successColor }]}>
                Lease Received
              </ThemedText>
              <ThemedText style={[styles.statusDate, { color: secondaryTextColor }]}>
                Sent on {formatDate(selectedLease.updated_at)}
              </ThemedText>
            </View>
          </View>

          {/* Property Info */}
          {formData && (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="home-outline" size={20} color={primaryColor} />
                <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                  Property Details
                </ThemedText>
              </View>
              
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Address
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                  {formData.unitAddress ? 
                    `${formData.unitAddress.unit ? `Unit ${formData.unitAddress.unit}, ` : ''}${formData.unitAddress.streetNumber} ${formData.unitAddress.streetName}, ${formData.unitAddress.city}` 
                    : 'N/A'}
                </ThemedText>
              </View>
              
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Landlord
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                  {formData.landlordName}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Lease Terms */}
          {formData && (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="calendar-outline" size={20} color={primaryColor} />
                <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                  Lease Terms
                </ThemedText>
              </View>
              
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Start Date
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                  {formatDate(formData.tenancyStartDate)}
                </ThemedText>
              </View>
              
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Term Type
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                  {formData.tenancyType === 'fixed' ? 'Fixed Term' : 'Month-to-Month'}
                </ThemedText>
              </View>
              
              {formData.tenancyType === 'fixed' && formData.tenancyEndDate && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                    End Date
                  </ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textColor }]}>
                    {formatDate(formData.tenancyEndDate)}
                  </ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Rent Details */}
          {formData && (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="currency-usd" size={20} color={primaryColor} />
                <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                  Rent
                </ThemedText>
              </View>
              
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Base Rent
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                  {formatCurrency(formData.baseRent || 0)}
                </ThemedText>
              </View>
              
              {formData.parkingRent && formData.parkingRent > 0 && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                    Parking
                  </ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textColor }]}>
                    {formatCurrency(formData.parkingRent)}
                  </ThemedText>
                </View>
              )}
              
              <View style={[styles.infoRow, styles.totalRow]}>
                <ThemedText style={[styles.totalLabel, { color: textColor }]}>
                  Total Monthly Rent
                </ThemedText>
                <ThemedText style={[styles.totalValue, { color: primaryColor }]}>
                  {formatCurrency(totalRent)}
                </ThemedText>
              </View>
              
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Payment Due
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                  {formData.rentPaymentDay}{getDaySuffix(formData.rentPaymentDay)} of each month
                </ThemedText>
              </View>
            </View>
          )}

          {/* Document Download */}
          {selectedLease.document_url && (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="file-pdf-box" size={20} color="#ef4444" />
                <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                  Lease Document
                </ThemedText>
              </View>
              
              <ThemedText style={[styles.documentNote, { color: secondaryTextColor }]}>
                This is your official Ontario Standard Lease agreement. Please review carefully and keep a copy for your records.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.downloadButton, { backgroundColor: primaryColor }]}
                onPress={() => handleViewDocument(selectedLease.document_url!)}
              >
                <MaterialCommunityIcons name="download" size={20} color="#fff" />
                <ThemedText style={styles.downloadButtonText}>View / Download Lease PDF</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Help Info */}
          <View style={[styles.helpCard, { backgroundColor: `${primaryColor}10` }]}>
            <MaterialCommunityIcons name="information-outline" size={20} color={primaryColor} />
            <ThemedText style={[styles.helpText, { color: secondaryTextColor }]}>
              Questions about your lease? Contact your landlord directly or visit the Ontario Landlord and Tenant Board website for more information about your rights.
            </ThemedText>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  // Show list of leases if multiple
  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          My Leases
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {leases.map((lease) => (
          <TouchableOpacity
            key={lease.id}
            style={[styles.leaseCard, { backgroundColor: cardBgColor, borderColor }]}
            onPress={() => setSelectedLease(lease)}
          >
            <View style={styles.leaseCardHeader}>
              <MaterialCommunityIcons name="file-document-check" size={24} color={successColor} />
              <View style={styles.leaseCardInfo}>
                <ThemedText style={[styles.leaseCardTitle, { color: textColor }]}>
                  {lease.form_data?.unitAddress ? 
                    `${lease.form_data.unitAddress.streetNumber} ${lease.form_data.unitAddress.streetName}` 
                    : 'Lease Agreement'}
                </ThemedText>
                <ThemedText style={[styles.leaseCardMeta, { color: secondaryTextColor }]}>
                  From: {lease.form_data?.landlordName || 'Landlord'}
                </ThemedText>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={secondaryTextColor} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  statusBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusDate: {
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    backgroundColor: '#f9fafb',
    marginHorizontal: -12,
    paddingHorizontal: 24,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  documentNote: {
    fontSize: 13,
    lineHeight: 18,
    padding: 12,
    paddingBottom: 0,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    margin: 12,
    borderRadius: 10,
    gap: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  helpCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  leaseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  leaseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leaseCardInfo: {
    flex: 1,
  },
  leaseCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  leaseCardMeta: {
    fontSize: 13,
    marginTop: 2,
  },
});
