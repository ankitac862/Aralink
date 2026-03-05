import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, TextInput, Checkbox } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';
import { useAuthStore } from '@/store/authStore';

export default function TenantLeaseStep6Screen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId, unitId, subUnitId, inviteId, isCoApplicant } = useLocalSearchParams<{ 
    propertyId?: string;
    unitId?: string;
    subUnitId?: string;
    inviteId?: string;
    isCoApplicant?: string;
  }>();
  const { 
    tenantDraft, 
    coApplicants, 
    isAddingCoApplicant,
    submitDraft,
    startAddingCoApplicant,
    saveCurrentCoApplicant,
    editCoApplicant,
    removeCoApplicant,
    getCoApplicantCount,
  } = useLeaseStore();
  const { user } = useAuthStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const inputBgColor = isDark ? '#1a202c' : '#ffffff';

  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Skip consent and signature validation when adding co-applicant
    if (isCoApplicant !== 'true') {
      if (!agreed) {
        newErrors.agreed = 'You must agree to the terms';
      }

      if (!signature.trim()) {
        newErrors.signature = 'Signature is required';
      } else if (signature.trim() !== tenantDraft.personal.fullName.trim()) {
        newErrors.signature = 'Signature must match your full name';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validate()) {
      try {
        // If adding/editing a co-applicant, save and return to review page
        if (isCoApplicant === 'true') {
          saveCurrentCoApplicant();
          console.log('✅ Co-applicant saved');
          // Navigate back to review page (without isCoApplicant param to show review mode)
          router.push({
            pathname: '/tenant-lease-step6',
            params: { propertyId, unitId, subUnitId, inviteId }
          });
          return;
        }
        
        // Otherwise, submit the entire application
        console.log('🚀 Starting application submission...');
        console.log('📋 Raw params from useLocalSearchParams:', {
          propertyId,
          unitId,
          subUnitId,
          inviteId,
          types: {
            propertyId: typeof propertyId,
            unitId: typeof unitId,
            subUnitId: typeof subUnitId,
          },
          isEmpty: {
            propertyId: propertyId === '',
            unitId: unitId === '',
            subUnitId: subUnitId === '',
          }
        });
        console.log('📋 User info:', {
          userId: user?.id,
          userName: user?.name,
        });
        
        const applicationId = await submitDraft(propertyId, unitId, subUnitId, user?.id, inviteId);
        
        console.log('✅ Application submitted successfully! ID:', applicationId);
        router.push('/tenant-lease-submitted');
      } catch (error) {
        console.error('❌ Submission error:', error);
        // Show error to user
        alert('Failed to submit application. Please try again.');
      }
    } else {
      console.warn('⚠️ Validation failed, cannot submit');
    }
  };

  const handleEdit = (step: number) => {
    router.push(`/tenant-lease-step${step}`);
  };

  const handleAddCoApplicant = () => {
    const totalCount = getCoApplicantCount();
    if (totalCount >= 12) {
      alert('Maximum of 12 applicants (including primary) allowed');
      return;
    }
    
    // Save current primary applicant if in co-applicant mode
    if (isAddingCoApplicant) {
      saveCurrentCoApplicant();
    }
    
    // Start adding new co-applicant
    startAddingCoApplicant();
    
    // Navigate to step 1 to fill co-applicant info
    router.push(`/tenant-lease-step1?propertyId=${propertyId || ''}&unitId=${unitId || ''}&subUnitId=${subUnitId || ''}&inviteId=${inviteId || ''}&isCoApplicant=true`);
  };

  const handleEditCoApplicant = (index: number) => {
    editCoApplicant(index);
    router.push(`/tenant-lease-step1?propertyId=${propertyId || ''}&unitId=${unitId || ''}&subUnitId=${subUnitId || ''}&inviteId=${inviteId || ''}&isCoApplicant=true`);
  };

  const handleRemoveCoApplicant = (index: number) => {
    if (confirm('Are you sure you want to remove this co-applicant?')) {
      removeCoApplicant(index);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Review Your Application</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progressContainer}>
          <ThemedText style={[styles.progressText, { color: textSecondaryColor }]}>Final Step</ThemedText>
          <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
            <View style={[styles.progressFill, { backgroundColor: primaryColor, width: '100%' }]} />
          </View>
          <ThemedText style={[styles.progressLabel, { color: textSecondaryColor }]}>Review & Submit</ThemedText>
        </View>

        <ThemedText style={[styles.instruction, { color: textSecondaryColor }]}>
          Please review all your information for accuracy before submitting.
        </ThemedText>

        {/* Personal Information */}
        <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Personal Information</ThemedText>
            <TouchableOpacity onPress={() => handleEdit(1)}>
              <ThemedText style={[styles.editLink, { color: primaryColor }]}>Edit</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Full Name</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {tenantDraft.personal.fullName}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Email</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {tenantDraft.personal.email}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Phone</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {tenantDraft.personal.phone}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Date of Birth</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {tenantDraft.personal.dob}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Residence History */}
        <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Residence History</ThemedText>
            <TouchableOpacity onPress={() => handleEdit(2)}>
              <ThemedText style={[styles.editLink, { color: primaryColor }]}>Edit</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Current Address</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {tenantDraft.residence.currentAddress}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Employment */}
        <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Employment & Income</ThemedText>
            <TouchableOpacity onPress={() => handleEdit(3)}>
              <ThemedText style={[styles.editLink, { color: primaryColor }]}>Edit</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Employer</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {tenantDraft.employment.employerName}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Annual Income</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                ${tenantDraft.employment.annualIncome}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Documents */}
        <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Uploaded Documents</ThemedText>
            <TouchableOpacity onPress={() => handleEdit(5)}>
              <ThemedText style={[styles.editLink, { color: primaryColor }]}>Edit</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionContent}>
            <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
              {Object.keys(tenantDraft.documents).filter((key) => tenantDraft.documents[key as keyof typeof tenantDraft.documents]).length} documents uploaded
            </ThemedText>
          </View>
        </View>

        {/* Co-Applicants Section - Only show when NOT adding/editing co-applicant */}
        {isCoApplicant !== 'true' && (
          <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.sectionHeader}>
              <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>
                Co-Applicants ({coApplicants.length})
              </ThemedText>
            </View>
            
            {coApplicants.length === 0 ? (
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor, marginBottom: 12 }]}>
                No co-applicants added yet
              </ThemedText>
            ) : (
              <View style={{ gap: 12, marginBottom: 12 }}>
                {coApplicants.map((coApp, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.coApplicantItem, 
                      { 
                        backgroundColor: isDark ? '#121920' : '#F8F9FA',
                        borderColor,
                      }
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.coApplicantName, { color: textPrimaryColor }]}>
                        {coApp.personal.fullName || 'Unnamed Co-Applicant'}
                      </ThemedText>
                      <ThemedText style={[styles.coApplicantEmail, { color: textSecondaryColor }]}>
                        {coApp.personal.email}
                      </ThemedText>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        onPress={() => handleEditCoApplicant(index)}
                        style={styles.iconButton}
                      >
                        <MaterialCommunityIcons name="pencil" size={20} color={primaryColor} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleRemoveCoApplicant(index)}
                        style={styles.iconButton}
                      >
                        <MaterialCommunityIcons name="delete" size={20} color="#ff3b30" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {getCoApplicantCount() < 12 && (
              <TouchableOpacity
                style={[styles.addCoApplicantButton, { borderColor: primaryColor }]}
                onPress={handleAddCoApplicant}
              >
                <MaterialCommunityIcons name="plus-circle" size={24} color={primaryColor} />
                <ThemedText style={[styles.addCoApplicantText, { color: primaryColor }]}>
                  Add Co-Applicant ({getCoApplicantCount()}/12)
                </ThemedText>
              </TouchableOpacity>
            )}
            
            {getCoApplicantCount() >= 12 && (
              <ThemedText style={[styles.maxApplicantsText, { color: textSecondaryColor }]}>
                Maximum of 12 applicants reached
              </ThemedText>
            )}
          </View>
        )}

        {/* Consent - Only show when NOT adding co-applicant or submitting full app */}
        {isCoApplicant !== 'true' && (
          <View style={[styles.consentCard, { backgroundColor: cardBgColor, borderColor }]}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreed(!agreed)}>
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: agreed ? primaryColor : 'transparent',
                    borderColor: agreed ? primaryColor : borderColor,
                  },
                ]}>
                {agreed && <MaterialCommunityIcons name="check" size={16} color="#ffffff" />}
              </View>
              <ThemedText style={[styles.consentText, { color: textPrimaryColor }]}>
                I agree to the terms and consent to a credit and background check. I confirm that all information
                provided is true and accurate.
              </ThemedText>
            </TouchableOpacity>
            {errors.agreed && <ThemedText style={styles.errorText}>{errors.agreed}</ThemedText>}
          </View>
        )}

        {/* Signature - Only show when NOT adding co-applicant */}
        {isCoApplicant !== 'true' && (
          <View style={[styles.signatureCard, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.label, { color: textPrimaryColor }]}>
              Type your full name as signature
            </ThemedText>
            <TextInput
              style={[
                styles.signatureInput,
                {
                  backgroundColor: inputBgColor,
                  color: textPrimaryColor,
                  borderColor: errors.signature ? '#ff3b30' : borderColor,
                },
              ]}
              placeholder="Enter your full name"
              placeholderTextColor={textSecondaryColor}
              value={signature}
              onChangeText={(value) => {
                setSignature(value);
                if (errors.signature) setErrors({ ...errors, signature: '' });
              }}
            />
            {errors.signature && <ThemedText style={styles.errorText}>{errors.signature}</ThemedText>}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: primaryColor }]}
          onPress={handleSubmit}>
          <ThemedText style={styles.submitButtonText}>
            {isCoApplicant === 'true' ? 'Save Co-Applicant' : 'Submit Application'}
          </ThemedText>
        </TouchableOpacity>
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
    color: '#8A8A8F',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  instruction: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionContent: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  consentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  signatureCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  signatureInput: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 44,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  coApplicantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  coApplicantName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  coApplicantEmail: {
    fontSize: 13,
  },
  iconButton: {
    padding: 4,
  },
  addCoApplicantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  addCoApplicantText: {
    fontSize: 15,
    fontWeight: '600',
  },
  maxApplicantsText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

