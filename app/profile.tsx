import { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  View,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateAvatar, updateProfile } = useAuthStore();

  const [isEditMode, setIsEditMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101622' : '#f1f5f9';
  const cardBg = isDark ? '#1e2736' : '#ffffff';
  const border = isDark ? '#2d3a4a' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subText = isDark ? '#94a3b8' : '#64748b';
  const primary = '#2563eb';
  const inputBg = isDark ? '#141c27' : '#f8fafc';

  // Only sync form fields from store on mount, not on every user update.
  // This prevents background profile loads from wiping in-progress edits.
  useEffect(() => {
    if (user) {
      setFullName(user.name || '');
      setPhone(user.phone || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'landlord': return 'Property Owner';
      case 'tenant': return 'Tenant';
      case 'manager': return 'Property Manager';
      default: return 'User';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'landlord': return '#7c3aed';
      case 'manager': return '#0891b2';
      default: return '#059669';
    }
  };

  const getInitials = () =>
    (user?.name || 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handlePickAvatar = async () => {
    if (!user) return;

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

    if (result.canceled || !result.assets[0]) return;

    setIsUploadingAvatar(true);
    try {
      const uri = result.assets[0].uri;

      // Read file as base64 using fetch + FileReader (available in RN 0.73+/Expo SDK 54)
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Policy requires path: user-<uid>/avatar.jpg
      const storagePath = `user-${user.id}/avatar.jpg`;

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(storagePath, bytes, {
          contentType: 'image/jpeg',
          upsert: true, // overwrite existing
        });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to upload image.');
        return;
      }

      // Append timestamp to bust React Native's image cache
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const res = await updateAvatar(publicUrl);
      if (!res.success) {
        Alert.alert('Error', res.error || 'Failed to save profile picture.');
      }
      // No alert on success — image updates visually immediately
    } catch (e) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation', 'Full name cannot be empty.');
      return;
    }
    setIsSaving(true);
    const res = await updateProfile({ name: fullName.trim(), phone: phone.trim() });
    setIsSaving(false);
    if (res.success) {
      setIsEditMode(false);
    } else {
      Alert.alert('Error', res.error || 'Failed to update profile.');
    }
  };

  const handleCancel = () => {
    // Reset to current saved values from store
    const { user: currentUser } = useAuthStore.getState();
    setFullName(currentUser?.name || '');
    setPhone(currentUser?.phone || '');
    setIsEditMode(false);
  };

  if (!user) return null;

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>Profile</ThemedText>
        {isEditMode ? (
          <TouchableOpacity onPress={handleCancel}>
            <MaterialCommunityIcons name="close" size={24} color={subText} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setIsEditMode(true)}>
            <MaterialCommunityIcons name="pencil-outline" size={24} color={primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}>

        {/* Avatar block */}
        <View style={styles.avatarBlock}>
          <View style={styles.avatarWrap}>
            {user.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatar}
                key={user.avatarUrl}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: primary }]}>
                <ThemedText style={styles.initials}>{getInitials()}</ThemedText>
              </View>
            )}
            <TouchableOpacity
              style={[styles.cameraBtn, { backgroundColor: primary }]}
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar}>
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialCommunityIcons name="camera" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <ThemedText style={[styles.displayName, { color: textColor }]}>
            {user.name || 'Your Name'}
          </ThemedText>
          <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user.role) + '20' }]}>
            <ThemedText style={[styles.roleText, { color: getRoleBadgeColor(user.role) }]}>
              {getRoleLabel(user.role)}
            </ThemedText>
          </View>
        </View>

        {/* Personal Details Card */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: border }]}>
            <MaterialCommunityIcons name="account-outline" size={18} color={primary} />
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>Personal Details</ThemedText>
          </View>

          {/* Full Name */}
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, { color: subText }]}>Full Name</ThemedText>
            {isEditMode ? (
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textColor }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={subText}
                autoCapitalize="words"
              />
            ) : (
              <ThemedText style={[styles.fieldValue, { color: textColor }]}>
                {user.name || 'Not set'}
              </ThemedText>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          {/* Email — always locked */}
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, { color: subText }]}>Email Address</ThemedText>
            <View style={styles.lockedRow}>
              <ThemedText style={[styles.fieldValue, { color: textColor, flex: 1 }]}>
                {user.email}
              </ThemedText>
              <View style={[styles.lockBadge, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                <MaterialCommunityIcons name="lock-outline" size={13} color={subText} />
                <ThemedText style={[styles.lockText, { color: subText }]}>Cannot change</ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          {/* Phone */}
          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, { color: subText }]}>Phone Number</ThemedText>
            {isEditMode ? (
              <TextInput
                style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textColor }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone number"
                placeholderTextColor={subText}
                keyboardType="phone-pad"
              />
            ) : (
              <ThemedText style={[styles.fieldValue, { color: textColor }]}>
                {user.phone || 'Not set'}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Account info card */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: border }]}>
            <MaterialCommunityIcons name="shield-account-outline" size={18} color={primary} />
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>Account</ThemedText>
          </View>

          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, { color: subText }]}>Account Type</ThemedText>
            <ThemedText style={[styles.fieldValue, { color: textColor }]}>
              {getRoleLabel(user.role)}
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <View style={styles.field}>
            <ThemedText style={[styles.fieldLabel, { color: subText }]}>Login Method</ThemedText>
            <ThemedText style={[styles.fieldValue, { color: textColor }]}>
              {user.isSocialLogin
                ? `${user.socialProvider ? user.socialProvider.charAt(0).toUpperCase() + user.socialProvider.slice(1) : 'Social'} Login`
                : 'Email & Password'}
            </ThemedText>
          </View>
        </View>

        {isEditMode && (
          <ThemedText style={[styles.emailNote, { color: subText }]}>
            * Email address cannot be changed. Contact support if needed.
          </ThemedText>
        )}
      </ScrollView>

      {/* Save / Cancel footer */}
      {isEditMode && (
        <View style={[styles.footer, { borderTopColor: border, paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: border }]}
            onPress={handleCancel}
            disabled={isSaving}>
            <ThemedText style={[styles.cancelBtnText, { color: textColor }]}>Cancel</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: primary, opacity: isSaving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.saveBtnText}>Save Changes</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16, gap: 16 },

  // Avatar
  avatarBlock: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { width: 104, height: 104, borderRadius: 52 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  initials: { fontSize: 40, fontWeight: '700', color: '#fff' },
  cameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  displayName: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: { fontSize: 13, fontWeight: '600' },

  // Card
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: '700' },

  // Fields
  field: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldValue: { fontSize: 15, fontWeight: '400' },
  divider: { height: 1, marginHorizontal: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 2,
  },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockText: { fontSize: 11, fontWeight: '500' },

  emailNote: { fontSize: 12, textAlign: 'center', marginTop: 4 },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
