import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import messageService from '@/services/messageService';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

interface Landlord {
  id: string;
  email: string;
  name: string;
}

export default function TenantStartChatScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const primaryColor = '#4A90E2';

  useEffect(() => {
    loadLandlords();
  }, []);

  const loadLandlords = async () => {
    try {
      setLoading(true);
      if (!user?.email) return;

      // Find all properties where this tenant is assigned
      // Then get the landlords of those properties
      const { data: tenantRecords, error: tenantError } = await supabase
        .from('tenants')
        .select('id, property_id')
        .eq('email', user.email);

      if (tenantError) {
        console.error('Error fetching tenant records:', tenantError);
        setLoading(false);
        return;
      }

      if (!tenantRecords || tenantRecords.length === 0) {
        console.log('No tenant records found for this email');
        setLoading(false);
        return;
      }

      // Get unique property IDs
      const propertyIds = [...new Set(tenantRecords.map((t) => t.property_id))];

      // Get landlords for these properties
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('landlord_id')
        .in('id', propertyIds);

      if (propError) {
        console.error('Error fetching properties:', propError);
        setLoading(false);
        return;
      }

      // Get unique landlord IDs and fetch their profiles
      const landlordIds = [...new Set(properties?.map((p) => p.landlord_id) || [])];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', landlordIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        setLoading(false);
        return;
      }

      const landlordList = (profiles || []).map((p) => ({
        id: p.id,
        email: p.email,
        name: p.full_name || 'Landlord',
      }));

      setLandlords(landlordList);
    } catch (error) {
      console.error('Error loading landlords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (landlord: Landlord) => {
    if (!user) return;

    try {
      console.log('💬 Tenant starting chat with landlord:', {
        tenantId: user.id,
        landlordId: landlord.id,
      });

      setMessagingId(landlord.id);

      // Get the first tenant record for this email to use as tenant_record_id
      const { data: tenantRecords } = await supabase
        .from('tenants')
        .select('id, property_id')
        .eq('email', user.email)
        .limit(1);

      if (!tenantRecords || tenantRecords.length === 0) {
        throw new Error('Tenant record not found');
      }

      const tenantRecord = tenantRecords[0];

      const conversation = await messageService.getOrCreateConversation(
        tenantRecord.property_id,
        tenantRecord.id, // tenant_record_id
        landlord.id,
        user.name || user.email || 'Tenant',
        landlord.name,
        undefined,
        undefined
      );

      console.log('💬 Got conversation:', {
        conversationId: conversation.id,
      });

      setMessagingId(null);
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      setMessagingId(null);
      console.error('Error starting chat:', error);
    }
  };

  const renderLandlord = ({ item }: { item: Landlord }) => {
    const isLoading = messagingId === item.id;

    return (
      <TouchableOpacity
        onPress={() => handleStartChat(item)}
        disabled={isLoading}
        style={[
          styles.landlordCard,
          { backgroundColor: cardBgColor, opacity: isLoading ? 0.6 : 1 },
        ]}>
        <View style={[styles.avatar, { backgroundColor: primaryColor + '20' }]}>
          <MaterialCommunityIcons name="home" size={32} color={primaryColor} />
        </View>

        <View style={styles.landlordContent}>
          <ThemedText style={[styles.landlordName, { color: textPrimaryColor }]}>
            {item.name}
          </ThemedText>
          <ThemedText style={[styles.landlordEmail, { color: textSecondaryColor }]}>
            {item.email}
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
        name="home-outline"
        size={64}
        color={textSecondaryColor}
      />
      <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
        No landlords available
      </ThemedText>
      <ThemedText style={[styles.emptySubtext, { color: textSecondaryColor }]}>
        You don't have any properties assigned yet
      </ThemedText>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Message Your Landlord</ThemedText>
      </View>

      <FlatList
        data={landlords}
        renderItem={renderLandlord}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  landlordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  landlordContent: {
    flex: 1,
  },
  landlordName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  landlordEmail: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
});
