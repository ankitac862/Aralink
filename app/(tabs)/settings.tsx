import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';

interface SettingItem {
  icon: string;
  iconBg: string;
  label: string;
  onPress?: () => void;
  showChevron?: boolean;
  showToggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuthStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const primaryColor = '#2A64F5';
  const dangerColor = '#FF3B30';

  const accountItems: SettingItem[] = [
    {
      icon: 'account',
      iconBg: primaryColor,
      label: 'Profile Information',
      onPress: () => router.push('/profile'),
    },
    {
      icon: 'key',
      iconBg: textSecondaryColor,
      label: 'Change Password',
      onPress: () => {
        Alert.alert('Coming Soon', 'Password change feature will be available soon.');
      },
    },
  ];

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(auth)');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const SettingSection = ({ title, items }: { title: string; items: SettingItem[] }) => (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: textSecondaryColor }]}>{title}</ThemedText>
      <View style={[styles.card, { backgroundColor: cardBgColor }]}>
        {items.map((item, index) => (
          <View key={index}>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={item.onPress}
              disabled={!item.onPress && !item.showToggle}>
              <View style={[styles.iconContainer, { backgroundColor: item.iconBg }]}>
                <MaterialCommunityIcons name={item.icon as any} size={22} color="#ffffff" />
              </View>
              <ThemedText style={[styles.settingLabel, { color: textPrimaryColor }]}>
                {item.label}
              </ThemedText>
              {item.showToggle ? (
                <Switch
                  value={item.toggleValue}
                  onValueChange={item.onToggleChange}
                  trackColor={{ false: '#d1d5db', true: '#34c759' }}
                  thumbColor="#ffffff"
                />
              ) : (
                item.showChevron !== false && (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={isDark ? '#4b5563' : '#d1d5db'}
                  />
                )
              )}
            </TouchableOpacity>
            {index < items.length - 1 && (
              <View style={[styles.divider, { backgroundColor: borderColor }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Settings</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contentInner}>
          <SettingSection title="Account" items={accountItems} />

          {/* Logout Button */}
          <View style={styles.logoutSection}>
            <View style={[styles.card, { backgroundColor: cardBgColor }]}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <ThemedText style={[styles.logoutText, { color: dangerColor }]}>Log Out</ThemedText>
              </TouchableOpacity>
            </View>
            <ThemedText style={[styles.versionText, { color: textSecondaryColor }]}>
              App Version 1.0.0
            </ThemedText>
          </View>
        </View>
      </ScrollView>
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
  backButton: {
    width: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingTop: 8,
    gap: 32,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  card: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 16,
    gap: 16,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    marginLeft: 56,
  },
  logoutSection: {
    paddingTop: 8,
    gap: 16,
  },
  logoutButton: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '400',
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 16,
  },
});
