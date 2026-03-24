/**
 * Ontario Lease Generation Wizard - Entry Point
 * 
 * This screen serves as the entry point for the lease generation wizard.
 * It displays the current step and provides navigation.
 * 
 * Entry Points:
 * - From Property Detail: propertyId (and optionally unitId/roomId)
 * - From Tenant Page: tenantId (and optionally propertyId)
 * - Direct: No params (user selects property/tenant manually)
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOntarioLeaseStore } from '@/store/ontarioLeaseStore';
import { usePropertyStore } from '@/store/propertyStore';
import { useAuthStore } from '@/store/authStore';
import { fetchTenantById, DbTenant } from '@/lib/supabase';

const STEP_TITLES = [
  'Parties',
  'Rental Unit',
  'Contact Info',
  'Term',
  'Rent',
  'Review & Generate',
];

export default function LeaseWizardIndex() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    propertyId?: string; 
    unitId?: string; 
    roomId?: string;
    tenantId?: string;
    tenantName?: string;
    coApplicantNames?: string; // JSON stringified array of co-applicant names
    applicationId?: string; // New param for approved applications
  }>();
  
  const { user } = useAuthStore();
  const { getPropertyById, properties } = usePropertyStore();
  const {
    currentStep,
    totalSteps,
    formData,
    setPropertyContext,
    prefillLandlordInfo,
    prefillFromProperty,
    updateFormData,
    updateTenantName,
    resetWizard,
    isLoading,
  } = useOntarioLeaseStore();

  const [selectedTenant, setSelectedTenant] = useState<DbTenant | null>(null);
  const [initComplete, setInitComplete] = useState(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  // Initialize wizard with context
  useEffect(() => {
    if (!initComplete) {
      // ── Synchronous step: set tenant names immediately from params ──
      // This runs before the async fetch so step1 always shows correct names
      if (params.applicationId && (params.tenantName || params.coApplicantNames)) {
        const allNames: string[] = [params.tenantName || ''];
        if (params.coApplicantNames) {
          try {
            const coAppNames = JSON.parse(params.coApplicantNames) as string[];
            allNames.push(...coAppNames.filter(n => n?.trim()));
          } catch (_) {}
        }
        if (allNames.some(n => n.trim())) {
          updateFormData('tenantNames', allNames);
          console.log('⚡ Synchronously set tenant names:', allNames);
        }
      }
      initializeWizard();
    }
  }, [params.propertyId, params.unitId, params.roomId, params.tenantId, params.tenantName, params.coApplicantNames, params.applicationId]);

  const initializeWizard = async () => {
    console.log('Initializing wizard with params:', params);
    
    // Reset wizard for fresh start if no draft
    if (!params.propertyId && !params.tenantId && !params.applicationId) {
      // Fresh start - show property/tenant selection
      setInitComplete(true);
      return;
    }

    // If applicationId is provided, fetch and prefill from application
    if (params.applicationId) {
      try {
        const { getApplicationById } = await import('@/lib/supabase');
        const application = await getApplicationById(params.applicationId);
        
        if (application) {
          console.log('📋 Application loaded:', application.applicant_name);
          console.log('📋 Co-applicant names from params:', params.coApplicantNames);
          
          // Set context with application data
          setPropertyContext({
            propertyId: application.property_id,
            unitId: application.unit_id || undefined,
            subUnitId: application.sub_unit_id || undefined,
            tenantId: undefined, // No tenant yet, will be created after signing
          });
          
          // Store application ID in ontarioLeaseStore
          const { useOntarioLeaseStore: LeaseStore } = await import('@/store/ontarioLeaseStore');
          LeaseStore.getState().setTenantId(null, 'applicant', params.applicationId);
          
          // Build complete tenant names array including primary and co-applicants
          const allTenantNames: string[] = [application.applicant_name || ''];
          
          // Add co-applicants if provided
          if (params.coApplicantNames) {
            try {
              const coAppNames = JSON.parse(params.coApplicantNames) as string[];
              console.log('📋 Parsed co-applicants:', coAppNames);
              allTenantNames.push(...coAppNames.filter(n => n?.trim()));
            } catch (error) {
              console.error('Error parsing co-applicant names:', error);
            }
          }
          
          console.log('📋 All tenant names to set:', allTenantNames);
          
          // Update form data with all tenant names at once
          LeaseStore.getState().updateFormData('tenantNames', allTenantNames);
          
          console.log('📋 Store tenant names after update:', LeaseStore.getState().formData.tenantNames);
          
          // Get property info for prefilling address
          const property = getPropertyById(application.property_id);
          if (property) {
            let unitInfo = '';
            
            // Handle different property types
            if (property.property_type === 'multi_unit' && application.unit_id) {
              const unit = property.units?.find(u => u.id === application.unit_id);
              if (unit && application.sub_unit_id) {
                const subUnit = unit.sub_units?.find(s => s.id === application.sub_unit_id);
                unitInfo = subUnit?.name || unit.unit_number || '';
              } else if (unit) {
                unitInfo = unit.unit_number || '';
              }
            } else if (application.sub_unit_id) {
              const subUnit = property.sub_units?.find(s => s.id === application.sub_unit_id);
              unitInfo = subUnit?.name || '';
            }

            prefillFromProperty({
              unit: unitInfo,
              streetNumber: property.address1?.split(' ')[0] || '',
              streetName: property.address1?.split(' ').slice(1).join(' ') || '',
              city: property.city || '',
              province: property.state || 'ON',
              postalCode: property.zip_code || '',
            });
          }
        }
      } catch (error) {
        console.error('Error loading application:', error);
      }
      
      setInitComplete(true);
      return;
    }

    // Set property context
    if (params.propertyId) {
      setPropertyContext({
        propertyId: params.propertyId,
        unitId: params.unitId || undefined,
        subUnitId: params.roomId || undefined, // ← FIX: roomId should map to subUnitId
        tenantId: params.tenantId || undefined,
      });
      
      // Prefill from property
      const property = getPropertyById(params.propertyId);
      if (property) {
        // Find unit info if unitId provided
        let unitInfo = '';
        if (params.unitId && property.units) {
          const unit = property.units.find(u => u.id === params.unitId);
          if (unit) {
            unitInfo = unit.name || '';
            // Check for room/subunit
            if (params.roomId && unit.subUnits) {
              const room = unit.subUnits.find(r => r.id === params.roomId);
              if (room) {
                unitInfo = `${unit.name} - ${room.name}`;
              }
            }
          }
        }
        
        prefillFromProperty({
          unit: unitInfo,
          streetNumber: property.address1?.split(' ')[0] || '',
          streetName: property.address1?.split(' ').slice(1).join(' ') || '',
          city: property.city,
          province: property.state,
          postalCode: property.zipCode,
        });
      }
      
      // Prefill landlord info
      if (user) {
        prefillLandlordInfo(
          property?.landlordName || user.name,
          user.email,
          user.phone
        );
      }
    }

    // Prefill tenant if provided
    if (params.tenantId) {
      try {
        const tenant = await fetchTenantById(params.tenantId);
        if (tenant) {
          setSelectedTenant(tenant);
          // Update first tenant name
          updateTenantName(0, tenant.name);
        }
      } catch (error) {
        console.error('Error fetching tenant:', error);
      }
    } else if (params.tenantName) {
      // If tenant name passed directly
      updateTenantName(0, params.tenantName);
    }

    setInitComplete(true);
  };

  const handleStepPress = (step: number) => {
    router.push(`/lease-wizard/step${step}`);
  };

  const handleCancel = () => {
    resetWizard();
    router.back();
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
          Loading...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleCancel}>
          <MaterialCommunityIcons name="close" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Ontario Lease Wizard
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <React.Fragment key={index}>
              <TouchableOpacity
                style={[
                  styles.stepIndicator,
                  {
                    backgroundColor: index + 1 <= currentStep ? primaryColor : borderColor,
                  },
                ]}
                onPress={() => handleStepPress(index + 1)}
              >
                <ThemedText
                  style={[
                    styles.stepNumber,
                    { color: index + 1 <= currentStep ? '#fff' : secondaryTextColor },
                  ]}
                >
                  {index + 1}
                </ThemedText>
              </TouchableOpacity>
              {index < totalSteps - 1 && (
                <View
                  style={[
                    styles.stepConnector,
                    { backgroundColor: index + 1 < currentStep ? primaryColor : borderColor },
                  ]}
                />
              )}
            </React.Fragment>
          ))}
        </View>
        <ThemedText style={[styles.stepTitle, { color: textColor }]}>
          Step {currentStep}: {STEP_TITLES[currentStep - 1]}
        </ThemedText>
      </View>

      {/* Steps Overview */}
      <View style={styles.stepsContainer}>
        {STEP_TITLES.map((title, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.stepCard,
              { backgroundColor: cardBgColor, borderColor },
              index + 1 === currentStep && { borderColor: primaryColor, borderWidth: 2 },
            ]}
            onPress={() => handleStepPress(index + 1)}
          >
            <View
              style={[
                styles.stepIcon,
                {
                  backgroundColor:
                    index + 1 < currentStep
                      ? '#10b981'
                      : index + 1 === currentStep
                      ? primaryColor
                      : borderColor,
                },
              ]}
            >
              {index + 1 < currentStep ? (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
              ) : (
                <ThemedText style={styles.stepIconNumber}>{index + 1}</ThemedText>
              )}
            </View>
            <View style={styles.stepCardContent}>
              <ThemedText style={[styles.stepCardTitle, { color: textColor }]}>
                {title}
              </ThemedText>
              <ThemedText style={[styles.stepCardStatus, { color: secondaryTextColor }]}>
                {index + 1 < currentStep
                  ? 'Completed'
                  : index + 1 === currentStep
                  ? 'In Progress'
                  : 'Pending'}
              </ThemedText>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={secondaryTextColor} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Start/Continue Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: primaryColor }]}
          onPress={() => handleStepPress(currentStep)}
        >
          <ThemedText style={styles.primaryButtonText}>
            {currentStep === 1 ? 'Start Wizard' : 'Continue'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
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
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepConnector: {
    width: 24,
    height: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stepCardContent: {
    flex: 1,
  },
  stepCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepCardStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
