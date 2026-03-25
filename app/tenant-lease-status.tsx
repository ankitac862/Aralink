import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { fetchApplicantLeaseOverview, DbLease } from '@/lib/supabase';

function leaseStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft — landlord preparing';
    case 'generated':
    case 'uploaded':
      return 'Lease document ready — not sent yet';
    case 'sent':
      return 'With you — signature needed';
    case 'signed':
      return 'You signed — awaiting landlord countersign';
    case 'signed_pending_move_in':
      return 'Fully signed — tenancy can be activated next';
    case 'active':
      return 'Active tenancy';
    default:
      return status.replace(/_/g, ' ');
  }
}

function leaseStatusDetail(lease: DbLease): string {
  switch (lease.status) {
    case 'draft':
      return 'The landlord is still preparing or regenerating the lease PDF.';
    case 'generated':
    case 'uploaded':
      return 'The lease file exists but may not have been sent to you yet. Check notifications.';
    case 'sent':
      return 'Please open the lease, review it, and sign when you are ready.';
    case 'signed':
      return 'Your signature is recorded. The landlord still needs to upload their final countersignature.';
    case 'signed_pending_move_in':
      return lease.tenant_id
        ? 'All signatures are complete. Your landlord may convert you to a tenant record and set move-in when ready.'
        : 'All signatures are complete. Your landlord will link your tenant profile when they are ready.';
    default:
      return 'Open the lease for full details and documents.';
  }
}

export default function TenantLeaseStatusScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [application, setApplication] = useState<Record<string, unknown> | null>(null);
  const [lease, setLease] = useState<DbLease | null>(null);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { application: app, lease: l } = await fetchApplicantLeaseOverview(user.id);
      setApplication(app);
      setLease(l);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const appStatus = (application?.status as string) || '';
  const applicationId = (application?.id as string) || '';

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Application & lease</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {application && (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={[styles.idLabel, { color: textSecondaryColor }]}>Application ID</ThemedText>
              <ThemedText style={[styles.idValue, { color: textPrimaryColor }]}>
                {applicationId || '—'}
              </ThemedText>
              <View style={styles.rowBetween}>
                <ThemedText style={[styles.muted, { color: textSecondaryColor }]}>Status</ThemedText>
                <ThemedText style={[styles.statusBadgeText, { color: primaryColor }]}>
                  {appStatus.replace(/_/g, ' ').toUpperCase()}
                </ThemedText>
              </View>
            </View>
          )}

          {lease && (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Your lease</ThemedText>
              <ThemedText style={[styles.leaseHeadline, { color: primaryColor }]}>
                {leaseStatusLabel(lease.status)}
              </ThemedText>
              <ThemedText style={[styles.bodyText, { color: textSecondaryColor }]}>
                {leaseStatusDetail(lease)}
              </ThemedText>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: primaryColor }]}
                onPress={() => router.push(`/tenant-lease-detail?id=${lease.id}`)}>
                <MaterialCommunityIcons name="file-document-outline" size={20} color="#fff" />
                <ThemedText style={[styles.primaryButtonText, { marginLeft: 8 }]}>
                  View lease & current status
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryLink}
                onPress={() => router.push('/tenant-leases')}>
                <ThemedText style={[styles.secondaryLinkText, { color: primaryColor }]}>
                  All my leases
                </ThemedText>
                <MaterialCommunityIcons name="chevron-right" size={20} color={primaryColor} />
              </TouchableOpacity>
            </View>
          )}

          {!application && !lease && (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <MaterialCommunityIcons name="information-outline" size={40} color={textSecondaryColor} />
              <ThemedText style={[styles.bodyText, { color: textSecondaryColor, marginTop: 12 }]}>
                No application linked to this account yet. After you apply for a property, your status and lease will
                appear here.
              </ThemedText>
            </View>
          )}

          {application && !lease && (
            <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={[styles.bodyText, { color: textSecondaryColor }]}>
                No lease has been created for this application yet. When the landlord generates and sends the lease,
                you will see it here and under My Leases.
              </ThemedText>
            </View>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  idLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  idValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muted: {
    fontSize: 14,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  leaseHeadline: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  secondaryLinkText: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
});
