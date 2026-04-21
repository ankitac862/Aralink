import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore, UserRole } from '@/store/authStore';

const ROLES: { type: UserRole; icon: string; title: string; description: string }[] = [
  {
    type: 'landlord',
    icon: 'home-city',
    title: 'Landlord',
    description: 'I own properties and manage tenants',
  },
  {
    type: 'manager',
    icon: 'briefcase-account',
    title: 'Property Manager',
    description: 'I manage properties on behalf of owners',
  },
];

export default function SocialRoleSelectScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);

  const { completeSocialSignIn, pendingOAuthSession, signOut } = useAuthStore();

  const isDark = colorScheme === 'dark';
  const primaryColor = '#2A64F5';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#1a202c' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#D1D5DB';
  const textColor = isDark ? '#F4F6F8' : '#111827';
  const subtextColor = isDark ? '#94a3b8' : '#6B7280';

  // If somehow the pending session is gone, go back (must be in effect, not render)
  useEffect(() => {
    if (!pendingOAuthSession) {
      router.replace('/(auth)');
    }
  }, [pendingOAuthSession, router]);

  if (!pendingOAuthSession) return null;

  const userName =
    pendingOAuthSession.user.user_metadata?.full_name ||
    pendingOAuthSession.user.user_metadata?.name ||
    pendingOAuthSession.user.email?.split('@')[0] ||
    'there';

  const handleCancel = async () => {
    await signOut();
  };

  const handleContinue = async () => {
    if (!selectedRole) {
      Alert.alert('Select Account Type', 'Please choose how you will use Aaralink.');
      return;
    }

    setLoading(true);
    const result = await completeSocialSignIn(selectedRole);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to complete sign-in. Please try again.');
      return;
    }

    // _layout.tsx will handle the navigation once `user` is set in the store
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={[styles.logo, { backgroundColor: primaryColor }]}>
            <MaterialCommunityIcons name="home" size={32} color="#fff" />
          </View>
        </View>

        <ThemedText style={[styles.heading, { color: textColor }]}>
          Welcome, {userName}!
        </ThemedText>
        <ThemedText style={[styles.subheading, { color: subtextColor }]}>
          How will you use Aaralink?
        </ThemedText>

        <View style={[styles.card, { backgroundColor: cardBgColor }]}>
          {ROLES.map((role) => {
            const isSelected = selectedRole === role.type;
            return (
              <TouchableOpacity
                key={role.type}
                style={[
                  styles.roleCard,
                  {
                    backgroundColor: isSelected ? `${primaryColor}12` : (isDark ? '#1e293b' : '#F4F6F8'),
                    borderColor: isSelected ? primaryColor : borderColor,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedRole(role.type)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.roleIcon,
                  { backgroundColor: isSelected ? `${primaryColor}20` : (isDark ? '#334155' : '#e5e7eb') },
                ]}>
                  <MaterialCommunityIcons
                    name={role.icon as any}
                    size={26}
                    color={isSelected ? primaryColor : subtextColor}
                  />
                </View>
                <View style={styles.roleText}>
                  <ThemedText style={[styles.roleTitle, { color: isSelected ? primaryColor : textColor }]}>
                    {role.title}
                  </ThemedText>
                  <ThemedText style={[styles.roleDesc, { color: subtextColor }]}>
                    {role.description}
                  </ThemedText>
                </View>
                <View style={[styles.radioOuter, { borderColor: isSelected ? primaryColor : borderColor }]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />}
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[
              styles.continueButton,
              {
                backgroundColor: selectedRole ? primaryColor : (isDark ? '#334155' : '#D1D5DB'),
                opacity: loading ? 0.7 : 1,
              },
            ]}
            onPress={handleContinue}
            disabled={loading || !selectedRole}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.continueText}>Continue</ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading}
          >
            <ThemedText style={[styles.cancelText, { color: subtextColor }]}>
              Cancel
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: { flex: 1 },
  roleTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  continueButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
