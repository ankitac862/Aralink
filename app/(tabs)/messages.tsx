import React, { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import messageService, { Conversation } from '@/services/messageService';
import { useUserRole } from '@/hooks/use-user-role';
import { useAuth } from '@/hooks/use-auth';

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userRole = useUserRole();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const primaryColor = '#4A90E2';

  // Reload conversations when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 Messages screen focused - reloading conversations');
      loadConversations();
    }, [])
  );

  useEffect(() => {
    loadConversations();

    // Subscribe to new conversations
    const sub = messageService.subscribeToConversations((conv) => {
      console.log('📨 New conversation received via subscription:', conv.id);
      setConversations((prev) => {
        const existing = prev.findIndex((c) => c.id === conv.id);
        if (existing > -1) {
          const updated = [...prev];
          updated[existing] = conv;
          console.log('✏️ Updated existing conversation:', conv.id);
          return updated.sort(
            (a, b) =>
              new Date(b.last_message_at || 0).getTime() -
              new Date(a.last_message_at || 0).getTime()
          );
        }
        console.log('➕ Added new conversation:', conv.id);
        return [conv, ...prev];
      });
    });

    setSubscription(sub);

    return () => {
      if (sub) {
        messageService.unsubscribe(sub);
      }
    };
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      console.log('📡 Loading conversations...');
      const data = await messageService.getConversations();
      console.log('✅ Loaded conversations:', data.length);
      setConversations(data);
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const handleStartNewChat = () => {
    // Tenants go to tenant-start-chat, landlords go to start-chat
    if (userRole === 'tenant') {
      router.push('/tenant-start-chat');
    } else {
      router.push('/start-chat');
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const totalUnread =
      item.tenant_unread_count +
      item.landlord_unread_count +
      item.manager_unread_count;

    // Show the OTHER person's name (not current user's name)
    let displayName = 'Unknown';
    if (user?.id === item.tenant_id) {
      // Current user is tenant, show landlord's name
      displayName = item.landlord_name || item.manager_name || 'Landlord';
    } else if (user?.id === item.landlord_id) {
      // Current user is landlord, show tenant's name
      displayName = item.tenant_name || 'Tenant';
    } else if (user?.id === item.manager_id) {
      // Current user is manager, show tenant's name
      displayName = item.tenant_name || 'Tenant';
    }

    const lastMessageTime = item.last_message_at
      ? new Date(item.last_message_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : '';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/chat/${item.id}`)}
        style={[styles.conversationCard, { backgroundColor: cardBgColor }]}>
        <View style={[styles.avatar, { backgroundColor: primaryColor + '20' }]}>
          <MaterialCommunityIcons
            name="account-circle"
            size={40}
            color={primaryColor}
          />
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <ThemedText style={[styles.name, { color: textPrimaryColor }]}>
              {displayName}
            </ThemedText>
            <ThemedText style={[styles.timestamp, { color: textSecondaryColor }]}>
              {lastMessageTime}
            </ThemedText>
          </View>
          <ThemedText
            numberOfLines={1}
            style={[styles.lastMessage, { color: textSecondaryColor }]}>
            {item.last_message || 'No messages yet'}
          </ThemedText>
        </View>

        {totalUnread > 0 && (
          <View style={[styles.badge, { backgroundColor: '#FF6B6B' }]}>
            <ThemedText style={styles.badgeText}>{totalUnread}</ThemedText>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: bgColor,
              paddingTop: insets.top + 12,
              paddingBottom: 12,
              borderBottomColor: borderColor,
            },
          ]}>
          <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
            Messages
          </ThemedText>
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
            backgroundColor: bgColor,
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            borderBottomColor: borderColor,
            borderBottomWidth: 1,
          },
        ]}>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
          Messages
        </ThemedText>
        <TouchableOpacity 
          onPress={handleStartNewChat}
          style={styles.newChatButton}>
          <MaterialCommunityIcons
            name="plus"
            size={24}
            color={primaryColor}
          />
        </TouchableOpacity>
      </View>

      {/* Conversations list or empty state */}
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="message-outline"
            size={64}
            color={textSecondaryColor}
          />
          <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
            No messages yet
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: textSecondaryColor }]}>
            Your conversations will appear here
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={primaryColor}
            />
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  newChatButton: {
    padding: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  conversationCard: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  lastMessage: {
    fontSize: 13,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

