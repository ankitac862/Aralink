import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { acceptInvite, declineInvite, getInviteDetails, InviteDetails } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { user, isInitialized } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardColor = isDark ? '#111827' : '#ffffff';
  const borderColor = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#f9fafb' : '#0f172a';
  const secondaryText = isDark ? '#94a3b8' : '#64748b';
  const primaryColor = '#137fec';

  const addressLine = useMemo(() => {
    if (!inviteDetails?.property) return '';
    const { address1, address2, city, state, zipCode } = inviteDetails.property;
    return [address1, address2, city, state, zipCode].filter(Boolean).join(', ');
  }, [inviteDetails]);

  useEffect(() => {
    if (token) {
      AsyncStorage.setItem('pendingInviteToken', token);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !isInitialized) return;
    if (!user) {
      setInviteDetails(null);
      return;
    }

    const loadInvite = async () => {
      setIsLoading(true);
      setError(null);
      const details = await getInviteDetails({ token });
      if (!details) {
        setError('Unable to load invite details.');
      }
      setInviteDetails(details);
      setIsLoading(false);
    };

    loadInvite();
  }, [token, user, isInitialized]);

  const handleAccept = async () => {
    if (!token) return;
    setIsLoading(true);
    const result = await acceptInvite(token);
    setIsLoading(false);
    if (!result) {
      Alert.alert('Error', 'Could not accept invite. Please try again.');
      return;
    }
    setActionStatus(result.inviteStatus);
    await AsyncStorage.removeItem('pendingInviteToken');
  };

  const handleDecline = async () => {
    if (!token) return;
    setIsLoading(true);
    const result = await declineInvite(token);
    setIsLoading(false);
    if (!result) {
      Alert.alert('Error', 'Could not decline invite. Please try again.');
      return;
    }
    setActionStatus(result.inviteStatus);
    await AsyncStorage.removeItem('pendingInviteToken');
  };

  const handleSignIn = () => {
    router.push('/(auth)');
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
        <ThemedText style={[styles.title, { color: textColor }]}>Property Invite</ThemedText>

        {!token && (
          <ThemedText style={[styles.body, { color: secondaryText }]}>
            Missing invite token.
          </ThemedText>
        )}

        {token && !user && (
          <>
            <ThemedText style={[styles.body, { color: secondaryText }]}>
              Please sign in with the invited email to view the property details.
            </ThemedText>
            <TouchableOpacity style={[styles.button, { backgroundColor: primaryColor }]} onPress={handleSignIn}>
              <ThemedText style={styles.buttonText}>Sign in</ThemedText>
            </TouchableOpacity>
          </>
        )}

        {user && (
          <>
            {isLoading && <ActivityIndicator size="small" color={primaryColor} />}
            {error && <ThemedText style={[styles.body, { color: '#ef4444' }]}>{error}</ThemedText>}
            {inviteDetails && (
              <>
                <ThemedText style={[styles.label, { color: secondaryText }]}>Property Address</ThemedText>
                <View style={[styles.field, { borderColor }]}>
                  <ThemedText style={[styles.fieldText, { color: textColor }]}>{addressLine}</ThemedText>
                </View>
                {inviteDetails.landlord?.name && (
                  <>
                    <ThemedText style={[styles.label, { color: secondaryText }]}>Landlord</ThemedText>
                    <ThemedText style={[styles.body, { color: textColor }]}>
                      {inviteDetails.landlord.name}
                    </ThemedText>
                  </>
                )}
                {actionStatus && actionStatus === 'accepted' && (
                  <>
                    <ThemedText style={[styles.body, { color: secondaryText }]}>
                      Invite accepted! You can now submit an application for this property.
                    </ThemedText>
                    <TouchableOpacity 
                      style={[styles.button, { backgroundColor: primaryColor, marginTop: 12 }]} 
                      onPress={() => router.push({
                        pathname: '/tenant-lease-start',
                        params: { 
                          propertyId: inviteDetails.property?.id,
                          address: addressLine,
                          fromInvite: 'true'
                        }
                      })}
                    >
                      <ThemedText style={styles.buttonText}>Start Application</ThemedText>
                    </TouchableOpacity>
                  </>
                )}
                {actionStatus && actionStatus !== 'accepted' && (
                  <ThemedText style={[styles.body, { color: secondaryText }]}>
                    Invite status: {actionStatus}
                  </ThemedText>
                )}
                {!actionStatus && inviteDetails.inviteStatus === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.button, styles.accept, { backgroundColor: primaryColor }]} onPress={handleAccept}>
                      <ThemedText style={styles.buttonText}>Accept</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.decline, { borderColor }]} onPress={handleDecline}>
                      <ThemedText style={[styles.buttonText, { color: textColor }]}>Decline</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  field: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  fieldText: {
    fontSize: 16,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  accept: {
    borderWidth: 0,
  },
  decline: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
