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
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const textColor = isDark ? '#FFFFFF' : '#111315';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.logoContainer}>
        <View style={[styles.logo, { backgroundColor: isDark ? '#26282C' : '#E8E8EA' }]}>
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
        color={textColor} 
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
