import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, View, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function TenantLeaseStep1Screen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { propertyId, address, fromInvite, unitId, subUnitId, inviteId, isCoApplicant } = useLocalSearchParams<{ 
    propertyId?: string; 
    address?: string; 
    fromInvite?: string;
    unitId?: string;
    subUnitId?: string;
    inviteId?: string;
    isCoApplicant?: string;
  }>();
  const { tenantDraft, updateDraft, isAddingCoApplicant, getCoApplicantCount } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const inputBgColor = isDark ? '#1a202c' : '#ffffff';

  const [formData, setFormData] = useState({
    fullName: tenantDraft.personal.fullName || '',
    email: tenantDraft.personal.email || '',
    phone: tenantDraft.personal.phone || '',
    dob: tenantDraft.personal.dob || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.dob.trim()) {
      newErrors.dob = 'Date of birth is required';
    } else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(formData.dob)) {
      newErrors.dob = 'Please use format MM/DD/YYYY';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      updateDraft('personal', formData);
      router.push({
        pathname: '/tenant-lease-step2',
        params: { propertyId, address, fromInvite, unitId, subUnitId, inviteId, isCoApplicant }
      });
    }
  };

  const handleScanID = () => {
    Alert.alert('Scan ID', 'ID scanning feature will be available soon');
  };

  const formatDate = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      const formattedDate = formatDate(date);
      setFormData({ ...formData, dob: formattedDate });
      if (errors.dob) setErrors({ ...errors, dob: '' });
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Lease Application</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progressContainer}>
          <ThemedText style={[styles.progressText, { color: textSecondaryColor }]}>This is Step 1 of 6</ThemedText>
          <View style={[styles.progressBar, { backgroundColor: borderColor }]}>
            <View style={[styles.progressFill, { backgroundColor: primaryColor, width: '16.67%' }]} />
          </View>
        </View>

        {isCoApplicant === 'true' && (
          <View style={[styles.coApplicantBanner, { backgroundColor: isDark ? '#1a3a52' : '#e8f4ff', borderColor: primaryColor }]}>
            <MaterialCommunityIcons name="account-multiple-plus" size={24} color={primaryColor} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.coApplicantTitle, { color: textPrimaryColor }]}>
                Adding Co-Applicant #{getCoApplicantCount()}
              </ThemedText>
              <ThemedText style={[styles.coApplicantSubtitle, { color: textSecondaryColor }]}>
                Please fill in the co-applicant's information
              </ThemedText>
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Personal Information</ThemedText>
          <ThemedText style={[styles.sectionDescription, { color: textSecondaryColor }]}>
            Let's start with the basics. Please provide {isCoApplicant === 'true' ? "the co-applicant's" : 'your'} personal details.
          </ThemedText>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Full Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.fullName ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="Enter your full name"
                placeholderTextColor={textSecondaryColor}
                value={formData.fullName}
                onChangeText={(value) => {
                  setFormData({ ...formData, fullName: value });
                  if (errors.fullName) setErrors({ ...errors, fullName: '' });
                }}
              />
              {errors.fullName && (
                <ThemedText style={styles.errorText}>{errors.fullName}</ThemedText>
              )}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Date of Birth</ThemedText>
              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.inputFlex,
                    {
                      backgroundColor: inputBgColor,
                      borderColor: errors.dob ? '#ff3b30' : borderColor,
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}>
                  <ThemedText style={[styles.dateText, { color: formData.dob ? textPrimaryColor : textSecondaryColor }]}>
                    {formData.dob || 'mm/dd/yyyy'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calendarButton}
                  onPress={() => setShowDatePicker(true)}>
                  <MaterialCommunityIcons name="calendar" size={20} color={primaryColor} />
                </TouchableOpacity>
              </View>
              {errors.dob && <ThemedText style={styles.errorText}>{errors.dob}</ThemedText>}
              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Phone Number</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.phone ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="(555) 123-4567"
                placeholderTextColor={textSecondaryColor}
                value={formData.phone}
                onChangeText={(value) => {
                  setFormData({ ...formData, phone: value });
                  if (errors.phone) setErrors({ ...errors, phone: '' });
                }}
                keyboardType="phone-pad"
              />
              {errors.phone && <ThemedText style={styles.errorText}>{errors.phone}</ThemedText>}
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Email Address</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: inputBgColor,
                    color: textPrimaryColor,
                    borderColor: errors.email ? '#ff3b30' : borderColor,
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={textSecondaryColor}
                value={formData.email}
                onChangeText={(value) => {
                  setFormData({ ...formData, email: value });
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <ThemedText style={styles.errorText}>{errors.email}</ThemedText>}
            </View>

            <TouchableOpacity style={[styles.secondaryButton, { borderColor }]} onPress={handleScanID}>
              <MaterialCommunityIcons name="camera" size={20} color={primaryColor} />
              <ThemedText style={[styles.secondaryButtonText, { color: primaryColor }]}>
                Scan your ID to auto-fill
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.securityMessage}>
          <MaterialCommunityIcons name="lock" size={16} color={textSecondaryColor} />
          <ThemedText style={[styles.securityText, { color: textSecondaryColor }]}>
            Your information is encrypted and stored securely.
          </ThemedText>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor }]}
            onPress={() => router.back()}>
            <ThemedText style={[styles.backButtonText, { color: textPrimaryColor }]}>Back</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: primaryColor }]}
            onPress={handleContinue}>
            <ThemedText style={styles.continueButtonText}>Next</ThemedText>
          </TouchableOpacity>
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
  progressContainer: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 12,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  form: {
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
  },
  calendarButton: {
    padding: 12,
  },
  dateText: {
    fontSize: 16,
    paddingVertical: 2,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  securityMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  securityText: {
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  coApplicantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
    gap: 12,
  },
  coApplicantTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  coApplicantSubtitle: {
    fontSize: 13,
  },
});

