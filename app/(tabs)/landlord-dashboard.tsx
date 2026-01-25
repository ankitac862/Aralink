import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  FlatList,
  ListRenderItem,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';

import RentChart from '@/components/RentChart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore } from '@/store/propertyStore';
import { getUserProfile, supabase, fetchLandlordNotifications } from '@/lib/supabase';

interface PortfolioOverview {
  activeLeases: number;
  occupancyRate: number;
}

interface RentCollection {
  collected: number;
  pending: number;
  notPaid: number;
  total: number;
  month: string;
  year: number;
}

interface Activity {
  id: string;
  icon: string;
  title: string;
  description: string;
  time: string;
  type: 'payment' | 'maintenance' | 'message' | 'application';
}

interface DashboardTile {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  created_at: string;
  is_read?: boolean;
}

export default function LandlordDashboardScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { properties, loadFromSupabase } = usePropertyStore();
  
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState({
    propertyCount: 0,
    tenantCount: 0,
    leaseCount: 0,
    occupancyRate: 0,
    maintenanceCount: 0,
    applicantCount: 0,
  });
  const [rentCollection, setRentCollection] = useState<RentCollection>({
    collected: 0,
    pending: 0,
    notPaid: 0,
    total: 0,
    month: new Date().toLocaleDateString('en-US', { month: 'long' }),
    year: new Date().getFullYear(),
  });

  const isDark = colorScheme === 'dark';
  const primaryColor = '#4A90E2';
  const bgColor = isDark ? '#101c22' : '#F2F2F7';
  const cardBgColor = isDark ? '#1A2831' : '#ffffff';
  const textPrimaryColor = isDark ? '#F2F2F7' : '#101c22';
  const textSecondaryColor = isDark ? '#a0aec0' : '#8E8E93';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';

  // Load data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        loadDashboardData();
      }
    }, [user?.id])
  );

  const loadDashboardData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Load profile for name
      const profile = await getUserProfile(user.id);
      if (profile?.full_name) {
        setUserName(profile.full_name.split(' ')[0]); // Get first name
      }

      // Load properties
      await loadFromSupabase(user.id);

      // Get property count
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);
      const propertyCount = propertiesData?.length || 0;

      // Get tenant count from tenant_property_links (active tenants)
      const { data: tenantsData, error: tenantError } = await supabase
        .from('tenant_property_links')
        .select('tenant_id', { count: 'exact' })
        .eq('landlord_id', user.id)
        .eq('status', 'active');
      
      const tenantCount = tenantsData?.length || 0;
      console.log('👥 Tenant count:', tenantCount, 'Error:', tenantError);
      if (tenantsData && tenantsData.length > 0) {
        console.log('👥 Tenant IDs:', tenantsData.map(t => t.tenant_id));
      }

      // Get lease count (active leases)
      const { data: leasesData } = await supabase
        .from('leases')
        .select('id', { count: 'exact' })
        .eq('landlord_id', user.id)
        .eq('status', 'active');
      const leaseCount = leasesData?.length || 0;

      // Get maintenance requests count (open/pending)
      const { data: maintenanceData } = await supabase
        .from('maintenance_requests')
        .select('id', { count: 'exact' })
        .eq('landlord_id', user.id)
        .in('status', ['pending', 'in_progress']);
      const maintenanceCount = maintenanceData?.length || 0;

      // Get applicant count (invited/applied status only, exclude converted to tenant)
      const { data: applicantsData } = await supabase
        .from('applicants')
        .select('id', { count: 'exact' })
        .eq('landlord_id', user.id)
        .in('status', ['invited', 'applied']);
      const applicantCount = applicantsData?.length || 0;

      console.log('📊 Applicant count:', applicantCount, 'from data:', applicantsData);

      // Calculate occupancy rate
      let occupancyRate = 0;
      if (propertyCount > 0 && tenantCount > 0) {
        occupancyRate = Math.round((tenantCount / propertyCount) * 100);
      }

      // Calculate rent collection dynamically
      const { data: rentData } = await supabase
        .from('tenant_property_links')
        .select('rent_amount')
        .eq('landlord_id', user.id)
        .eq('status', 'active');
      
      const totalExpectedRent = rentData?.reduce((sum, link) => sum + (link.rent_amount || 0), 0) || 0;
      
      // For now, assume 90% collected (you can add actual payment tracking later)
      const collectedRent = Math.round(totalExpectedRent * 0.9);
      const pendingRent = totalExpectedRent - collectedRent;

      setStats({
        propertyCount,
        tenantCount,
        leaseCount,
        occupancyRate,
        maintenanceCount,
        applicantCount,
      });

      setRentCollection({
        collected: collectedRent,
        pending: pendingRent,
        notPaid: 0,
        total: totalExpectedRent,
        month: new Date().toLocaleDateString('en-US', { month: 'long' }),
        year: new Date().getFullYear(),
      });

      // Load notifications
      const notifs = await fetchLandlordNotifications(user.id);
      setNotifications(notifs.filter(n => n.type === 'application').slice(0, 3)); // Show only application notifications

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh dashboard when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadDashboardData();
      }
    }, [user?.id])
  );

  const activities: Activity[] = [
    {
      id: '1',
      icon: 'cash-multiple',
      title: 'Rent paid for Unit 5B',
      description: 'John Smith - $1,500',
      time: '1h ago',
      type: 'payment',
    },
    {
      id: '2',
      icon: 'toolbox',
      title: 'New maintenance request',
      description: 'Unit 3A - Leaky Faucet',
      time: '3h ago',
      type: 'maintenance',
    },
  ];

  const dashboardTiles: DashboardTile[] = [
    { 
      id: '1', 
      title: 'My Properties', 
      subtitle: `${stats.propertyCount} ${stats.propertyCount === 1 ? 'property' : 'properties'}`, 
      icon: 'office-building', 
      route: '/properties' 
    },
    { 
      id: '2', 
      title: 'My Tenants', 
      subtitle: `${stats.tenantCount} active`, 
      icon: 'account-group', 
      route: '/tenants' 
    },
    { 
      id: '3', 
      title: 'Leases', 
      subtitle: `${stats.leaseCount} active`, 
      icon: 'gavel', 
      route: '/leases' 
    },
    { 
      id: '4', 
      title: 'Accounting', 
      subtitle: 'Review finances', 
      icon: 'file-document-outline', 
      route: '/accounting' 
    },
    { 
      id: '5', 
      title: 'Maintenance', 
      subtitle: `${stats.maintenanceCount} open ${stats.maintenanceCount === 1 ? 'request' : 'requests'}`, 
      icon: 'toolbox', 
      route: '/landlord-maintenance-overview' 
    },
    { 
      id: '6', 
      title: 'New Applicants', 
      subtitle: `${stats.applicantCount} new`, 
      icon: 'file-document', 
      route: '/landlord-applications' 
    },
  ];

  const handleAddProperty = () => {
    setShowAddMenu(false);
    router.push('/add-property');
  };

  const handleAddTenant = () => {
    setShowAddMenu(false);
    router.push('/add-tenant');
  };

  const handleInviteApplicant = () => {
    setShowAddMenu(false);
    router.push('/add-applicant');
  };

  const renderTile: ListRenderItem<DashboardTile> = ({ item }) => {
    const handleNavigation = () => {
      console.log('Navigating to:', item.route);
      // Use href format for Expo Router
      const href = item.route as Href;
      router.push(href);
    };

    return (
      <TouchableOpacity
        style={[styles.dashboardTile, { backgroundColor: cardBgColor }]}
        onPress={handleNavigation}>
        <MaterialCommunityIcons name={item.icon as any} size={24} color={primaryColor} />
        <ThemedText style={[styles.tileName, { color: textPrimaryColor }]}>{item.title}</ThemedText>
        <ThemedText style={[styles.tileSubtitle, { color: textSecondaryColor }]}>{item.subtitle}</ThemedText>
      </TouchableOpacity>
    );
  };

  const renderActivity: ListRenderItem<Activity> = ({ item }) => {
    const iconBgColor = item.type === 'payment' 
      ? (isDark ? '#065f46' : '#d1fae5') 
      : item.type === 'maintenance' 
      ? (isDark ? '#78350f' : '#fef3c7') 
      : `${primaryColor}20`;
    const iconColor = item.type === 'payment' 
      ? (isDark ? '#10b981' : '#059669') 
      : item.type === 'maintenance' 
      ? (isDark ? '#f59e0b' : '#d97706') 
      : primaryColor;
    
    return (
      <View style={[styles.activityItem, { backgroundColor: cardBgColor }]}>
        <View style={[styles.activityIconContainer, { backgroundColor: iconBgColor }]}>
          <MaterialCommunityIcons name={item.icon as any} size={24} color={iconColor} />
        </View>
        <View style={styles.activityContent}>
          <ThemedText style={[styles.activityTitle, { color: textPrimaryColor }]}>{item.title}</ThemedText>
          <ThemedText style={[styles.activityDescription, { color: textSecondaryColor }]}>
            {item.description}
          </ThemedText>
        </View>
        <ThemedText style={[styles.activityTime, { color: textSecondaryColor }]}>
          {item.time}
        </ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <ThemedText style={[styles.loadingText, { color: textSecondaryColor }]}>
            Loading dashboard...
          </ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Card */}
          <TouchableOpacity
            style={[styles.headerCard, { backgroundColor: cardBgColor, marginTop: insets.top + 16 }]}
            onPress={() => router.push('/profile')}>
            <View style={styles.headerTop}>
              <View style={styles.profileSection}>
                <View style={[styles.profilePicture, { backgroundColor: isDark ? '#475569' : '#e2e8f0' }]}>
                  <MaterialCommunityIcons name="account" size={24} color={textPrimaryColor} />
                </View>
                <View>
                  <ThemedText style={[styles.greeting, { color: textPrimaryColor }]}>
                    Hello, {userName || user?.name || 'there'}
                  </ThemedText>
                  <ThemedText style={[styles.portfolioLabel, { color: textSecondaryColor }]}>
                    PORTFOLIO OVERVIEW
                  </ThemedText>
                </View>
              </View>
            </View>
            <ThemedText style={[styles.statsText, { color: textPrimaryColor }]}>
              {stats.leaseCount} Active {stats.leaseCount === 1 ? 'Lease' : 'Leases'} • {stats.occupancyRate}% Occupancy
            </ThemedText>
          </TouchableOpacity>

        {/* Rent Collection Card */}
        <View style={[styles.rentCard, { backgroundColor: cardBgColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Rent Collection</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
            For {rentCollection.month} {rentCollection.year}
          </ThemedText>

          <RentChart 
            collected={rentCollection.collected} 
            pending={rentCollection.pending}
            notPaid={rentCollection.notPaid}
            total={rentCollection.total} 
          />

          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
              <ThemedText style={[styles.legendText, { color: textPrimaryColor }]}>Paid</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
              <ThemedText style={[styles.legendText, { color: textPrimaryColor }]}>Pending</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: isDark ? '#1e3a8a' : '#bfdbfe' }]} />
              <ThemedText style={[styles.legendText, { color: textPrimaryColor }]}>Overdue</ThemedText>
            </View>
          </View>
        </View>

        {/* Dashboard Tiles */}
        <FlatList
          data={dashboardTiles}
          keyExtractor={(item) => item.id}
          renderItem={renderTile}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={styles.tilesRow}
        />

        {/* Notifications Section */}
        {notifications.length > 0 && (
          <>
            <View style={styles.notificationHeader}>
              <ThemedText style={[styles.activitySectionTitle, { color: textPrimaryColor }]}>
                Recent Notifications
              </ThemedText>
              <TouchableOpacity onPress={() => router.push('/landlord-applications')}>
                <ThemedText style={[styles.viewAllText, { color: primaryColor }]}>View All</ThemedText>
              </TouchableOpacity>
            </View>
            {notifications.map((notif) => (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notificationCard, { backgroundColor: cardBgColor }]}
                onPress={() => router.push('/landlord-applications')}>
                <View style={[styles.notificationIcon, { backgroundColor: `${primaryColor}20` }]}>
                  <MaterialCommunityIcons name="file-document" size={24} color={primaryColor} />
                </View>
                <View style={styles.notificationContent}>
                  <ThemedText style={[styles.notificationTitle, { color: textPrimaryColor }]}>
                    {notif.title}
                  </ThemedText>
                  <ThemedText style={[styles.notificationMessage, { color: textSecondaryColor }]}>
                    {notif.message}
                  </ThemedText>
                  <ThemedText style={[styles.notificationTime, { color: textSecondaryColor }]}>
                    {new Date(notif.created_at).toLocaleString()}
                  </ThemedText>
                </View>
                {!notif.is_read && (
                  <View style={[styles.unreadBadge, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Recent Activity */}
        <ThemedText style={[styles.activitySectionTitle, { color: textPrimaryColor }]}>Recent Activity</ThemedText>
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderActivity}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />

        <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* FAB Button */}
      <View style={styles.fabContainer}>
        {showAddMenu && (
          <View style={[styles.addMenu, { backgroundColor: cardBgColor }]}>
            <TouchableOpacity style={styles.addMenuItem} onPress={handleInviteApplicant}>
              <MaterialCommunityIcons name="email-plus" size={24} color={primaryColor} />
              <ThemedText style={[styles.addMenuText, { color: textPrimaryColor }]}>Invite Applicant</ThemedText>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: borderColor }]} />
            <TouchableOpacity style={styles.addMenuItem} onPress={handleAddTenant}>
              <MaterialCommunityIcons name="account-plus" size={24} color={primaryColor} />
              <ThemedText style={[styles.addMenuText, { color: textPrimaryColor }]}>Add Tenant</ThemedText>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: borderColor }]} />
            <TouchableOpacity style={styles.addMenuItem} onPress={handleAddProperty}>
              <MaterialCommunityIcons name="home-plus" size={24} color={primaryColor} />
              <ThemedText style={[styles.addMenuText, { color: textPrimaryColor }]}>Add Property</ThemedText>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: primaryColor }]}
          onPress={() => setShowAddMenu(!showAddMenu)}>
          <MaterialCommunityIcons name={showAddMenu ? 'close' : 'plus'} size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  portfolioLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  rentCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  tilesRow: {
    gap: 16,
    marginBottom: 16,
  },
  dashboardTile: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tileName: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 2,
  },
  tileSubtitle: {
    fontSize: 12,
  },
  activitySectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 12,
  },
  activityTime: {
    fontSize: 12,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    alignItems: 'flex-end',
    zIndex: 20,
  },
  addMenu: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuDivider: {
    height: 1,
  },
  addMenuText: {
    fontSize: 14,
    fontWeight: '500',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
    marginTop: 4,
  },
});