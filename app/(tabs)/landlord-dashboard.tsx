import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  AppState,
  AppStateStatus,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ListRenderItem,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';

import RentChart from '@/components/RentChart';
import { ThemedText } from '@/components/themed-text';
import { fmtShortDate, fmtDateTime, toISODateLocal } from '@/lib/dateUtils';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore } from '@/store/propertyStore';
import { getUserProfile, supabase, fetchLandlordNotifications } from '@/lib/supabase';
import { getActivityIconInfo } from '@/utils/activityIcon';

interface RentCollection {
  collected: number;
  overdue: number;   // unpaid rent (no longer splits into pending/not-paid)
  advance: number;   // collected > total: cash paid in advance
  total: number;
  month: string;
  year: number;
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
  const { loadFromSupabase } = usePropertyStore();
  
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
    overdue: 0,
    advance: 0,
    total: 0,
    month: new Date().toLocaleDateString('en-US', { month: 'long' }),
    year: new Date().getFullYear(),
  });
  const [rentPeriod, setRentPeriod] = useState<1 | 3 | 6 | 'cr'>(1);
  const [rawRentTxns, setRawRentTxns] = useState<{ type: string; category: string; amount: number; date: string; status: string }[]>([]);
  const [rentMonths, setRentMonths] = useState<{ label: string; start: string; end: string }[]>([]);
  const [expectedMonthlyRent, setExpectedMonthlyRent] = useState(0);

  // Chart carousel
  const chartScrollRef = useRef<ScrollView>(null);
  const [chartPage, setChartPage] = useState(0);
  const SCREEN_WIDTH = Dimensions.get('window').width - 32; // card width = screen - horizontal padding

  // Income vs Expense data
  const [incomeExpenseData, setIncomeExpenseData] = useState<{ month: string; income: number; expense: number }[]>([]);
  const [incomeExpensePeriod, setIncomeExpensePeriod] = useState<1 | 3 | 6 | 'cr'>(6);

  // Custom range state (shared modal, separate stored ranges per chart)
  const [rentCustomRange, setRentCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [ieCustomRange, setIeCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [crModalTarget, setCrModalTarget] = useState<'rent' | 'ie' | null>(null);
  const [crDraftStart, setCrDraftStart] = useState('');
  const [crDraftEnd, setCrDraftEnd] = useState('');
  const [showCRStartPicker, setShowCRStartPicker] = useState(false);
  const [showCREndPicker, setShowCREndPicker] = useState(false);

  const isDark = colorScheme === 'dark';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const textPrimaryColor = isDark ? '#FFFFFF' : '#111315';
  const textSecondaryColor = isDark ? '#9BA1A6' : '#6E7377';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';

  // Load data every time the screen comes into focus so changes from other screens are reflected
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        setIsLoading(false);
        loadDashboardDataInBackground();
      }
    }, [user?.id])
  );

  // Reload data when app comes back to foreground (e.g. after phone sleep or switching apps)
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      // fired when returning from background or inactive (phone locked)
      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        if (user?.id) {
          loadDashboardDataInBackground();
        }
      }
    });

    return () => subscription.remove();
  }, [user?.id]);

  // Recalculate rent collection client-side when the period toggle changes
  useEffect(() => {
    if (rentMonths.length < 12) return;

    let periodTxns: typeof rawRentTxns;
    let monthCount: number;
    let firstLabel: string;

    if (rentPeriod === 'cr') {
      if (!rentCustomRange) return;
      periodTxns = rawRentTxns.filter(t => t.date >= rentCustomRange.start && t.date <= rentCustomRange.end);
      const s = new Date(rentCustomRange.start + 'T00:00:00');
      const e = new Date(rentCustomRange.end + 'T00:00:00');
      monthCount = Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth() + 1);
      firstLabel = s.toLocaleDateString('en-US', { month: 'long' });
    } else {
      const periodMonths = rentMonths.slice(12 - rentPeriod);
      periodTxns = rawRentTxns.filter(t => t.date >= periodMonths[0].start && t.date <= periodMonths[periodMonths.length - 1].end);
      monthCount = rentPeriod;
      firstLabel = periodMonths[0].label;
    }

    const rentTxns = periodTxns.filter(t => t.type === 'income' && t.category === 'rent');
    const collected = rentTxns.filter(t => t.status === 'paid').reduce((s, t) => s + (t.amount || 0), 0);
    const overdueFromTxns = rentTxns.filter(t => t.status === 'overdue').reduce((s, t) => s + (t.amount || 0), 0);
    const total = expectedMonthlyRent > 0 ? expectedMonthlyRent * monthCount : collected + overdueFromTxns;
    const overdue = expectedMonthlyRent > 0 ? Math.max(overdueFromTxns, Math.max(0, total - collected)) : overdueFromTxns;
    const advance = expectedMonthlyRent > 0 ? Math.max(0, collected - total) : 0;
    setRentCollection({ collected, overdue, advance, total, month: firstLabel, year: new Date().getFullYear() });
  }, [rentPeriod, rentCustomRange, rawRentTxns, rentMonths, expectedMonthlyRent]);

  // Recalculate income vs expense client-side when period changes
  useEffect(() => {
    if (rawRentTxns.length === 0 && rentMonths.length === 0) return;
    const months: { label: string; start: string; end: string }[] = [];

    if (incomeExpensePeriod === 'cr') {
      if (!ieCustomRange) return;
      // iterate from the 1st of each month so day-31 starts can't skip months
      // and the end month is always included
      const d = new Date(ieCustomRange.start + 'T00:00:00');
      d.setDate(1);
      const endD = new Date(ieCustomRange.end + 'T00:00:00');
      endD.setDate(1);
      while (d <= endD) {
        const monthStart = toISODateLocal(new Date(d.getFullYear(), d.getMonth(), 1));
        const monthEnd = toISODateLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
        // clamp partial first/last months to the selected range
        const start = monthStart < ieCustomRange.start ? ieCustomRange.start : monthStart;
        const end = monthEnd > ieCustomRange.end ? ieCustomRange.end : monthEnd;
        months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), start, end });
        d.setMonth(d.getMonth() + 1);
      }
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() - (incomeExpensePeriod - 1));
      for (let i = 0; i < incomeExpensePeriod; i++) {
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
        months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), start, end });
        d.setMonth(d.getMonth() + 1);
      }
    }

    const result = months.map(({ label, start, end }) => {
      const bucket = rawRentTxns.filter(t => t.date >= start && t.date <= end);
      const income = bucket.filter(t => t.type === 'income' && t.status !== 'pending').reduce((s, t) => s + (t.amount || 0), 0);
      const expense = bucket.filter(t => t.type === 'expense' && t.status !== 'pending').reduce((s, t) => s + (t.amount || 0), 0);
      return { month: label, income, expense };
    });
    setIncomeExpenseData(result);
  }, [incomeExpensePeriod, ieCustomRange, rawRentTxns, rentMonths]);

  // Load data in background without blocking UI
  const loadDashboardDataInBackground = async () => {
    if (!user?.id) return;
    
    try {
      // OPTIMIZATION 6: Don't await these, let them load in background
      // This shows the dashboard instantly while loading data
      
      // Load profile asynchronously
      getUserProfile(user.id).then(profile => {
        if (profile?.full_name) {
          setUserName(profile.full_name.split(' ')[0]);
        }
      }).catch(err => console.error('Profile load error:', err));

      // Load properties asynchronously
      loadFromSupabase(user.id).catch(err => console.error('Properties load error:', err));

      // Build last-12-months labels (supports all period options: 1M/3M/6M/12M)
      const months: { label: string; start: string; end: string }[] = [];
      const dMonth = new Date();
      dMonth.setMonth(dMonth.getMonth() - 11);

      for (let i = 0; i < 12; i++) {
        const start = new Date(dMonth.getFullYear(), dMonth.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(dMonth.getFullYear(), dMonth.getMonth() + 1, 0).toISOString().split('T')[0];
        months.push({
          label: dMonth.toLocaleDateString('en-US', { month: 'short' }),
          start,
          end,
        });
        dMonth.setMonth(dMonth.getMonth() + 1);
      }

      // Fetch ALL transactions for the last 12 months
      const [
        { count: propertyCount },
        { count: tenantCount },
        { count: leaseCount },
        { count: maintenanceCount },
        { count: applicantCount },
        { data: rentData },
        { data: txns }
      ] = await Promise.all([
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('tenant_property_links').select('id', { count: 'exact', head: true }).eq('landlord_id', user.id).eq('status', 'active'),
        supabase.from('leases').select('id', { count: 'exact', head: true }).eq('landlord_id', user.id).not('status', 'in', '(draft,terminated)'),
        supabase.from('maintenance_requests').select('id', { count: 'exact', head: true }).eq('landlord_id', user.id).in('status', ['pending', 'in_progress']),
        supabase.from('applicants').select('id', { count: 'exact', head: true }).eq('landlord_id', user.id).in('status', ['invited', 'applied']),
        supabase.from('tenant_property_links').select('rent_amount').eq('landlord_id', user.id).eq('status', 'active'),
        supabase.from('transactions').select('type, category, amount, date, status').eq('user_id', user.id).gte('date', months[0].start).lte('date', months[11].end)
      ]);

      // Calculate occupancy rate
      let occupancyRate = 0;
      if ((propertyCount || 0) > 0 && (tenantCount || 0) > 0) {
        occupancyRate = Math.round(((tenantCount || 0) / (propertyCount || 0)) * 100);
      }

      // Store raw data so the period toggle can recalculate client-side
      const monthlyRent = rentData?.reduce((sum, link) => sum + (link.rent_amount || 0), 0) || 0;
      setExpectedMonthlyRent(monthlyRent);
      setRentMonths(months);
      setRawRentTxns(txns || []);

      // Initial calculation for current month (period = 1, months[11])
      const currentTxns = (txns || []).filter(t => t.date >= months[11].start && t.date <= months[11].end);
      const currentRentTxns = currentTxns.filter(t => t.type === 'income' && t.category === 'rent');
      const collected = currentRentTxns
        .filter(t => t.status === 'paid')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const overdueFromTxns = currentRentTxns
        .filter(t => t.status === 'overdue')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const overdue = monthlyRent > 0
        ? Math.max(overdueFromTxns, Math.max(0, monthlyRent - collected))
        : overdueFromTxns;
      const advance = monthlyRent > 0 ? Math.max(0, collected - monthlyRent) : 0;

      setStats({
        propertyCount: propertyCount || 0,
        tenantCount: tenantCount || 0,
        leaseCount: leaseCount || 0,
        occupancyRate,
        maintenanceCount: maintenanceCount || 0,
        applicantCount: applicantCount || 0,
      });

      setRentCollection({
        collected,
        overdue,
        advance,
        total: monthlyRent > 0 ? monthlyRent : collected,
        month: new Date().toLocaleDateString('en-US', { month: 'long' }),
        year: new Date().getFullYear(),
      });

      // OPTIMIZATION 7: Load recent activity asynchronously (don't block main data)
      fetchLandlordNotifications(user.id)
        .then(notifs => {
          setNotifications(notifs.slice(0, 3));
        })
        .catch(err => console.error('Notifications load error:', err));

    } catch (error) {
      console.error('❌ Error loading dashboard:', error);
    }
  };



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
      subtitle: '',
      icon: 'account-group',
      route: '/tenants',
    },
    {
      id: '3',
      title: 'Leases',
      subtitle: '',
      icon: 'gavel',
      route: '/leases',
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
      subtitle: '',
      icon: 'file-document',
      route: '/landlord-applications',
    },
    {
      id: '7',
      title: 'Marketplace',
      subtitle: 'Find vendors',
      icon: 'store',
      route: '/marketplace',
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
        {!!item.subtitle && (
          <ThemedText style={[styles.tileSubtitle, { color: textSecondaryColor }]}>{item.subtitle}</ThemedText>
        )}
      </TouchableOpacity>
    );
  };

  const handleActivityPress = (notif: Notification) => {
    const data = (notif.data || {}) as Record<string, any>;

    switch (notif.type) {
      case 'property_added':
        router.push(data.propertyId ? `/property-detail?id=${data.propertyId}` as any : '/properties' as any);
        return;
      case 'payment':
      case 'expense':
        router.push(data.transactionId ? `/transaction-detail?id=${data.transactionId}` as any : '/accounting' as any);
        return;
      case 'maintenance_request':
      case 'maintenance_status_update':
        router.push(data.requestId ? `/landlord-maintenance-detail?id=${data.requestId}` as any : '/landlord-maintenance-overview' as any);
        return;
      case 'application':
      case 'application_approved':
      case 'application_rejected':
        router.push(data.applicationId ? `/landlord-application-review?id=${data.applicationId}` as any : '/landlord-applications' as any);
        return;
      case 'lease':
      case 'lease_received':
      case 'lease_rejected':
      case 'arrival_date_change_request':
        router.push(data.leaseId ? `/lease-detail?id=${data.leaseId}` as any : '/leases' as any);
        return;
      case 'chat_message':
        router.push(data.conversationId ? `/chat/${data.conversationId}` as any : '/(tabs)/messages' as any);
        return;
      case 'invite':
        router.push('/tenants' as any);
        return;
      default:
        router.push('/notifications' as any);
    }
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
                {user?.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={styles.profilePicture}
                  />
                ) : (
                  <View style={[styles.profilePicture, { backgroundColor: isDark ? '#26282C' : '#E5E5E7' }]}>
                    <MaterialCommunityIcons name="account" size={24} color={textPrimaryColor} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <ThemedText
                    style={[styles.greeting, { color: textPrimaryColor }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Hello, {userName || user?.name || 'there'}
                  </ThemedText>
                  <ThemedText style={[styles.portfolioLabel, { color: textSecondaryColor }]}>
                    PORTFOLIO OVERVIEW
                  </ThemedText>
                </View>
              </View>
            </View>
          </TouchableOpacity>

        {/* ── Scrollable Chart Carousel ─────────────────────────────── */}
        <View style={{ marginBottom: 24 }}>
          <ScrollView
            ref={chartScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH + 16}
            snapToAlignment="start"
            contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 2 }}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH + 16));
              setChartPage(page);
            }}
          >
            {/* ── Slide 1: Rent Collection Pie ─────────────────── */}
            <View style={[styles.chartCard, { backgroundColor: cardBgColor, width: SCREEN_WIDTH }]}>
              <View style={styles.chartCardHeader}>
                <View>
                  <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Rent Collection</ThemedText>
                  <ThemedText style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
                    {rentPeriod === 'cr'
                      ? (rentCustomRange ? `${fmtShortDate(rentCustomRange.start)} – ${fmtShortDate(rentCustomRange.end)}` : 'Select range')
                      : rentPeriod === 1 ? `${rentCollection.month} ${rentCollection.year}` : `Last ${rentPeriod} months`}
                  </ThemedText>
                </View>
                {/* Period toggle: 1M / 3M / 6M / CR */}
                <View style={[styles.rentPeriodToggle, { backgroundColor: isDark ? '#26282C' : '#E5E5E7' }]}>
                  {([1, 3, 6] as const).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.rentPeriodBtn, rentPeriod === p && { backgroundColor: '#34C759' }]}
                      onPress={() => setRentPeriod(p)}
                    >
                      <ThemedText style={[styles.rentPeriodBtnText, { color: rentPeriod === p ? '#fff' : textSecondaryColor }]}>
                        {p}M
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.rentPeriodBtn, rentPeriod === 'cr' && { backgroundColor: '#34C759' }]}
                    onPress={() => {
                      setRentPeriod('cr');
                      setCrDraftStart(rentCustomRange?.start ?? '');
                      setCrDraftEnd(rentCustomRange?.end ?? '');
                      setCrModalTarget('rent');
                    }}
                  >
                    <ThemedText style={[styles.rentPeriodBtnText, { color: rentPeriod === 'cr' ? '#fff' : textSecondaryColor }]}>
                      CR
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <RentChart
                collected={rentCollection.collected}
                overdue={rentCollection.overdue}
                advance={rentCollection.advance}
                total={rentCollection.total}
              />

              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                  <ThemedText style={[styles.legendText, { color: textPrimaryColor }]}>Paid</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
                  <ThemedText style={[styles.legendText, { color: textPrimaryColor }]}>Overdue</ThemedText>
                </View>
                {rentCollection.advance > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#AF52DE' }]} />
                    <ThemedText style={[styles.legendText, { color: textPrimaryColor }]}>In Advance</ThemedText>
                  </View>
                )}
              </View>
            </View>

            {/* ── Slide 2: Income vs Expense Bar Chart ─────────── */}
            <View style={[styles.chartCard, { backgroundColor: cardBgColor, width: SCREEN_WIDTH, marginLeft: 16 }]}>
              <View style={styles.chartCardHeader}>
                <View>
                  <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Income vs Expense</ThemedText>
                  <ThemedText style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
                    {incomeExpensePeriod === 'cr'
                      ? (ieCustomRange ? `${fmtShortDate(ieCustomRange.start)} – ${fmtShortDate(ieCustomRange.end)}` : 'Select range')
                      : incomeExpensePeriod === 1 ? 'This month' : `Last ${incomeExpensePeriod} months`}
                  </ThemedText>
                </View>
                {/* Period toggle: 1M / 3M / 6M / CR */}
                <View style={[styles.rentPeriodToggle, { backgroundColor: isDark ? '#26282C' : '#E5E5E7' }]}>
                  {([1, 3, 6] as const).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.rentPeriodBtn, incomeExpensePeriod === p && { backgroundColor: primaryColor }]}
                      onPress={() => setIncomeExpensePeriod(p)}
                    >
                      <ThemedText style={[styles.rentPeriodBtnText, { color: incomeExpensePeriod === p ? onPrimaryColor : textSecondaryColor }]}>
                        {p}M
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.rentPeriodBtn, incomeExpensePeriod === 'cr' && { backgroundColor: primaryColor }]}
                    onPress={() => {
                      setIncomeExpensePeriod('cr');
                      setCrDraftStart(ieCustomRange?.start ?? '');
                      setCrDraftEnd(ieCustomRange?.end ?? '');
                      setCrModalTarget('ie');
                    }}
                  >
                    <ThemedText style={[styles.rentPeriodBtnText, { color: incomeExpensePeriod === 'cr' ? onPrimaryColor : textSecondaryColor }]}>
                      CR
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bar chart */}
              {incomeExpenseData.length === 0 ? (
                <View style={styles.barChartEmpty}>
                  <MaterialCommunityIcons name="chart-bar" size={40} color={textSecondaryColor} />
                  <ThemedText style={[{ color: textSecondaryColor, fontSize: 13, marginTop: 8 }]}>
                    No transaction data yet
                  </ThemedText>
                </View>
              ) : (() => {
                const maxVal = Math.max(...incomeExpenseData.flatMap(d => [d.income, d.expense]), 1);
                const BAR_H = 120;
                return (
                  <View style={styles.barChartWrapper}>
                    {/* Y-axis guide lines */}
                    {[1, 0.5, 0].map(frac => (
                      <View
                        key={frac}
                        style={[
                          styles.barChartGuideLine,
                          { bottom: frac * BAR_H + 28, borderColor: isDark ? '#ffffff12' : '#00000010' },
                        ]}
                      />
                    ))}
                    {incomeExpenseData.map((d, i) => (
                      <View key={i} style={styles.barGroup}>
                        <View style={[styles.barsRow, { height: BAR_H }]}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: Math.max((d.income / maxVal) * BAR_H, 3),
                                backgroundColor: '#34C759',
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.bar,
                              {
                                height: Math.max((d.expense / maxVal) * BAR_H, 3),
                                backgroundColor: '#FF3B30',
                              },
                            ]}
                          />
                        </View>
                        <ThemedText style={[styles.barLabel, { color: textSecondaryColor }]}>
                          {d.month}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Legend */}
              <View style={[styles.legendContainer, { marginTop: 12 }]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                  <ThemedText style={[styles.legendText, { color: textPrimaryColor }]}>Income</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
                  <ThemedText style={[styles.legendText, { color: textPrimaryColor }]}>Expense</ThemedText>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Pagination dots */}
          <View style={styles.paginationDots}>
            {[0, 1].map(i => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  chartScrollRef.current?.scrollTo({ x: i * (SCREEN_WIDTH + 16), animated: true });
                  setChartPage(i);
                }}
                style={[
                  styles.dot,
                  {
                    backgroundColor: chartPage === i ? primaryColor : (isDark ? '#26282C' : '#E5E5E7'),
                    width: chartPage === i ? 20 : 8,
                  },
                ]}
              />
            ))}
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

        {/* Recent Activity (notifications + actions like adding a property or recording a payment) */}
        <View style={styles.notificationHeader}>
          <ThemedText style={[styles.activitySectionTitle, { color: textPrimaryColor, marginTop: 0, marginBottom: 0 }]}>
            Recent Activity
          </ThemedText>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/notifications' as any)}>
              <ThemedText style={[styles.viewAllText, { color: primaryColor }]}>View All</ThemedText>
            </TouchableOpacity>
          )}
        </View>
        {notifications.length === 0 ? (
          <View style={[styles.notificationCard, { backgroundColor: cardBgColor, justifyContent: 'center' }]}>
            <ThemedText style={{ color: textSecondaryColor, fontSize: 13, textAlign: 'center' }}>
              No recent activity yet
            </ThemedText>
          </View>
        ) : (
          notifications.map((notif) => {
            const iconInfo = getActivityIconInfo(notif.type);
            return (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notificationCard, { backgroundColor: cardBgColor }]}
                onPress={() => handleActivityPress(notif)}>
                <View style={[styles.notificationIcon, { backgroundColor: isDark ? iconInfo.bgDark : iconInfo.bgLight }]}>
                  <MaterialCommunityIcons name={iconInfo.icon as any} size={18} color={isDark ? iconInfo.colorDark : iconInfo.colorLight} />
                </View>
                <View style={styles.notificationContent}>
                  <ThemedText style={[styles.notificationTitle, { color: textPrimaryColor }]}>
                    {notif.title}
                  </ThemedText>
                  <ThemedText style={[styles.notificationMessage, { color: textSecondaryColor }]}>
                    {notif.message}
                  </ThemedText>
                  <ThemedText style={[styles.notificationTime, { color: textSecondaryColor }]}>
                    {fmtDateTime(notif.created_at)}
                  </ThemedText>
                </View>
                {!notif.is_read && (
                  <View style={[styles.unreadBadge, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>
            );
          })
        )}

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
          <MaterialCommunityIcons name={showAddMenu ? 'close' : 'plus'} size={28} color={onPrimaryColor} />
        </TouchableOpacity>
      </View>

      {/* Custom Range date picker modal */}
      <Modal
        visible={crModalTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCrModalTarget(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCrModalTarget(null)} />
          <View style={{ backgroundColor: cardBgColor, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <ThemedText style={{ fontSize: 17, fontWeight: '700', color: textPrimaryColor, marginBottom: 16 }}>
              Custom Date Range
            </ThemedText>

            <TouchableOpacity
              style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor, marginBottom: 10, backgroundColor: isDark ? '#141517' : '#F7F7F8' }}
              onPress={() => { setShowCRStartPicker(true); setShowCREndPicker(false); }}
            >
              <ThemedText style={{ color: crDraftStart ? textPrimaryColor : textSecondaryColor }}>
                {crDraftStart ? fmtShortDate(crDraftStart) : 'Start Date'}
              </ThemedText>
            </TouchableOpacity>
            {showCRStartPicker && (
              <DateTimePicker
                value={crDraftStart ? new Date(crDraftStart + 'T00:00:00') : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_e, date) => {
                  if (Platform.OS !== 'ios') setShowCRStartPicker(false);
                  if (date) setCrDraftStart(toISODateLocal(date));
                }}
              />
            )}
            {showCRStartPicker && Platform.OS === 'ios' && (
              <TouchableOpacity style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6, marginBottom: 4 }} onPress={() => setShowCRStartPicker(false)}>
                <ThemedText style={{ fontWeight: '600' }}>Done</ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor, marginBottom: 20, backgroundColor: isDark ? '#141517' : '#F7F7F8' }}
              onPress={() => { setShowCREndPicker(true); setShowCRStartPicker(false); }}
            >
              <ThemedText style={{ color: crDraftEnd ? textPrimaryColor : textSecondaryColor }}>
                {crDraftEnd ? fmtShortDate(crDraftEnd) : 'End Date'}
              </ThemedText>
            </TouchableOpacity>
            {showCREndPicker && (
              <DateTimePicker
                value={crDraftEnd ? new Date(crDraftEnd + 'T00:00:00') : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_e, date) => {
                  if (Platform.OS !== 'ios') setShowCREndPicker(false);
                  if (date) setCrDraftEnd(toISODateLocal(date));
                }}
              />
            )}
            {showCREndPicker && Platform.OS === 'ios' && (
              <TouchableOpacity style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6, marginBottom: 4 }} onPress={() => setShowCREndPicker(false)}>
                <ThemedText style={{ fontWeight: '600' }}>Done</ThemedText>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor, alignItems: 'center' }}
                onPress={() => setCrModalTarget(null)}
              >
                <ThemedText style={{ color: textPrimaryColor }}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: primaryColor, alignItems: 'center' }}
                onPress={() => {
                  if (!crDraftStart || !crDraftEnd) {
                    Alert.alert('Select both start and end dates');
                    return;
                  }
                  if (crDraftStart > crDraftEnd) {
                    Alert.alert('End date must be after start date');
                    return;
                  }
                  const range = { start: crDraftStart, end: crDraftEnd };
                  if (crModalTarget === 'rent') setRentCustomRange(range);
                  else setIeCustomRange(range);
                  setCrModalTarget(null);
                }}
              >
                <ThemedText style={{ color: onPrimaryColor, fontWeight: '700' }}>Apply</ThemedText>
              </TouchableOpacity>
            </View>
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
  // Chart carousel
  chartCard: {
    padding: 16,
    borderRadius: 16,
    minHeight: 330, // Ensures consistent height and prevents Android ScrollView collapse
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  chartBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chartBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  // Bar chart
  barChartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 148,
    marginTop: 16,
    position: 'relative',
  },
  barChartGuideLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
  },
  barChartEmpty: {
    height: 148,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    justifyContent: 'center',
  },
  bar: {
    width: 14,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 3,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
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
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    marginBottom: 2,
  },
  notificationTime: {
    fontSize: 10,
    opacity: 0.7,
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
    marginTop: 4,
  },
  rentPeriodToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  rentPeriodBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  rentPeriodBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});