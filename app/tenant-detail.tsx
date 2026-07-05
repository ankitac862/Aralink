import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTenantStore } from '@/store/tenantStore';
import { usePropertyStore } from '@/store/propertyStore';
import { DbTransaction, fetchTenantTransactions, supabase } from '@/lib/supabase';
import { exportTransactionsToExcel } from '@/utils/excelExport';
import { fmtShortDate, fmtDate, toISODateLocal } from '@/lib/dateUtils';

interface CoTenant {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
}

const PAYMENT_CATEGORIES = [
  { key: 'rent', label: 'Rent', color: '#8E959B', active: true },
  { key: 'maintenance', label: 'Maintenance', color: '#10b981', active: false },
  { key: 'utility', label: 'Utility', color: '#f59e0b', active: false },
  { key: 'other', label: 'Other', color: '#a855f7', active: false },
];

export default function TenantDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getTenantById, deleteTenant } = useTenantStore();
  const { getPropertyById, getUnitById } = usePropertyStore();

  const [selectedCategory, setSelectedCategory] = useState('rent');
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [coTenants, setCoTenants] = useState<CoTenant[]>([]);
  const [linkData, setLinkData] = useState<{ unit_id?: string | null; sub_unit_id?: string | null } | null>(null);
  const [paymentPeriod, setPaymentPeriod] = useState<1 | 3 | 6 | 'cr'>(1);
  const [paymentCustomRange, setPaymentCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [showCRModal, setShowCRModal] = useState(false);
  const [crDraftStart, setCrDraftStart] = useState('');
  const [crDraftEnd, setCrDraftEnd] = useState('');
  const [showCRStartPicker, setShowCRStartPicker] = useState(false);
  const [showCREndPicker, setShowCREndPicker] = useState(false);
  
  const tenantData = id ? getTenantById(id) : null;
  const property = tenantData ? getPropertyById(tenantData.propertyId) : null;

  // Load transactions for this tenant, refreshing whenever the screen regains focus
  // (e.g. after adding a transaction via /add-transaction)
  const loadTransactions = useCallback(async () => {
    if (!id) return;

    setLoadingTransactions(true);
    try {
      const data = await fetchTenantTransactions(id);
      setTransactions(data);
    } catch (error) {
      console.error('Error loading tenant transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  useEffect(() => {
    const loadCoTenants = async () => {
      if (!id || !tenantData?.propertyId) {
        setCoTenants([]);
        return;
      }

      try {
        const { data: tenantLink, error: tenantLinkError } = await supabase
          .from('tenant_property_links')
          .select('id')
          .eq('tenant_id', id)
          .eq('property_id', tenantData.propertyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tenantLinkError) {
          console.error('Error loading tenant property link for co-tenants:', tenantLinkError);
          setCoTenants([]);
          return;
        }

        if (!tenantLink?.id) {
          setCoTenants([]);
          return;
        }

        const { data, error } = await supabase
          .from('co_tenants')
          .select('id, full_name, email, phone')
          .eq('tenant_id', tenantLink.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading co-tenants for tenant detail:', error);
          setCoTenants([]);
          return;
        }

        setCoTenants(data || []);
      } catch (error) {
        console.error('Error fetching co-tenants for tenant detail:', error);
        setCoTenants([]);
      }
    };

    loadCoTenants();
  }, [id, tenantData?.propertyId]);

  // Load the active tenant_property_link to get authoritative unit_id + sub_unit_id
  useEffect(() => {
    if (!id || !tenantData?.propertyId) return;
    supabase
      .from('tenant_property_links')
      .select('unit_id, sub_unit_id')
      .eq('tenant_id', id)
      .eq('property_id', tenantData.propertyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setLinkData(data); });
  }, [id, tenantData?.propertyId]);

  const periodFilteredTransactions = useMemo(() => {
    const today = new Date();
    let startStr: string;
    let endStr: string;
    if (paymentPeriod === 'cr') {
      if (!paymentCustomRange) return transactions;
      startStr = paymentCustomRange.start;
      endStr = paymentCustomRange.end;
    } else {
      const s = new Date(today.getFullYear(), today.getMonth() - (paymentPeriod - 1), 1);
      startStr = s.toISOString().split('T')[0];
      endStr = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    }
    return transactions.filter(t => t.date >= startStr && t.date <= endStr);
  }, [transactions, paymentPeriod, paymentCustomRange]);

  const computedPayments = useMemo(() => {
    const summary: Record<string, { paid: number; total: number; overdue: number; percentage: number }> = {
      rent: { paid: 0, total: 0, overdue: 0, percentage: 0 },
      maintenance: { paid: 0, total: 0, overdue: 0, percentage: 0 },
      utility: { paid: 0, total: 0, overdue: 0, percentage: 0 },
      other: { paid: 0, total: 0, overdue: 0, percentage: 0 },
    };

    periodFilteredTransactions.forEach((t) => {
      const key = (['rent', 'maintenance', 'utility'] as const).includes(t.category as any)
        ? (t.category as 'rent' | 'maintenance' | 'utility')
        : 'other';

      summary[key].total += t.amount;
      if (t.status === 'paid') {
        summary[key].paid += t.amount;
      } else if (t.status === 'overdue') {
        summary[key].overdue += t.amount;
      }
    });

    Object.values(summary).forEach((cat) => {
      cat.percentage = cat.total > 0 ? Math.round((cat.paid / cat.total) * 100) : 0;
    });

    return summary;
  }, [periodFilteredTransactions]);

  // Resolve unit (apartment) and room (sub-unit) from authoritative link data
  const resolvedUnitId = linkData?.unit_id || tenantData?.unitId;
  const unitObj = resolvedUnitId ? getUnitById(resolvedUnitId) : null;
  const unitDisplayName = unitObj?.name ? `Unit ${unitObj.name}` : null;

  const resolvedSubUnitId = linkData?.sub_unit_id;
  const subUnitObj = resolvedSubUnitId && unitObj
    ? unitObj.subUnits?.find(s => s.id === resolvedSubUnitId)
    : null;
  const roomName = subUnitObj?.name || tenantData?.unitName || null;

  const propertyType = property?.propertyType;

  // Format tenant data for display
  const tenant = tenantData ? {
    id: tenantData.id,
    name: `${tenantData.firstName} ${tenantData.lastName}`,
    email: tenantData.email,
    phone: tenantData.phone,
    propertyName: property?.name || property?.address1 || 'Unknown Property',
    unitDisplayName,
    roomName,
    address: property ? `${property.address1}${property.address2 ? ', ' + property.address2 : ''}, ${property.city}, ${property.state}` : 'N/A',
    startDate: tenantData.startDate || null,
    endDate: tenantData.endDate || null,
    rentAmount: tenantData.rentAmount,
    idProof1: tenantData.idProof1,
    idProof2: tenantData.idProof2,
    profilePicture: tenantData.photo,
    payments: computedPayments,
  } : null;

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const secondaryTextColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const handleDelete = () => {
    if (!tenant || !tenantData) return;
    
    Alert.alert(
      'Delete Tenant',
      'Are you sure you want to delete this tenant? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTenant(tenantData.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    if (!tenant) return;
    router.push(`/add-tenant?id=${tenant.id}`);
  };

  if (!tenant) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>Tenant Details</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ThemedText style={[styles.loadingText, { color: secondaryTextColor }]}>
            Tenant not found
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>{tenant.name}</ThemedText>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleDelete}>
            <MaterialCommunityIcons name="delete-outline" size={24} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEdit}>
            <MaterialCommunityIcons name="pencil" size={24} color={textColor} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.heroTop}>
            {tenant.profilePicture ? (
              <Image source={{ uri: tenant.profilePicture }} style={styles.heroAvatar} />
            ) : (
              <View style={[styles.heroAvatarPlaceholder, { backgroundColor: isDark ? '#222428' : '#EDEDEF' }]}>
                <ThemedText style={[styles.heroAvatarInitial, { color: primaryColor }]}>
                  {tenant.name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.heroMeta}>
              <ThemedText style={[styles.heroName, { color: textColor }]}>{tenant.name}</ThemedText>
              <ThemedText style={[styles.heroLocation, { color: secondaryTextColor }]} numberOfLines={1}>
                {tenant.propertyName}
                {tenant.unitDisplayName ? `  ·  ${tenant.unitDisplayName}` : ''}
                {tenant.roomName ? `  ·  ${tenant.roomName}` : ''}
              </ThemedText>
            </View>
          </View>

          {/* Key stats strip */}
          <View style={[styles.heroStats, { borderTopColor: borderColor }]}>
            <View style={styles.heroStat}>
              <ThemedText style={[styles.heroStatValue, { color: primaryColor }]}>
                {tenant.rentAmount != null ? `$${tenant.rentAmount.toLocaleString()}` : 'N/A'}
              </ThemedText>
              <ThemedText style={[styles.heroStatLabel, { color: secondaryTextColor }]}>Monthly Rent</ThemedText>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: borderColor }]} />
            <View style={styles.heroStat}>
              <ThemedText style={[styles.heroStatValue, { color: textColor }]}>
                {tenant.startDate ? fmtShortDate(tenant.startDate) : 'N/A'}
              </ThemedText>
              <ThemedText style={[styles.heroStatLabel, { color: secondaryTextColor }]}>Lease Start</ThemedText>
            </View>
            <View style={[styles.heroStatDivider, { backgroundColor: borderColor }]} />
            <View style={styles.heroStat}>
              <ThemedText style={[styles.heroStatValue, { color: textColor }]}>
                {tenant.endDate ? fmtShortDate(tenant.endDate) : 'N/A'}
              </ThemedText>
              <ThemedText style={[styles.heroStatLabel, { color: secondaryTextColor }]}>Lease End</ThemedText>
            </View>
          </View>
        </View>

        {/* Tenant Info Card */}
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.cardTitle, { color: textColor }]}>Contact & Location</ThemedText>
          <View style={styles.infoList}>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <View style={styles.infoRowLeft}>
                <MaterialCommunityIcons name="phone-outline" size={16} color={secondaryTextColor} />
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Phone</ThemedText>
              </View>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.phone || 'N/A'}</ThemedText>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <View style={styles.infoRowLeft}>
                <MaterialCommunityIcons name="email-outline" size={16} color={secondaryTextColor} />
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Email</ThemedText>
              </View>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.email || 'N/A'}</ThemedText>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <View style={styles.infoRowLeft}>
                <MaterialCommunityIcons name="home-city-outline" size={16} color={secondaryTextColor} />
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Property</ThemedText>
              </View>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.propertyName}</ThemedText>
            </View>
            {(propertyType === 'multi_unit' || tenant.unitDisplayName) && (
              <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
                <View style={styles.infoRowLeft}>
                  <MaterialCommunityIcons name="door" size={16} color={secondaryTextColor} />
                  <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Unit</ThemedText>
                </View>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.unitDisplayName || 'N/A'}</ThemedText>
              </View>
            )}
            {tenant.roomName && (
              <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
                <View style={styles.infoRowLeft}>
                  <MaterialCommunityIcons name="bed-outline" size={16} color={secondaryTextColor} />
                  <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Room</ThemedText>
                </View>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.roomName}</ThemedText>
              </View>
            )}
            <View style={styles.infoRow}>
              <View style={styles.infoRowLeft}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={secondaryTextColor} />
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Address</ThemedText>
              </View>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.address}</ThemedText>
            </View>
          </View>
        </View>

        {/* ID Proofs */}
        {(tenant.idProof1 || tenant.idProof2) && (
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>ID Proofs</ThemedText>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              {tenant.idProof1 && (
                <View style={{ flex: 1 }}>
                  <Image
                    source={{ uri: tenant.idProof1 }}
                    style={{ width: '100%', height: 120, borderRadius: 8, resizeMode: 'cover' }}
                  />
                  <ThemedText style={[styles.infoLabel, { color: secondaryTextColor, textAlign: 'center', marginTop: 4 }]}>ID Proof 1</ThemedText>
                </View>
              )}
              {tenant.idProof2 && (
                <View style={{ flex: 1 }}>
                  <Image
                    source={{ uri: tenant.idProof2 }}
                    style={{ width: '100%', height: 120, borderRadius: 8, resizeMode: 'cover' }}
                  />
                  <ThemedText style={[styles.infoLabel, { color: secondaryTextColor, textAlign: 'center', marginTop: 4 }]}>ID Proof 2</ThemedText>
                </View>
              )}
            </View>
          </View>
        )}

        {coTenants.length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}> 
            <View style={styles.coTenantsHeader}>
              <MaterialCommunityIcons name="account-group" size={20} color="#137fec" />
              <ThemedText style={[styles.cardTitle, styles.coTenantsTitle, { color: textColor }]}> 
                Co-Tenants ({coTenants.length})
              </ThemedText>
            </View>
            <ThemedText style={[styles.coTenantsSubtitle, { color: secondaryTextColor }]}> 
              Co-applicants converted with this tenant
            </ThemedText>
            {coTenants.map((coTenant) => (
              <View key={coTenant.id} style={[styles.coTenantRow, { borderTopColor: borderColor }]}> 
                <View style={[styles.coTenantAvatar, { backgroundColor: isDark ? '#222428' : '#EDEDEF' }]}> 
                  <ThemedText style={[styles.coTenantAvatarText, { color: textColor }]}>
                    {coTenant.full_name?.charAt(0).toUpperCase() || '?'}
                  </ThemedText>
                </View>
                <View style={styles.coTenantContent}>
                  <ThemedText style={[styles.coTenantName, { color: textColor }]}> 
                    {coTenant.full_name}
                  </ThemedText>
                  {coTenant.email ? (
                    <ThemedText style={[styles.coTenantMeta, { color: secondaryTextColor }]}> 
                      {coTenant.email}
                    </ThemedText>
                  ) : null}
                  {coTenant.phone ? (
                    <ThemedText style={[styles.coTenantMeta, { color: secondaryTextColor }]}> 
                      {coTenant.phone}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Payment Overview */}
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.paymentOverviewHeader}>
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>Payment Overview</ThemedText>
            <View style={[styles.periodToggle, { backgroundColor: isDark ? '#26282C' : '#E5E5E7' }]}>
              {([1, 3, 6] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, paymentPeriod === p && { backgroundColor: primaryColor }]}
                  onPress={() => setPaymentPeriod(p)}
                >
                  <ThemedText style={[styles.periodBtnText, { color: paymentPeriod === p ? onPrimaryColor : secondaryTextColor }]}>
                    {p}M
                  </ThemedText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.periodBtn, paymentPeriod === 'cr' && { backgroundColor: primaryColor }]}
                onPress={() => {
                  setPaymentPeriod('cr');
                  setCrDraftStart(paymentCustomRange?.start ?? '');
                  setCrDraftEnd(paymentCustomRange?.end ?? '');
                  setShowCRModal(true);
                }}
              >
                <ThemedText style={[styles.periodBtnText, { color: paymentPeriod === 'cr' ? onPrimaryColor : secondaryTextColor }]}>
                  CR
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <ThemedText style={[styles.periodSubtitle, { color: secondaryTextColor }]}>
            {paymentPeriod === 'cr'
              ? (paymentCustomRange
                  ? `${fmtShortDate(paymentCustomRange.start)} – ${fmtShortDate(paymentCustomRange.end)}`
                  : 'Select a date range')
              : paymentPeriod === 1 ? 'This month' : `Last ${paymentPeriod} months`}
          </ThemedText>

          <View style={styles.paymentCells}>
            {PAYMENT_CATEGORIES.map((category) => {
              const payment = tenant.payments[category.key as keyof typeof tenant.payments];
              return (
                <View key={category.key} style={[styles.paymentCell, { backgroundColor: bgColor, borderColor }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                    <ThemedText style={[styles.paymentCellLabel, { color: secondaryTextColor }]}>
                      {category.label}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.paymentCellValue, { color: category.color }]}>
                    ${payment.paid.toLocaleString()}
                  </ThemedText>
                  {payment.overdue > 0 && (
                    <View style={[styles.overdueBadge, { marginTop: 4 }]}>
                      <ThemedText style={styles.overdueBadgeText}>
                        ${payment.overdue.toLocaleString()} overdue
                      </ThemedText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Ledger */}
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.ledgerHeader}>
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>Ledger</ThemedText>
            <View style={styles.ledgerActions}>
              <TouchableOpacity 
                style={styles.ledgerActionButton}
                onPress={() => {
                  if (!tenant || transactions.length === 0) {
                    Alert.alert('No Data', 'No transactions to export');
                    return;
                  }
                  exportTransactionsToExcel(transactions, tenant.name);
                }}
              >
                <MaterialCommunityIcons name="download" size={20} color={secondaryTextColor} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.ledgerActionButton, { backgroundColor: '#10b981' }]}
                onPress={() => {
                  if (!tenant || !property) return;
                  router.push({
                    pathname: '/add-transaction',
                    params: {
                      type: 'income',
                      category: 'rent',
                      propertyId: tenantData?.propertyId,
                      tenantId: tenant.id,
                    },
                  });
                }}
              >
                <MaterialCommunityIcons name="cash-plus" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.ledgerActionButton, { backgroundColor: isDark ? '#26282C' : '#111315' }]}
                onPress={() => {
                  if (!tenant) return;
                  router.push({
                    pathname: '/add-transaction',
                    params: {
                      propertyId: tenantData?.propertyId,
                      tenantId: tenant.id,
                    },
                  });
                }}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <View style={styles.categoryContainer}>
              {PAYMENT_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.key}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category.key && {
                      backgroundColor: isDark ? '#222428' : '#EDEDEF',
                    },
                  ]}
                  onPress={() => setSelectedCategory(category.key)}
                >
                  <ThemedText
                    style={[
                      styles.categoryButtonText,
                      {
                        color:
                          selectedCategory === category.key
                            ? textColor
                            : secondaryTextColor,
                        fontWeight: selectedCategory === category.key ? '600' : '500',
                      },
                    ]}
                  >
                    {category.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Ledger List */}
          {loadingTransactions ? (
            <View style={styles.emptyLedger}>
              <ActivityIndicator size="large" color="#137fec" />
              <ThemedText style={[styles.emptyLedgerSubtitle, { color: secondaryTextColor }]}>
                Loading transactions...
              </ThemedText>
            </View>
          ) : (
            <>
              {transactions.filter(t => t.category === selectedCategory).length === 0 ? (
                <View style={styles.emptyLedger}>
                  <MaterialCommunityIcons name="receipt-text-outline" size={64} color={secondaryTextColor} />
                  <ThemedText style={[styles.emptyLedgerTitle, { color: textColor }]}>
                    No transactions found
                  </ThemedText>
                  <ThemedText style={[styles.emptyLedgerSubtitle, { color: secondaryTextColor }]}>
                    There are no transactions for the selected category.
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.transactionsList}>
                  {transactions
                    .filter(t => t.category === selectedCategory)
                    .map((transaction) => (
                      <View key={transaction.id} style={[styles.transactionRow, { borderBottomColor: borderColor }]}>
                        <View style={styles.transactionLeft}>
                          <ThemedText style={[styles.transactionDate, { color: textColor }]}>
                            {new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </ThemedText>
                          <ThemedText style={[styles.transactionDesc, { color: secondaryTextColor }]}>
                            {transaction.description || transaction.category}
                          </ThemedText>
                        </View>
                        <View style={styles.transactionRight}>
                          <ThemedText
                            style={[
                              styles.transactionAmount,
                              { color: transaction.type === 'income' ? '#10b981' : '#ef4444' }
                            ]}
                          >
                            {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                          </ThemedText>
                          {transaction.category === 'rent' &&
                            transaction.type === 'income' &&
                            !!tenantData?.rentAmount &&
                            transaction.amount > tenantData.rentAmount && (
                              <ThemedText style={styles.overpaidNote}>
                                +${(transaction.amount - tenantData.rentAmount).toFixed(2)} over rent
                              </ThemedText>
                            )}
                          <View style={[
                            styles.transactionStatus,
                            {
                              backgroundColor:
                                transaction.status === 'paid' ? '#dcfce7'
                                  : transaction.status === 'overdue' ? '#fee2e2'
                                  : '#fef3c7',
                            },
                          ]}>
                            <ThemedText style={[
                              styles.transactionStatusText,
                              {
                                color:
                                  transaction.status === 'paid' ? '#10b981'
                                    : transaction.status === 'overdue' ? '#ef4444'
                                    : '#f59e0b',
                              },
                            ]}>
                              {transaction.status}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                    ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Custom Range modal */}
      <Modal
        visible={showCRModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCRModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCRModal(false)} />
          <View style={{ backgroundColor: cardBgColor, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <ThemedText style={{ fontSize: 17, fontWeight: '700', color: textColor, marginBottom: 16 }}>
              Custom Date Range
            </ThemedText>

            <TouchableOpacity
              style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor, marginBottom: 10, backgroundColor: isDark ? '#141517' : '#F7F7F8' }}
              onPress={() => { setShowCRStartPicker(true); setShowCREndPicker(false); }}
            >
              <ThemedText style={{ color: crDraftStart ? textColor : secondaryTextColor }}>
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
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6, marginBottom: 4 }}
                onPress={() => setShowCRStartPicker(false)}>
                <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>Done</ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor, marginBottom: 20, backgroundColor: isDark ? '#141517' : '#F7F7F8' }}
              onPress={() => { setShowCREndPicker(true); setShowCRStartPicker(false); }}
            >
              <ThemedText style={{ color: crDraftEnd ? textColor : secondaryTextColor }}>
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
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6, marginBottom: 4 }}
                onPress={() => setShowCREndPicker(false)}>
                <ThemedText style={{ color: primaryColor, fontWeight: '600' }}>Done</ThemedText>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor, alignItems: 'center' }}
                onPress={() => setShowCRModal(false)}
              >
                <ThemedText style={{ color: textColor }}>Cancel</ThemedText>
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
                  setPaymentCustomRange({ start: crDraftStart, end: crDraftEnd });
                  setShowCRModal(false);
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  heroAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarInitial: {
    fontSize: 30,
    fontWeight: '700',
  },
  heroMeta: {
    flex: 1,
    gap: 4,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
  },
  heroLocation: {
    fontSize: 13,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 2,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  heroStatLabel: {
    fontSize: 11,
  },
  heroStatDivider: {
    width: 1,
    marginVertical: 10,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoList: {
    gap: 0,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  coTenantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  coTenantsTitle: {
    marginBottom: 0,
  },
  coTenantsSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  coTenantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  coTenantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coTenantAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  coTenantContent: {
    flex: 1,
    gap: 2,
  },
  coTenantName: {
    fontSize: 15,
    fontWeight: '600',
  },
  coTenantMeta: {
    fontSize: 13,
  },
  paymentOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  periodToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  periodBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  periodSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  paymentCells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentCell: {
    width: '47.5%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentCellLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  paymentCellValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  paymentCellTotal: {
    fontSize: 12,
  },
  overdueBadge: {
    marginTop: 2,
    backgroundColor: '#fef2f2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  overdueBadgeText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ledgerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  ledgerActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryButtonText: {
    fontSize: 14,
  },
  emptyLedger: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyLedgerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyLedgerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  transactionsList: {
    gap: 0,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  overpaidNote: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
