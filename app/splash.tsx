import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reanimated specifically requires a catch handler */
});

export default function SplashRoute() {
  const colorScheme = useColorScheme();
  const { isInitialized } = useAuthStore();

  // Hide splash screen when auth is initialized
  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync().catch(() => {
        // Splash already hidden
      });
    }
  }, [isInitialized]);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const textColor = isDark ? '#F4F6F8' : '#111827';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.logoContainer}>
        <View style={styles.logo}>
          <ThemedText style={styles.logoText}>🏠</ThemedText>
        </View>
        <ThemedText style={[styles.appName, { color: textColor }]}>
          Aralink
        </ThemedText>
        <ThemedText style={[styles.tagline, { color: textColor, opacity: 0.7 }]}>
          Your Rental Home, Managed
        </ThemedText>
      </View>
      <ActivityIndicator 
        size="large" 
        color="#2A64F5" 
        style={styles.loader}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#2A64F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
  },
  loader: {
    position: 'absolute',
    bottom: 100,
  },
});
