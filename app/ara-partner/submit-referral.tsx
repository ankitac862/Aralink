import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAraPartnerStore } from '@/store/araPartnerStore';


export default function SubmitReferral() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { submitReferral, isLoading, profile } = useAraPartnerStore();

  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBg = isDark ? '#1A1B1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#111315';
  const subText = isDark ? '#9BA1A6' : '#6E7377';
  const PRIMARY = isDark ? '#FFFFFF' : '#111315';
  const ON_PRIMARY = isDark ? '#0B0B0C' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const inputBg = isDark ? '#141517' : '#F7F7F8';

  const [form, setForm] = useState({
    landlordName: '',
    landlordPhone: '',
    landlordEmail: '',
    propertyAddress: '',
  });

  const handleSubmit = async () => {
    if (!form.landlordName.trim() || !form.propertyAddress.trim()) {
      Alert.alert('Required', 'Landlord name and property address are required.');
      return;
    }
    if (!form.landlordPhone.trim() && !form.landlordEmail.trim()) {
      Alert.alert('Required', 'Provide at least a phone number or email for the landlord.');
      return;
    }
    if (!profile) {
      Alert.alert('Profile Incomplete', 'Please complete your profile before submitting a referral.');
      router.push('/ara-partner/profile' as any);
      return;
    }

    const result = await submitReferral({
      landlordName: form.landlordName.trim(),
      landlordPhone: form.landlordPhone.trim() || undefined,
      landlordEmail: form.landlordEmail.trim() || undefined,
      propertyAddress: form.propertyAddress.trim(),
    });

    if (result.success) {
      Alert.alert('Submitted!', 'Your referral has been submitted and is pending review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Failed to submit referral.');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={24} color={textColor} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textColor }]}>Submit Referral</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>Landlord Details</ThemedText>

            <Field label="Landlord Name *" value={form.landlordName} onChangeText={(v: string) => setForm({ ...form, landlordName: v })} placeholder="Full name" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
            <Field label="Phone Number" value={form.landlordPhone} onChangeText={(v: string) => setForm({ ...form, landlordPhone: v })} placeholder="e.g. +1 416 555 0100" keyboardType="phone-pad" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
            <Field label="Email Address" value={form.landlordEmail} onChangeText={(v: string) => setForm({ ...form, landlordEmail: v })} placeholder="landlord@email.com" keyboardType="email-address" inputBg={inputBg} textColor={textColor} subText={subText} borderColor={borderColor} />
          </View>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor, marginTop: 14 }]}>
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>Property Details</ThemedText>
            <AddressAutocomplete
              label="Property Address *"
              placeholder="e.g. 238 Glengarry Ave, Windsor, ON"
              required
              onAddressSelect={(address) => setForm({ ...form, propertyAddress: address.formattedAddress })}
              onError={() => setForm({ ...form, propertyAddress: form.propertyAddress })}
            />
            <View style={[styles.infoBox, { backgroundColor: isDark ? '#222428' : '#EDEDEF' }]}>
              <MaterialCommunityIcons name="information" size={16} color={subText} />
              <ThemedText style={[styles.infoText, { color: subText }]}>
                Each property address can only be referred once.
              </ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: PRIMARY, opacity: isLoading ? 0.6 : 1 }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={ON_PRIMARY} />
            ) : (
              <ThemedText style={[styles.submitBtnText, { color: ON_PRIMARY }]}>Submit Referral</ThemedText>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
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
        autoCapitalize="none"
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
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  infoText: { fontSize: 12, flex: 1 },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
