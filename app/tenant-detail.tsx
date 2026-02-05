import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTenantStore } from '@/store/tenantStore';
import { usePropertyStore } from '@/store/propertyStore';
import { DbTransaction, fetchTenantTransactions } from '@/lib/supabase';
import { exportTransactionsToExcel } from '@/utils/excelExport';

const PAYMENT_CATEGORIES = [
  { key: 'rent', label: 'Rent', color: '#3b82f6', active: true },
  { key: 'maintenance', label: 'Maintenance', color: '#10b981', active: false },
  { key: 'utility', label: 'Utility', color: '#f59e0b', active: false },
  { key: 'other', label: 'Other', color: '#a855f7', active: false },
];

const CircularProgress = ({ percentage, color, size = 80 }: { percentage: number; color: string; size?: number }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth="4"
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>{percentage}%</ThemedText>
      </View>
    </View>
  );
};

export default function TenantDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getTenantById, deleteTenant } = useTenantStore();
  const { getPropertyById } = usePropertyStore();
  
  const [selectedCategory, setSelectedCategory] = useState('rent');
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  
  const tenantData = id ? getTenantById(id) : null;
  const property = tenantData ? getPropertyById(tenantData.propertyId) : null;

  // Load transactions for this tenant
  useEffect(() => {
    const loadTransactions = async () => {
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
    };

    loadTransactions();
  }, [id]);
  
  // Format tenant data for display
  const tenant = tenantData ? {
    id: tenantData.id,
    name: `${tenantData.firstName} ${tenantData.lastName}`,
    email: tenantData.email,
    phone: tenantData.phone,
    propertyName: property?.name || 'Unknown Property',
    unitName: tenantData.unitName || 'N/A',
    address: property ? `${property.address1}${property.address2 ? ', ' + property.address2 : ''}, ${property.city}, ${property.state}` : 'N/A',
    createdAt: new Date(tenantData.createdAt).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }),
    profilePicture: tenantData.photo,
    payments: tenantData.payments || {
      rent: { paid: 0, total: tenantData.rentAmount || 0, percentage: 0 },
      maintenance: { paid: 0, total: 0, percentage: 0 },
      utility: { paid: 0, total: 0, percentage: 0 },
      other: { paid: 0, total: 0, percentage: 0 },
    },
  } : null;

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F8F9FA';
  const cardBgColor = isDark ? '#1A242E' : '#FFFFFF';
  const borderColor = isDark ? '#2E3A48' : '#E9ECEF';
  const textColor = isDark ? '#F8F9FA' : '#101921';
  const secondaryTextColor = isDark ? '#B0B8C1' : '#687588';

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

  const currentPayment = tenant.payments[selectedCategory as keyof typeof tenant.payments];

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
        {/* Profile Picture */}
        <View style={styles.profileSection}>
          {tenant.profilePicture ? (
            <Image source={{ uri: tenant.profilePicture }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profilePlaceholder, { backgroundColor: isDark ? '#2E3A48' : '#E9ECEF' }]}>
              <MaterialCommunityIcons name="account" size={48} color={secondaryTextColor} />
            </View>
          )}
        </View>

        {/* Tenant Info Card */}
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.cardTitle, { color: textColor }]}>Tenant Info</ThemedText>
          <View style={styles.infoList}>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Name</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.name}</ThemedText>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Property Name</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.propertyName}</ThemedText>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Unit Name</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.unitName}</ThemedText>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Address</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.address}</ThemedText>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Phone</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.phone}</ThemedText>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: borderColor }]}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Email</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.email}</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>CreatedAt</ThemedText>
              <ThemedText style={[styles.infoValue, { color: textColor }]}>{tenant.createdAt}</ThemedText>
            </View>
          </View>
        </View>

        {/* Payment Overview */}
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.cardTitle, { color: textColor }]}>Payment Overview</ThemedText>
          <View style={styles.paymentGrid}>
            {PAYMENT_CATEGORIES.map((category) => {
              const payment = tenant.payments[category.key as keyof typeof tenant.payments];
              return (
                <View key={category.key} style={[styles.paymentCard, { backgroundColor: bgColor }]}>
                  <ThemedText style={[styles.paymentCardTitle, { color: textColor }]}>
                    {category.label}
                  </ThemedText>
                  <CircularProgress percentage={payment.percentage} color={category.color} />
                  <View style={styles.paymentCardFooter}>
                    <ThemedText style={[styles.paymentCardLabel, { color: secondaryTextColor }]}>
                      Paid
                    </ThemedText>
                    <ThemedText style={[styles.paymentCardAmount, { color: textColor }]}>
                      ${payment.paid.toLocaleString()} / ${payment.total.toLocaleString()}
                    </ThemedText>
                  </View>
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
                style={[styles.ledgerActionButton, { backgroundColor: '#137fec' }]}
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
                      backgroundColor: isDark ? '#1e3a5f' : '#dbeafe',
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
                            ? '#137fec'
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
                          <View style={[
                            styles.transactionStatus,
                            { backgroundColor: transaction.status === 'paid' ? '#dcfce7' : '#fef3c7' }
                          ]}>
                            <ThemedText style={[
                              styles.transactionStatusText,
                              { color: transaction.status === 'paid' ? '#10b981' : '#f59e0b' }
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
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#fff',
  },
  profilePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
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
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  paymentCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  paymentCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  paymentCardFooter: {
    alignItems: 'center',
    gap: 4,
  },
  paymentCardLabel: {
    fontSize: 12,
  },
  paymentCardAmount: {
    fontSize: 14,
    fontWeight: '700',
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
