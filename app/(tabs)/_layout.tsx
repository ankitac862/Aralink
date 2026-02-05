import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WebNavbar } from '@/components/web-navbar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type UserRole = 'landlord' | 'manager' | 'tenant' | null;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUserRole = async () => {
      try {
        const role = await AsyncStorage.getItem('userRole');
        setUserRole((role as UserRole) || 'tenant'); // default to tenant
      } catch (error) {
        console.error('Failed to get user role:', error);
        setUserRole('tenant');
      } finally {
        setLoading(false);
      }
    };

    getUserRole();
  }, []);

  if (loading) {
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

  return (
    <View style={{ flex: 1 }}>
      {/* Web Navbar (Top) */}
      {isWeb && <WebNavbar items={navItems} userRole={userRole!} />}

      {/* Mobile/Web Tabs */}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          // Hide tab bar on web
          tabBarStyle: isWeb
            ? { display: 'none' }
            : {
                borderTopWidth: 0,
                borderBottomWidth: 1,
                borderBottomColor: borderColor,
                height: 60,
              },
        }}>
        {/* Tab 1: Dashboard - Role based (changes based on user type) */}
        {isLandlordOrManager ? (
          <Tabs.Screen
            name="landlord-dashboard"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            }}
          />
        ) : (
          <Tabs.Screen
            name="tenant-dashboard"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            }}
          />
        )}

        {/* Tab 2: Messages (for all users) */}
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="message.fill" color={color} />,
          }}
        />

        {/* Tab 3: Notifications (for all users) */}
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="bell.fill" color={color} />,
          }}
        />

        {/* Tab 4: Settings (for all users) */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="gear" color={color} />,
          }}
        />

        {/* Hide unused dashboard from tabs */}
        {isLandlordOrManager && (
          <Tabs.Screen
            name="tenant-dashboard"
            options={{
              href: null, // Hide from tabs
            }}
          />
        )}
        {!isLandlordOrManager && (
          <Tabs.Screen
            name="landlord-dashboard"
            options={{
              href: null, // Hide from tabs
            }}
          />
        )}
      </Tabs>
    </View>
  );
}
