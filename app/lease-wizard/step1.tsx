/**
 * Ontario Lease Wizard - Step 1: Parties
 * 
 * Section 1 of Ontario Standard Lease:
 * - Landlord name (auto-filled from profile)
 * - Tenant names (autocomplete from existing tenants or manual entry)
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOntarioLeaseStore } from '@/store/ontarioLeaseStore';
import { useAuthStore } from '@/store/authStore';
import { fetchTenants, DbTenant, fetchApprovedApplicants } from '@/lib/supabase';

export default function LeaseWizardStep1() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { user } = useAuthStore();
  const {
    formData,
    updateFormData,
    addTenantName,
    removeTenantName,
    updateTenantName,
    setTenantId,
    nextStep,
    resetWizard,
  } = useOntarioLeaseStore();

  // Combined interface for both tenants and applicants
  interface PersonOption {
    id: string;
    fullName: string;
    email: string;
    type: 'tenant' | 'applicant';
    applicationId?: string; // For applicants
    coApplicants?: Array<{ full_name: string; email: string }>; // Co-applicant details
  }
  
  const [personOptions, setPersonOptions] = useState<PersonOption[]>([]);
  const [isLoadingPersons, setIsLoadingPersons] = useState(false);
  const [showTenantSuggestions, setShowTenantSuggestions] = useState<number | null>(null);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const inputBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  // Load existing tenants and approved applicants for autocomplete
  useEffect(() => {
    loadPersonOptions();
  }, [user?.id]);

  const loadPersonOptions = async () => {
    if (!user?.id) return;
    setIsLoadingPersons(true);
    try {
      // Fetch both tenants and approved applicants
      const [tenants, applicants] = await Promise.all([
        fetchTenants(user.id),
        fetchApprovedApplicants(user.id),
      ]);
      
      // Fetch co-applicants for each approved applicant
      const applicantsWithCoApplicants = await Promise.all(
        applicants.map(async (a) => {
          const { supabase } = await import('@/lib/supabase');
          const { data: coApplicants } = await supabase
            .from('co_applicants')
            .select('full_name, email')
            .eq('application_id', a.id)
            .order('applicant_order', { ascending: true });
          
          return {
            id: a.applicant_email, // Use email as temporary ID
            fullName: a.applicant_name || a.applicant_email || 'Unknown',
            email: a.applicant_email,
            type: 'applicant' as const,
            applicationId: a.id, // Store application ID
            coApplicants: coApplicants || [],
          };
        })
      );
      
      // Combine into single list
      const options: PersonOption[] = [
        // Add tenants
        ...tenants.map(t => ({
          id: t.id,
          fullName: `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email || 'Unknown',
          email: t.email,
          type: 'tenant' as const,
        })),
        // Add approved applicants
        ...applicantsWithCoApplicants,
      ];
      
      setPersonOptions(options);
    } catch (error) {
      console.error('Error loading persons:', error);
    } finally {
      setIsLoadingPersons(false);
    }
  };

  // Filter persons based on search query
  const filteredPersons = personOptions.filter((person) => {
    const normalizedQuery = tenantSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }
    const name = person.fullName?.toLowerCase() || '';
    const email = person.email?.toLowerCase() || '';
    return name.includes(normalizedQuery) || email.includes(normalizedQuery);
  });

  const handleSelectPerson = async (person: PersonOption, index: number) => {
    updateTenantName(index, person.fullName);
    // Set the person ID and type in the store
    if (index === 0) {
      if (person.type === 'tenant') {
        setTenantId(person.id, 'tenant');
      } else {
        // For applicants, don't set tenantId (leave null), only store application info
        setTenantId(null, 'applicant', person.applicationId);
        
        // If this applicant has co-applicants, automatically add them
        if (person.coApplicants && person.coApplicants.length > 0) {
          console.log('Auto-adding co-applicants:', person.coApplicants);
          // Add co-applicants to the tenant list
          person.coApplicants.forEach((coApp) => {
            addTenantName(); // Add empty slot
            const currentNames = useOntarioLeaseStore.getState().formData.tenantNames;
            updateTenantName(currentNames.length - 1, coApp.full_name);
          });
        }
      }
    }
    setShowTenantSuggestions(null);
    setTenantSearchQuery('');
  };

  const handleTenantInputFocus = (index: number) => {
    setShowTenantSuggestions(index);
    setTenantSearchQuery(formData.tenantNames[index] || '');
  };

  const handleTenantInputChange = (text: string, index: number) => {
    updateTenantName(index, text);
    setTenantSearchQuery(text);
    // If user is editing the first tenant and it no longer matches a selected person, clear the IDs
    if (index === 0) {
      const matchesPerson = personOptions.some(p => p.fullName === text);
      if (!matchesPerson) {
        setTenantId(null);
      }
    }
  };

  const handleNext = () => {
    // Validation
    if (!formData.landlordName.trim()) {
      return;
    }
    if (!formData.tenantNames[0]?.trim()) {
      return;
    }

    nextStep();
    router.push('/lease-wizard/step2');
  };

  const handleClose = () => {
    resetWizard();
    router.back();
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header with Close Button */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Step 1: Parties
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress */}
      <View style={[styles.progressContainer, { borderBottomColor: borderColor }]}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '16.66%', backgroundColor: primaryColor }]} />
        </View>
        <ThemedText style={[styles.progressText, { color: secondaryTextColor }]}>
          1 of 6
        </ThemedText>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Landlord Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-tie" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Landlord Information
              </ThemedText>
            </View>
            <ThemedText style={[styles.sectionDescription, { color: secondaryTextColor }]}>
              Enter the legal name of the landlord who will be listed on the lease.
            </ThemedText>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.label, { color: textColor }]}>
                Landlord Full Name <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                placeholder="Enter landlord's legal name"
                placeholderTextColor={secondaryTextColor}
                value={formData.landlordName}
                onChangeText={(text) => updateFormData('landlordName', text)}
              />
              {user?.name && !formData.landlordName && (
                <TouchableOpacity 
                  style={styles.autofillHint}
                  onPress={() => updateFormData('landlordName', user.name)}
                >
                  <MaterialCommunityIcons name="account-check" size={16} color={primaryColor} />
                  <ThemedText style={[styles.autofillText, { color: primaryColor }]}>
                    Use "{user.name}" from profile
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Tenant Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-group" size={24} color={primaryColor} />
              <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
                Tenant Information
              </ThemedText>
            </View>
            <ThemedText style={[styles.sectionDescription, { color: secondaryTextColor }]}>
              Select from existing tenants/approved applicants or enter names manually. You can add multiple tenants.
            </ThemedText>

            {formData.tenantNames.map((name, index) => (
              <View key={index} style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <ThemedText style={[styles.label, { color: textColor }]}>
                    Tenant {index + 1} {index === 0 && <ThemedText style={{ color: '#ef4444' }}>*</ThemedText>}
                  </ThemedText>
                  {formData.tenantNames.length > 1 && (
                    <TouchableOpacity onPress={() => removeTenantName(index)}>
                      <MaterialCommunityIcons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.autocompleteContainer}>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBgColor, borderColor, color: textColor }]}
                    placeholder={`Enter or select tenant/applicant ${index + 1}'s name`}
                    placeholderTextColor={secondaryTextColor}
                    value={name}
                    onChangeText={(text) => handleTenantInputChange(text, index)}
                    onFocus={() => handleTenantInputFocus(index)}
                    onBlur={() => setTimeout(() => setShowTenantSuggestions(null), 200)}
                  />
                  
                  {/* Autocomplete Dropdown - Shows both tenants and applicants */}
                  {showTenantSuggestions === index && filteredPersons.length > 0 && (
                    <View style={[styles.suggestionsContainer, { backgroundColor: inputBgColor, borderColor }]}>
                      {isLoadingPersons ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color={primaryColor} />
                        </View>
                      ) : (
                        <ScrollView 
                          nestedScrollEnabled 
                          keyboardShouldPersistTaps="handled"
                          style={{ maxHeight: 200 }}
                        >
                          {filteredPersons.slice(0, 5).map((item, idx) => (
                            <TouchableOpacity
                              key={`${item.type}-${item.id}`}
                              style={[
                                styles.suggestionItem, 
                                { borderBottomColor: borderColor },
                                idx === filteredPersons.slice(0, 5).length - 1 && { borderBottomWidth: 0 }
                              ]}
                              onPress={() => handleSelectPerson(item, index)}
                            >
                              <MaterialCommunityIcons 
                                name={item.type === 'tenant' ? 'account' : 'account-check'} 
                                size={20} 
                                color={item.type === 'tenant' ? secondaryTextColor : primaryColor} 
                              />
                              <View style={styles.suggestionContent}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <ThemedText style={[styles.suggestionName, { color: textColor }]}>
                                    {item.fullName}
                                  </ThemedText>
                                  {item.type === 'applicant' && (
                                    <View style={[styles.badge, { backgroundColor: primaryColor + '20' }]}>
                                      <ThemedText style={[styles.badgeText, { color: primaryColor }]}>
                                        Approved Applicant
                                      </ThemedText>
                                    </View>
                                  )}
                                </View>
                                {item.email && (
                                  <ThemedText style={[styles.suggestionEmail, { color: secondaryTextColor }]}>
                                    {item.email}
                                  </ThemedText>
                                )}
                                {item.coApplicants && item.coApplicants.length > 0 && (
                                  <View style={{ marginTop: 4, paddingLeft: 8 }}>
                                    {item.coApplicants.map((coApp, idx) => (
                                      <ThemedText 
                                        key={idx} 
                                        style={[styles.suggestionEmail, { color: primaryColor, fontSize: 12 }]}
                                      >
                                        • {coApp.full_name}
                                      </ThemedText>
                                    ))}
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.addButton, { borderColor: primaryColor }]}
              onPress={addTenantName}
            >
              <MaterialCommunityIcons name="plus" size={20} color={primaryColor} />
              <ThemedText style={[styles.addButtonText, { color: primaryColor }]}>
                Add Another Tenant
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: borderColor }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: primaryColor }]}
          onPress={handleNext}
        >
          <ThemedText style={styles.primaryButtonText}>Continue</ThemedText>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
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
  closeButton: {
    padding: 4,
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  autofillHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  autofillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  autocompleteContainer: {
    position: 'relative',
    zIndex: 1,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '500',
  },
  suggestionEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
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
});
