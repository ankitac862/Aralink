import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  ListRenderItem,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import React, { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { fetchTenantNotifications } from '@/lib/supabase';

interface Announcement {
  id: string;
  icon: string;
  title: string;
  description: string;
  date: string;
  type?: string;
  data?: any;
}

interface QuickLink {
  id: string;
  icon: string;
  label: string;
  route: string;
}

export default function TenantDashboardScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [propertyInfo, setPropertyInfo] = useState<any>(null);
  const [rentStatus, setRentStatus] = useState<any>(null);
  const [coTenants, setCoTenants] = useState<any[]>([]);

  const isDark = colorScheme === 'dark';
  const primaryColor = '#4A90E2';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const warningColor = '#F5A623';

  // Load notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadNotifications();
        loadTenantData();
      }
    }, [user])
  );

  const loadTenantData = async () => {
    if (!user?.id) {
      console.log('⚠️ No user ID available');
      return;
    }
    
    try {
      const { supabase } = await import('@/lib/supabase');
      
      console.log('🏠 Loading tenant data for user:', user.id);
      
      // Get tenant profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();
      
      console.log('👤 Profile:', profile);
      if (profileError) console.log('❌ Profile error:', profileError);
      
      // IMPORTANT: tenant_property_links.tenant_id points to tenants.id, NOT user.id
      // So we need to first find the tenant record for this user
      console.log('🔍 Step 1: Finding tenant record for user:', user.id);
      const { data: tenantRecords, error: tenantError } = await supabase
        .from('tenants')
        .select('id, first_name, last_name, email, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      console.log('🔍 Found tenant records:', tenantRecords);
      if (tenantError) console.log('❌ Tenant lookup error:', tenantError);
      
      // Filter to active tenant records only
      const activeTenant = tenantRecords?.find(t => t.status === 'active') || tenantRecords?.[0];
      
      if (!activeTenant) {
        console.log('⚠️ No tenant record found for this user');
        // Try fallback: check if user.id is stored directly in tenant_property_links (old method)
        const { data: directLinks } = await supabase
          .from('tenant_property_links')
          .select('id, tenant_id, status')
          .eq('tenant_id', user.id);
        
        if (directLinks && directLinks.length > 0) {
          console.log('✅ Found direct links (old method), count:', directLinks.length);
        }
      } else {
        console.log('✅ Using tenant record:', activeTenant.id, activeTenant.first_name, activeTenant.last_name);
      }
      
      const tenantIdToUse = activeTenant?.id || user.id;
      
      // Now get tenant property links for this tenant record
      console.log('🔍 Step 2: Finding property links for tenant:', tenantIdToUse);
      let { data: tenantLink, error: linkError } = await supabase
        .from('tenant_property_links')
        .select(`
          *,
          properties (
            id,
            name,
            address1,
            address2,
            city,
            state,
            zip_code,
            property_type
          ),
          units (
            id,
            name
          ),
          sub_units (
            id,
            name
          )
        `)
        .eq('tenant_id', tenantIdToUse)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log('🏠 Active tenant link data:', tenantLink);
      if (linkError) console.log('❌ Tenant link error:', linkError);
      
      // If no active link found, try to get any link (including pending_invite or inactive)
      if (!tenantLink) {
        console.log('⚠️ No active link found, trying to get any status...');
        const { data: anyLink, error: anyLinkError } = await supabase
          .from('tenant_property_links')
          .select(`
            *,
            properties (
              id,
              name,
              property_type,
              address1,
              address2,
              city,
              state,
              zip_code
            ),
            units (
              id,
              name
            ),
            sub_units (
              id,
              name
            )
          `)
          .eq('tenant_id', tenantIdToUse)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        tenantLink = anyLink;
        console.log('🏠 Any status tenant link data:', tenantLink);
        if (anyLinkError) console.log('❌ Any status link error:', anyLinkError);
      }
      
      // Set tenant info regardless of property link
      setTenantInfo({
        name: activeTenant ? `${activeTenant.first_name} ${activeTenant.last_name}` : profile?.full_name || 'Tenant',
        email: activeTenant?.email || profile?.email,
      });
      
      if (tenantLink && tenantLink.properties) {
        const prop = tenantLink.properties as any;
        
        // Build complete address with unit/subunit
        let displayAddress = prop.name || 'Property';
        const addressParts = [
          prop.address1,
          prop.address2,
          prop.city,
          prop.state,
          prop.zip_code
        ].filter(Boolean);
        
        if (addressParts.length > 0) {
          displayAddress = addressParts.join(', ');
        }
        
        // Determine unit name based on property type
        let unitName: string | undefined;
        
        // For multi-unit properties: check unit first, then subunit
        if (prop.property_type === 'multi_unit') {
          unitName = tenantLink.units?.name || tenantLink.sub_units?.name;
        } else {
          // For single_unit, commercial, parking: only check subunit
          unitName = tenantLink.sub_units?.name;
        }
        
        // Add unit/subunit to address if available
        if (unitName) {
          displayAddress = `${displayAddress}, Unit ${unitName}`;
        }
        
        console.log('✅ Setting property info:', {
          propertyId: tenantLink.property_id,
          propertyType: prop.property_type,
          address: displayAddress,
          unitName,
          status: tenantLink.status,
        });
        
        setPropertyInfo({
          propertyId: tenantLink.property_id,
          unitId: tenantLink.unit_id,
          subUnitId: tenantLink.sub_unit_id,
          name: prop.name,
          address: displayAddress,
          unitName,
        });
        
        setRentStatus({
          amount: tenantLink.rent_amount || 0,
          dueDate: 'Monthly',
          status: tenantLink.status === 'active' ? 'due_soon' : 'pending',
        });
        
        // Load co-tenants for this tenant link
        await loadCoTenants(tenantLink.id);
      } else {
        console.log('⚠️ No property link found for tenant record:', tenantIdToUse);
        console.log('⚠️ User auth ID:', user.id);
        console.log('⚠️ Tenant records found:', tenantRecords?.length || 0);
        if (tenantRecords && tenantRecords.length > 1) {
          console.log('⚠️ Multiple tenant records exist - showing only active or most recent');
        }
      }
    } catch (error) {
      console.error('❌ Error loading tenant data:', error);
      Alert.alert('Error', 'Failed to load tenant data. Please try again.');
    }
  };

  const loadCoTenants = async (tenantLinkId: string) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      
      const { data, error } = await supabase
        .from('co_tenants')
        .select('*')
        .eq('tenant_id', tenantLinkId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error loading co-tenants:', error);
        return;
      }
      
      setCoTenants(data || []);
      console.log(`✅ Loaded ${data?.length || 0} co-tenants`);
    } catch (error) {
      console.error('Error fetching co-tenants:', error);
    }
  };

  const loadNotifications = async () => {
    if (!user?.id) return;
    
    console.log('🔔 Loading notifications for user:', user.id);
    const notifications = await fetchTenantNotifications(user.id);
    console.log('🔔 Fetched notifications:', notifications.length);
    
    // Log each notification's data with detailed info
    console.log('\n========== ALL NOTIFICATIONS ==========');
    notifications.forEach((notif: any, index: number) => {
      console.log(`\n📬 Notification ${index + 1}:`);
      console.log('  ID:', notif.id);
      console.log('  Type:', notif.type);
      console.log('  Created:', notif.created_at);
      console.log('  Property ID:', notif.data?.propertyId);
      console.log('  Unit ID:', notif.data?.unitId);
      console.log('  SubUnit ID:', notif.data?.subUnitId);
      console.log('  Full data:', JSON.stringify(notif.data, null, 2));
    });
    console.log('\n========================================\n');
    
    // Convert notifications to announcements format with full data
    const notificationAnnouncements: Announcement[] = notifications.map((notif: any) => ({
      id: notif.id,
      icon: notif.type === 'invite' ? 'email-outline' : 'bell',
      title: notif.title,
      description: notif.message,
      date: new Date(notif.created_at).toLocaleDateString() + ' ' + new Date(notif.created_at).toLocaleTimeString(),
      type: notif.type,
      data: notif.data, // Store the full notification data
    }));

    console.log('🔔 Notification announcements:', notificationAnnouncements.length);

    // Get base announcements
    const baseAnnouncements = [
      {
        id: '1',
        icon: 'pool',
        title: 'Pool Maintenance This Friday',
        description:
          'The community pool will be closed for scheduled maintenance this Friday, June 28th.',
        date: 'June 24, 2024',
      },
      {
        id: '2',
        icon: 'bug',
        title: 'Pest Control Notice',
        description:
          'Quarterly pest control service is scheduled for all units next Monday. Please prepare accordingly.',
        date: 'June 22, 2024',
      },
    ];

    // Merge with static announcements
    setAnnouncements([...notificationAnnouncements, ...baseAnnouncements]);
  };

  const quickLinks: QuickLink[] = [
    { id: '1', icon: 'file-document-multiple', label: 'My Leases', route: '/tenant-leases' },
    { id: '2', icon: 'account-supervisor', label: 'Contact Us', route: '/(tabs)/messages' },
    { id: '3', icon: 'folder-open', label: 'Documents', route: '/(tabs)/documents' },
    { id: '4', icon: 'gavel', label: 'Community Rules', route: '/(tabs)/explore' },
  ];

  const renderAnnouncement: ListRenderItem<Announcement> = ({ item }) => {
    const isInvite = item.type === 'invite';
    const CardComponent = isInvite ? TouchableOpacity : View;
    
    const handleInviteClick = async () => {
      if (!isInvite || !item.data) {
        console.log('⚠️ Not an invite or no data:', { isInvite, hasData: !!item.data });
        return;
      }
      
      const notifData = item.data as any;
      console.log('📨 CLICKED NOTIFICATION:');
      console.log('  - Notification ID:', item.id);
      console.log('  - Notification Date:', item.date);
      console.log('  - Full data:', JSON.stringify(notifData, null, 2));
      
      // Extract property/unit/subunit IDs and address from notification
      const propertyId = notifData.propertyId;
      const propertyAddress = notifData.propertyAddress;
      const unitId = notifData.unitId;
      const subUnitId = notifData.subUnitId;
      const inviteId = notifData.inviteId; // Get actual invite ID from notification data
      
      console.log('  - Extracted IDs:', { propertyId, unitId, subUnitId, inviteId });
      console.log('  - Property Address from notification:', propertyAddress);
      
      if (!propertyId) {
        console.error('❌ Missing propertyId in notification data');
        Alert.alert('Error', 'This invite is missing property information.');
        return;
      }
      
      // Use address from notification if available, otherwise try to fetch
      let fullAddress = propertyAddress;
      
      if (!fullAddress) {
        console.log('⚠️ No address in notification, attempting to fetch property...');
        const { fetchPropertyById } = await import('@/lib/supabase');
        const property = await fetchPropertyById(propertyId);
        
        if (!property) {
          console.error('❌ Property not found:', propertyId);
          Alert.alert(
            'Property Not Available',
            'The property information for this invite could not be loaded. Please contact your landlord.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        fullAddress = [
          property.address1,
          property.address2,
          property.city,
          property.state,
          property.zip_code
        ].filter(Boolean).join(', ');
      }
      
      console.log('✅ Using address:', fullAddress);
      
      // Navigate to tenant-lease-start with all the data
      router.push({
        pathname: '/tenant-lease-start',
        params: {
          propertyId,
          address: fullAddress,
          unitId: unitId || '',
          subUnitId: subUnitId || '',
          inviteId: inviteId || '', // Use actual invite ID from notification data
          fromInvite: 'true',
        },
      });
      
      // Mark notification as read
      const { markNotificationAsRead } = await import('@/lib/supabase');
      await markNotificationAsRead(item.id);
    };
    
    return (
      <CardComponent
        style={[
          styles.announcementCard,
          {
            backgroundColor: cardBgColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 4,
          },
        ]}
        onPress={isInvite ? handleInviteClick : undefined}>
        <View
          style={[
            styles.announcementIconContainer,
            { backgroundColor: `${primaryColor}33` },
          ]}>
          <MaterialCommunityIcons name={item.icon as any} size={24} color={primaryColor} />
        </View>
        <View style={styles.announcementContent}>
          <ThemedText style={[styles.announcementTitle, { color: textPrimaryColor }]}>
            {item.title}
          </ThemedText>
          <ThemedText
            style={[styles.announcementDescription, { color: textSecondaryColor }]}>
            {item.description}
          </ThemedText>
          {isInvite && item.data?.propertyId && (
            <ThemedText
              style={[styles.announcementDate, { color: primaryColor, fontSize: 10, marginTop: 4 }]}>
              Property ID: {item.data.propertyId.substring(0, 8)}...
            </ThemedText>
          )}
          <ThemedText
            style={[styles.announcementDate, { color: textSecondaryColor, opacity: 0.7 }]}>
            {item.date}
          </ThemedText>
        </View>
        {isInvite && (
          <MaterialCommunityIcons name="chevron-right" size={20} color={textSecondaryColor} />
        )}
      </CardComponent>
    );
  };

  const renderQuickLink: ListRenderItem<QuickLink> = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.quickLinkCard,
        { backgroundColor: `${primaryColor}20` },
      ]}
      onPress={() => router.push(item.route as any)}>
      <View style={[styles.quickLinkIconContainer, { backgroundColor: `${primaryColor}40` }]}>
        <MaterialCommunityIcons name={item.icon as any} size={24} color={primaryColor} />
      </View>
      <ThemedText style={[styles.quickLinkLabel, { color: textPrimaryColor }]}>
        {item.label}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: bgColor,
            paddingTop: insets.top + 8,
            paddingBottom: 12,
          },
        ]}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => router.push('/profile')}>
            <View style={styles.profilePicture}>
              <MaterialCommunityIcons name="account" size={24} color={primaryColor} />
            </View>
            <View>
              <ThemedText style={[styles.greeting, { color: textPrimaryColor }]}>
                Hello, {tenantInfo?.name?.split(' ')[0] || 'Tenant'}
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Property Card */}
        <TouchableOpacity
          style={[
            styles.propertyCard,
            {
              backgroundColor: cardBgColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.2 : 0.05,
              shadowRadius: 4,
            },
          ]}
          onPress={() => router.push('/profile')}>
          <View
            style={[
              styles.propertyImagePlaceholder,
              { backgroundColor: `${primaryColor}30` },
            ]}>
            <MaterialCommunityIcons name="home" size={48} color={primaryColor} />
          </View>
          <View style={styles.propertyInfo}>
            <ThemedText style={[styles.propertyLabel, { color: textSecondaryColor }]}>
              YOUR HOME
            </ThemedText>
            <ThemedText style={[styles.propertyAddress, { color: textPrimaryColor }]}>
              {propertyInfo?.address || 'No property assigned'}
            </ThemedText>
            {propertyInfo?.unitName && (
              <ThemedText style={[styles.propertyCity, { color: textSecondaryColor }]}>
                Unit: {propertyInfo.unitName}
              </ThemedText>
            )}
          </View>
        </TouchableOpacity>

        {/* Co-Tenants Card */}
        {coTenants.length > 0 && (
          <View
            style={[
              styles.coTenantsCard,
              {
                backgroundColor: cardBgColor,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.2 : 0.05,
                shadowRadius: 4,
              },
            ]}>
            <View style={styles.coTenantsHeader}>
              <MaterialCommunityIcons name="account-group" size={20} color={primaryColor} />
              <ThemedText style={[styles.coTenantsTitle, { color: textPrimaryColor }]}>
                Co-Tenants ({coTenants.length})
              </ThemedText>
            </View>
            <ThemedText style={[styles.coTenantsSubtitle, { color: textSecondaryColor }]}>
              People living with you at this property
            </ThemedText>
            {coTenants.map((coTenant, index) => (
              <View key={coTenant.id} style={[styles.coTenantItem, { borderTopColor: isDark ? '#374151' : '#e5e7eb' }]}>
                <View style={[styles.coTenantAvatar, { backgroundColor: `${primaryColor}20` }]}>
                  <ThemedText style={[styles.coTenantAvatarText, { color: primaryColor }]}>
                    {coTenant.full_name?.charAt(0).toUpperCase() || '?'}
                  </ThemedText>
                </View>
                <View style={styles.coTenantInfo}>
                  <ThemedText style={[styles.coTenantName, { color: textPrimaryColor }]}>
                    {coTenant.full_name}
                  </ThemedText>
                  {coTenant.email && (
                    <ThemedText style={[styles.coTenantContact, { color: textSecondaryColor }]}>
                      {coTenant.email}
                    </ThemedText>
                  )}
                  {coTenant.phone && (
                    <ThemedText style={[styles.coTenantContact, { color: textSecondaryColor }]}>
                      {coTenant.phone}
                    </ThemedText>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Rent Status Card */}
        <View
          style={[
            styles.rentStatusCard,
            {
              backgroundColor: cardBgColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.2 : 0.05,
              shadowRadius: 4,
            },
          ]}>
          <View style={styles.rentStatusHeader}>
            <ThemedText style={[styles.rentStatusLabel, { color: textSecondaryColor }]}>
              RENT STATUS
            </ThemedText>
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: warningColor }]} />
              <ThemedText style={[styles.statusText, { color: textPrimaryColor }]}>
                Rent is Due Soon
              </ThemedText>
            </View>
          </View>
          <View style={styles.rentStatusContent}>
            <ThemedText style={[styles.rentAmount, { color: textSecondaryColor }]}>
              ${rentStatus?.amount?.toFixed(2) || '0.00'} {rentStatus?.dueDate || 'Monthly'}
            </ThemedText>
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: primaryColor }]}
              onPress={() => router.push('/dashboard')}>
              <ThemedText style={styles.payButtonText}>Pay Now</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Start Application Button */}
        <TouchableOpacity
          style={[styles.maintenanceButton, { backgroundColor: primaryColor, marginBottom: 12 }]}
          onPress={() => router.push('/tenant-lease-start')}>
          <View style={styles.maintenanceButtonIcon}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color="#fff" />
          </View>
          <ThemedText style={styles.maintenanceButtonText}>Start Application</ThemedText>
        </TouchableOpacity>

        {/* Generate Lease Button - Show only if tenant has property assigned */}
        {propertyInfo && (
          <TouchableOpacity
            style={[styles.maintenanceButton, { backgroundColor: '#10b981', marginBottom: 12 }]}
            onPress={() => {
              if (!propertyInfo) {
                Alert.alert('No Property', 'You need to be assigned to a property first.');
                return;
              }
              
              // Navigate to lease wizard with tenant's property details
              router.push({
                pathname: '/lease-wizard',
                params: {
                  propertyId: propertyInfo.propertyId,
                  unitId: propertyInfo.unitId,
                  roomId: propertyInfo.subUnitId,
                  tenantId: user?.id,
                  tenantName: tenantInfo?.name,
                },
              });
            }}>
            <View style={styles.maintenanceButtonIcon}>
              <MaterialCommunityIcons name="file-sign" size={20} color="#fff" />
            </View>
            <ThemedText style={styles.maintenanceButtonText}>Generate Lease Agreement</ThemedText>
          </TouchableOpacity>
        )}

        {/* Maintenance Request Button */}
        <TouchableOpacity
          style={[styles.maintenanceButton, { backgroundColor: primaryColor }]}
          onPress={() => router.push('/tenant-maintenance-request')}>
          <View style={styles.maintenanceButtonIcon}>
            <MaterialCommunityIcons name="wrench" size={20} color="#fff" />
          </View>
          <ThemedText style={styles.maintenanceButtonText}>Submit Maintenance Request</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.maintenanceButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: primaryColor }]}
          onPress={() => router.push('/tenant-maintenance-status')}>
          <View style={[styles.maintenanceButtonIcon, { backgroundColor: primaryColor + '20' }]}>
            <MaterialCommunityIcons name="clipboard-text" size={20} color={primaryColor} />
          </View>
          <ThemedText style={[styles.maintenanceButtonText, { color: primaryColor }]}>View My Requests</ThemedText>
        </TouchableOpacity>

        {/* Quick Links */}
        <View>
          <FlatList
            data={quickLinks}
            keyExtractor={(item) => item.id}
            renderItem={renderQuickLink}
            numColumns={4}
            scrollEnabled={false}
            columnWrapperStyle={styles.quickLinksRow}
          />
        </View>

        {/* Announcements Section */}
        <View style={styles.announcementsSection}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>
            Announcements
          </ThemedText>
          <FlatList
            data={announcements}
            keyExtractor={(item) => item.id}
            renderItem={renderAnnouncement}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
  },
  notificationBadge: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  propertyCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
  },
  propertyImagePlaceholder: {
    width: 120,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyInfo: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  propertyLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  propertyCity: {
    fontSize: 14,
    fontWeight: '400',
  },
  rentStatusCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  rentStatusHeader: {
    marginBottom: 12,
  },
  rentStatusLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  rentStatusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentAmount: {
    fontSize: 14,
    fontWeight: '400',
  },
  payButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  maintenanceButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  maintenanceButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maintenanceButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickLinksRow: {
    gap: 12,
    marginBottom: 24,
  },
  quickLinkCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
  quickLinkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  announcementsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  announcementCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    elevation: 3,
  },
  announcementIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementContent: {
    flex: 1,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  announcementDescription: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 4,
    lineHeight: 16,
  },
  announcementDate: {
    fontSize: 10,
    fontWeight: '400',
  },
  coTenantsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  coTenantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  coTenantsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  coTenantsSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  coTenantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  coTenantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coTenantAvatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  coTenantInfo: {
    flex: 1,
  },
  coTenantName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  coTenantContact: {
    fontSize: 12,
    marginBottom: 1,
  },
});
