import { Tabs, useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import { useEffect } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WebNavbar } from '@/components/web-navbar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';

type UserRole = 'landlord' | 'manager' | 'tenant' | null;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isInitialized } = useAuthStore();
  const router = useRouter();
  const userRole = (user?.role as UserRole) ?? 'tenant';

  useEffect(() => {
    if (isInitialized && user?.role === 'ara_partner') {
      router.replace('/ara-partner/dashboard' as any);
    }
  }, [isInitialized, user?.role]);

  if (!isInitialized) {
    return null;
  }

  if (user?.role === 'ara_partner') {
    return null;
  }

  const isLandlordOrManager = userRole === 'landlord' || userRole === 'manager' ? true : false;
  const isWeb = Platform.OS === 'web';
  const borderColor = colorScheme === 'dark' ? '#394a57' : '#E5E7EB';

  // Define navigation items based on user role
  const navItems = [
    {
      name: 'dashboard',
      label: 'Dashboard',
      icon: 'home',
      href: isLandlordOrManager ? 'landlord-dashboard' : 'tenant-dashboard',
    },
    {
      name: 'messages',
      label: 'Messages',
      icon: 'message',
      href: 'messages',
    },
    {
      name: 'alerts',
      label: 'Alerts',
      icon: 'bell',
      href: 'alerts',
    },
    {
      name: 'settings',
      label: 'Settings',
      icon: 'cog',
      href: 'settings',
    },
  ];

  const tabs = (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: isWeb
            ? { display: 'none' }
            : {
                borderTopWidth: 0,
                borderBottomWidth: 1,
                borderBottomColor: borderColor,
                height: 60,
              },
        }}>
        <Tabs.Screen
          name="landlord-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            href: isLandlordOrManager ? undefined : null,
          }}
        />
        <Tabs.Screen
          name="tenant-dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            href: isLandlordOrManager ? null : undefined,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="message.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="bell.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="gear" color={color} />,
          }}
        />
      </Tabs>
  );

  // Expo Router requires <Tabs> at the layout root on mobile.
  // For web, wrap with the navbar; on mobile return <Tabs> directly.
  if (isWeb) {
    return (
      <View style={{ flex: 1 }}>
        <WebNavbar items={navItems} userRole={userRole!} />
        {tabs}
      </View>
    );
  }

  return tabs;
}
