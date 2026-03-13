import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';

export const unstable_settings = {
  anchor: 'splash', // Start with splash while auth initializes
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { initialize, isInitialized, user, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize auth on app start
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isInitialized || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    const isInviteRoute = segments[0] === 'invite';

    if (!user && !inAuthGroup && !isInviteRoute) {
      // User is not authenticated and not in auth group, redirect to auth
      router.replace('/(auth)');
    } else if (user && inAuthGroup) {
      // User is authenticated but in auth group, redirect to appropriate dashboard
      if (user.role === 'tenant') {
        router.replace('/(tabs)/tenant-dashboard');
      } else {
        router.replace('/(tabs)/landlord-dashboard');
      }
    } else if (user && !inAuthGroup && !isInviteRoute) {
      (async () => {
        const pendingToken = await AsyncStorage.getItem('pendingInviteToken');
        if (pendingToken) {
          router.replace(`/invite?token=${encodeURIComponent(pendingToken)}`);
        }
      })();
    }
  }, [user, segments, isInitialized, isLoading, router]);

  // Web font optimization - add font-display: swap to prevent FCP warnings
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        @font-face {
          font-family: system-ui;
          font-display: swap;
        }
      `;
      if (!document.getElementById('font-display-optimization')) {
        style.id = 'font-display-optimization';
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="splash" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="properties" />
        <Stack.Screen name="tenants" />
        <Stack.Screen name="leases" />
        <Stack.Screen name="accounting" />
        <Stack.Screen name="maintenance" />
        <Stack.Screen name="applicants" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="property-detail" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tenant-detail" options={{ presentation: 'modal' }} />
        <Stack.Screen name="maintenance-detail" options={{ presentation: 'modal' }} />
        <Stack.Screen name="applicant-detail" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invoice-detail" options={{ presentation: 'modal' }} />
        
        {/* Add Property/Unit/Room/Tenant/Transaction Routes */}
        <Stack.Screen name="add-property" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-unit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-room" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-tenant" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-transaction" options={{ presentation: 'modal' }} />
        
        {/* Lease Application Routes */}
        <Stack.Screen name="tenant-lease-start" />
        <Stack.Screen name="tenant-lease-step1" />
        <Stack.Screen name="tenant-lease-step2" />
        <Stack.Screen name="tenant-lease-step3" />
        <Stack.Screen name="tenant-lease-step4" />
        <Stack.Screen name="tenant-lease-step5" />
        <Stack.Screen name="tenant-lease-step6" />
        <Stack.Screen name="tenant-lease-submitted" />
        <Stack.Screen name="tenant-lease-status" />
        <Stack.Screen name="tenant-lease-review-sign" />
        
        {/* Tenant Lease Management Routes */}
        <Stack.Screen name="tenant-leases" />
        <Stack.Screen name="tenant-lease-detail" />
        
        {/* Landlord Lease Routes */}
        <Stack.Screen name="landlord-applications" />
        <Stack.Screen name="landlord-application-review" />
        <Stack.Screen name="finalize-lease-terms" />
        <Stack.Screen name="lease-preview" />
        <Stack.Screen name="lease-sent" />

        {/* Maintenance Flow Routes */}
        <Stack.Screen name="tenant-maintenance-request" />
        <Stack.Screen name="tenant-maintenance-confirmation" />
        <Stack.Screen name="tenant-maintenance-status" />
        <Stack.Screen name="tenant-maintenance-detail" />
        <Stack.Screen name="landlord-maintenance-overview" />
        <Stack.Screen name="landlord-maintenance-detail" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
