/**
 * Ontario Lease Wizard - Step 6: Review & Generate
 * 
 * Final step to review all entered information and generate/upload the lease.
 * Supports:
 * - Generate Official PDF (XFA with automatic fallback)
 * - Upload existing signed lease
 * - View/Download generated document
 * - Send lease to tenant
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOntarioLeaseStore } from '@/store/ontarioLeaseStore';
import { useAuthStore } from '@/store/authStore';

export default function LeaseWizardStep6() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { user } = useAuthStore();
  const {
    formData,
    propertyId,
    draftLeaseId,
    generateLease,
    generateOfficialPdf,
    uploadLease,
    sendLease,
    prevStep,
    resetWizard,
    isLoading,
    error,
    documentUrl,
    documentVersion,
    engineUsed,
    isSent,
  } = useOntarioLeaseStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [tenantEmail, setTenantEmail] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';
  const successColor = '#10b981';

  const totalRent = (formData.baseRent || 0) + (formData.parkingRent || 0) + (formData.otherServicesRent || 0);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleBack = () => {
    prevStep();
    router.back();
  };

  const handleClose = () => {
    Alert.alert(
      'Close Wizard',
      'Are you sure you want to close? Your progress will be saved as a draft.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          onPress: () => {
            router.replace('/properties');
          },
        },
      ]
    );
  };

  const handleDone = () => {
    console.log('📋 handleDone called, draftLeaseId:', draftLeaseId);
    
    if (!draftLeaseId) {
      console.error('❌ No draftLeaseId found, redirecting to properties');
      Alert.alert('Error', 'Lease ID not found. Returning to properties.');
      router.replace('/properties');
      return;
    }
    
    console.log('✅ Navigating to lease-detail with ID:', draftLeaseId);
    const leaseIdToNavigate = draftLeaseId; // Store ID before reset
    resetWizard(); // Reset after storing the ID
    router.replace(`/lease-detail?id=${leaseIdToNavigate}`);
  };

  const handleGenerate = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to generate a lease');
      return;
    }

    console.log('🔄 Starting lease generation...');
    console.log('📋 Current draftLeaseId before generation:', draftLeaseId);
    
    setIsGenerating(true);
    setGenerationComplete(false);
    setGenerationMessage('');

    try {
      // Use generateOfficialPdf which tries XFA first, then falls back
      const result = await generateOfficialPdf(user.id);

      console.log('📋 Generation result:', result);
      console.log('📋 draftLeaseId after generation:', draftLeaseId);

      if (result.success) {
        setGenerationComplete(true);
        // Set message based on engine used
        if (result.code === 'FALLBACK_USED' || result.warning) {
          setGenerationMessage(result.warning || 'Generated using standard template (official XFA template not available).');
        } else if (result.engineUsed === 'xfa') {
          setGenerationMessage('Generated using official Ontario Standard Lease template.');
        } else {
          setGenerationMessage('Ontario Standard Lease generated successfully.');
        }
        
        console.log('✅ Lease generated successfully');
      } else {
        console.error('❌ Generation failed:', result.error);
        Alert.alert('Generation Failed', result.error || 'Failed to generate lease. Please try again.');
      }
    } catch (err) {
      console.error('❌ Exception during generation:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewDocument = async () => {
    if (!documentUrl) {
      Alert.alert('Error', 'No document available to view');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(documentUrl);
      if (canOpen) {
        await Linking.openURL(documentUrl);
      } else {
        Alert.alert('Error', 'Cannot open document. Please try downloading instead.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const handleDownloadDocument = async () => {
    if (!documentUrl) {
      Alert.alert('Error', 'No document available to download');
      return;
    }

    try {
      await Linking.openURL(documentUrl);
    } catch (err) {
      Alert.alert('Error', 'Failed to download document');
    }
  };

  const handleSendLease = async () => {
    if (!documentUrl) {
      Alert.alert('Error', 'Please generate or upload a lease document first');
      return;
    }

    setShowSendModal(true);
  };

  const confirmSendLease = async () => {
    setIsSending(true);
    setShowSendModal(false);

    try {
      const result = await sendLease(
        tenantEmail || undefined,
        sendMessage || undefined
      );

      if (result.success) {
        // Store leaseId before reset
        const leaseId = draftLeaseId;
        
        Alert.alert(
          'Lease Sent',
          `Your lease has been sent to the tenant.${result.emailSent ? ' An email notification was sent.' : ''}`,
          [
            {
              text: 'View Lease Details',
              onPress: () => {
                resetWizard();
                router.replace(`/lease-detail?id=${leaseId}`);
              },
            },
            {
              text: 'Back to Properties',
              onPress: () => {
                resetWizard();
                router.replace('/properties');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to send lease. Please try again.');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSending(false);
      setTenantEmail('');
      setSendMessage('');
    }
  };

  const handleUpload = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to upload a lease');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      // Validate file size (max 10MB)
      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert('Error', 'File size must be less than 10MB');
        return;
      }

      setIsUploading(true);

      const uploadResult = await uploadLease(file.uri, user.id);

      if (uploadResult) {
        setGenerationComplete(true);
        setGenerationMessage('Lease document uploaded successfully.');
      } else {
        Alert.alert('Error', error || 'Failed to upload lease. Please try again.');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const renderSection = (
    icon: string,
    title: string,
    items: { label: string; value: string }[]
  ) => (
    <View style={[styles.reviewSection, { backgroundColor: cardBgColor, borderColor }]}>
      <View style={styles.reviewSectionHeader}>
        <MaterialCommunityIcons name={icon as any} size={20} color={primaryColor} />
        <ThemedText style={[styles.reviewSectionTitle, { color: textColor }]}>
          {title}
        </ThemedText>
      </View>
      {items.map((item, index) => (
        <View key={index} style={styles.reviewItem}>
          <ThemedText style={[styles.reviewItemLabel, { color: secondaryTextColor }]}>
            {item.label}
          </ThemedText>
          <ThemedText style={[styles.reviewItemValue, { color: textColor }]}>
            {item.value}
          </ThemedText>
        </View>
      ))}
    </View>
  );

  const fullAddress = [
    formData.unitAddress.unit ? `Unit ${formData.unitAddress.unit}` : '',
    `${formData.unitAddress.streetNumber} ${formData.unitAddress.streetName}`,
    formData.unitAddress.city,
    formData.unitAddress.province,
    formData.unitAddress.postalCode,
  ].filter(Boolean).join(', ');

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleBack} disabled={generationComplete}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={generationComplete ? secondaryTextColor : textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          {generationComplete ? 'Lease Ready' : 'Review & Generate'}
        </ThemedText>
        <TouchableOpacity onPress={generationComplete ? handleDone : handleClose}>
          <MaterialCommunityIcons name="close" size={24} color={textColor} />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={[styles.progressContainer, { borderBottomColor: borderColor }]}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%', backgroundColor: successColor }]} />
        </View>
        <ThemedText style={[styles.progressText, { color: secondaryTextColor }]}>
          8 of 8
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
      >
        {/* Status Banner */}
        {generationComplete || documentUrl ? (
          <View style={[styles.successBanner, { backgroundColor: `${successColor}15` }]}>
            <MaterialCommunityIcons name="check-circle" size={24} color={successColor} />
            <View style={styles.successContent}>
              <ThemedText style={[styles.successTitle, { color: successColor }]}>
                {isSent ? 'Lease Sent!' : 'Lease Generated!'}
              </ThemedText>
              <ThemedText style={[styles.successText, { color: secondaryTextColor }]}>
                {generationMessage || 'Your Ontario Standard Lease is ready. You can view, download, or send it to the tenant.'}
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={[styles.successBanner, { backgroundColor: `${primaryColor}15` }]}>
            <MaterialCommunityIcons name="file-document-edit" size={24} color={primaryColor} />
            <View style={styles.successContent}>
              <ThemedText style={[styles.successTitle, { color: primaryColor }]}>
                Ready to Generate
              </ThemedText>
              <ThemedText style={[styles.successText, { color: secondaryTextColor }]}>
                Review the information below and generate your Ontario Standard Lease
              </ThemedText>
            </View>
          </View>
        )}

        {/* Review Sections */}
        {renderSection('account-tie', 'Parties', [
          { label: 'Landlord', value: formData.landlordName || 'Not set' },
          { label: 'Tenant(s)', value: formData.tenantNames.filter(Boolean).join(', ') || 'Not set' },
        ])}

        {renderSection('home-map-marker', 'Rental Unit', [
          { label: 'Address', value: fullAddress || 'Not set' },
          { label: 'Parking', value: formData.parkingDescription || 'None' },
          { label: 'Condominium', value: formData.isCondo ? 'Yes' : 'No' },
        ])}

        {renderSection('email-outline', 'Contact Information', [
          { label: 'Notice Address', value: formData.landlordNoticeAddress || 'Not set' },
          { label: 'Email Notices', value: formData.allowEmailNotices ? `Yes (${formData.landlordEmail})` : 'No' },
          { label: 'Emergency Phone', value: formData.emergencyContactPhone || 'Not set' },
        ])}

        {renderSection('calendar', 'Term', [
          { label: 'Start Date', value: formatDate(formData.tenancyStartDate) },
          { label: 'End Date', value: formData.tenancyType === 'fixed' ? formatDate(formData.tenancyEndDate || '') : 'Month-to-month' },
          { label: 'Payment Frequency', value: formData.paymentFrequency.charAt(0).toUpperCase() + formData.paymentFrequency.slice(1) },
        ])}

        {renderSection('currency-usd', 'Rent', [
          { label: 'Payment Day', value: `${formData.rentPaymentDay}${getDaySuffix(formData.rentPaymentDay)} of each ${formData.paymentFrequency === 'monthly' ? 'month' : formData.paymentFrequency === 'weekly' ? 'week' : 'day'}` },
          { label: 'Base Rent', value: `$${formData.baseRent?.toFixed(2) || '0.00'}` },
          { label: 'Parking', value: `$${formData.parkingRent?.toFixed(2) || '0.00'}` },
          { label: 'Other Services', value: `$${formData.otherServicesRent?.toFixed(2) || '0.00'}` },
          { label: 'Total Rent', value: `$${totalRent.toFixed(2)}` },
          { label: 'Payable To', value: formData.rentPayableTo || 'Not set' },
          { label: 'Payment Method', value: formData.paymentMethod === 'etransfer' ? 'e-Transfer' : formData.paymentMethod.charAt(0).toUpperCase() + formData.paymentMethod.slice(1) },
        ])}

        {renderSection('lightning-bolt', 'Utilities', [
          { label: 'Electricity', value: formData.utilities?.electricity === 'landlord' ? 'Landlord' : 'Tenant' },
          { label: 'Heat', value: formData.utilities?.heat === 'landlord' ? 'Landlord' : 'Tenant' },
          { label: 'Water', value: formData.utilities?.water === 'landlord' ? 'Landlord' : 'Tenant' },
          { label: 'Gas Included', value: formData.utilities?.gas ? 'Yes' : 'No' },
          { label: 'A/C Included', value: formData.utilities?.airConditioning ? 'Yes' : 'No' },
          { label: 'On-Site Laundry', value: formData.utilities?.laundry === 'included' ? 'Yes (No Charge)' : formData.utilities?.laundry === 'payPerUse' ? 'Yes (Pay Per Use)' : 'No' },
        ])}

        {renderSection('cash-lock', 'Deposits & Discounts', [
          { label: 'Rent Discount', value: formData.hasRentDiscount ? (formData.rentDiscountDescription || 'Yes') : 'None' },
          { label: 'Rent Deposit', value: formData.requiresRentDeposit ? `$${formData.rentDepositAmount?.toFixed(2) || '0.00'}` : 'Not required' },
          { label: 'Key Deposit', value: formData.requiresKeyDeposit ? `$${formData.keyDepositAmount?.toFixed(2) || '0.00'}` : 'Not required' },
        ])}

        {renderSection('shield-check', 'Rules & Insurance', [
          { label: 'Smoking', value: formData.smokingRules === 'prohibited' ? 'Prohibited' : formData.smokingRules === 'designated' ? 'Designated Areas Only' : 'No Additional Rules' },
          { label: 'Tenant Insurance', value: formData.requiresTenantInsurance ? 'Required' : 'Not Required' },
          { label: 'Additional Terms', value: formData.additionalTerms ? 'Yes (see below)' : 'None' },
        ])}

        {/* Document Status Card */}
        {documentUrl && (
          <View style={[styles.documentCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.documentHeader}>
              <MaterialCommunityIcons 
                name={isSent ? 'file-check' : 'file-document'} 
                size={24} 
                color={isSent ? successColor : primaryColor} 
              />
              <View style={styles.documentInfo}>
                <ThemedText style={[styles.documentTitle, { color: textColor }]}>
                  Lease Document {documentVersion ? `v${documentVersion}` : ''}
                </ThemedText>
                <ThemedText style={[styles.documentMeta, { color: secondaryTextColor }]}>
                  {engineUsed === 'xfa' ? 'Official Template' : engineUsed === 'uploaded' ? 'Uploaded' : 'Generated PDF'}
                  {isSent && ' • Sent to Tenant'}
                </ThemedText>
              </View>
            </View>
            <View style={styles.documentActions}>
              <TouchableOpacity 
                style={[styles.documentActionButton, { backgroundColor: primaryColor }]}
                onPress={handleViewDocument}
              >
                <MaterialCommunityIcons name="eye" size={18} color="#fff" />
                <ThemedText style={styles.documentActionText}>View</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.documentActionButton, { backgroundColor: successColor }]}
                onPress={handleDownloadDocument}
              >
                <MaterialCommunityIcons name="download" size={18} color="#fff" />
                <ThemedText style={styles.documentActionText}>Download</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Send Lease Modal */}
      <Modal
        visible={showSendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBgColor }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: textColor }]}>
                Send Lease to Tenant
              </ThemedText>
              <TouchableOpacity onPress={() => setShowSendModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={secondaryTextColor} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <ThemedText style={[styles.inputLabel, { color: secondaryTextColor }]}>
                Tenant Email (optional - override)
              </ThemedText>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: bgColor, 
                  borderColor, 
                  color: textColor 
                }]}
                placeholder="Enter email address"
                placeholderTextColor={secondaryTextColor}
                value={tenantEmail}
                onChangeText={setTenantEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <ThemedText style={[styles.inputLabel, { color: secondaryTextColor, marginTop: 16 }]}>
                Message (optional)
              </ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea, { 
                  backgroundColor: bgColor, 
                  borderColor, 
                  color: textColor 
                }]}
                placeholder="Add a message for the tenant..."
                placeholderTextColor={secondaryTextColor}
                value={sendMessage}
                onChangeText={setSendMessage}
                multiline
                numberOfLines={4}
              />
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor }]}
                onPress={() => setShowSendModal(false)}
              >
                <ThemedText style={[styles.modalButtonText, { color: textColor }]}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: primaryColor }]}
                onPress={confirmSendLease}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.modalButtonTextPrimary}>
                    Send Lease
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Footer Actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: borderColor, backgroundColor: bgColor }]}>
        {/* Row 1: Upload and Generate */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.uploadButton, { borderColor }]}
            onPress={handleUpload}
            disabled={isGenerating || isUploading || isSending}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <>
                <MaterialCommunityIcons name="upload" size={18} color={primaryColor} />
                <ThemedText style={[styles.uploadButtonText, { color: primaryColor }]}>
                  Upload
                </ThemedText>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: primaryColor }]}
            onPress={handleGenerate}
            disabled={isGenerating || isUploading || isSending}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="file-document-outline" size={18} color="#fff" />
                <ThemedText style={styles.generateButtonText}>
                  {documentUrl ? 'Regenerate' : 'Generate'}
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Row 2: Send to Tenant (only show if document exists) */}
        {documentUrl && !isSent && (
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: successColor }]}
            onPress={handleSendLease}
            disabled={isGenerating || isUploading || isSending}
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

        {/* Show sent status */}
        {isSent && (
          <View style={[styles.sentBadge, { backgroundColor: `${successColor}20` }]}>
            <MaterialCommunityIcons name="check-circle" size={20} color={successColor} />
            <ThemedText style={[styles.sentBadgeText, { color: successColor }]}>
              Lease sent to tenant
            </ThemedText>
          </View>
        )}
      </View>
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  successBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  successText: {
    fontSize: 13,
    lineHeight: 18,
  },
  reviewSection: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  reviewSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewItemLabel: {
    fontSize: 13,
    flex: 1,
  },
  reviewItemValue: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  generateButton: {
    flexDirection: 'row',
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sendButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
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
    marginTop: 12,
  },
  sentBadgeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  documentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  documentMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  documentActionButton: {
    flexDirection: 'row',
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  documentActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal styles
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
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
