/**
 * Lease Detail Screen
 * 
 * Displays detailed lease information including:
 * - Lease status and metadata
 * - View/Download document
 * - Send to tenant (if not sent)
 * - Document version history
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
import { fetchLeaseById, DbLease } from '@/lib/supabase';
import {
  sendLeaseToTenant,
  getLeaseDocumentVersions,
  LeaseDocument,
} from '@/services/lease-generation-service';

export default function LeaseDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: leaseId } = useLocalSearchParams<{ id: string }>();
  
  const { user } = useAuthStore();
  
  const [lease, setLease] = useState<DbLease | null>(null);
  const [documents, setDocuments] = useState<LeaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
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

  useEffect(() => {
    if (leaseId) {
      loadLease();
    }
  }, [leaseId]);

  const loadLease = async () => {
    if (!leaseId) return;
    
    setIsLoading(true);
    try {
      const [leaseData, docsData] = await Promise.all([
        fetchLeaseById(leaseId),
        getLeaseDocumentVersions(leaseId),
      ]);
      
      setLease(leaseData);
      setDocuments(docsData);
    } catch (error) {
      console.error('Error loading lease:', error);
      Alert.alert('Error', 'Failed to load lease details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLease();
    setIsRefreshing(false);
  };

  const handleViewDocument = async () => {
    if (!lease?.document_url) {
      Alert.alert('Error', 'No document available');
      return;
    }

    try {
      await Linking.openURL(lease.document_url);
    } catch (error) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const handleSendLease = async () => {
    if (!lease?.document_url) {
      Alert.alert('Error', 'No document to send. Generate or upload a document first.');
      return;
    }

    Alert.alert(
      'Send Lease',
      'Are you sure you want to send this lease to the tenant?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setIsSending(true);
            try {
              const result = await sendLeaseToTenant(leaseId!);
              
              if (result.success) {
                Alert.alert('Success', 'Lease has been sent to the tenant.');
                loadLease(); // Refresh to update status
              } else {
                Alert.alert('Error', result.error || 'Failed to send lease');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to send lease');
            } finally {
              setIsSending(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return secondaryTextColor;
      case 'generated': return primaryColor;
      case 'uploaded': return primaryColor;
      case 'sent': return successColor;
      case 'signed': return successColor;
      default: return secondaryTextColor;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'generated': return 'Generated';
      case 'uploaded': return 'Uploaded';
      case 'sent': return 'Sent to Tenant';
      case 'signed': return 'Signed';
      default: return status;
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

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
          Loading lease details...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!lease) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer, { backgroundColor: bgColor }]}>
        <MaterialCommunityIcons name="file-alert-outline" size={64} color={secondaryTextColor} />
        <ThemedText style={[styles.errorText, { color: textColor }]}>
          Lease not found
        </ThemedText>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: primaryColor }]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const formData = lease.form_data;
  const isOwner = lease.user_id === user?.id;
  const canSend = isOwner && ['generated', 'uploaded'].includes(lease.status) && lease.document_url;

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Lease Details
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
        <View style={[styles.statusBanner, { backgroundColor: `${getStatusColor(lease.status)}15` }]}>
          <MaterialCommunityIcons
            name={
              lease.status === 'sent' || lease.status === 'signed'
                ? 'check-circle'
                : 'file-document-outline'
            }
            size={24}
            color={getStatusColor(lease.status)}
          />
          <View style={styles.statusContent}>
            <ThemedText style={[styles.statusLabel, { color: getStatusColor(lease.status) }]}>
              {getStatusLabel(lease.status)}
            </ThemedText>
            <ThemedText style={[styles.statusDate, { color: secondaryTextColor }]}>
              Last updated: {formatDateTime(lease.updated_at)}
            </ThemedText>
          </View>
        </View>

        {/* Lease Overview */}
        {formData && (
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="file-document-outline" size={20} color={primaryColor} />
              <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                Lease Overview
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
            
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                Tenant(s)
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>
                {formData.tenantNames?.filter(Boolean).join(', ') || 'N/A'}
              </ThemedText>
            </View>
            
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                Property
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>
                {formData.unitAddress ? 
                  `${formData.unitAddress.unit ? `Unit ${formData.unitAddress.unit}, ` : ''}${formData.unitAddress.streetNumber} ${formData.unitAddress.streetName}, ${formData.unitAddress.city}` 
                  : 'N/A'}
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
                Monthly Rent
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>
                ${((formData.baseRent || 0) + (formData.parkingRent || 0) + (formData.otherServicesRent || 0)).toFixed(2)}
              </ThemedText>
            </View>
          </View>
        )}

        {/* Document Card */}
        {lease.document_url && (
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="file-pdf-box" size={20} color="#ef4444" />
              <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                Lease Document
              </ThemedText>
            </View>
            
            <TouchableOpacity
              style={[styles.documentButton, { backgroundColor: primaryColor }]}
              onPress={handleViewDocument}
            >
              <MaterialCommunityIcons name="eye" size={20} color="#fff" />
              <ThemedText style={styles.documentButtonText}>View / Download PDF</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Document Versions */}
        {documents.length > 1 && (
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="history" size={20} color={primaryColor} />
              <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                Version History
              </ThemedText>
            </View>
            
            {documents.map((doc, index) => (
              <TouchableOpacity
                key={doc.id}
                style={[styles.versionRow, { borderTopColor: borderColor }]}
                onPress={() => Linking.openURL(doc.fileUrl)}
              >
                <View style={styles.versionInfo}>
                  <ThemedText style={[styles.versionLabel, { color: textColor }]}>
                    Version {doc.version}
                    {doc.isCurrent && (
                      <ThemedText style={{ color: successColor }}> (Current)</ThemedText>
                    )}
                  </ThemedText>
                  <ThemedText style={[styles.versionMeta, { color: secondaryTextColor }]}>
                    {doc.engineUsed === 'xfa' ? 'Official Template' : doc.engineUsed === 'uploaded' ? 'Uploaded' : 'Generated'}
                    {' • '}
                    {formatDateTime(doc.createdAt)}
                  </ThemedText>
                </View>
                <MaterialCommunityIcons name="download" size={20} color={primaryColor} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Footer Actions */}
      {isOwner && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: borderColor, backgroundColor: bgColor }]}>
          {canSend && (
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: successColor }]}
              onPress={handleSendLease}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={20} color="#fff" />
                  <ThemedText style={styles.sendButtonText}>Send to Tenant</ThemedText>
                </>
              )}
            </TouchableOpacity>
          )}
          
          {lease.status === 'sent' && (
            <View style={[styles.sentBadge, { backgroundColor: `${successColor}15` }]}>
              <MaterialCommunityIcons name="check-circle" size={20} color={successColor} />
              <ThemedText style={[styles.sentBadgeText, { color: successColor }]}>
                Lease has been sent to tenant
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    margin: 12,
    borderRadius: 10,
    gap: 8,
  },
  documentButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  versionInfo: {
    flex: 1,
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  versionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  sendButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sentBadge: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sentBadgeText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
