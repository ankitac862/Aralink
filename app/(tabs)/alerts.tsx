import React, { useState, useEffect } from 'react';
import {
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  AppState,
  AppStateStatus,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import {
  fetchTenantNotifications,
  fetchLandlordNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications,
  deleteNotification,
  fetchPropertyById,
} from '@/lib/supabase';

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

interface TypeConfig {
  icon: string;
  accent: string;
  bgLight: string;
  bgDark: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  invite:                    { icon: 'email-outline',           accent: '#7C3AED', bgLight: '#f5f3ff', bgDark: '#2d1f4e' },
  maintenance:               { icon: 'tools',                   accent: '#EA580C', bgLight: '#fff7ed', bgDark: '#3c1f0a' },
  maintenance_request:       { icon: 'tools',                   accent: '#EA580C', bgLight: '#fff7ed', bgDark: '#3c1f0a' },
  maintenance_status_update: { icon: 'wrench-check',            accent: '#EA580C', bgLight: '#fff7ed', bgDark: '#3c1f0a' },
  lease:                     { icon: 'file-document-outline',   accent: '#2563EB', bgLight: '#eff6ff', bgDark: '#1e3a5f' },
  lease_received:            { icon: 'file-document-outline',   accent: '#2563EB', bgLight: '#eff6ff', bgDark: '#1e3a5f' },
  lease_rejected:            { icon: 'file-cancel-outline',     accent: '#DC2626', bgLight: '#fef2f2', bgDark: '#3b1515' },
  application_approved:      { icon: 'clipboard-check-outline', accent: '#16A34A', bgLight: '#f0fdf4', bgDark: '#14321e' },
  application_rejected:      { icon: 'clipboard-remove-outline',accent: '#DC2626', bgLight: '#fef2f2', bgDark: '#3b1515' },
  payment:                   { icon: 'cash-check',              accent: '#16A34A', bgLight: '#f0fdf4', bgDark: '#14321e' },
  announcement:              { icon: 'bullhorn-outline',         accent: '#0891B2', bgLight: '#ecfeff', bgDark: '#0a2535' },
};

const DEFAULT_CONFIG: TypeConfig = { icon: 'bell-outline', accent: '#8E959B', bgLight: '#EDEDEF', bgDark: '#26282C' };

function getTypeConfig(type: string, data?: Record<string, any>): TypeConfig {
  if ((type === 'lease' || type === 'lease_received') && data?.lease_updated_resign === true) {
    return { icon: 'draw-pen', accent: '#D97706', bgLight: '#fffbeb', bgDark: '#3a2408' };
  }
  return TYPE_CONFIG[type] ?? DEFAULT_CONFIG;
}

function groupNotifications(notifications: Notification[]) {
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const thisWeek: Notification[] = [];
  const earlier: Notification[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (d >= todayStart) today.push(n);
    else if (d >= yesterdayStart) yesterday.push(n);
    else if (d >= weekStart) thisWeek.push(n);
    else earlier.push(n);
  }

  const groups: { label: string; items: Notification[] }[] = [];
  if (today.length)     groups.push({ label: 'Today', items: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
  if (thisWeek.length)  groups.push({ label: 'This Week', items: thisWeek });
  if (earlier.length)   groups.push({ label: 'Earlier', items: earlier });
  return groups;
}

function formatTime(dateString: string) {
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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AlertsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDark = colorScheme === 'dark';
  const bg        = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBg    = isDark ? '#1A1B1E' : '#FFFFFF';
  const border    = isDark ? '#26282C' : '#E5E5E7';
  const textPri   = isDark ? '#FFFFFF' : '#111315';
  const textSec   = isDark ? '#9BA1A6' : '#6E7377';
  const primary   = isDark ? '#FFFFFF' : '#111315';
  const onPrimary = isDark ? '#0B0B0C' : '#FFFFFF';

  const loadNotifications = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const isLM = user.role === 'landlord' || user.role === 'manager';
    const data = isLM
      ? await fetchLandlordNotifications(user.id)
      : await fetchTenantNotifications(user.id);
    setNotifications(data);
    setIsLoading(false);
  };

  useFocusEffect(
    React.useCallback(() => { loadNotifications(); }, [user?.id, user?.role])
  );

  // Reload when app returns from background
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        loadNotifications();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [user?.id, user?.role]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    await markAllNotificationsAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClearAll = () => {
    if (!user?.id) return;
    Alert.alert(
      'Clear All Notifications',
      'This will permanently delete all your notifications. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllNotifications(user.id);
            setNotifications([]);
          },
        },
      ]
    );
  };

  const handleMarkAsRead = (id: string) => {
    markNotificationAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    deleteNotification(id);
  };

  const parseData = (raw: unknown): Record<string, any> => {
    if (!raw) return {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    if (typeof raw === 'object') return raw as Record<string, any>;
    return {};
  };

  const handlePress = async (notif: Notification) => {
    if (!notif.is_read) handleMarkAsRead(notif.id);
    const data = parseData(notif.data);
    const propertyId   = data.propertyId   || data.property_id;
    const leaseId      = data.leaseId      || data.lease_id;
    const inviteId     = data.inviteId     || data.invite_id;
    const unitId       = data.unitId       || data.unit_id;
    const subUnitId    = data.subUnitId    || data.sub_unit_id || data.roomId;
    const requestId    = data.requestId    || data.request_id;
    const applicationId= data.applicationId|| data.application_id;
    const type  = (notif.type  || '').toLowerCase();
    const title = (notif.title || '').toLowerCase();

    const openLeaseStart = async (fromInvite: boolean) => {
      if (!propertyId) return false;
      let address = data.propertyAddress || data.property_address || '';
      if (!address) {
        const p = await fetchPropertyById(propertyId);
        if (p) address = [p.address1, p.city, p.state, p.zip_code].filter(Boolean).join(', ');
      }
      router.push({ pathname: '/tenant-lease-start', params: {
        propertyId, address: address || '',
        unitId: unitId || '', subUnitId: subUnitId || '',
        inviteId: inviteId || '', fromInvite: fromInvite || !!inviteId ? 'true' : 'false',
      }} as any);
      return true;
    };

    if (requestId || type.includes('maintenance') || title.includes('maintenance')) {
      const isLM = user?.role === 'landlord' || user?.role === 'manager';
      if (requestId) {
        router.push((isLM ? `/landlord-maintenance-detail?id=${requestId}` : `/tenant-maintenance-detail?id=${requestId}`) as any);
      } else {
        router.push((isLM ? '/landlord-maintenance-overview' : '/tenant-maintenance-status') as any);
      }
      return;
    }
    if (type === 'lease_rejected') { router.push((leaseId ? `/lease-detail?id=${leaseId}` : '/leases') as any); return; }
    if (leaseId || type === 'lease' || type === 'lease_received' || title.includes('lease agreement')) {
      router.push((leaseId ? `/tenant-lease-detail?id=${leaseId}` : '/tenant-leases') as any); return;
    }
    if (type === 'invite' || title.includes('invited to apply') || title.includes('invitation')) {
      if (propertyId) { await openLeaseStart(true); return; }
      router.push('/invite' as any); return;
    }
    if (type === 'application_approved' || type === 'application_rejected') {
      if (propertyId) { await openLeaseStart(false); return; }
      if (applicationId) { router.push('/tenant-lease-status' as any); return; }
    }
    if (propertyId && (type === 'announcement' || title.includes('assigned'))) {
      router.push('/(tabs)/tenant-dashboard' as any); return;
    }
    if (propertyId) { if (await openLeaseStart(false)) return; }
    if (applicationId) { router.push('/tenant-lease-status' as any); return; }
    if (title.includes('assigned') || title.includes('your property')) router.push('/(tabs)/tenant-dashboard' as any);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const groups = groupNotifications(notifications);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemedView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: border }]}>
        <View style={styles.headerLeft}>
          <ThemedText style={[styles.headerTitle, { color: textPri }]}>Notifications</ThemedText>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: primary }]}>
              <ThemedText style={[styles.badgeText, { color: onPrimary }]}>{unreadCount}</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={[styles.markAllBtn, { borderColor: primary }]} onPress={handleMarkAllAsRead}>
              <ThemedText style={[styles.markAllText, { color: primary }]}>Mark all read</ThemedText>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, notifications.length === 0 && styles.scrollEmpty]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={primary} />}
          showsVerticalScrollIndicator={false}>

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#222428' : '#EDEDEF' }]}>
                <MaterialCommunityIcons name="bell-sleep-outline" size={40} color={isDark ? '#9BA1A6' : '#6E7377'} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: textPri }]}>All caught up</ThemedText>
              <ThemedText style={[styles.emptyMsg, { color: textSec }]}>
                You have no notifications right now.{'\n'}Pull down to refresh.
              </ThemedText>
            </View>
          ) : (
            groups.map(group => (
              <View key={group.label}>
                {/* Group label */}
                <ThemedText style={[styles.groupLabel, { color: textSec }]}>{group.label}</ThemedText>

                {group.items.map(notif => {
                  const nData = parseData(notif.data);
                  const cfg = getTypeConfig(notif.type, nData);
                  const leaseUpdatedResign =
                    nData.lease_updated_resign === true ||
                    (notif.type === 'lease_received' && (notif.title || '').toLowerCase().includes('lease updated'));

                  return (
                    <ReanimatedSwipeable
                      key={notif.id}
                      overshootRight={false}
                      renderRightActions={() => (
                        <TouchableOpacity
                          style={styles.deleteAction}
                          onPress={() => handleDeleteNotification(notif.id)}>
                          <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
                        </TouchableOpacity>
                      )}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        style={[
                          styles.card,
                          { backgroundColor: cardBg, borderColor: border },
                          !notif.is_read && { borderLeftColor: cfg.accent, borderLeftWidth: 3 },
                        ]}
                        onPress={() => handlePress(notif)}>

                        {/* Icon circle */}
                        <View style={[styles.iconCircle, {
                          backgroundColor: isDark ? cfg.bgDark : cfg.bgLight,
                        }]}>
                          <MaterialCommunityIcons name={cfg.icon as any} size={22} color={cfg.accent} />
                        </View>

                        {/* Content */}
                        <View style={styles.cardBody}>
                          <View style={styles.cardTop}>
                            <View style={styles.titleRow}>
                              <ThemedText
                                style={[styles.cardTitle, { color: textPri }, !notif.is_read && { fontWeight: '700' }]}
                                numberOfLines={1}>
                                {notif.title}
                              </ThemedText>
                              {leaseUpdatedResign && (
                                <View style={[styles.resgnBadge, { backgroundColor: isDark ? '#3a2408' : '#fef3c7' }]}>
                                  <ThemedText style={[styles.resgnText, { color: isDark ? '#fde68a' : '#92400e' }]}>
                                    Sign again
                                  </ThemedText>
                                </View>
                              )}
                            </View>
                            <ThemedText style={[styles.time, { color: textSec }]}>
                              {formatTime(notif.created_at)}
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.cardMsg, { color: textSec }]} numberOfLines={2}>
                            {notif.message}
                          </ThemedText>
                        </View>

                        {/* Unread dot */}
                        {!notif.is_read && (
                          <View style={[styles.unreadDot, { backgroundColor: cfg.accent }]} />
                        )}
                      </TouchableOpacity>
                    </ReanimatedSwipeable>
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // States
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  scrollEmpty: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20, opacity: 0.8 },

  // Groups
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  resgnBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resgnText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  time: {
    fontSize: 12,
    flexShrink: 0,
    marginTop: 1,
  },
  cardMsg: {
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    marginBottom: 10,
    marginLeft: 8,
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
