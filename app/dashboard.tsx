import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { getDashboardMetrics, getRentCollectionSummary, DashboardMetrics, RentCollectionSummary, getUserProfile } from '@/lib/supabase';

interface QuickAccessItem {
  id: string;
  title: string;
  icon: string;
  route: string;
}

type UserRole = 'landlord' | 'manager' | 'tenant' | null;

const LANDLORD_MANAGER_ITEMS: QuickAccessItem[] = [
  { id: '1', title: 'My Properties', icon: 'home-city', route: '/(tabs)/properties' },
  { id: '2', title: 'My Tenants', icon: 'account-multiple', route: '/(tabs)/tenants' },
  { id: '3', title: 'Maintenance', icon: 'wrench', route: '/(tabs)/maintenance' },
  { id: '4', title: 'Leases', icon: 'file-document', route: '/(tabs)/properties' },
];

const TENANT_ITEMS: QuickAccessItem[] = [
  { id: '1', title: 'Maintenance', icon: 'wrench', route: '/(tabs)/maintenance' },
  { id: '2', title: 'My Property', icon: 'home', route: '/(tabs)/dashboard' },
  { id: '3', title: 'Lease', icon: 'file-document', route: '/(tabs)/dashboard' },
];

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeLeases: 0,
    totalRentableUnits: 0,
    rentedUnits: 0,
    occupancyPercentage: 0,
  });
  const [rentCollection, setRentCollection] = useState<RentCollectionSummary>({
    totalExpected: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Get user role
        const role = await AsyncStorage.getItem('userRole');
        setUserRole((role as UserRole) || 'tenant');

        // Get user profile for name
        if (user?.id) {
          const profile = await getUserProfile(user.id);
          if (profile?.full_name) {
            setUserName(profile.full_name.split(' ')[0]); // First name only
          } else if (user.email) {
            setUserName(user.email.split('@')[0]); // Email prefix fallback
          }

          // Load metrics for landlord/manager
          if (role === 'landlord' || role === 'manager') {
            const [metricsData, rentData] = await Promise.all([
              getDashboardMetrics(user.id),
              getRentCollectionSummary(user.id),
            ]);
            setMetrics(metricsData);
            setRentCollection(rentData);
          }
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#18181b' : '#f8fafc';
  const cardBgColor = isDark ? '#27272a' : '#ffffff';
  const borderColor = isDark ? '#3f3f46' : '#e2e8f0';
  const textColor = isDark ? '#fafafa' : '#0f172a';
  const secondaryTextColor = isDark ? '#a1a1aa' : '#64748b';
  const primaryColor = '#3B82F6';

  const isLandlordOrManager = userRole === 'landlord' || userRole === 'manager';
  const quickAccessItems = isLandlordOrManager ? LANDLORD_MANAGER_ITEMS : TENANT_ITEMS;

  const QuickAccessCard = ({ item }: { item: QuickAccessItem }) => (
    <TouchableOpacity
      style={[styles.quickAccessCard, { backgroundColor: cardBgColor }]}
      onPress={() => router.push(item.route as any)}>
      <MaterialCommunityIcons name={item.icon as any} size={32} color={primaryColor} />
      <ThemedText style={[styles.quickAccessTitle, { color: textColor }]}>
        {item.title}
      </ThemedText>
    </TouchableOpacity>
  );

  if (loading) {
    return <ThemedView style={[styles.container, { backgroundColor: bgColor }]} />;
  }


  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top }}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarContainer, { backgroundColor: isDark ? '#3f3f46' : '#e2e8f0' }]}>
              <MaterialCommunityIcons name="account-circle" size={32} color={secondaryTextColor} />
            </View>
            <View>
              <ThemedText style={[styles.greeting, { color: textColor }]}>
                Hello, {userName || 'User'}
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: secondaryTextColor }]}>
                PORTFOLIO OVERVIEW
              </ThemedText>
            </View>
          </View>
          <TouchableOpacity>
            <View style={styles.notificationContainer}>
              <MaterialCommunityIcons name="bell" size={24} color={secondaryTextColor} />
              <View style={styles.notificationBadge} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Card */}
        {isLandlordOrManager && (
          <View style={[styles.statsCard, { backgroundColor: cardBgColor }]}>
            {loading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <ThemedText style={[styles.statsText, { color: textColor }]}>
                {metrics.activeLeases} Active Lease{metrics.activeLeases !== 1 ? 's' : ''} 
                <ThemedText style={{ color: borderColor }}>  •  </ThemedText>
                {metrics.occupancyPercentage}% Occupancy ({metrics.rentedUnits}/{metrics.totalRentableUnits})
              </ThemedText>
            )}
          </View>
        )}

        {/* Rent Collection Card */}
        {isLandlordOrManager && (
          <View style={[styles.rentCollectionCard, { backgroundColor: cardBgColor }]}>
            <ThemedText style={[styles.rentTitle, { color: textColor }]}>Rent Collection</ThemedText>
            <ThemedText style={[styles.rentSubtitle, { color: secondaryTextColor }]}>
              For {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </ThemedText>

            {loading ? (
              <View style={styles.chartContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
              </View>
            ) : rentCollection.totalExpected === 0 ? (
              <View style={styles.chartContainer}>
                <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                  No rent data for this month
                </ThemedText>
              </View>
            ) : (
              <>
                {/* Circular Progress Chart */}
                <View style={styles.chartContainer}>
                  <View style={styles.chartCircle}>
                    <View
                      style={[
                        styles.progressRing,
                        {
                          borderTopColor: '#10b981',
                          borderRightColor: '#fbbf24',
                          borderBottomColor: '#60a5fa',
                          borderLeftColor: isDark ? '#3f3f46' : '#e2e8f0',
                        },
                      ]}>
                    </View>
                    <View style={styles.chartCenter}>
                      <ThemedText style={[styles.chartAmount, { color: textColor }]}>
                        ${rentCollection.paid.toLocaleString()}
                      </ThemedText>
                      <ThemedText style={[styles.chartTotal, { color: secondaryTextColor }]}>
                        out of ${rentCollection.totalExpected.toLocaleString()}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                {/* Legend */}
                <View style={styles.legendContainer}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                    <ThemedText style={[styles.legendText, { color: secondaryTextColor }]}>
                      Paid (${rentCollection.paid.toLocaleString()})
                    </ThemedText>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} />
                    <ThemedText style={[styles.legendText, { color: secondaryTextColor }]}>
                      Pending (${rentCollection.pending.toLocaleString()})
                    </ThemedText>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#60a5fa' }]} />
                    <ThemedText style={[styles.legendText, { color: secondaryTextColor }]}>
                      Overdue (${rentCollection.overdue.toLocaleString()})
                    </ThemedText>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Quick Access Grid */}
        <View style={styles.quickAccessGrid}>
          {quickAccessItems.map((item) => (
            <QuickAccessCard key={item.id} item={item} />
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  notificationContainer: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  statsText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  rentCollectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  rentTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  rentSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  chartCircle: {
    width: 200,
    height: 200,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 12,
  },
  chartCenter: {
    alignItems: 'center',
  },
  chartAmount: {
    fontSize: 28,
    fontWeight: '700',
  },
  chartTotal: {
    fontSize: 12,
    marginTop: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '400',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  quickAccessCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickAccessTitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
