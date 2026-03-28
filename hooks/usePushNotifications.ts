import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

// Configure notification handler — show alert, play sound, set badge
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const [notification, setNotification] = useState<Notifications.Notification | undefined>();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);
      if (token && user?.id) {
        savePushToken(token, user.id);
      }
    });

    // ── Foreground: notification received while app is open ──────────────────
    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      console.log('📬 Notification received:', notif);
      setNotification(notif);
    });

    // ── User tapped a notification (background / killed / foreground) ─────────
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>;
      console.log('👆 Notification tapped:', data);
      handleNotificationNavigation(data, router);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.id]);

  return { expoPushToken, notification };
}

/**
 * Navigate to the correct screen based on the notification's data payload.
 * Keep this in sync with the `data.type` values set in each edge function.
 */
function handleNotificationNavigation(
  data: Record<string, any>,
  router: ReturnType<typeof useRouter>
) {
  const type = (data?.type || '').toLowerCase();

  try {
    // ── Chat message ─────────────────────────────────────────────────────────
    if (type === 'chat_message' && data.conversationId) {
      router.push(`/chat/${data.conversationId}` as any);
      return;
    }

    // ── Lease (tenant received / landlord countersign) ────────────────────────
    if (type === 'lease_received' && data.leaseId) {
      router.push(`/tenant-lease-detail?id=${data.leaseId}` as any);
      return;
    }
    if (type === 'lease' && data.leaseId) {
      // Landlord: pending countersign, open full lease list
      router.push('/leases' as any);
      return;
    }

    // ── Rental application ────────────────────────────────────────────────────
    if (type === 'application' && data.applicationId) {
      router.push(
        `/landlord-application-review?id=${data.applicationId}` as any
      );
      return;
    }

    // ── Maintenance request (landlord) ────────────────────────────────────────
    if (type === 'maintenance_request' && data.requestId) {
      router.push(`/landlord-maintenance-detail?id=${data.requestId}` as any);
      return;
    }

    // ── Maintenance status update (tenant) ────────────────────────────────────
    if (type === 'maintenance_status_update' && data.requestId) {
      router.push(`/tenant-maintenance-detail?id=${data.requestId}` as any);
      return;
    }

    // ── Move-in date change request ───────────────────────────────────────────
    if (type === 'arrival_date_change_request' && data.leaseId) {
      router.push('/leases' as any);
      return;
    }

    // ── Fallback: open notifications screen ───────────────────────────────────
    router.push('/notifications' as any);
  } catch (navError) {
    console.error('⚠️ Navigation from push notification failed:', navError);
  }
}

async function registerForPushNotificationsAsync() {
  // Push notifications are not supported on web without VAPID keys — skip entirely
  if (Platform.OS === 'web') {
    console.log('ℹ️ Push notifications not supported on web');
    return undefined;
  }

  let token: string | undefined;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4A90E2',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('⚠️ Failed to get push token for push notification!');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('📱 Push token:', token);
  } else {
    console.log('⚠️ Must use physical device for Push Notifications');
  }

  return token;
}

async function savePushToken(token: string, userId: string) {
  try {
    const platform = Platform.OS;
    const deviceId = Device.modelName || 'unknown';

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          device_id: deviceId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      // Use console.warn instead of console.error to prevent red LogBox in Expo during development,
      // as some older users might legitimately be missing a profiles row due to migrations.
      console.warn('⚠️ Error saving push token:', error.message || error);
    } else {
      console.log('✅ Push token saved');
    }
  } catch (error) {
    console.warn('⚠️ Error saving push token exception:', error);
  }
}
