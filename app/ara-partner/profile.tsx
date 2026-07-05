import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { useAraPartnerStore, PaymentMethod } from '@/store/araPartnerStore';


export default function AraPartnerProfile() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuthStore();
  const { profile, loadProfile, createProfile, updateProfile, isLoading } = useAraPartnerStore();

  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBg = isDark ? '#1A1B1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const subText = isDark ? '#9BA1A6' : '#6E7377';
  const PRIMARY = isDark ? '#FFFFFF' : '#111315';
  const ON_PRIMARY = isDark ? '#0B0B0C' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const inputBg = isDark ? '#141517' : '#F7F7F8';

  const [isEditing, setIsEditing] = useState(edit === 'true');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    companyName: '',
    paymentMethod: 'etransfer' as PaymentMethod,
    etransferId: '',
    bankTransit: '',
    bankRouting: '',
    bankAccount: '',
  });

  useEffect(() => {
    if (profile) {
      // Existing ara_partner profile — populate from it
      setForm({
        fullName: profile.fullName || user?.name || '',
        phone: profile.phone || user?.phone || '',
        companyName: profile.companyName || '',
        paymentMethod: profile.paymentMethod || 'etransfer',
        etransferId: profile.etransferId || '',
        bankTransit: profile.bankTransit || '',
        bankRouting: profile.bankRouting || '',
        bankAccount: profile.bankAccount || '',
      });
    } else {
      // No profile yet — pre-fill from signup info
      setForm((prev) => ({
        ...prev,
        fullName: user?.name || '',
        phone: user?.phone || '',
      }));
      // New user: open in edit mode straight away
      setIsEditing(true);
    }
  }, [profile, user]);

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    if (form.paymentMethod === 'etransfer' && !form.etransferId.trim()) {
      Alert.alert('Required', 'Please enter your Interac e-Transfer ID.');
      return;
    }
    if (form.paymentMethod === 'bank' && (!form.bankTransit || !form.bankRouting || !form.bankAccount)) {
      Alert.alert('Required', 'Please fill in all bank details.');
      return;
    }

    const data = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim() || undefined,
      companyName: form.companyName.trim() || undefined,
      paymentMethod: form.paymentMethod,
      etransferId: form.paymentMethod === 'etransfer' ? form.etransferId.trim() : undefined,
      bankTransit: form.paymentMethod === 'bank' ? form.bankTransit.trim() : undefined,
      bankRouting: form.paymentMethod === 'bank' ? form.bankRouting.trim() : undefined,
      bankAccount: form.paymentMethod === 'bank' ? form.bankAccount.trim() : undefined,
    };

    const result = profile
      ? await updateProfile(data)
      : await createProfile(user!.id, { ...data, email: user?.email });

    if (result.success) {
      setIsEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } else {
      Alert.alert('Error', result.error || 'Failed to save profile.');
    }
  };

  const handleCancelEdit = () => {
    // Reset form to saved values
    if (profile) {
      setForm({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        companyName: profile.companyName || '',
        paymentMethod: profile.paymentMethod || 'etransfer',
        etransferId: profile.etransferId || '',
        bankTransit: profile.bankTransit || '',
        bankRouting: profile.bankRouting || '',
        bankAccount: profile.bankAccount || '',
      });
    }
    setIsEditing(false);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>Profile & Banking</ThemedText>
          {!isEditing ? (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtn}>
              <MaterialCommunityIcons name="pencil" size={16} color={PRIMARY} />
              <ThemedText style={[styles.editBtnText, { color: PRIMARY }]}>Edit</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleCancelEdit}>
              <ThemedText style={[styles.cancelText, { color: subText }]}>Cancel</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Email (read-only always) */}
          <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Account</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <InfoRow label="Email" value={user?.email || '—'} subText={subText} textColor={textColor} />
          </View>

          {/* Personal Info */}
          <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Personal Information</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {isEditing ? (
              <>
                <Field label="Full Name *" value={form.fullName} onChangeText={(v: string) => setForm({ ...form, fullName: v })} placeholder="Your full name" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
                <Field label="Phone" value={form.phone} onChangeText={(v: string) => setForm({ ...form, phone: v })} placeholder="e.g. +1 416 555 0100" keyboardType="phone-pad" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
                <Field label="Company Name" value={form.companyName} onChangeText={(v: string) => setForm({ ...form, companyName: v })} placeholder="Optional" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
              </>
            ) : (
              <>
                <InfoRow label="Full Name" value={form.fullName || '—'} subText={subText} textColor={textColor} />
                <InfoRow label="Phone" value={form.phone || '—'} subText={subText} textColor={textColor} />
                <InfoRow label="Company" value={form.companyName || '—'} subText={subText} textColor={textColor} />
              </>
            )}
          </View>

          {/* Payout Method */}
          <ThemedText style={[styles.sectionTitle, { color: textColor }]}>Payout Method</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {isEditing ? (
              <>
                <View style={styles.toggleRow}>
                  {(['etransfer', 'bank'] as PaymentMethod[]).map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.toggleBtn,
                        { borderColor, backgroundColor: form.paymentMethod === method ? PRIMARY : inputBg },
                      ]}
                      onPress={() => setForm({ ...form, paymentMethod: method })}
                    >
                      <ThemedText style={[styles.toggleText, { color: form.paymentMethod === method ? ON_PRIMARY : subText }]}>
                        {method === 'etransfer' ? 'e-Transfer' : 'Bank Account'}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
                {form.paymentMethod === 'etransfer' ? (
                  <Field label="Interac e-Transfer ID *" value={form.etransferId} onChangeText={(v: string) => setForm({ ...form, etransferId: v })} placeholder="e.g. you@email.com" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
                ) : (
                  <>
                    <Field label="Transit Number *" value={form.bankTransit} onChangeText={(v: string) => setForm({ ...form, bankTransit: v })} placeholder="5 digits" keyboardType="number-pad" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
                    <Field label="Institution (Routing) Number *" value={form.bankRouting} onChangeText={(v: string) => setForm({ ...form, bankRouting: v })} placeholder="3 digits" keyboardType="number-pad" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
                    <Field label="Account Number *" value={form.bankAccount} onChangeText={(v: string) => setForm({ ...form, bankAccount: v })} placeholder="7–12 digits" keyboardType="number-pad" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
                  </>
                )}
              </>
            ) : (
              <>
                <InfoRow label="Method" value={form.paymentMethod === 'etransfer' ? 'e-Transfer' : 'Bank Account'} subText={subText} textColor={textColor} />
                {form.paymentMethod === 'etransfer' ? (
                  <InfoRow label="e-Transfer ID" value={form.etransferId || '—'} subText={subText} textColor={textColor} />
                ) : (
                  <>
                    <InfoRow label="Transit #" value={form.bankTransit || '—'} subText={subText} textColor={textColor} />
                    <InfoRow label="Institution #" value={form.bankRouting || '—'} subText={subText} textColor={textColor} />
                    <InfoRow label="Account #" value={form.bankAccount ? '••••' + form.bankAccount.slice(-4) : '—'} subText={subText} textColor={textColor} />
                  </>
                )}
              </>
            )}
          </View>

          {isEditing && (
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: PRIMARY, opacity: isLoading ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={ON_PRIMARY} />
              ) : (
                <ThemedText style={[styles.saveBtnText, { color: ON_PRIMARY }]}>Save Changes</ThemedText>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function InfoRow({ label, value, subText, textColor }: { label: string; value: string; subText: string; textColor: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={[styles.infoLabel, { color: subText }]}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, { color: textColor }]}>{value}</ThemedText>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, inputBg, textColor, subText, borderColor }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <ThemedText style={{ fontSize: 12, fontWeight: '600', marginBottom: 6, color: subText }}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType || 'default'}
        style={[styles.input, { backgroundColor: inputBg, color: textColor, borderColor }]}
        placeholderTextColor={subText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontWeight: '600', fontSize: 14 },
  cancelText: { fontSize: 14, fontWeight: '500' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: { fontSize: 13, fontWeight: '600' },
  infoValue: { fontSize: 13 },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleText: { fontWeight: '600', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
