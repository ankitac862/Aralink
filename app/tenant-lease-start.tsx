import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';
import { useAuthStore } from '@/store/authStore';
import { fetchPendingInvites } from '@/lib/supabase';

export default function TenantLeaseStartScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId, address, fromInvite, unitId, subUnitId, inviteId: inviteIdParam } = useLocalSearchParams<{ 
    propertyId?: string; 
    address?: string;
    fromInvite?: string;
    unitId?: string;
    subUnitId?: string;
    inviteId?: string;
  }>();
  const { tenantApplication, getTenantStatus } = useLeaseStore();
  const { user } = useAuthStore();

  console.log('🏠 TenantLeaseStart - Params received:', {
    propertyId,
    address,
    fromInvite,
    unitId,
    subUnitId,
    inviteId: inviteIdParam,
  });

  const [propertyAddress, setPropertyAddress] = useState<string>(address || '');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(propertyId);
  const [unitInfo, setUnitInfo] = useState<{ unitId?: string; unitName?: string; subUnitId?: string; subUnitName?: string } | null>(
    unitId || subUnitId ? { unitId, subUnitId } : null
  );
  const [inviteId, setInviteId] = useState<string | undefined>(inviteIdParam);
  const [isFromInvite, setIsFromInvite] = useState(fromInvite === 'true');
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [hasCheckedInvites, setHasCheckedInvites] = useState(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';

  // Check for pending invites if not coming from invite link
  useEffect(() => {
    const checkPendingInvites = async () => {
      if (isFromInvite || !user?.id || hasCheckedInvites) return;
      
      console.log('🔍 Checking for pending invites for user:', user.id);
      setIsLoadingInvites(true);
      const invites = await fetchPendingInvites(user.id);
      
      console.log('📨 Fetched invites:', invites);
      
      if (invites && invites.length > 0) {
        const invite = invites[0] as any; // Get the most recent invite
        const property = invite?.property;
        const inviteData = invite?.inviteData || invite?.notificationData; // Support both formats
        
        console.log('📨 Processing invite:', {
          inviteId: invite?.id,
          propertyId: property?.id,
          unitId: invite?.unit?.id,
          subUnitId: invite?.subUnit?.id,
          inviteData,
        });
        
        if (property) {
          const fullAddress = [
            property.address1,
            property.address2,
            property.city,
            property.state,
            property.zip_code
          ].filter(Boolean).join(', ');
          
          const extractedUnitInfo = {
            unitId: invite?.unit?.id || inviteData?.unitId,
            unitName: invite?.unit?.name,
            subUnitId: invite?.subUnit?.id || inviteData?.subUnitId,
            subUnitName: invite?.subUnit?.name,
          };
          
          console.log('✅ Setting unit info:', extractedUnitInfo);
          
          setSelectedPropertyId(property.id);
          setPropertyAddress(fullAddress);
          setInviteId(invite?.id);
          setUnitInfo(extractedUnitInfo);
          setIsFromInvite(true);
        }
      } else {
        console.log('⚠️ No pending invites found');
      }
      
      setHasCheckedInvites(true);
      setIsLoadingInvites(false);
    };

    checkPendingInvites();
  }, [user, isFromInvite, hasCheckedInvites]);

  const status = getTenantStatus();
  const hasApplication = !!tenantApplication;

  const handleStartApplication = () => {
    if (!propertyAddress.trim()) {
      return; // Don't proceed without address
    }
    
    console.log('🚀 Starting application from tenant-lease-start');
    console.log('📋 Current state:', {
      selectedPropertyId,
      propertyAddress,
      unitInfo,
      inviteId,
      isFromInvite,
    });
    
    const navigationParams = { 
      propertyId: selectedPropertyId || '',
      address: propertyAddress,
      unitId: unitInfo?.unitId || '',
      unitName: unitInfo?.unitName || '',
      subUnitId: unitInfo?.subUnitId || '',
      subUnitName: unitInfo?.subUnitName || '',
      inviteId: inviteId || '',
      fromInvite: isFromInvite ? 'true' : 'false'
    };
    
    console.log('📋 Navigation params being passed to step 1:', navigationParams);
    
    router.push({
      pathname: '/tenant-lease-step1',
      params: navigationParams
    });
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Rental Application</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color={primaryColor} />
          <ThemedText style={[styles.title, { color: textPrimaryColor }]}>Start Your Application</ThemedText>
          <ThemedText style={[styles.description, { color: textSecondaryColor }]}>
            Complete your lease application in a few simple steps. We'll guide you through the process.
          </ThemedText>

          {isLoadingInvites ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={primaryColor} />
              <ThemedText style={[styles.loadingText, { color: textSecondaryColor }]}>
                Checking for property invites...
              </ThemedText>
            </View>
          ) : (
            <>
              {isFromInvite && propertyAddress && (
                <>
                  <View style={[styles.addressBox, { backgroundColor: isDark ? '#1a242d' : '#f3f4f6', borderColor }]}>
                    <MaterialCommunityIcons name="map-marker" size={20} color={primaryColor} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <ThemedText style={[styles.addressLabel, { color: textSecondaryColor }]}>Property Address</ThemedText>
                      <ThemedText style={[styles.addressText, { color: textPrimaryColor }]}>{propertyAddress}</ThemedText>
                    </View>
                  </View>

                  {unitInfo?.unitName && (
                    <View style={[styles.addressBox, { backgroundColor: isDark ? '#1a242d' : '#f3f4f6', borderColor, marginTop: 12 }]}>
                      <MaterialCommunityIcons name="office-building" size={20} color={primaryColor} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <ThemedText style={[styles.addressLabel, { color: textSecondaryColor }]}>Unit</ThemedText>
                        <ThemedText style={[styles.addressText, { color: textPrimaryColor }]}>{unitInfo.unitName}</ThemedText>
                      </View>
                    </View>
                  )}

                  {unitInfo?.subUnitName && (
                    <View style={[styles.addressBox, { backgroundColor: isDark ? '#1a242d' : '#f3f4f6', borderColor, marginTop: 12 }]}>
                      <MaterialCommunityIcons name="door" size={20} color={primaryColor} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <ThemedText style={[styles.addressLabel, { color: textSecondaryColor }]}>Room</ThemedText>
                        <ThemedText style={[styles.addressText, { color: textPrimaryColor }]}>{unitInfo.subUnitName}</ThemedText>
                      </View>
                    </View>
                  )}
                </>
              )}

              {!isFromInvite && (
                <View style={[styles.inputContainer, { borderColor }]}>
                  <ThemedText style={[styles.inputLabel, { color: textSecondaryColor }]}>Property Address *</ThemedText>
                  <TextInput
                    style={[styles.input, { color: textPrimaryColor, backgroundColor: isDark ? '#1a242d' : '#f9fafb', borderColor }]}
                    placeholder="Enter the property address"
                    placeholderTextColor={textSecondaryColor}
                    value={propertyAddress}
                    onChangeText={setPropertyAddress}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}
            </>
          )}

          {hasApplication && status ? (
            <View style={styles.statusContainer}>
              <ThemedText style={[styles.statusLabel, { color: textSecondaryColor }]}>Current Status:</ThemedText>
              <ThemedText style={[styles.statusValue, { color: primaryColor }]}>
                {status.replace('_', ' ').toUpperCase()}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.buttonContainer}>
          {hasApplication ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryColor }]}
              onPress={() => router.push('/tenant-lease-status')}>
              <ThemedText style={styles.buttonText}>View Application Status</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryColor }]}
              onPress={handleStartApplication}>
              <ThemedText style={styles.buttonText}>Start Application</ThemedText>
            </TouchableOpacity>
          )}
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
    paddingBottom: 16,
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
  },
  card: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  statusContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  addressBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 8,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  inputContainer: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 50,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

