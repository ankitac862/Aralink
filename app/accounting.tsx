import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-auth';
import { 
  DbTransaction, 
  fetchTransactions, 
  getTransactionAggregates, 
  TransactionAggregates,
} from '@/lib/supabase';

type TransactionType = 'income' | 'expense';
type TransactionCategory = 'all' | 'rent' | 'garage' | 'parking' | 'utility' | 'maintenance' | 'other';
type TransactionStatus = 'paid' | 'pending' | 'overdue';

// Group transactions by date section
interface TransactionSection {
  title: string;
  data: DbTransaction[];
}

const CATEGORIES: { key: TransactionCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'rent', label: 'Rent' },
  { key: 'garage', label: 'Garage' },
  { key: 'parking', label: 'Parking' },
  { key: 'utility', label: 'Utility' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'other', label: 'Other' },
];

export default function AccountingScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [transactionType, setTransactionType] = useState<TransactionType>('income');
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory>('all');
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [aggregates, setAggregates] = useState<TransactionAggregates>({ totalIncome: 0, totalExpense: 0, chartData: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1a2632' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#e0e6ed' : '#0d141b';
  const secondaryTextColor = isDark ? '#94a3b8' : '#4c739a';
  const primaryColor = '#137fec';

  // Load transactions on mount
  useEffect(() => {
    loadTransactions();
  }, [user]);

  const loadTransactions = async (isRefresh = false) => {
    if (!user) return;
    
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Get current month date range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const [transactionsData, aggregatesData] = await Promise.all([
        fetchTransactions(user.id),
        getTransactionAggregates(user.id, startOfMonth, endOfMonth),
      ]);

      setTransactions(transactionsData);
      setAggregates(aggregatesData);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter transactions by type and category
  const filteredTransactions = transactions.filter(t => {
    const typeMatch = t.type === transactionType;
    const categoryMatch = selectedCategory === 'all' || t.category === selectedCategory;
    return typeMatch && categoryMatch;
  });

  // Group by date
  const groupedTransactions = filteredTransactions.reduce((acc, transaction) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let dateLabel: string;
    if (transaction.date === today) {
      dateLabel = 'Today';
    } else if (transaction.date === yesterday) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = new Date(transaction.date).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    
    const existing = acc.find(s => s.title === dateLabel);
    if (existing) {
      existing.data.push(transaction);
    } else {
      acc.push({ title: dateLabel, data: [transaction] });
    }
    return acc;
  }, [] as TransactionSection[]);

  // Calculate total for filtered transactions
  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Map category to icon
  const getCategoryIcon = (category: string): string => {
    const iconMap: Record<string, string> = {
      rent: 'office-building',
      garage: 'car',
      parking: 'parking',
      utility: 'flash',
      maintenance: 'wrench',
      other: 'cash',
    };
    return iconMap[category] || 'cash';
  };

  // Map category to colors
  const getCategoryColors = (category: string): { bgColor: string; color: string } => {
    const colorMap: Record<string, { bgColor: string; color: string }> = {
      rent: { bgColor: '#EFF6FF', color: '#2563EB' },
      garage: { bgColor: '#F3E8FF', color: '#9333EA' },
      parking: { bgColor: '#FFF7ED', color: '#EA580C' },
      utility: { bgColor: '#FEF9C3', color: '#CA8A04' },
      maintenance: { bgColor: '#FEF2F2', color: '#DC2626' },
      other: { bgColor: '#F0FDF4', color: '#16A34A' },
    };
    return colorMap[category] || { bgColor: '#F3F4F6', color: '#6B7280' };
  };

  const renderTransaction = (transaction: DbTransaction) => {
    const isPending = transaction.status === 'pending';
    const colors = getCategoryColors(transaction.category);
    const icon = getCategoryIcon(transaction.category);
    
    return (
      <TouchableOpacity
        key={transaction.id}
        style={[
          styles.transactionCard,
          { 
            backgroundColor: cardBgColor,
            borderColor: isDark ? '#374151' : '#e5e7eb',
            opacity: isPending ? 0.6 : 1,
          },
        ]}
        onPress={() => router.push(`/transaction-detail?id=${transaction.id}`)}
      >
        <View 
          style={[
            styles.transactionIcon,
            { backgroundColor: isDark ? `${colors.color}20` : colors.bgColor },
          ]}
        >
          <MaterialCommunityIcons 
            name={icon as any} 
            size={24} 
            color={colors.color} 
          />
        </View>
        
        <View style={styles.transactionContent}>
          <ThemedText style={[styles.transactionTitle, { color: textColor }]}>
            {transaction.description || `${transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1)} Payment`}
          </ThemedText>
          <ThemedText style={[styles.transactionMeta, { color: secondaryTextColor }]}>
            {transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1)}
            {transaction.service_type && ` • ${transaction.service_type}`}
          </ThemedText>
        </View>
        
        <View style={styles.transactionRight}>
          <ThemedText 
            style={[
              styles.transactionAmount,
              { 
                color: isPending 
                  ? secondaryTextColor 
                  : transaction.type === 'income' 
                    ? '#16A34A' 
                    : '#DC2626',
              },
            ]}
          >
            {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </ThemedText>
          <View style={styles.statusContainer}>
            <View 
              style={[
                styles.statusDot,
                { 
                  backgroundColor: isPending ? '#EAB308' : '#22C55E',
                },
              ]} 
            />
            <ThemedText style={[styles.statusText, { color: secondaryTextColor }]}>
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>Accounts</ThemedText>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: `${primaryColor}15` }]}
            onPress={() => router.push('/add-transaction')}
          >
            <MaterialCommunityIcons name="plus" size={24} color={primaryColor} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTransactions(true)}
            tintColor={primaryColor}
          />
        }
      >
        {/* Income/Expense Toggle */}
        <View style={styles.toggleContainer}>
          <View style={[styles.toggleWrapper, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                transactionType === 'income' && [styles.toggleActive, { backgroundColor: cardBgColor }],
              ]}
              onPress={() => setTransactionType('income')}
            >
              <ThemedText 
                style={[
                  styles.toggleText,
                  { 
                    color: transactionType === 'income' ? primaryColor : secondaryTextColor,
                    fontWeight: transactionType === 'income' ? '700' : '500',
                  },
                ]}
              >
                Income
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                transactionType === 'expense' && [styles.toggleActive, { backgroundColor: cardBgColor }],
              ]}
              onPress={() => setTransactionType('expense')}
            >
              <ThemedText 
                style={[
                  styles.toggleText,
                  { 
                    color: transactionType === 'expense' ? primaryColor : secondaryTextColor,
                    fontWeight: transactionType === 'expense' ? '700' : '500',
                  },
                ]}
              >
                Expense
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Card with 7-Day Chart */}
        <View style={styles.combinedContainer}>
          <View style={[styles.summaryCard, { backgroundColor: cardBgColor, borderColor }]}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
              </View>
            ) : (
              <>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryInfo}>
                    <ThemedText style={[styles.summaryMonth, { color: secondaryTextColor }]}>
                      {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </ThemedText>
                    <ThemedText style={[styles.summaryLabel, { color: textColor }]}>
                      Total {transactionType === 'income' ? 'Income' : 'Expenses'}
                    </ThemedText>
                    <View style={styles.summaryAmountContainer}>
                      <ThemedText 
                        style={[styles.summaryAmount, { color: primaryColor }]}
                      >
                        ${(transactionType === 'income' ? aggregates.totalIncome : aggregates.totalExpense).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </ThemedText>
                    </View>
                  </View>
                  <View 
                    style={[
                      styles.summaryIconWrapper,
                      { backgroundColor: transactionType === 'income' ? '#DCFCE7' : '#FEE2E2' },
                    ]}
                  >
                    <MaterialCommunityIcons 
                      name={transactionType === 'income' ? 'trending-up' : 'trending-down'} 
                      size={24} 
                      color={transactionType === 'income' ? '#16A34A' : '#DC2626'} 
                    />
                  </View>
                </View>

                {/* Divider */}
                <View style={[styles.summaryDivider, { backgroundColor: borderColor }]} />
                
                {/* Mini Chart - Last 7 days */}
                <View style={[styles.chartContainer, { backgroundColor: `${primaryColor}08` }]}>
                  {aggregates.chartData && aggregates.chartData.length > 0 ? (
                    aggregates.chartData.map((day, index) => {
                      const maxAmount = Math.max(...aggregates.chartData.map(d => transactionType === 'income' ? d.income : d.expense));
                      const amount = transactionType === 'income' ? day.income : day.expense;
                      const flexValue = maxAmount > 0 ? Math.max(amount / maxAmount, 0.1) : 0.1;
                      
                      return (
                        <View key={index} style={styles.chartBarWrapper}>
                          <View style={[styles.chartBar, { flex: flexValue, backgroundColor: primaryColor }]} />
                        </View>
                      );
                    })
                  ) : (
                    // Show placeholder bars when no data
                    Array.from({ length: 7 }).map((_, i) => {
                      const heights = [0.35, 0.55, 0.4, 0.65, 0.5, 0.85, 0.45];
                      return (
                        <View key={i} style={styles.chartBarWrapper}>
                          <View style={[styles.chartBar, { flex: heights[i], backgroundColor: `${primaryColor}20` }]} />
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryPill,
                selectedCategory === cat.key
                  ? { backgroundColor: primaryColor }
                  : { backgroundColor: cardBgColor, borderColor, borderWidth: 1 },
              ]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <ThemedText 
                style={[
                  styles.categoryText,
                  { 
                    color: selectedCategory === cat.key ? '#ffffff' : textColor,
                    fontWeight: selectedCategory === cat.key ? '700' : '500',
                  },
                ]}
              >
                {cat.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Transaction List */}
        <View style={styles.transactionsContainer}>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={primaryColor} />
              <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                Loading transactions...
              </ThemedText>
            </View>
          ) : groupedTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons 
                name="receipt-text-outline" 
                size={48} 
                color={secondaryTextColor} 
              />
              <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
                No {transactionType} transactions found
              </ThemedText>
              <TouchableOpacity
                style={[styles.addFirstButton, { backgroundColor: primaryColor }]}
                onPress={() => router.push('/add-transaction')}
              >
                <MaterialCommunityIcons name="plus" size={20} color="#ffffff" />
                <ThemedText style={styles.addFirstButtonText}>
                  Add Your First Transaction
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            groupedTransactions.map((section) => (
              <View key={section.title} style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: secondaryTextColor }]}>
                  {section.title}
                </ThemedText>
                <View style={styles.sectionTransactions}>
                  {section.data.map(renderTransaction)}
                </View>
              </View>
            ))
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
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  toggleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  toggleWrapper: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    height: 48,
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  summaryDivider: {
    height: 1,
    marginVertical: 12,
    marginHorizontal: -20,
  },
  combinedContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  summaryCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    gap: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryInfo: {
    gap: 3,
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  summaryMonth: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryAmountContainer: {
    flexWrap: 'wrap',
    marginTop: 3,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 38,
    flexShrink: 1,
  },
  summaryIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  chartContainer: {
    minHeight: 96,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingBottom: 12,
    overflow: 'visible',
    gap: 4,
  },
  chartBarWrapper: {
    flex: 1,
    height: 96,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 1.5,
    minWidth: 0,
  },
  chartBar: {
    width: '100%',
    maxWidth: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minHeight: 3,
  },
  categoriesContainer: {
    paddingVertical: 8,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryText: {
    fontSize: 14,
  },
  transactionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionTransactions: {
    gap: 0,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  transactionContent: {
    flex: 1,
    minWidth: 0,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  transactionMeta: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  transactionRight: {
    alignItems: 'flex-end',
    minWidth: 0,
    flexShrink: 0,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  addFirstButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  timeSeriesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeSeriesCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  timeSeriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  timeSeriesTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartTypeToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  chartTypeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chartTypeText: {
    fontWeight: '600',
  },
  chartLoadingContainer: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmptyState: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmptyText: {
    fontSize: 14,
  },
});
