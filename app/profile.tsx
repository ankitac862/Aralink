import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View, Image, Switch, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { upsertUserProfile, uploadImage } from '@/lib/supabase';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, updateAvatar } = useAuthStore();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Section open/close state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  
  // Notification preferences
  const [pushNotif, setPushNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Load user data
  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  // Log avatar URL changes for debugging
  useEffect(() => {
    if (user?.avatarUrl) {
      console.log('🖼️ Avatar URL changed:', user.avatarUrl);
    }
  }, [user?.avatarUrl]);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101622' : '#f6f6f8';
  const cardBgColor = isDark ? '#1f2937' : '#f8f9fc';
  const borderColor = isDark ? '#4b5563' : '#cfd7e7';
  const textColor = isDark ? '#f3f4f6' : '#0d121b';
  const secondaryTextColor = isDark ? '#9ca3af' : '#4c669a';
  const primaryColor = '#135bec';

  const handleSaveChanges = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const result = await upsertUserProfile({
        id: user.id,
        full_name: fullName,
        email: email,
        phone: phone || undefined,
      });

      if (result) {
        Alert.alert('Success', 'Profile updated successfully');
        setIsEditMode(false);
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reload user data to discard changes
    if (user) {
      setFullName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
    setIsEditMode(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'landlord':
        return 'Property Owner';
      case 'tenant':
        return 'Tenant';
      case 'manager':
        return 'Property Manager';
      default:
        return 'User';
    }
  };

  const handlePickAvatar = async () => {
    if (!user) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingAvatar(true);
        const imageUri = result.assets[0].uri;

        // Upload image to Supabase Storage
        const uploadResult = await uploadImage(
          imageUri,
          'avatars',
          `user-${user.id}`
        );

        if (uploadResult.success && uploadResult.url) {
          console.log('✅ Avatar uploaded successfully:', uploadResult.url);
          
          // Update user profile with new avatar URL
          const updateResult = await updateAvatar(uploadResult.url);
          
          if (updateResult.success) {
            console.log('✅ Avatar URL updated in profile');
            Alert.alert('Success', 'Profile picture updated successfully');
          } else {
            Alert.alert('Error', updateResult.error || 'Failed to update profile picture');
          }
        } else {
          Alert.alert('Error', uploadResult.error || 'Failed to upload image. Make sure the "avatars" bucket exists in Supabase Storage.');
        }
        
        setIsUploadingAvatar(false);
      }
    } catch (error) {
      console.error('Error picking avatar:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      setIsUploadingAvatar(false);
    }
  };

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
            backgroundColor: isDark ? '#111827' : '#ffffff',
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
    <View style={[styles.toggleItem, { backgroundColor: isDark ? '#111827' : '#ffffff' }]}>
      <ThemedText style={[styles.toggleLabel, { color: textColor }]}>{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d1d5db', true: primaryColor + '40' }}
        thumbColor={value ? primaryColor : '#d1d5db'}
      />
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Top App Bar */}
      <View style={[styles.topBar, { borderBottomColor: borderColor, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: textColor }]}>
          Profile
        </ThemedText>
        {isEditMode ? (
          <TouchableOpacity onPress={handleCancelEdit} style={{ width: 40, alignItems: 'center' }}>
            <MaterialCommunityIcons name="close" size={24} color={textColor} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setIsEditMode(true)} style={{ width: 40, alignItems: 'center' }}>
            <MaterialCommunityIcons name="pencil" size={24} color={primaryColor} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          {user?.avatarUrl ? (
            <Image
              source={{ 
                uri: user.avatarUrl,
                cache: 'reload' // Force reload from server, not cache
              }}
              style={styles.profileImage}
              key={user.avatarUrl} // Force re-render when URL changes
            />
          ) : (
            <View style={[styles.profileImage, styles.avatarPlaceholder, { backgroundColor: primaryColor }]}>
              <ThemedText style={styles.avatarInitials}>
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </ThemedText>
            </View>
          )}
          <TouchableOpacity 
            style={[styles.editButton, { backgroundColor: primaryColor }]}
            onPress={handlePickAvatar}
            disabled={isUploadingAvatar}
          >
            {isUploadingAvatar ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialCommunityIcons name="pencil" size={14} color="white" />
            )}
          </TouchableOpacity>
          <ThemedText style={[styles.profileName, { color: textColor }]}>
            {user?.name || 'User'}
          </ThemedText>
          <ThemedText style={[styles.profileRole, { color: secondaryTextColor }]}>
            {user ? getRoleDisplayName(user.role) : 'User'}
          </ThemedText>
        </View>

        {/* Settings Sections */}
        <View style={styles.sectionsContainer}>
          {/* Personal Details - View or Edit Mode */}
          {!isEditMode ? (
            // View Mode
            <View style={[styles.section, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={[styles.sectionTitle, { color: textColor, marginBottom: 16 }]}>Personal Details</ThemedText>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Full Name</ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>{fullName || 'Not set'}</ThemedText>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Email Address</ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>{email || 'Not set'}</ThemedText>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <ThemedText style={[styles.infoLabel, { color: secondaryTextColor }]}>Phone Number</ThemedText>
                <ThemedText style={[styles.infoValue, { color: textColor }]}>{phone || 'Not set'}</ThemedText>
              </View>
            </View>
          ) : (
            // Edit Mode
            <View style={[styles.section, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={[styles.sectionTitle, { color: textColor, marginBottom: 16 }]}>Edit Personal Details</ThemedText>
              <SettingInput 
                label="Full Name" 
                value={fullName} 
                onChangeText={setFullName} 
              />
              <SettingInput 
                label="Email Address" 
                value={email} 
                type="email" 
                onChangeText={setEmail} 
              />
              <SettingInput 
                label="Phone Number" 
                value={phone} 
                type="tel" 
                onChangeText={setPhone} 
              />
            </View>
          )}

          <SettingSection 
            title="Notification Preferences" 
            isOpen={notificationsOpen} 
            onToggle={() => setNotificationsOpen(!notificationsOpen)}
          >
            <ToggleSetting label="Push Notifications" value={pushNotif} onValueChange={setPushNotif} />
            <ToggleSetting label="Email" value={emailNotif} onValueChange={setEmailNotif} />
            <ToggleSetting label="SMS" value={smsNotif} onValueChange={setSmsNotif} />
          </SettingSection>

          <SettingSection 
            title="Security" 
            isOpen={securityOpen} 
            onToggle={() => setSecurityOpen(!securityOpen)}
          >
            <TouchableOpacity 
              style={[styles.buttonItem, { backgroundColor: isDark ? '#111827' : '#ffffff' }]}
              onPress={() => Alert.alert('Change Password', 'Password change feature coming soon')}
            >
              <ThemedText style={[styles.buttonItemText, { color: textColor }]}>Change Password</ThemedText>
              <MaterialCommunityIcons name="arrow-right" size={20} color={secondaryTextColor} />
            </TouchableOpacity>
            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={[
                  styles.toggleItem,
                  { backgroundColor: isDark ? '#111827' : '#ffffff' },
                ]}
                onPress={() => Alert.alert('2FA', 'Two-factor authentication setup coming soon')}
              >
                <View>
                  <ThemedText style={[styles.toggleLabel, { color: textColor }]}>
                    Two-Factor Authentication
                  </ThemedText>
                  <ThemedText style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                    Not Enabled
                  </ThemedText>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={20} color={secondaryTextColor} />
              </TouchableOpacity>
            </View>
          </SettingSection>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
          <ThemedText style={styles.logoutButtonText}>Log Out</ThemedText>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom Save/Cancel Buttons - Only in Edit Mode */}
      {isEditMode && (
        <View style={[styles.bottomBar, { borderTopColor: borderColor }]}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: isDark ? '#404450' : '#e5e7eb' }]}
            disabled={isSaving}
            onPress={handleCancelEdit}>
            <ThemedText style={[styles.cancelButtonText, { color: isDark ? '#f3f4f6' : '#1f2937' }]}>
              Cancel
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: primaryColor, opacity: isSaving ? 0.6 : 1 }]}
            disabled={isSaving}
            onPress={handleSaveChanges}>
            <ThemedText style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
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
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
  },
  editButton: {
    position: 'absolute',
    bottom: 8,
    right: '30%',
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
  infoItem: {
    marginBottom: 12,
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(127, 127, 127, 0.2)',
    marginVertical: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '400',
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(127, 127, 127, 0.2)',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
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

