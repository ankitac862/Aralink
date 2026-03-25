/**
 * Tenant Lease Detail Screen
 * 
 * Allows tenant to:
 * - View lease details
 * - Download PDF
 * - Sign the lease
 * - Upload signed document
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { fetchLeaseById, updateLeaseInDb, uploadLeaseDocument, notifyLandlordLeaseCountersign, DbLease } from '@/lib/supabase';

export default function TenantLeaseDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();

  const [lease, setLease] = useState<DbLease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signature, setSignature] = useState('');

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
    loadLease();
  }, [id]);

  const loadLease = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const data = await fetchLeaseById(id as string);
      setLease(data);
    } catch (error) {
      console.error('Error loading lease:', error);
      Alert.alert('Error', 'Failed to load lease details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!lease?.document_url) {
      Alert.alert('Error', 'No document available to download');
      return;
    }

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        // Download the file first
        const fileName = `lease_${lease.id}.pdf`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        const downloadResult = await FileSystem.downloadAsync(
          lease.document_url,
          fileUri
        );

        // Share/save the file
        await Sharing.shareAsync(downloadResult.uri);
      } else {
        // Fallback to opening in browser
        await Linking.openURL(lease.document_url);
      }
    } catch (error) {
      console.error('Error downloading lease:', error);
      Alert.alert('Error', 'Failed to download lease');
    }
  };

  const handleViewPDF = async () => {
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

  const handleUploadSigned = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setIsProcessing(true);

      const uploadResult = await uploadLeaseDocument(
        result.assets[0].uri,
        lease!.id,
        user!.id
      );

      if (uploadResult.success) {
        // Update lease status to signed, keeping original URL intact and adding new signed version
        await updateLeaseInDb(lease!.id, { 
          status: 'signed', // Changed to standard 'signed' indicating Tenant signed it
          signed_date: new Date().toISOString(),
          document_url: uploadResult.url, // Override main URL for display if needed
          signed_pdf_url: uploadResult.url, // Store the signed URL explicitly
          version: 2, // Increment version to v2 (user signed)
        });

        // Applicant → tenant conversion runs only after landlord finalizes (v3), not here.

        // Notify the property owner (landlord) that countersign is pending.
        // Non-blocking: signing should still succeed even if notifications fail.
        await notifyLandlordLeaseCountersign({
          leaseId: lease!.id,
          tenantNames: lease!.form_data?.tenantNames,
        });

        Alert.alert(
          'Uploaded',
          'Your signed lease was uploaded. The lease is NOT fully complete until the landlord uploads the countersigned (final) copy.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', uploadResult.error || 'Failed to upload document');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload signed lease');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSign = () => {
    setShowSignModal(true);
  };

  const confirmSign = async () => {
    if (!signature.trim()) {
      Alert.alert('Error', 'Please enter your full name as signature');
      return;
    }

    setShowSignModal(false);
    setIsProcessing(true);

    try {
      // Update lease status to signed
      await updateLeaseInDb(lease!.id, { 
        status: 'signed',
        signed_date: new Date().toISOString(),
      });

      const moveInDateText = lease?.effective_date
        ? ` Move-in date: ${formatDate(lease.effective_date)}.`
        : '';

      if (lease!.application_id) {
        Alert.alert(
          'Signature recorded',
          `Your signature is recorded. The lease is NOT fully complete until the landlord countersigns.${moveInDateText}`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'Signature recorded',
          'Your signature is recorded. The lease is NOT fully complete until the landlord countersigns.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }

      // Notify the property owner (landlord) that countersign is pending.
      // Non-blocking: signing should still succeed even if notifications fail.
      await notifyLandlordLeaseCountersign({
        leaseId: lease!.id,
        tenantNames: lease!.form_data?.tenantNames,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to sign lease');
    } finally {
      setIsProcessing(false);
      setSignature('');
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

  const getPropertyAddress = () => {
    if (lease?.form_data?.unitAddress) {
      const addr = lease.form_data.unitAddress;
      return `${addr.unit ? `Unit ${addr.unit}, ` : ''}${addr.streetNumber} ${addr.streetName}, ${addr.city}, ${addr.province} ${addr.postalCode}`;
    }
    return 'Property Address';
  };

  const canSign = lease?.status === 'sent';
  const isUserSigned = lease?.status === 'signed';
  const isFullySigned = lease?.status === 'signed_pending_move_in' || lease?.status === 'active';
  const isCreatedPhase =
    lease?.status === 'draft' ||
    lease?.status === 'generated' ||
    lease?.status === 'uploaded';

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
          Loading lease...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!lease) {
    return (
      <ThemedView style={[styles.container, styles.centerContent, { backgroundColor: bgColor }]}>
        <MaterialCommunityIcons name="file-alert-outline" size={64} color={secondaryTextColor} />
        <ThemedText style={[styles.errorText, { color: textColor }]}>Lease not found</ThemedText>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: primaryColor }]}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </TouchableOpacity>
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
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>Lease Details</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor: isFullySigned
                ? `${successColor}20`
                : canSign
                ? `${warningColor}20`
                : isUserSigned
                ? `${warningColor}20`
                : isCreatedPhase
                ? `${primaryColor}20`
                : `${primaryColor}20`,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={
              isFullySigned
                ? 'check-circle'
                : canSign
                ? 'alert-circle'
                : isUserSigned
                ? 'clock-outline'
                : isCreatedPhase
                ? 'file-document'
                : 'file-document'
            }
            size={24}
            color={
              isFullySigned
                ? successColor
                : canSign
                ? warningColor
                : isUserSigned
                ? warningColor
                : primaryColor
            }
          />
          <View style={styles.statusContent}>
            <ThemedText
              style={[
                styles.statusLabel,
                {
                  color: isFullySigned
                    ? successColor
                    : canSign
                    ? warningColor
                    : isUserSigned
                    ? warningColor
                    : primaryColor,
                },
              ]}
            >
              {isFullySigned
                ? 'Lease fully signed'
                : canSign
                ? 'Waiting for your signature'
                : isUserSigned
                ? 'Waiting for landlord approval'
                : isCreatedPhase
                ? 'Lease being prepared'
                : 'Lease status'}
            </ThemedText>
            <ThemedText style={[styles.statusDate, { color: secondaryTextColor }]}>
              {isFullySigned
                ? 'Landlord has countersigned. This lease is complete.'
                : isUserSigned
                ? 'You have signed. The landlord still needs to countersign.'
                : canSign
                ? 'Please review and sign this lease.'
                : isCreatedPhase
                ? 'The landlord is still preparing/finalizing this lease. You’ll be notified when it’s ready to sign.'
                : `Updated ${formatDate(lease.updated_at)}`}
            </ThemedText>
          </View>
        </View>

        {/* Property Info */}
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={[styles.cardHeader, { borderBottomColor: borderColor }]}>
            <MaterialCommunityIcons name="home" size={20} color={primaryColor} />
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>Property</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Address</ThemedText>
            <ThemedText style={[styles.infoValue, { color: textColor }]}>
              {getPropertyAddress()}
            </ThemedText>
          </View>
        </View>

        {/* Lease Terms */}
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={[styles.cardHeader, { borderBottomColor: borderColor }]}>
            <MaterialCommunityIcons name="calendar-range" size={20} color={primaryColor} />
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>Lease Term</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Start Date</ThemedText>
            <ThemedText style={[styles.infoValue, { color: textColor }]}>
              {formatDate(lease.effective_date || '')}
            </ThemedText>
          </View>
          {lease.expiry_date && (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>End Date</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>
                {formatDate(lease.expiry_date)}
              </ThemedText>
            </View>
          )}
          {lease.form_data?.baseRent && (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Monthly Rent</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>
                ${lease.form_data.baseRent.toFixed(2)}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Document Actions */}
        {lease.document_url && (
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={[styles.cardHeader, { borderBottomColor: borderColor }]}>
              <MaterialCommunityIcons name="file-pdf-box" size={20} color={primaryColor} />
              <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                Lease Document (v{lease.version || 1})
              </ThemedText>
            </View>
            
            <View style={styles.documentActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${primaryColor}20`, borderColor: primaryColor }]}
                onPress={handleViewPDF}
              >
                <MaterialCommunityIcons name="eye" size={20} color={primaryColor} />
                <ThemedText style={[styles.actionButtonText, { color: primaryColor }]}>
                  View PDF
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${successColor}20`, borderColor: successColor }]}
                onPress={handleDownload}
              >
                <MaterialCommunityIcons name="download" size={20} color={successColor} />
                <ThemedText style={[styles.actionButtonText, { color: successColor }]}>
                  Download
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: borderColor }]}>
        {canSign && (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: successColor }]}
              onPress={handleSign}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="pen" size={20} color="#fff" />
                  <ThemedText style={styles.primaryButtonText}>Sign Lease</ThemedText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor }]}
              onPress={handleUploadSigned}
              disabled={isProcessing}
            >
              <MaterialCommunityIcons name="upload" size={20} color={primaryColor} />
              <ThemedText style={[styles.secondaryButtonText, { color: primaryColor }]}>
                Upload Signed Copy
              </ThemedText>
            </TouchableOpacity>
          </>
        )}

