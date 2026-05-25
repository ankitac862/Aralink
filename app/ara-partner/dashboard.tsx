import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { useAraPartnerStore } from '@/store/araPartnerStore';

export default function AraPartnerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, signOut } = useAuthStore();
  const { profile, referrals, payouts, loadProfile, loadReferrals, loadPayouts, isLoading } =
    useAraPartnerStore();

  // Match app-wide color palette
  const primaryColor = '#4A90E2';
  const bgColor = isDark ? '#101c22' : '#F2F2F7';
  const cardBg = isDark ? '#1A2831' : '#ffffff';
  const textColor = isDark ? '#F2F2F7' : '#101c22';
  const subText = isDark ? '#a0aec0' : '#8E8E93';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadProfile(user.id).then(() => {
          loadReferrals();
          loadPayouts();
        });
      }
    }, [user?.id])
  );

  const approved = referrals.filter((r) => r.status === 'approved').length;
  const pending = referrals.filter((r) => r.status === 'pending').length;
  const totalPaid = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingPayout = payouts
    .filter((p) => p.status === 'pending' || p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0);

  const actions = [
    { label: 'Submit Referral', icon: 'plus-circle', route: '/ara-partner/submit-referral', filled: true },
    { label: 'My Referrals', icon: 'clipboard-list', route: '/ara-partner/referrals', filled: false },
    { label: 'Payouts', icon: 'cash-multiple', route: '/ara-partner/payouts', filled: false },
    { label: 'Profile', icon: 'account-edit', route: '/ara-partner/profile', filled: false },
  ];

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: borderColor }]}>
        <View>
          <ThemedText style={[styles.greeting, { color: subText }]}>Welcome back</ThemedText>
          <ThemedText style={[styles.name, { color: textColor }]}>
            {profile?.fullName || user?.name || 'AaraPartner'}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => router.push('/ara-partner/profile' as any)}>
          <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
            <ThemedText style={styles.avatarText}>
              {(profile?.fullName || user?.name || 'A')[0].toUpperCase()}
            </ThemedText>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={primaryColor} style={{ marginVertical: 16 }} />}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.statIcon, { backgroundColor: `${primaryColor}18` }]}>
              <MaterialCommunityIcons name="check-circle" size={18} color={primaryColor} />
            </View>
            <ThemedText style={[styles.statValue, { color: primaryColor }]}>{approved}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>Approved</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.statIcon, { backgroundColor: '#FF950018' }]}>
              <MaterialCommunityIcons name="clock-outline" size={18} color="#FF9500" />
            </View>
            <ThemedText style={[styles.statValue, { color: '#FF9500' }]}>{pending}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>Pending</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.statIcon, { backgroundColor: '#34C75918' }]}>
              <MaterialCommunityIcons name="cash" size={18} color="#34C759" />
            </View>
            <ThemedText style={[styles.statValue, { color: '#34C759' }]}>
              ${totalPaid.toFixed(0)}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>Paid Out</ThemedText>
          </View>
        </View>

        {/* Pending Payout Banner */}
        {pendingPayout > 0 && (
          <View style={[styles.banner, { backgroundColor: isDark ? '#1e2a1e' : '#f6fdf6', borderColor: isDark ? '#2d4a2d' : '#d1ecd1' }]}>
            <MaterialCommunityIcons name="cash-clock" size={14} color={isDark ? '#6ee7b7' : '#4a9e6b'} />
            <ThemedText style={[styles.bannerText, { color: isDark ? '#6ee7b7' : '#4a9e6b' }]}>
              ${pendingPayout.toFixed(2)} in pending payouts
            </ThemedText>
          </View>
        )}

        {/* Quick Actions */}
        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Quick Actions</ThemedText>
        <View style={styles.actionsGrid}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[
                styles.actionCard,
                a.filled
                  ? { backgroundColor: primaryColor }
                  : { backgroundColor: cardBg, borderWidth: 1, borderColor },
              ]}
              onPress={() => router.push(a.route as any)}
            >
              <MaterialCommunityIcons
                name={a.icon as any}
                size={26}
                color={a.filled ? '#fff' : primaryColor}
              />
              <ThemedText
                style={[
                  styles.actionLabel,
                  { color: a.filled ? '#fff' : textColor },
                ]}
              >
                {a.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Referrals */}
        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Recent Referrals</ThemedText>
        {referrals.slice(0, 3).map((r) => (
          <View key={r.id} style={[styles.referralRow, { backgroundColor: cardBg, borderColor }]}>
            <View style={[styles.referralDot, { backgroundColor: statusColor(r.status, isDark) }]} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.referralAddress, { color: textColor }]} numberOfLines={1}>
                {r.propertyAddress}
              </ThemedText>
              <ThemedText style={[styles.referralLandlord, { color: subText }]}>
                {r.landlordName}
              </ThemedText>
            </View>
            <View style={[styles.badge, { backgroundColor: statusBg(r.status, isDark) }]}>
              <ThemedText style={[styles.badgeText, { color: statusColor(r.status, isDark) }]}>
                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
              </ThemedText>
            </View>
          </View>
        ))}
        {referrals.length === 0 && !isLoading && (
          <ThemedText style={[styles.emptyText, { color: subText }]}>
            No referrals yet. Submit your first one!
          </ThemedText>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <MaterialCommunityIcons name="logout" size={16} color="#FF3B30" />
          <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

function statusColor(status: string, isDark: boolean) {
  if (status === 'approved') return isDark ? '#10b981' : '#059669';
  if (status === 'rejected') return isDark ? '#f87171' : '#dc2626';
  return isDark ? '#f59e0b' : '#d97706';
}

function statusBg(status: string, isDark: boolean) {
  if (status === 'approved') return isDark ? '#065f46' : '#d1fae5';
  if (status === 'rejected') return isDark ? '#7f1d1d' : '#fee2e2';
  return isDark ? '#78350f' : '#fef3c7';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  greeting: { fontSize: 12 },
  name: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 16,
    borderWidth: 1,
  },
  bannerText: { fontWeight: '500', fontSize: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  actionCard: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionLabel: { fontWeight: '600', fontSize: 13, textAlign: 'center' },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  referralDot: { width: 8, height: 8, borderRadius: 4 },
  referralAddress: { fontWeight: '600', fontSize: 14 },
  referralLandlord: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginVertical: 16, fontSize: 14 },
  signOutBtn: { marginTop: 24, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  signOutText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },
});
