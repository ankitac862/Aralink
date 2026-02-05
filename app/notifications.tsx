import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { fetchTenantNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/supabase';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const unreadBgColor = isDark ? '#1e3a5f' : '#eff6ff';

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [user])
  );

  const loadNotifications = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    const data = await fetchTenantNotifications(user.id);
    setNotifications(data);
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications(notifications.map(n => 
      n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
    ));
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    await markAllNotificationsAsRead(user.id);
    setNotifications(notifications.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.type === 'invite') {
      router.push('/invite');
    } else if (notification.type === 'maintenance') {
      router.push('/maintenance');
    } else if (notification.type === 'lease') {
      router.push('/leases');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invite':
        return 'email-outline';
      case 'maintenance':
        return 'tools';
      case 'lease':
        return 'file-document-outline';
      case 'payment':
        return 'cash';
      case 'announcement':
        return 'bullhorn';
      default:
        return 'bell';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Notifications</ThemedText>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: primaryColor }]}>
              <ThemedText style={styles.badgeText}>{unreadCount}</ThemedText>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <ThemedText style={[styles.markAllRead, { color: primaryColor }]}>Mark all read</ThemedText>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 24 }} />}
      </View>

      {isLoading && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={primaryColor} />
          }>
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bell-off-outline" size={64} color={textSecondaryColor} />
              <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
                No notifications yet
              </ThemedText>
            </View>
          ) : (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: notification.is_read ? cardBgColor : unreadBgColor,
                    borderColor,
                  },
                ]}
                onPress={() => handleNotificationPress(notification)}>
                <View style={[styles.iconContainer, { backgroundColor: `${primaryColor}20` }]}>
                  <MaterialCommunityIcons
                    name={getNotificationIcon(notification.type) as any}
                    size={24}
                    color={primaryColor}
                  />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <ThemedText style={[styles.notificationTitle, { color: textPrimaryColor }]}>
                      {notification.title}
                    </ThemedText>
                    {!notification.is_read && (
                      <View style={[styles.unreadDot, { backgroundColor: primaryColor }]} />
                    )}
                  </View>
                  <ThemedText style={[styles.notificationMessage, { color: textSecondaryColor }]}>
                    {notification.message}
                  </ThemedText>
                  <ThemedText style={[styles.notificationDate, { color: textSecondaryColor }]}>
                    {formatDate(notification.created_at)}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  markAllRead: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
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
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconContainer: {
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
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
    opacity: 0.7,
  },
});
