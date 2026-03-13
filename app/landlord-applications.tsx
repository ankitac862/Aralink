import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { useTenantStore } from '@/store/tenantStore';
import { fetchLandlordApplications, supabase, convertApplicantToTenant } from '@/lib/supabase';

interface Application {
  id: string;
  applicant_name: string;
  applicant_email: string;
  property_address: string;
  status: string;
  submitted_at: string;
  created_at: string;
  property_id?: string;
}

export default function LandlordApplicationsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { loadFromSupabase: loadTenants } = useTenantStore();
  
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [applicationLeases, setApplicationLeases] = useState<Record<string, boolean>>({});
  const [convertingApplicationId, setConvertingApplicationId] = useState<string | null>(null);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';

  // Load applications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadApplications();
      }
    }, [user?.id])
  );

  const loadApplications = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      console.log('📋 Loading applications for landlord:', user.id);
      const data = await fetchLandlordApplications(user.id);
      console.log('📋 Loaded applications:', data.length);
      setApplications(data);
      
      // Check which applications have leases (with timeout to prevent hanging)
      if (data.length > 0) {
        await Promise.race([
          checkForLeases(data),
          new Promise((resolve) => setTimeout(resolve, 5000)) // 5 second timeout
        ]);
      }
    } catch (error) {
      console.error('❌ Error loading applications:', error);
      Alert.alert('Error', 'Failed to load applications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkForLeases = async (apps: Application[]) => {
    try {
      const leaseMap: Record<string, boolean> = {};
      
      for (const app of apps) {
        try {
          // Check if a lease exists for this application (may be multiple)
          const { data, error } = await supabase
            .from('leases')
            .select('id')
            .eq('application_id', app.id)
            .limit(1);
          
          if (error) {
            console.error('Error checking lease for application:', app.id, error);
            leaseMap[app.id] = false; // Default to false on error
          } else {
            leaseMap[app.id] = !!(data && data.length > 0);
          }
        } catch (err) {
          console.error('Exception checking lease for application:', app.id, err);
          leaseMap[app.id] = false;
        }
      }
      
      console.log('📋 Lease status map:', leaseMap);
      setApplicationLeases(leaseMap);
    } catch (error) {
      console.error('❌ Error in checkForLeases:', error);
      // Set empty map on failure so UI doesn't break
      setApplicationLeases({});
    }
  };

  const handleConvertToTenant = async (application: Application) => {
    if (!application.property_id) {
      Alert.alert('Error', 'Property information is missing for this application.');
      return;
    }

    // First check if a lease exists for this application
    console.log('🔍 Checking for leases with application_id:', application.id);
    const { data: leaseData, error: leaseError } = await supabase
      .from('leases')
      .select('id, unit_id, effective_date, form_data, status')
      .eq('application_id', application.id)
      .order('created_at', { ascending: false });

    console.log('📋 Lease check result:', { 
      found: leaseData?.length || 0, 
      error: leaseError,
      leases: leaseData 
    });

    if (leaseError) {
      console.error('❌ Error checking for leases:', leaseError);
      Alert.alert('Error', `Failed to check for leases: ${leaseError.message}`);
      return;
    }

    if (!leaseData || leaseData.length === 0) {
      Alert.alert(
        'No Lease Found',
        'A lease must be generated before converting to tenant. Would you like to generate a lease now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Generate Lease',
            onPress: () => {
              router.push({
                pathname: '/lease-wizard',
                params: { 
                  applicationId: application.id,
                  propertyId: application.property_id,
                  tenantName: application.applicant_name,
                }
              });
            },
          },
        ]
      );
      return;
    }

    // If multiple leases exist, warn the user
    if (leaseData.length > 1) {
      console.warn('⚠️ Multiple leases found for application:', application.id, 'Count:', leaseData.length);
      Alert.alert(
        'Multiple Leases Found',
        `Found ${leaseData.length} leases for this application. Using the most recent one. You may want to review and delete duplicate leases.`,
        [{ text: 'OK' }]
      );
    }

    const lease = leaseData[0];
    const rentAmount = lease.form_data?.monthlyRent || lease.form_data?.rent || 0;

    Alert.alert(
      'Convert to Tenant',
      `Convert ${application.applicant_name} to a tenant?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Convert',
          onPress: async () => {
            // Prevent double conversion
            if (convertingApplicationId === application.id) {
              Alert.alert('Please Wait', 'Conversion already in progress...');
              return;
            }
            
            setConvertingApplicationId(application.id);
            
            try {
              console.log('🔄 Converting applicant to tenant:', application.id);
              
              // Call the conversion function with lease details
              const result = await convertApplicantToTenant({
                applicationId: application.id,
                propertyId: application.property_id!,
                unitId: lease.unit_id,
                leaseId: lease.id,
                startDate: lease.effective_date,
                rentAmount: rentAmount,
              });

              console.log('✅ Conversion successful');
              // Refresh both applications and tenants lists
              await loadApplications();
              if (user?.id) {
                await loadTenants(user.id);
              }
              Alert.alert(
                'Success',
                `${application.applicant_name} has been converted to a tenant and is now visible in the Tenants list.`
              );
            } catch (error) {
              console.error('❌ Error converting applicant:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert(
                'Conversion Failed',
                errorMessage
              );
            } finally {
              setConvertingApplicationId(null);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return '#FF9500';
      case 'under_review':
        return '#007AFF';
      case 'approved':
        return '#34C759';
      case 'lease_ready':
        return '#5856D6';
      case 'lease_signed':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      default:
        return textSecondaryColor;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderApplication = ({ item }: { item: Application }) => (
    <TouchableOpacity
      style={[styles.applicationCard, { backgroundColor: cardBgColor, borderColor }]}
      onPress={() => router.push(`/landlord-application-review?id=${item.id}`)}>
      <View style={styles.applicationHeader}>
        <View style={styles.applicationInfo}>
          <ThemedText style={[styles.applicationName, { color: textPrimaryColor }]}>
            {item.applicant_name}
          </ThemedText>
          <ThemedText style={[styles.applicationEmail, { color: textSecondaryColor, fontSize: 12 }]}>
            {item.applicant_email}
          </ThemedText>
          <ThemedText style={[styles.applicationProperty, { color: textSecondaryColor }]}>
            {item.property_address || 'Property Address'}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <ThemedText style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace('_', ' ').toUpperCase()}
          </ThemedText>
        </View>
      </View>
      <View style={styles.applicationFooter}>
        <ThemedText style={[styles.applicationDate, { color: textSecondaryColor }]}>
          Submitted: {formatDate(item.submitted_at)}
        </ThemedText>
        <MaterialCommunityIcons name="chevron-right" size={20} color={textSecondaryColor} />
      </View>
      
      {/* Action buttons for approved applications */}
      {item.status === 'approved' && (
        <View style={styles.actionButtonsContainer}>
          {/* Generate Lease button - only show if no lease exists */}
          {!applicationLeases[item.id] && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: primaryColor, flex: 1 }]}
              onPress={(e) => {
                e.stopPropagation();
                router.push({
                  pathname: '/lease-wizard',
                  params: { 
                    applicationId: item.id,
                    propertyId: item.property_id,
                    tenantName: item.applicant_name,
                  }
                });
              }}>
              <MaterialCommunityIcons name="file-document-edit" size={16} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Generate Lease</ThemedText>
            </TouchableOpacity>
          )}
          
          {/* Lease exists message */}
          {applicationLeases[item.id] && (
            <View style={[styles.leaseExistsContainer, { backgroundColor: `${primaryColor}15`, borderColor: primaryColor, flex: 1 }]}>
              <MaterialCommunityIcons name="file-document-check" size={16} color={primaryColor} />
              <ThemedText style={[styles.leaseExistsText, { color: primaryColor }]}>
                Lease Generated
              </ThemedText>
            </View>
          )}
          
          {/* Convert to Tenant button */}
          <TouchableOpacity
            style={[
              styles.actionButton, 
              { 
                backgroundColor: convertingApplicationId === item.id ? '#9ca3af' : '#10b981', 
                flex: 1, 
                marginLeft: 8,
                opacity: convertingApplicationId === item.id ? 0.6 : 1
              }
            ]}
            disabled={convertingApplicationId === item.id}
            onPress={(e) => {
              e.stopPropagation();
              if (convertingApplicationId === null) {
                handleConvertToTenant(item);
              }
            }}>
            <MaterialCommunityIcons 
              name={convertingApplicationId === item.id ? "loading" : "account-convert"} 
              size={16} 
              color="#fff" 
            />
            <ThemedText style={styles.actionButtonText}>
              {convertingApplicationId === item.id ? 'Converting...' : 'Convert to Tenant'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Applications</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <ThemedText style={[styles.emptyText, { color: textSecondaryColor, marginTop: 16 }]}>
            Loading applications...
          </ThemedText>
        </View>
      ) : applications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color={textSecondaryColor} />
          <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>No applications yet</ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: textSecondaryColor }]}>
            Invite applicants to start receiving applications
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={renderApplication}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* FAB Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primaryColor, bottom: insets.bottom + 16 }]}
        onPress={() => router.push('/add-applicant')}>
        <MaterialCommunityIcons name="email-plus" size={24} color="#fff" />
      </TouchableOpacity>
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  applicationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  applicationInfo: {
    flex: 1,
  },
  applicationName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  applicationProperty: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  applicationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  applicationDate: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  applicationEmail: {
    fontSize: 12,
    marginBottom: 4,
  },
  addTenantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  addTenantButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  leaseExistsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
    borderWidth: 1,
  },
  leaseExistsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

