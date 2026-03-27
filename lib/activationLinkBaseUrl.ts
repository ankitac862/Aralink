import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Base URL for emailed web activation links.
 *
 * On web, uses the current browser origin so the port matches whatever Metro is using
 * (e.g. :8081 vs :3000) without editing .env each time.
 *
 * On native dev, tries Expo's dev-server host so LAN links work when set.
 * Otherwise uses EXPO_PUBLIC_APP_URL, or null (caller uses aralink:// deep link).
 */
export function getActivationLinkBaseUrl(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location?.origin;
    if (origin && /^https?:\/\//i.test(origin)) {
      return origin.replace(/\/+$/, '');
    }
  }

  const fromEnv = process.env.EXPO_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      if (/^https?:\/\//i.test(hostUri)) {
        try {
          const u = new URL(hostUri);
          return `${u.protocol}//${u.host}`.replace(/\/+$/, '');
        } catch {
          // fall through
        }
      }
      if (/^exp(s)?:\/\//i.test(hostUri)) {
        const rest = hostUri.replace(/^exp(s)?:\/\//i, '');
        const hostPort = rest.split('/')[0];
        if (hostPort) {
          return `http://${hostPort}`.replace(/\/+$/, '');
        }
      }
      const hostPart = hostUri.split('/')[0];
      if (hostPart && !hostPart.includes('://')) {
        return `http://${hostPart}`.replace(/\/+$/, '');
      }
    }
  }

  return null;
}
