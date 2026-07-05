import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
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
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBg = isDark ? '#1A1B1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const subText = isDark ? '#9BA1A6' : '#6E7377';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';

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

  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);
  const profileIncomplete = profile && (!profile.phone || !profile.companyName);
  const showProfileBanner = profileIncomplete && !profileBannerDismissed;

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
            <ThemedText style={[styles.avatarText, { color: onPrimaryColor }]}>
              {(profile?.fullName || user?.name || 'A')[0].toUpperCase()}
            </ThemedText>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator color={primaryColor} style={{ marginVertical: 16 }} />}

        {/* Stats Panel */}
        <View style={[styles.statsPanel, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: primaryColor }]}>{approved}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>Approved</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: '#FF9500' }]}>{pending}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>Pending</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: borderColor }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: '#34C759' }]}>${totalPaid.toFixed(0)}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: subText }]}>Paid Out</ThemedText>
          </View>
        </View>

        {/* Complete Profile Banner */}
        {showProfileBanner && (
          <View style={[styles.profileBanner, { backgroundColor: isDark ? '#222428' : '#EDEDEF', borderColor: isDark ? '#222428' : '#EDEDEF' }]}>
            <View style={[styles.profileBannerIcon, { backgroundColor: isDark ? '#222428' : '#EDEDEF' }]}>
              <MaterialCommunityIcons name="account-edit-outline" size={20} color={textColor} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText style={[styles.profileBannerTitle, { color: textColor }]}>
                Complete your profile
              </ThemedText>
              <ThemedText style={[styles.profileBannerSub, { color: subText }]}>
                Add your {[!profile?.phone && 'phone number', !profile?.companyName && 'company name'].filter(Boolean).join(' & ')} to finish setup
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/ara-partner/profile?edit=true' as any)}
              style={[styles.profileBannerBtn, { backgroundColor: primaryColor }]}
            >
              <ThemedText style={[styles.profileBannerBtnText, { color: onPrimaryColor }]}>Update</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setProfileBannerDismissed(true)} style={styles.profileBannerClose}>
              <MaterialCommunityIcons name="close" size={15} color={subText} />
            </TouchableOpacity>
          </View>
        )}

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
                color={a.filled ? onPrimaryColor : primaryColor}
              />
              <ThemedText
                style={[
                  styles.actionLabel,
                  { color: a.filled ? onPrimaryColor : textColor },
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
  statsPanel: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 3,
  },
  statDivider: { width: StyleSheet.hairlineWidth },
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
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  profileBannerTitle: { fontSize: 13, fontWeight: '700' },
  profileBannerSub: { fontSize: 11, marginTop: 1 },
  profileBannerIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  profileBannerBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  profileBannerBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  profileBannerClose: { padding: 4, marginLeft: 2 },
});
