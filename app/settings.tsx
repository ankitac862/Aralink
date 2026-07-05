import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View, Image, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState('owner');
  const [pushNotif, setPushNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#141517' : '#F7F7F8';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const secondaryTextColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';

  const SettingSection = ({
    title,
    children,
    isOpen,
    onToggle,
  }: {
    title: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
  }) => (
    <View style={[styles.section, { backgroundColor: cardBgColor, borderColor }]}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle}>
        <ThemedText style={[styles.sectionTitle, { color: textColor }]}>{title}</ThemedText>
        <MaterialCommunityIcons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={textColor}
        />
      </TouchableOpacity>
      {isOpen && <View style={[styles.sectionContent, { borderTopColor: borderColor }]}>{children}</View>}
    </View>
  );

  const SettingInput = ({
    label,
    value,
    onChangeText,
    type = 'text',
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    type?: 'text' | 'email' | 'tel';
  }) => (
    <View style={styles.inputGroup}>
      <ThemedText style={[styles.inputLabel, { color: textColor }]}>{label}</ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? '#1A1B1E' : '#FFFFFF',
            borderColor,
            color: textColor,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={type === 'email' ? 'email-address' : type === 'tel' ? 'phone-pad' : 'default'}
        placeholderTextColor={secondaryTextColor}
      />
    </View>
  );

  const ToggleSetting = ({
    label,
    value,
    onValueChange,
  }: {
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={[styles.toggleItem, { backgroundColor: isDark ? '#1A1B1E' : '#FFFFFF' }]}>
      <ThemedText style={[styles.toggleLabel, { color: textColor }]}>{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d1d5db', true: primaryColor + '40' }}
        thumbColor={value ? primaryColor : '#d1d5db'}
      />
    </View>
  );

  const ButtonItem = ({ label, icon }: { label: string; icon: string }) => (
    <TouchableOpacity
      style={[styles.buttonItem, { backgroundColor: isDark ? '#1A1B1E' : '#FFFFFF' }]}>
      <ThemedText style={[styles.buttonItemText, { color: textColor }]}>{label}</ThemedText>
      <MaterialCommunityIcons name={icon as any} size={20} color={secondaryTextColor} />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Top App Bar */}
      <View style={[styles.topBar, { borderBottomColor: borderColor, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: textColor }]}>
          Settings
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Role Switcher */}
        <View style={styles.roleSwitcher}>
          <ThemedText style={[styles.roleSwitcherLabel, { color: secondaryTextColor }]}>
            Viewing As:
          </ThemedText>
          <View style={[styles.roleButtons, { backgroundColor: isDark ? '#26282C' : '#E5E5E7' }]}>
            {['owner', 'manager'].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.roleButton,
                  role === r && [styles.roleButtonActive, { backgroundColor: cardBgColor }],
                ]}
                onPress={() => setRole(r)}>
                <ThemedText
                  style={[
                    styles.roleButtonText,
                    role === r && { color: primaryColor, fontWeight: '600' },
                  ]}>
                  {r === 'owner' ? 'John Smith Prop.' : 'Jane Doe Res.'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Image
            source={{
              uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDT6tBSmRfV0U1t9Nyfyjr4Rjy51jqbfpyMzsjMaBlYcBVlwFPopmEnre-Fb3tCVJWDUI8ed_etMl_q5qn_CTggRbRiKnBjA7FlqxF-THFsmO8Nr7-lbFctzLnwd3d20Iy9E5-uy9Ni2dGZ_aTTRH29CTmNCjINj6tMkySAu1uf4j5-O5EWmTUmiHeYjJ3TyI8DggQCtkwU7xJRYp8t9Fb_WrISkNFtoTbNpXLFdcjcFJnFmVuhtrWSOuZuck5eCfMhe05Q6niEwE2Z',
            }}
            style={styles.profileImage}
          />
          <TouchableOpacity style={[styles.editButton, { backgroundColor: primaryColor }]}>
            <MaterialCommunityIcons name="pencil" size={14} color={onPrimaryColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.profileName, { color: textColor }]}>Alex Johnson</ThemedText>
          <ThemedText style={[styles.profileRole, { color: secondaryTextColor }]}>
            Property Manager
          </ThemedText>
        </View>

        {/* Settings Sections */}
        <View style={styles.sectionsContainer}>
          <SettingSection title="Personal Details" isOpen={true} onToggle={() => {}}>
            <SettingInput label="Full Name" value="Alex Johnson" onChangeText={() => {}} />
            <SettingInput label="Email Address" value="alex.j@manage.co" type="email" onChangeText={() => {}} />
            <SettingInput label="Phone Number" value="(555) 123-4567" type="tel" onChangeText={() => {}} />
          </SettingSection>

          <SettingSection title="Notification Preferences" isOpen={false} onToggle={() => {}}>
            <ToggleSetting label="Push Notifications" value={pushNotif} onValueChange={setPushNotif} />
            <ToggleSetting label="Email" value={emailNotif} onValueChange={setEmailNotif} />
            <ToggleSetting label="SMS" value={smsNotif} onValueChange={setSmsNotif} />
          </SettingSection>

          <SettingSection title="Security" isOpen={false} onToggle={() => {}}>
            <ButtonItem label="Change Password" icon="arrow-right" />
            <View style={{ marginTop: 12 }}>
              <View
                style={[
                  styles.toggleItem,
                  { backgroundColor: isDark ? '#1A1B1E' : '#FFFFFF' },
                ]}>
                <View>
                  <ThemedText style={[styles.toggleLabel, { color: textColor }]}>
                    Two-Factor Authentication
                  </ThemedText>
                  <ThemedText style={{ color: '#10b981', fontSize: 12, marginTop: 4 }}>
                    Enabled
                  </ThemedText>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={20} color={secondaryTextColor} />
              </View>
            </View>
          </SettingSection>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton}>
          <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
          <ThemedText style={styles.logoutButtonText}>Log Out</ThemedText>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom Save Button */}
      <View style={[styles.bottomBar, { borderTopColor: borderColor }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: primaryColor, opacity: isSaving ? 0.6 : 1 }]}
          disabled={isSaving}
          onPress={() => {
            setIsSaving(true);
            setTimeout(() => setIsSaving(false), 500);
          }}>
          <ThemedText style={[styles.saveButtonText, { color: onPrimaryColor }]}>Save Changes</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  roleSwitcher: {
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  roleSwitcherLabel: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 8,
  },
  roleButtons: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    width: '100%',
    gap: 4,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleButtonActive: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    marginBottom: 8,
  },
  editButton: {
    position: 'absolute',
    bottom: 20,
    right: '28%',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  profileRole: {
    fontSize: 16,
    fontWeight: '400',
    marginTop: 4,
  },
  sectionsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  section: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionContent: {
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  toggleItem: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonItem: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