{lease?.status === 'signed' && (
          <View style={[styles.signedBadge, { backgroundColor: `${successColor}20` }]}>
            <MaterialCommunityIcons name="check-circle" size={20} color={successColor} />
            <ThemedText style={[styles.signedText, { color: successColor }]}>
              Signed (v{lease?.version || 2}) — awaiting landlord countersign
            </ThemedText>
          </View>
        )}
        {lease?.status === 'signed_pending_move_in' && (
          <View style={[styles.signedBadge, { backgroundColor: `${successColor}20` }]}>
            <MaterialCommunityIcons name="check-circle" size={20} color={successColor} />
            <ThemedText style={[styles.signedText, { color: successColor }]}>
              Fully signed — move-in date: {formatDate(lease?.effective_date || '')}
            </ThemedText>
          </View>
        )}
        {lease?.status === 'active' && (
          <View style={[styles.signedBadge, { backgroundColor: `${successColor}20` }]}>
            <MaterialCommunityIcons name="home-variant" size={20} color={successColor} />
            <ThemedText style={[styles.signedText, { color: successColor }]}>
              Tenancy Active
            </ThemedText>
          </View>
        )}
      </View>

      {/* Sign Modal */}
      <Modal visible={showSignModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBgColor }]}>
            <ThemedText style={[styles.modalTitle, { color: textColor }]}>Sign Lease</ThemedText>
            <ThemedText style={[styles.modalMessage, { color: secondaryTextColor }]}>
              By signing, you agree to all terms and conditions outlined in this lease agreement.
            </ThemedText>

            <TextInput
              style={[styles.signatureInput, { backgroundColor: bgColor, borderColor, color: textColor }]}
              placeholder="Enter your full name"
              placeholderTextColor={secondaryTextColor}
              value={signature}
              onChangeText={setSignature}
              autoCapitalize="words"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: borderColor }]}
                onPress={() => {
                  setShowSignModal(false);
                  setSignature('');
                }}
              >
                <ThemedText style={[styles.modalButtonText, { color: textColor }]}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: successColor }]}
                onPress={confirmSign}
              >
                <ThemedText style={[styles.modalButtonText, { color: '#fff' }]}>Sign</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
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
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statusBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
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
  documentActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  signedBadge: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  signatureInput: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
