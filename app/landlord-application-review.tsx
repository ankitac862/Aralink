import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, Modal, Alert, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getApplicationById, approveApplication, rejectApplication, approveMoveInDate, supabase, DbLease } from '@/lib/supabase';
import { useOntarioLeaseStore } from '@/store/ontarioLeaseStore';

export default function LandlordApplicationReviewScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { resetWizard, updateFormData, setTenantId, setPropertyContext, beginLeaseEdit } = useOntarioLeaseStore();

  const [application, setApplication] = useState<any>(null);
  const [coApplicants, setCoApplicants] = useState<any[]>([]);
  const [selectedCoApplicant, setSelectedCoApplicant] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showCoApplicantModal, setShowCoApplicantModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [applicationLease, setApplicationLease] = useState<DbLease | null>(null);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const modalBg = isDark ? '#192734' : '#ffffff';

  // Load application details
  useEffect(() => {
    loadApplication();
  }, [id]);

  const loadApplication = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const data = await getApplicationById(id as string);
      setApplication(data);

      await loadLeaseForApplication(id as string);
      
      // Load co-applicants for this application
      await loadCoApplicants(id as string);
    } catch (error) {
      console.error('Error loading application:', error);
      Alert.alert('Error', 'Failed to load application details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCoApplicants = async (applicationId: string) => {
    try {
      const { data, error } = await supabase
        .from('co_applicants')
        .select('*')
        .eq('application_id', applicationId)
        .order('applicant_order', { ascending: true });

      if (error) {
        console.error('Error loading co-applicants:', error);
        return;
      }

      setCoApplicants(data || []);
      console.log(`✅ Loaded ${data?.length || 0} co-applicants`);
    } catch (error) {
      console.error('Error fetching co-applicants:', error);
    }
  };

  const loadLeaseForApplication = async (applicationId: string) => {
    try {
      const { data, error } = await supabase
        .from('leases')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading lease for application:', error);
        setApplicationLease(null);
        return;
      }

      setApplicationLease(data?.[0] || null);
    } catch (e) {
      console.error('Error loading lease for application:', e);
      setApplicationLease(null);
    }
  };

  const getLeaseStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'generated':
        return 'Created (PDF ready)';
      case 'uploaded':
        return 'Uploaded';
      case 'sent':
        return 'Waiting for tenant signature';
      case 'signed':
        return 'Waiting for landlord signature';
      case 'signed_pending_move_in':
        return 'Fully signed (pending move-in)';
      case 'active':
        return 'Active';
      default:
        return status;
    }
  };

  const canEditLease = (lease: DbLease | null) => {
    if (!lease) return false;
    if (lease.status === 'signed_pending_move_in' || lease.status === 'active') return false;
    return true;
  };

  const handleEditLease = (lease: DbLease) => {
    if (!canEditLease(lease)) return;

    Alert.alert(
      'Edit lease?',
      'This will reset signing progress. After you save changes, generate a new PDF to replace the previous lease document.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            const ok = await beginLeaseEdit(lease.id);
            if (!ok) {
              Alert.alert('Error', 'Could not open lease editor.');
              return;
            }
            router.push({
              pathname: '/lease-wizard/step1',
              params: { leaseId: lease.id, edit: '0' },
            });
          },
        },
      ]
    );
  };

  const handleApprove = () => {
    setShowApprovalDialog(true);
  };

  const handleApproveWithTenant = async (action: 'now' | 'later') => {
    setIsProcessing(true);
    setShowApprovalDialog(false);
    
    try {
      const result = await approveApplication(id as string, action);
      
      if (result.success) {
        if (action === 'now') {
          // Fetch fresh co-applicants right now (async, before navigating)
          let freshCoApplicants: Array<{ full_name: string }> = [];
          try {
            const { data } = await supabase
              .from('co_applicants')
              .select('full_name')
              .eq('application_id', id as string)
              .order('applicant_order', { ascending: true });
            freshCoApplicants = data || [];
          } catch (_) {}

          const allTenantNames = [
            application.applicant_name || '',
            ...freshCoApplicants.map(ca => ca.full_name).filter(Boolean),
          ];

          console.log('🏠 Setting lease tenant names before navigation:', allTenantNames);

          // Pre-fill store BEFORE navigating so step1 shows correct names immediately
          resetWizard();
          setTenantId(null, 'applicant', id as string);
          setPropertyContext({
            propertyId: application.property_id,
            unitId: application.unit_id || undefined,
            subUnitId: application.sub_unit_id || undefined,
          });
          updateFormData('tenantNames', allTenantNames);

          Alert.alert(
            'Application Approved',
            'The applicant has been notified. Navigating to lease wizard...',
            [{
              text: 'OK',
              onPress: () => {
                router.replace({
                  pathname: '/lease-wizard/step1',
                  params: {
                    applicationId: id,
                    propertyId: application.property_id,
                    unitId: application.unit_id,
                    subUnitId: application.sub_unit_id,
                  }
                });
              }
            }]
          );
        } else {
          Alert.alert(
            'Application Approved',
            'The applicant has been notified of approval.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to approve application');
      }
    } catch (error) {
      console.error('Error approving application:', error);
      Alert.alert('Error', 'Failed to approve application');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Application',
      'Are you sure you want to reject this application? The applicant will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const result = await rejectApplication(id as string);
              
              if (result.success) {
                Alert.alert(
                  'Application Rejected',
                  'The applicant has been notified.',
                  [{ text: 'OK', onPress: () => router.back() }]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to reject application');
              }
            } catch (error) {
              console.error('Error rejecting application:', error);
              Alert.alert('Error', 'Failed to reject application');
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handleDocumentView = async (documentUrl: string, documentName: string) => {
    try {
      console.log('📄 Opening document:', documentUrl);
      
      // Check if it's a local file URI (starts with file://)
      if (documentUrl.startsWith('file://')) {
        Alert.alert(
          'Document Not Available',
          'This document is stored locally on the applicant\'s device and cannot be viewed here. Please contact the applicant to share the document.'
        );
        return;
      }

      // Check if it's already a full URL (http:// or https://)
      if (documentUrl.startsWith('http://') || documentUrl.startsWith('https://')) {
        await Linking.openURL(documentUrl);
        return;
      }

      // Otherwise, try to get signed URL from storage with fallback buckets.
      // documentUrl is usually saved as: "<bucket>/<path>".
      const cleanedRef = decodeURIComponent(documentUrl).replace(/^\/+/, '').trim();
      const parts = cleanedRef.split('/').filter(Boolean);
      const knownBuckets = ['documents', 'lease-documents', 'application-documents'];
      const detectedBucket = parts[0] && knownBuckets.includes(parts[0]) ? parts[0] : null;
      const primaryBucket = detectedBucket || 'documents';
      const rawFilePath = detectedBucket ? parts.slice(1).join('/') : cleanedRef;
      const fileName = rawFilePath.includes('/') ? rawFilePath.split('/').pop() || rawFilePath : rawFilePath;

      // Build path candidates and remove duplicates/invalids.
      const normalizedFilePaths = Array.from(
        new Set(
          [
            rawFilePath,
            rawFilePath.replace(/^\/+/, ''),
            // Handle malformed rows where bucket was duplicated in path
            rawFilePath.startsWith(`${primaryBucket}/`) ? rawFilePath.slice(primaryBucket.length + 1) : rawFilePath,
            cleanedRef.startsWith(`${primaryBucket}/`) ? cleanedRef.slice(primaryBucket.length + 1) : cleanedRef,
            cleanedRef,
            fileName, // last-chance fallback
          ]
            .map((p) => p?.trim())
            .filter((p): p is string => !!p && !p.startsWith('http://') && !p.startsWith('https://'))
        )
      );

      // Try fallback buckets: start with primary, then remaining known buckets.
      const candidateBuckets = [primaryBucket, ...['documents', 'lease-documents', 'application-documents'].filter(b => b && b !== primaryBucket)];
      let lastError: any = null;
      let signedUrl: string | null = null;

      for (const bucket of candidateBuckets) {
        for (const pathToTry of normalizedFilePaths) {
          try {
            const { data, error } = await supabase
              .storage
              .from(bucket)
              .createSignedUrl(pathToTry, 3600); // 1 hour expiry

            if (!error && data?.signedUrl) {
              console.log(`✅ Signed URL resolved from ${bucket}/${pathToTry}`);
              signedUrl = data.signedUrl;
              break;
            }

            lastError = error;
          } catch (e) {
            lastError = e;
          }
        }

        if (signedUrl) {
          break;
        }
      }

      if (!signedUrl) {
        console.log('❌ Failed storage resolution with buckets:', candidateBuckets);
        console.log('❌ Tried storage paths:', normalizedFilePaths);
        throw lastError || new Error('Unable to locate document in any storage bucket');
      }

      await Linking.openURL(signedUrl);
    } catch (error: any) {
      console.error('Error opening document:', error);
      Alert.alert(
        'Document Not Available',
        'The document could not be opened. It may not have been uploaded to the server yet.'
      );
    }
  };

  if (isLoading || !application) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
            Application Review
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <ThemedText style={[{ color: textSecondaryColor, marginTop: 16 }]}>Loading...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
          Application: {application.applicant_name}
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Applicant Info Card */}
        <View style={[styles.applicantCard, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.applicantHeader}>
            <View style={styles.applicantInfo}>
              <ThemedText style={[styles.applicantName, { color: textPrimaryColor }]}>
                {application.applicant_name}
              </ThemedText>
              <ThemedText style={[styles.applicantProperty, { color: textSecondaryColor }]}>
                Applied for: {application.property_address}
              </ThemedText>
              <ThemedText style={[styles.applicantDate, { color: textSecondaryColor }]}>
                Submitted: {new Date(application.submitted_at || application.created_at).toLocaleDateString()}
              </ThemedText>
              <ThemedText style={[styles.applicantEmail, { color: textSecondaryColor }]}>
                {application.applicant_email}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Lease (linked to this application) */}
        {applicationLease && (
          <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Lease</ThemedText>
            <View style={styles.sectionContent}>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Status</ThemedText>
                <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                  {getLeaseStatusLabel(applicationLease.status)}
                </ThemedText>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={[styles.approveButton, { backgroundColor: primaryColor, paddingVertical: 10, flex: 1, minWidth: 140 }]}
                  onPress={() => router.push(`/lease-detail?id=${applicationLease.id}`)}>
                  <ThemedText style={styles.approveButtonText}>Open Lease</ThemedText>
                </TouchableOpacity>

                {canEditLease(applicationLease) && (
                  <TouchableOpacity
                    style={[
                      styles.rejectButton,
                      { borderColor: primaryColor, paddingVertical: 10, flex: 1, minWidth: 140, alignItems: 'center' },
                    ]}
                    onPress={() => handleEditLease(applicationLease)}>
                    <ThemedText style={[styles.modalButtonTextOutline, { color: textPrimaryColor }]}>Edit Lease</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Personal Information */}
        <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Personal Information</ThemedText>
          <View style={styles.sectionContent}>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Full Name</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {application.applicant_name}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Email</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {application.applicant_email}
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Phone</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                {application.applicant_phone || 'N/A'}
              </ThemedText>
            </View>
            {application.form_data?.personal?.dob && (
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Date of Birth</ThemedText>
                <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                  {application.form_data.personal.dob}
                </ThemedText>
              </View>
            )}
          </View>
        </View>

        {/* Co-Applicants Section */}
        {coApplicants.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>
                Co-Applicants ({coApplicants.length})
              </ThemedText>
              <MaterialCommunityIcons name="account-group" size={20} color={primaryColor} />
            </View>
            <View style={styles.sectionContent}>
              {coApplicants.map((coApplicant, index) => (
                <TouchableOpacity
                  key={coApplicant.id}
                  style={[styles.coApplicantItem, { borderColor }]}
                  onPress={() => {
                    setSelectedCoApplicant(coApplicant);
                    setShowCoApplicantModal(true);
                  }}>
                  <View style={styles.coApplicantInfo}>
                    <View style={[styles.coApplicantAvatar, { backgroundColor: `${primaryColor}20` }]}>
                      <ThemedText style={[styles.coApplicantAvatarText, { color: primaryColor }]}>
                        {coApplicant.full_name.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.coApplicantName, { color: textPrimaryColor }]}>
                        {coApplicant.full_name}
                      </ThemedText>
                      <ThemedText style={[styles.coApplicantEmail, { color: textSecondaryColor }]}>
                        {coApplicant.email}
                      </ThemedText>
                      {coApplicant.phone && (
                        <ThemedText style={[styles.coApplicantPhone, { color: textSecondaryColor }]}>
                          {coApplicant.phone}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={textSecondaryColor} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Employment & Financial Information */}
        {application.form_data?.employment && (
          <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Employment & Financial</ThemedText>
            <View style={styles.sectionContent}>
              {application.form_data.employment.employerName && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Employer</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.employment.employerName}
                  </ThemedText>
                </View>
              )}
              {application.form_data.employment.jobTitle && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Job Title</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.employment.jobTitle}
                  </ThemedText>
                </View>
              )}
              {application.form_data.employment.employmentType && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Employment Type</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.employment.employmentType}
                  </ThemedText>
                </View>
              )}
              {application.form_data.employment.annualIncome && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Annual Income</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    ${application.form_data.employment.annualIncome}
                  </ThemedText>
                </View>
              )}
              {application.form_data.employment.additionalIncome && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Additional Income</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    ${application.form_data.employment.additionalIncome}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Rental History */}
        {application.form_data?.residence && (
          <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Rental History</ThemedText>
            <View style={styles.sectionContent}>
              {application.form_data.residence.currentAddress && (
                <>
                  <ThemedText style={[styles.subsectionTitle, { color: textPrimaryColor }]}>Current Residence</ThemedText>
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Address</ThemedText>
                    <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                      {application.form_data.residence.currentAddress}
                    </ThemedText>
                  </View>
                </>
              )}
              {application.form_data.residence.currentLandlordName && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Landlord Name</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.residence.currentLandlordName}
                  </ThemedText>
                </View>
              )}
              {application.form_data.residence.currentLandlordContact && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Landlord Contact</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.residence.currentLandlordContact}
                  </ThemedText>
                </View>
              )}
              
              {application.form_data.residence.previousAddress && (
                <>
                  <View style={styles.divider} />
                  <ThemedText style={[styles.subsectionTitle, { color: textPrimaryColor, marginTop: 12 }]}>Previous Residence</ThemedText>
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Address</ThemedText>
                    <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                      {application.form_data.residence.previousAddress}
                    </ThemedText>
                  </View>
                </>
              )}
              {application.form_data.residence.previousLandlordName && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Landlord Name</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.residence.previousLandlordName}
                  </ThemedText>
                </View>
              )}
              {application.form_data.residence.previousLandlordContact && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Landlord Contact</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.residence.previousLandlordContact}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Additional Information */}
        {application.form_data?.other && (
          <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Additional Information</ThemedText>
            <View style={styles.sectionContent}>
              {application.form_data.other.occupants && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Other Occupants</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.other.occupants}
                  </ThemedText>
                </View>
              )}
              {application.form_data.other.vehicleInfo && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Vehicle Info</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.other.vehicleInfo}
                  </ThemedText>
                </View>
              )}
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Pets</ThemedText>
                <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                  {application.form_data.other.pets ? 'Yes' : 'No'}
                </ThemedText>
              </View>
              {application.form_data.other.notes && (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Notes</ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                    {application.form_data.other.notes}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Uploaded Documents */}
        {application.form_data?.documents && Object.keys(application.form_data.documents).length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Uploaded Documents</ThemedText>
            <View style={styles.sectionContent}>
              {Object.entries(application.form_data.documents).map(([key, value]) => {
                if (!value) return null;
                const documentName = key.replace(/([A-Z])/g, ' $1').trim();
                const isLocalFile = typeof value === 'string' && value.startsWith('file://');
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.documentItem}
                    onPress={() => handleDocumentView(value as string, documentName)}>
                    <MaterialCommunityIcons name="file-document" size={24} color={primaryColor} />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.documentName, { color: textPrimaryColor }]}>
                        {documentName}
                      </ThemedText>
                      <ThemedText style={[styles.documentHint, { color: textSecondaryColor }]}>
                        {isLocalFile ? 'Stored locally on device' : 'Tap to view'}
                      </ThemedText>
                    </View>
                    <MaterialCommunityIcons 
                      name={isLocalFile ? 'information-outline' : 'chevron-right'} 
                      size={20} 
                      color={textSecondaryColor} 
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Decision Actions - only show if status is 'submitted' */}
        {application.status === 'submitted' && (
          <View style={styles.actionsContainer}>
            <ThemedText style={[styles.actionsTitle, { color: textPrimaryColor }]}>Make a Decision</ThemedText>

            <TouchableOpacity
              style={[styles.rejectButton, { borderColor: '#ff3b30' }]}
              onPress={handleReject}
              disabled={isProcessing}>
              <ThemedText style={[styles.rejectButtonText, { color: '#ff3b30' }]}>Reject Application</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.approveButton, { backgroundColor: primaryColor }]}
              onPress={handleApprove}
              disabled={isProcessing}>
              <ThemedText style={styles.approveButtonText}>Approve Application</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {application.status === 'lease_signed' && (
          <View style={styles.actionsContainer}>
            <ThemedText style={[styles.actionsTitle, { color: textPrimaryColor }]}>Move-In Approval Required</ThemedText>
            <ThemedText style={[styles.statusText, { color: textSecondaryColor, marginBottom: 15 }]}>
              The applicant has signed the lease. Please approve the Move-In Date to finalize their transition.
            </ThemedText>
            <TouchableOpacity
              style={[styles.approveButton, { backgroundColor: primaryColor }]}
              onPress={async () => {
                try {
                  setIsProcessing(true);
                  const res = await approveMoveInDate(application.id);
                  if (res.success) {
                    Alert.alert('Success', 'Move-in approved!');
                    loadApplication(); // Reload to see move_in_approved status
                  } else throw new Error(res.error);
                } catch(e: any) {
                  Alert.alert('Error', e.message);
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}>
              <ThemedText style={styles.approveButtonText}>Approve Move-In</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Info - show if already processed */}
        {application.status !== 'submitted' && application.status !== 'lease_signed' && (
          <View style={[styles.statusCard, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.statusTitle, { color: textPrimaryColor }]}>
              Status: {application.status.toUpperCase()}
            </ThemedText>
            <ThemedText style={[styles.statusText, { color: textSecondaryColor }]}>
              This application has already been {application.status}.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Approval Dialog */}
      <Modal
        visible={showApprovalDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApprovalDialog(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ThemedText style={[styles.modalTitle, { color: textPrimaryColor }]}>
              Application Approved!
            </ThemedText>
            <ThemedText style={[styles.modalMessage, { color: textSecondaryColor }]}>
              Do you want to generate a lease for this applicant now?
            </ThemedText>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: primaryColor }]}
              onPress={() => handleApproveWithTenant('now')}>
              <ThemedText style={styles.modalButtonText}>Generate Lease Now</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButtonOutline, { borderColor }]}
              onPress={() => handleApproveWithTenant('later')}>
              <ThemedText style={[styles.modalButtonTextOutline, { color: textPrimaryColor }]}>
                Do it Later
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={() => setShowApprovalDialog(false)}>
              <ThemedText style={[styles.modalButtonTextCancel, { color: textSecondaryColor }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Co-Applicant Detail Modal */}
      <Modal
        visible={showCoApplicantModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCoApplicantModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.coApplicantModal, { backgroundColor: modalBg }]}>
            <View style={styles.coApplicantModalHeader}>
              <ThemedText style={[styles.modalTitle, { color: textPrimaryColor }]}>
                Co-Applicant Details
              </ThemedText>
              <TouchableOpacity onPress={() => setShowCoApplicantModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textPrimaryColor} />
              </TouchableOpacity>
            </View>

            {selectedCoApplicant && (
              <ScrollView 
                style={styles.coApplicantModalContent}
                contentContainerStyle={styles.coApplicantModalScroll}
                showsVerticalScrollIndicator={true}
              >
                {/* Personal Information */}
                <View style={[styles.modalSection, { borderColor }]}>
                  <ThemedText style={[styles.modalSectionTitle, { color: textPrimaryColor }]}>
                    Personal Information
                  </ThemedText>
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Full Name</ThemedText>
                    <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                      {selectedCoApplicant.full_name}
                    </ThemedText>
                  </View>
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Email</ThemedText>
                    <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                      {selectedCoApplicant.email}
                    </ThemedText>
                  </View>
                  {selectedCoApplicant.phone && (
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Phone</ThemedText>
                      <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                        {selectedCoApplicant.phone}
                      </ThemedText>
                    </View>
                  )}
                  {selectedCoApplicant.date_of_birth && (
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Date of Birth</ThemedText>
                      <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                        {selectedCoApplicant.date_of_birth}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {/* Employment Information */}
                {(selectedCoApplicant.employer_name || selectedCoApplicant.annual_income) && (
                  <View style={[styles.modalSection, { borderColor }]}>
                    <ThemedText style={[styles.modalSectionTitle, { color: textPrimaryColor }]}>
                      Employment & Financial
                    </ThemedText>
                    {selectedCoApplicant.employer_name && (
                      <View style={styles.infoRow}>
                        <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Employer</ThemedText>
                        <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                          {selectedCoApplicant.employer_name}
                        </ThemedText>
                      </View>
                    )}
                    {selectedCoApplicant.job_title && (
                      <View style={styles.infoRow}>
                        <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Job Title</ThemedText>
                        <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                          {selectedCoApplicant.job_title}
                        </ThemedText>
                      </View>
                    )}
                    {selectedCoApplicant.employment_type && (
                      <View style={styles.infoRow}>
                        <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Employment Type</ThemedText>
                        <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                          {selectedCoApplicant.employment_type}
                        </ThemedText>
                      </View>
                    )}
                    {selectedCoApplicant.annual_income && (
                      <View style={styles.infoRow}>
                        <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Annual Income</ThemedText>
                        <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                          ${selectedCoApplicant.annual_income}
                        </ThemedText>
                      </View>
                    )}
                    {selectedCoApplicant.additional_income && (
                      <View style={styles.infoRow}>
                        <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Additional Income</ThemedText>
                        <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                          ${selectedCoApplicant.additional_income}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                )}

                {/* Rental History */}
                {(selectedCoApplicant.current_address || selectedCoApplicant.previous_address) && (
                  <View style={[styles.modalSection, { borderColor }]}>
                    <ThemedText style={[styles.modalSectionTitle, { color: textPrimaryColor }]}>
                      Rental History
                    </ThemedText>
                    {selectedCoApplicant.current_address && (
                      <>
                        <ThemedText style={[styles.subsectionTitle, { color: textPrimaryColor }]}>
                          Current Residence
                        </ThemedText>
                        <View style={styles.infoRow}>
                          <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Address</ThemedText>
                          <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                            {selectedCoApplicant.current_address}
                          </ThemedText>
                        </View>
                        {selectedCoApplicant.current_landlord_name && (
                          <View style={styles.infoRow}>
                            <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Landlord Name</ThemedText>
                            <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                              {selectedCoApplicant.current_landlord_name}
                            </ThemedText>
                          </View>
                        )}
                        {selectedCoApplicant.current_landlord_contact && (
                          <View style={styles.infoRow}>
                            <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Landlord Contact</ThemedText>
                            <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                              {selectedCoApplicant.current_landlord_contact}
                            </ThemedText>
                          </View>
                        )}
                      </>
                    )}
                    {selectedCoApplicant.previous_address && (
                      <>
                        {selectedCoApplicant.current_address && <View style={styles.divider} />}
                        <ThemedText style={[styles.subsectionTitle, { color: textPrimaryColor, marginTop: 12 }]}>
                          Previous Residence
                        </ThemedText>
                        <View style={styles.infoRow}>
                          <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Address</ThemedText>
                          <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                            {selectedCoApplicant.previous_address}
                          </ThemedText>
                        </View>
                        {selectedCoApplicant.previous_landlord_name && (
                          <View style={styles.infoRow}>
                            <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Landlord Name</ThemedText>
                            <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                              {selectedCoApplicant.previous_landlord_name}
                            </ThemedText>
                          </View>
                        )}
                        {selectedCoApplicant.previous_landlord_contact && (
                          <View style={styles.infoRow}>
                            <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Landlord Contact</ThemedText>
                            <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                              {selectedCoApplicant.previous_landlord_contact}
                            </ThemedText>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* Additional Information */}
                {(selectedCoApplicant.occupants || selectedCoApplicant.vehicle_info || selectedCoApplicant.notes) && (
                  <View style={[styles.modalSection, { borderColor }]}>
                    <ThemedText style={[styles.modalSectionTitle, { color: textPrimaryColor }]}>
                      Additional Information
                    </ThemedText>
                    {selectedCoApplicant.occupants && (
                      <View style={styles.infoRow}>
                        <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Other Occupants</ThemedText>
                        <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                          {selectedCoApplicant.occupants}
                        </ThemedText>
                      </View>
                    )}
                    {selectedCoApplicant.vehicle_info && (
                      <View style={styles.infoRow}>
                        <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Vehicle Info</ThemedText>
                        <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                          {selectedCoApplicant.vehicle_info}
                        </ThemedText>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Pets</ThemedText>
                      <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                        {selectedCoApplicant.pets ? 'Yes' : 'No'}
                      </ThemedText>
                    </View>
                    {selectedCoApplicant.notes && (
                      <View style={styles.infoRow}>
                        <ThemedText style={[styles.infoLabel, { color: textSecondaryColor }]}>Notes</ThemedText>
                        <ThemedText style={[styles.infoValue, { color: textPrimaryColor }]}>
                          {selectedCoApplicant.notes}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  applicantCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  applicantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  applicantInfo: {
    flex: 1,
  },
  applicantName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  applicantProperty: {
    fontSize: 14,
    marginBottom: 4,
  },
  applicantDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  applicantEmail: {
    fontSize: 12,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  documentNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 16,
  },
  sectionContent: {
    gap: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginBottom: 8,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
  },
  documentHint: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsContainer: {
    marginTop: 8,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  rejectButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  approveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  statusCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalButtonOutline: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  modalButtonTextOutline: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonCancel: {
    paddingVertical: 8,
  },
  modalButtonTextCancel: {
    fontSize: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  coApplicantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  coApplicantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  coApplicantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coApplicantAvatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  coApplicantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  coApplicantEmail: {
    fontSize: 13,
    marginBottom: 2,
  },
  coApplicantPhone: {
    fontSize: 12,
  },
  coApplicantModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
  },
  coApplicantModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  coApplicantModalContent: {
    maxHeight: 500,
  },
  coApplicantModalScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  modalSection: {
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
});

