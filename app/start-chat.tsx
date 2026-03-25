import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTenantStore } from '@/store/tenantStore';
import { usePropertyStore } from '@/store/propertyStore';
import messageService from '@/services/messageService';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

interface TenantListItem {
  id: string;
  userId?: string; // Auth user ID if tenant has signed up
  firstName: string;
  lastName: string;
  email: string;
  propertyId: string;
  propertyName?: string;
  phone?: string;
  source: 'tenant' | 'applicant';
  applicationId?: string;
}

export default function StartChatScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [people, setPeople] = useState<TenantListItem[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const { tenants: allTenants, loadFromSupabase: loadTenantsFromSupabase } = useTenantStore();
  const { getPropertyById, loadFromSupabase: loadPropertiesFromSupabase } = usePropertyStore();
  const { user } = useAuthStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const inputBgColor = isDark ? '#0f1620' : '#f5f5f5';
  const primaryColor = '#4A90E2';

  useEffect(() => {
    // Load store data when screen opens
    if (user?.id) {
      Promise.all([
        loadPropertiesFromSupabase(user.id),
        loadTenantsFromSupabase(user.id),
      ]).catch(err => console.error('Error loading store data:', err));
    }
  }, [user?.id]);

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    // Reload tenants when store data changes (properties or tenants loaded)
    loadTenants();
  }, [allTenants, getPropertyById]);

  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredPeople(people);
    } else {
      const filtered = people.filter((tenant) => {
        const fullName = `${tenant.firstName} ${tenant.lastName}`.toLowerCase();
        const search = searchText.toLowerCase();
        return (
          fullName.includes(search) ||
          tenant.email.toLowerCase().includes(search) ||
          tenant.propertyName?.toLowerCase().includes(search)
        );
      });
      setFilteredPeople(filtered);
    }
  }, [searchText, people]);

  const loadTenants = async () => {
    try {
      setLoading(true);

      const tenantList: TenantListItem[] = allTenants.map((tenant) => {
        const property = getPropertyById(tenant.propertyId);
        return {
          id: tenant.id,
          userId: (tenant as any).userId, // Get user_id if tenant has signed up
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          email: tenant.email,
          phone: tenant.phone,
          propertyId: tenant.propertyId,
          propertyName: property?.name || property?.address1 || 'Unknown Property',
          source: 'tenant',
        };
      });

      let applicantList: TenantListItem[] = [];
      if (user?.id) {
        const { data: propertyRows } = await supabase
          .from('properties')
          .select('id')
          .eq('user_id', user.id);

        const propertyIds = (propertyRows || []).map((p: any) => p.id);

        const { data: applicants } = await supabase
          .from('applications')
          .select('id, user_id, property_id, property_address, applicant_name, applicant_email, status')
          .in('status', ['submitted', 'under_review', 'approved', 'lease_ready'])
          .in('property_id', propertyIds.length > 0 ? propertyIds : ['00000000-0000-0000-0000-000000000000'])
          .order('created_at', { ascending: false });

        applicantList = (applicants || [])
          .filter((app: any) => !!app.applicant_email)
          .map((app: any) => {
            const property = app.property_id ? getPropertyById(app.property_id) : null;
            const names = (app.applicant_name || '').trim().split(/\s+/);
            const firstName = names[0] || app.applicant_email;
            const lastName = names.slice(1).join(' ') || '';
            return {
              id: `app-${app.id}`,
              userId: app.user_id || undefined,
              firstName,
              lastName,
              email: app.applicant_email,
              propertyId: app.property_id,
              propertyName: property?.name || app.property_address || property?.address1 || 'Unknown Property',
              source: 'applicant',
              applicationId: app.id,
            };
          });
      }

      const merged = [...tenantList, ...applicantList];
      setPeople(merged);
      setFilteredPeople(merged);
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (tenant: TenantListItem) => {
    if (!user) {
      return;
    }

    try {
      console.log('💬 handleStartChat - Starting conversation with person:', {
        tenantRecordId: tenant.id,
        tenantUserId: tenant.userId,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        source: tenant.source,
        applicationId: tenant.applicationId,
        propertyId: tenant.propertyId,
        landlordId: user.id,
      });

      setMessagingId(tenant.id);

      // Get tenant's user_id - either from tenant record or lookup by email
      let tenantUserId = tenant.userId;
      
      if (!tenantUserId) {
        // Look up tenant by email in profiles table
        const { supabase } = await import('@/lib/supabase');
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', tenant.email)
          .maybeSingle();
        
        if (profile) {
          tenantUserId = profile.id;
          console.log('✅ Found user_id from email:', tenantUserId);
        } else {
          Alert.alert(
            'Account Not Activated',
            tenant.source === 'applicant'
              ? 'Applicant has not activated their account yet. Send invitation first from the lease flow.'
              : 'Tenant has not signed up yet. They need to create an account first.'
          );
          setMessagingId(null);
          return;
        }
      }

      const conversation = await messageService.getOrCreateConversation(
        tenant.propertyId,
        tenantUserId, // Pass tenant's auth user ID
        user.id,
        `${tenant.firstName} ${tenant.lastName}`,
        user.name || 'You'
      );

      console.log('💬 Got conversation:', {
        conversationId: conversation.id,
      });

      setMessagingId(null);
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      setMessagingId(null);
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Could not start conversation. Please try again.');
    }
  };

  const renderTenant = ({ item }: { item: TenantListItem }) => {
    const isLoading = messagingId === item.id;

    return (
      <TouchableOpacity
        onPress={() => handleStartChat(item)}
        disabled={isLoading}
        style={[
          styles.tenantCard,
          { backgroundColor: cardBgColor, opacity: isLoading ? 0.6 : 1 },
        ]}>
        <View style={[styles.avatar, { backgroundColor: primaryColor + '20' }]}>
          <MaterialCommunityIcons name="account" size={32} color={primaryColor} />
        </View>

        <View style={styles.tenantContent}>
          <ThemedText style={[styles.tenantName, { color: textPrimaryColor }]}>
            {item.firstName} {item.lastName}
          </ThemedText>
          <ThemedText style={[styles.tenantProperty, { color: item.source === 'applicant' ? '#f59e0b' : textSecondaryColor }]}> 
            {item.source === 'applicant' ? 'Applicant' : 'Tenant'}
          </ThemedText>
          <ThemedText style={[styles.tenantEmail, { color: textSecondaryColor }]}>
            {item.email}
          </ThemedText>
          <ThemedText style={[styles.tenantProperty, { color: textSecondaryColor }]}>
            {item.propertyName}
          </ThemedText>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={textSecondaryColor}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="account-multiple-outline"
        size={64}
        color={textSecondaryColor}
      />
      <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
        {searchText ? 'No people found' : 'No tenants or applicants available'}
      </ThemedText>
      {!searchText && (
        <ThemedText style={[styles.emptySubtext, { color: textSecondaryColor }]}>
          Add or approve applicants to start messaging
        </ThemedText>
      )}
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
              borderBottomColor: borderColor,
            },
          ]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={textPrimaryColor}
            />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
            Start Chat
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: borderColor,
            borderBottomWidth: 1,
          },
        ]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={textPrimaryColor}
          />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
          Start Chat
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={textSecondaryColor}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            styles.searchInput,
            {
              color: textPrimaryColor,
              backgroundColor: inputBgColor,
              borderColor: borderColor,
            },
          ]}
          placeholder="Search tenants..."
          placeholderTextColor={textSecondaryColor}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <MaterialCommunityIcons
              name="close-circle"
              size={20}
              color={textSecondaryColor}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Tenants List */}
      {filteredPeople.length > 0 ? (
        <FlatList
            data={filteredPeople}
          renderItem={renderTenant}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        renderEmptyState()
      )}
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  listContent: {
    padding: 12,
  },
  tenantCard: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tenantContent: {
    flex: 1,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tenantEmail: {
    fontSize: 12,
    marginBottom: 4,
  },
  tenantProperty: {
    fontSize: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 8,
    textAlign: 'center',
  },
});
