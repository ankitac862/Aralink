import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { completeOAuthRedirect } from '@/store/authStore';

// Fallback landing screen for the `aralink://oauth-redirect` deep link.
// `signInWithGoogle` normally intercepts this redirect inside the in-app
// browser session, but on some Android builds the OS opens the link in the
// app itself before that happens — without this route, that shows an
// "Unmatched Route" error instead of completing sign-in.
export default function OAuthRedirectScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams<Record<string, string>>();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const textPrimaryColor = isDark ? '#FFFFFF' : '#111315';
  const textSecondaryColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    console.log('[GoogleAuth] oauth-redirect screen: mounted', params);

    const queryString = Object.entries(params)
      .filter(([key]) => key !== 'oauth-redirect')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    const redirectUrl = `aralink://oauth-redirect?${queryString}`;
    console.log('[GoogleAuth] oauth-redirect screen: reconstructed redirect URL', redirectUrl);

    completeOAuthRedirect(redirectUrl).then((result) => {
      console.log('[GoogleAuth] oauth-redirect screen: completeOAuthRedirect result', result);
      if (result.success) {
        router.replace('/');
      } else {
        setError(result.error || 'Google sign-in failed');
      }
    });
  }, [params, router]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {error ? (
        <View style={styles.content}>
          <ThemedText style={[styles.title, { color: textPrimaryColor }]}>
            Sign-in failed
          </ThemedText>
          <ThemedText style={[styles.message, { color: textSecondaryColor }]}>
            {error}
          </ThemedText>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: primaryColor }]}
            onPress={() => router.replace('/(auth)')}>
            <ThemedText style={[styles.buttonText, { color: onPrimaryColor }]}>Back to Login</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <ActivityIndicator size="large" color={primaryColor} />
          <ThemedText style={[styles.message, { color: textSecondaryColor }]}>
            Completing sign-in...
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
