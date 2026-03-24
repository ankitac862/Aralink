import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

interface DocumentCardProps {
  title: string;
  required: boolean;
  uploaded: boolean;
  onUpload: () => void;
  borderColor: string;
  cardBgColor: string;
  textPrimaryColor: string;
  textSecondaryColor: string;
  primaryColor: string;
  inputBgColor: string;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  title,
  required,
  uploaded,
  onUpload,
  borderColor,
  cardBgColor,
  textPrimaryColor,
  textSecondaryColor,
  primaryColor,
  inputBgColor,
}) => {
  return (
    <View style={[styles.documentCard, { backgroundColor: cardBgColor, borderColor }]}>
      <View style={styles.documentHeader}>
        <View style={styles.documentIcon}>
          <MaterialCommunityIcons
            name={uploaded ? 'check-circle' : 'file-document-outline'}
            size={24}
            color={uploaded ? '#34C759' : primaryColor}
          />
        </View>
        <View style={styles.documentInfo}>
          <ThemedText style={[styles.documentTitle, { color: textPrimaryColor }]}>{title}</ThemedText>
          {required && (
            <ThemedText style={[styles.documentRequired, { color: '#ff3b30' }]}>Required</ThemedText>
          )}
        </View>
        {uploaded && (
          <View style={styles.uploadedBadge}>
            <ThemedText style={styles.uploadedText}>Uploaded</ThemedText>
          </View>
        )}
      </View>
      {!uploaded && (
        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: inputBgColor, borderColor }]}
          onPress={onUpload}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={20} color={primaryColor} />
          <ThemedText style={[styles.uploadButtonText, { color: primaryColor }]}>Upload</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function TenantLeaseStep5Screen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId, address, fromInvite, unitId, subUnitId, inviteId, isCoApplicant } = useLocalSearchParams<{ 
    propertyId?: string; 
    address?: string; 
    fromInvite?: string;
    unitId?: string;
    subUnitId?: string;
    inviteId?: string;
    isCoApplicant?: string;
  }>();
  const { tenantDraft, updateDraft } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const inputBgColor = isDark ? '#1a202c' : '#ffffff';

  const [documents, setDocuments] = useState({
    governmentId: !!tenantDraft.documents.governmentId,
    proofOfIncome: !!tenantDraft.documents.proofOfIncome,
    referenceLetter: !!tenantDraft.documents.referenceLetter,
    utilityBill: !!tenantDraft.documents.utilityBill,
  });

  const handleUpload = async (docType: keyof typeof documents) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const fileSize = asset.size || 0;
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (fileSize > maxSize) {
          Alert.alert('File Too Large', 'Maximum file size is 5MB. Please choose a smaller file.');
          return;
        }

        // Show uploading state
        Alert.alert('Uploading', 'Please wait while your document is being uploaded...');

        try {
          // Upload to Supabase Storage
          const { supabase } = await import('@/lib/supabase');
          const { user } = await import('@/store/authStore').then(m => m.useAuthStore.getState());
          
          if (!user?.id) {
            Alert.alert('Error', 'You must be logged in to upload documents.');
            return;
          }

          // Create unique filename
          const fileExt = asset.name?.split('.').pop() || 'pdf';
          const fileName = `${user.id}/${docType}_${Date.now()}.${fileExt}`;

          // Read file in a React Native compatible way
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              if (!dataUrl || !dataUrl.includes(',')) {
                reject(new Error('Invalid file data'));
                return;
              }
              resolve(dataUrl.split(',')[1]);
            };
            reader.readAsDataURL(blob);
          });

          const binaryString = atob(base64);
          const fileData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            fileData[i] = binaryString.charCodeAt(i);
          }

          // Upload to Supabase Storage (fallback across known buckets)
          const candidateBuckets = ['documents', 'lease-documents', 'application-documents'];
          let uploadedBucket: string | null = null;
          let uploadedPath: string | null = null;
          let lastUploadError: any = null;

          for (const bucket of candidateBuckets) {
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from(bucket)
              .upload(fileName, fileData, {
                contentType: asset.mimeType || 'application/pdf',
                upsert: false,
              });

            if (!uploadError && uploadData?.path) {
              uploadedBucket = bucket;
              uploadedPath = uploadData.path;
              break;
            }

            lastUploadError = uploadError;

            const message = (uploadError?.message || '').toLowerCase();
            if (!message.includes('bucket not found')) {
              break;
            }
          }

          if (!uploadedBucket || !uploadedPath) {
            console.error('Upload error:', lastUploadError);
            Alert.alert(
              'Upload Failed',
              'Document storage bucket is missing or inaccessible. Please contact support to create/configure the documents bucket.'
            );
            return;
          }

          const documentRef = `${uploadedBucket}/${uploadedPath}`;
          console.log('Document uploaded successfully:', documentRef);

          // Update state and store with bucket/path reference
          setDocuments({ ...documents, [docType]: true });
          updateDraft('documents', { [docType]: documentRef });
          
          Alert.alert('Success', 'Document uploaded successfully');
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert('Upload Failed', 'Failed to upload document. Please try again.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document. Please try again.');
      console.error('Document picker error:', error);
    }
  };

  // Only Government ID is mandatory
  const canContinue = documents.governmentId;

  const handleContinue = () => {
    if (canContinue) {
      router.push({ 
        pathname: '/tenant-lease-step6', 
        params: { propertyId, address, fromInvite, unitId, subUnitId, inviteId, isCoApplicant } 
      });
    } else {
      Alert.alert('Missing Document', 'Please upload your Government ID before continuing.');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Lease Application</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progressContainer}>
          <ThemedText style={[styles.progressText, { color: textSecondaryColor }]}>This is Step 5 of 6</ThemedText>
          <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
            <View style={[styles.progressFill, { backgroundColor: primaryColor, width: '83.33%' }]} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Supporting Documents</ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: textSecondaryColor }]}>
            Please upload your Government ID (required). Other documents are optional but recommended.
          </ThemedText>

          <View style={styles.documentsList}>
            <DocumentCard
              title="Government ID"
              required
              uploaded={documents.governmentId}
              onUpload={() => handleUpload('governmentId')}
              borderColor={borderColor}
              cardBgColor={cardBgColor}
              textPrimaryColor={textPrimaryColor}
              textSecondaryColor={textSecondaryColor}
              primaryColor={primaryColor}
              inputBgColor={inputBgColor}
            />

            <DocumentCard
              title="Proof of Income"
              required={false}
              uploaded={documents.proofOfIncome}
              onUpload={() => handleUpload('proofOfIncome')}
              borderColor={borderColor}
              cardBgColor={cardBgColor}
              textPrimaryColor={textPrimaryColor}
              textSecondaryColor={textSecondaryColor}
              primaryColor={primaryColor}
              inputBgColor={inputBgColor}
            />

            <DocumentCard
              title="Landlord Reference"
              required={false}
              uploaded={documents.referenceLetter}
              onUpload={() => handleUpload('referenceLetter')}
              borderColor={borderColor}
              cardBgColor={cardBgColor}
              textPrimaryColor={textPrimaryColor}
              textSecondaryColor={textSecondaryColor}
              primaryColor={primaryColor}
              inputBgColor={inputBgColor}
            />

            <DocumentCard
              title="Utility Bill"
              required={false}
              uploaded={documents.utilityBill}
              onUpload={() => handleUpload('utilityBill')}
              borderColor={borderColor}
              cardBgColor={cardBgColor}
              textPrimaryColor={textPrimaryColor}
              textSecondaryColor={textSecondaryColor}
              primaryColor={primaryColor}
              inputBgColor={inputBgColor}
            />
          </View>

          <View style={styles.fileInfo}>
            <ThemedText style={[styles.fileInfoText, { color: textSecondaryColor }]}>
              Max file size: 5MB. Accepted formats: PDF, JPG, PNG.
            </ThemedText>
          </View>

          <View style={styles.securityMessage}>
            <MaterialCommunityIcons name="lock" size={16} color={textSecondaryColor} />
            <ThemedText style={[styles.securityText, { color: textSecondaryColor }]}>
              Your documents are encrypted and secure.
            </ThemedText>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor }]}
            onPress={() => router.back()}>
            <ThemedText style={[styles.backButtonText, { color: textPrimaryColor }]}>Back</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: canContinue ? primaryColor : textSecondaryColor },
            ]}
            onPress={handleContinue}
            disabled={!canContinue}>
            <ThemedText style={styles.continueButtonText}>Next</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 12,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  documentsList: {
    gap: 16,
    marginBottom: 16,
  },
  documentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentIcon: {
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  documentRequired: {
    fontSize: 12,
  },
  uploadedBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  uploadedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileInfo: {
    marginTop: 8,
    marginBottom: 16,
  },
  fileInfoText: {
    fontSize: 12,
  },
  securityMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  securityText: {
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

