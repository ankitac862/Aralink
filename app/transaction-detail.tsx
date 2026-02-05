import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { DbTransaction, fetchTransactionById, getTenantPropertyAssociation } from '@/lib/supabase';
import { usePropertyStore } from '@/store/propertyStore';
import { useTenantStore } from '@/store/tenantStore';

interface TransactionDetail extends DbTransaction {
  propertyName?: string;
  propertyAddress?: string;
  tenantName?: string;
  tenantEmail?: string;
  unitInfo?: string;
}

export default function TransactionDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1a2632' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#e0e6ed' : '#0d141b';
  const secondaryTextColor = isDark ? '#94a3b8' : '#4c739a';
  const primaryColor = '#137fec';
  
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { getPropertyById } = usePropertyStore();
  const { getTenantById } = useTenantStore();

  useEffect(() => {
    loadTransactionDetail();
  }, [id]);

  const loadTransactionDetail = async () => {
    if (!id || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const transactionData = await fetchTransactionById(id);
      
      if (!transactionData) {
        setError('Transaction not found');
        return;
      }

      // Ensure properties are loaded before looking up
      const { loadFromSupabase } = usePropertyStore.getState();
      await loadFromSupabase(user.id);

      // Enrich with property and tenant information
      const enrichedTransaction: TransactionDetail = { ...transactionData };
      
      // Get property information
      const property = getPropertyById(transactionData.property_id!);
      if (property) {
        enrichedTransaction.propertyName = property.name || property.address1;
        enrichedTransaction.propertyAddress = `${property.address1}${
          property.address2 ? ', ' + property.address2 : ''
        }${property.city ? ', ' + property.city : ''}${property.state ? ', ' + property.state : ''}${
          property.zipCode ? ' ' + property.zipCode : ''
        }`;
      }

      // Get tenant information if tenant_id is present
      if (transactionData.tenant_id) {
        const tenant = getTenantById(transactionData.tenant_id);
        if (tenant) {
          enrichedTransaction.tenantName = `${tenant.firstName} ${tenant.lastName}`;
          enrichedTransaction.tenantEmail = tenant.email;
          
          // Build unit info
          const unitParts = [];
          if (tenant.unitName) {
            unitParts.push(`Room ${tenant.unitName}`);
          }
          if (property?.propertyType === 'multi_unit' && tenant.unitId) {
            unitParts.push(`Unit: ${tenant.unitId}`);
          }
          if (unitParts.length > 0) {
            enrichedTransaction.unitInfo = unitParts.join(' / ');
          }
        }
      }
      
      setTransaction(enrichedTransaction);
    } catch (err) {
      console.error('Error loading transaction detail:', err);
      setError('Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string): string => {
    const iconMap: { [key: string]: string } = {
      rent: 'home-outline',
      garage: 'garage',
      parking: 'parking',
      utility: 'flash',
      maintenance: 'wrench',
      other: 'file-document-outline',
    };
    return iconMap[category] || 'file-document-outline';
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
            </TouchableOpacity>
            <ThemedText style={[styles.headerTitle, { color: textColor }]}>
              Transaction Details
            </ThemedText>
            <View style={styles.placeholder} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </ThemedView>
    );
  }

  if (error || !transaction) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
            </TouchableOpacity>
            <ThemedText style={[styles.headerTitle, { color: textColor }]}>
              Transaction Details
            </ThemedText>
            <View style={styles.placeholder} />
          </View>
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={48} color={secondaryTextColor} />
          <ThemedText style={[styles.errorText, { color: secondaryTextColor }]}>
            {error || 'Transaction not found'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const categoryColor =
    transaction.type === 'income' ? '#16A34A' : '#DC2626';
  const categoryBgColor =
    transaction.type === 'income' ? '#DCFCE7' : '#FEE2E2';

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>
            Transaction Details
          </ThemedText>
          <View style={styles.placeholder} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Main Transaction Card */}
        <View style={styles.contentContainer}>
          <View style={[styles.mainCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={[styles.categoryIconWrapper, { backgroundColor: categoryBgColor }]}>
              <MaterialCommunityIcons
                name={getCategoryIcon(transaction.category) as any}
                size={40}
                color={categoryColor}
              />
            </View>

            <ThemedText style={[styles.categoryLabel, { color: secondaryTextColor }]}>
              {transaction.category.toUpperCase()}
            </ThemedText>

            <View style={styles.amountWrapper}>
              <ThemedText style={[styles.amount, { color: categoryColor }]}>
                {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </ThemedText>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: transaction.status === 'paid' ? '#DCFCE7' : transaction.status === 'pending' ? '#FEF3C7' : '#FEE2E2' }]}>
              <ThemedText style={[styles.statusBadgeText, { color: transaction.status === 'paid' ? '#16A34A' : transaction.status === 'pending' ? '#CA8A04' : '#DC2626' }]}>
                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </ThemedText>
            </View>
          </View>

          {/* Property Information */}
          {(transaction.propertyAddress || transaction.propertyName) && (
            <View style={[styles.infoCard, { backgroundColor: cardBgColor, borderColor }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="home" size={20} color={primaryColor} />
                <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                  Property Information
                </ThemedText>
              </View>

              <View style={styles.infoItems}>
                {transaction.propertyName && (
                  <>
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                        Property
                      </ThemedText>
                      <ThemedText style={[styles.infoValue, { color: textColor }]}>
                        {transaction.propertyName}
                      </ThemedText>
                    </View>
                    {transaction.propertyAddress && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
                  </>
                )}

                {transaction.propertyAddress && (
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                      Address
                    </ThemedText>
                    <ThemedText style={[styles.infoValue, { color: textColor, textAlign: 'right', maxWidth: '60%' }]}>
                      {transaction.propertyAddress}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Tenant Information */}
          {transaction.tenantName && (
            <View style={[styles.infoCard, { backgroundColor: cardBgColor, borderColor }]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="account" size={20} color={primaryColor} />
                <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                  Tenant Information
                </ThemedText>
              </View>

              <View style={styles.infoItems}>
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                    Name
                  </ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textColor }]}>
                    {transaction.tenantName}
                  </ThemedText>
                </View>

                <View style={[styles.divider, { backgroundColor: borderColor }]} />

                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                    Email
                  </ThemedText>
                  <ThemedText style={[styles.infoValue, { color: textColor }]}>
                    {transaction.tenantEmail}
                  </ThemedText>
                </View>

                {transaction.unitInfo && (
                  <>
                    <View style={[styles.divider, { backgroundColor: borderColor }]} />
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                        Unit
                      </ThemedText>
                      <ThemedText style={[styles.infoValue, { color: textColor }]}>
                        {transaction.unitInfo}
                      </ThemedText>
                    </View>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Transaction Details */}
          <View style={[styles.infoCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="receipt" size={20} color={primaryColor} />
              <ThemedText style={[styles.cardTitle, { color: textColor }]}>
                Transaction Details
              </ThemedText>
            </View>

            <View style={styles.infoItems}>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Category
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                  {transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1)}
                </ThemedText>
              </View>

              <View style={[styles.divider, { backgroundColor: borderColor }]} />

              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Type
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: primaryColor }]}>
                  {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                </ThemedText>
              </View>

              <View style={[styles.divider, { backgroundColor: borderColor }]} />

              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                  Date
                </ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>
                  {new Date(transaction.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </ThemedText>
              </View>

              {transaction.service_type && (
                <>
                  <View style={[styles.divider, { backgroundColor: borderColor }]} />
                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>
                      Service Type
                    </ThemedText>
                    <ThemedText style={[styles.infoValue, { color: textColor }]}>
                      {transaction.service_type}
                    </ThemedText>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
              <MaterialCommunityIcons name="share-variant" size={20} color={textColor} />
              <ThemedText style={[styles.actionButtonText, { color: textColor }]}>
                Share
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: primaryColor }]}>
              <MaterialCommunityIcons name="download" size={20} color="#ffffff" />
              <ThemedText style={[styles.actionButtonText, { color: '#ffffff' }]}>
                Receipt
              </ThemedText>
            </TouchableOpacity>
          </View>
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
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  mainCard: {
    borderRadius: 32,
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    overflow: 'hidden',
  },
  categoryIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  amountWrapper: {
     width: '100%',
  paddingHorizontal: 8,
  },
  description: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: '90%',
  },
  amount: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
     flexShrink: 1, 
  },
  statusContainer: {
    width: '100%',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoItems: {
    gap: 0,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
