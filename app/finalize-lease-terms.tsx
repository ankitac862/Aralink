import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View, TextInput, Switch, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';
import { fmtDateInput } from '@/lib/dateUtils';

export default function FinalizeLeaseTermsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { applicationId } = useLocalSearchParams();
  const { approveApplication } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const primaryColor = '#2A64F5';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const inputBgColor = isDark ? '#1a202c' : '#ffffff';

  const [formData, setFormData] = useState({
    rent: '2400',
    deposit: '2400',
    startDate: '12/01/2024',
    endDate: '11/30/2025',
    allowPets: true,
    insuranceRequired: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.rent || isNaN(Number(formData.rent))) {
      newErrors.rent = 'Please enter a valid rent amount';
    }
    if (!formData.deposit || isNaN(Number(formData.deposit))) {
      newErrors.deposit = 'Please enter a valid deposit amount';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatDate = (date: Date): string => fmtDateInput(date);

  const handleStartDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (date) {
      setStartDate(date);
      const formattedDate = formatDate(date);
      setFormData({ ...formData, startDate: formattedDate });
      if (errors.startDate) setErrors({ ...errors, startDate: '' });
    }
  };

  const handleEndDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (date) {
      setEndDate(date);
      const formattedDate = formatDate(date);
      setFormData({ ...formData, endDate: formattedDate });
      if (errors.endDate) setErrors({ ...errors, endDate: '' });
    }
  };

  const handleGenerate = () => {
    if (validate() && applicationId) {
      approveApplication(applicationId as string, {
        rent: Number(formData.rent),
        deposit: Number(formData.deposit),
        startDate: formData.startDate,
        endDate: formData.endDate,
        allowPets: formData.allowPets,
        insuranceRequired: formData.insuranceRequired,
      });
      router.push('/lease-preview');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>Finalize Lease Terms</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>Finalize Lease Terms</ThemedText>

          <View style={styles.form}>
            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Monthly Rent ($)</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: inputBgColor,
                      color: textPrimaryColor,
                      borderColor: errors.rent ? '#ff3b30' : borderColor,
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor={textSecondaryColor}
                  value={formData.rent}
                  onChangeText={(value) => {
                    setFormData({ ...formData, rent: value });
                    if (errors.rent) setErrors({ ...errors, rent: '' });
                  }}
                  keyboardType="numeric"
                />
                {errors.rent && <ThemedText style={styles.errorText}>{errors.rent}</ThemedText>}
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Rent Deposit ($)</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: inputBgColor,
                      color: textPrimaryColor,
                      borderColor: errors.deposit ? '#ff3b30' : borderColor,
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor={textSecondaryColor}
                  value={formData.deposit}
                  onChangeText={(value) => {
                    setFormData({ ...formData, deposit: value });
                    if (errors.deposit) setErrors({ ...errors, deposit: '' });
                  }}
                  keyboardType="numeric"
                />
                {errors.deposit && <ThemedText style={styles.errorText}>{errors.deposit}</ThemedText>}
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Lease Start Date</ThemedText>
                <View style={styles.dateInputRow}>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      styles.inputFlex,
                      {
                        backgroundColor: inputBgColor,
                        borderColor: errors.startDate ? '#ff3b30' : borderColor,
                      },
                    ]}
                    onPress={() => setShowStartDatePicker(true)}>
                    <ThemedText style={[styles.dateText, { color: formData.startDate ? textPrimaryColor : textSecondaryColor }]}>
                      {formData.startDate || 'mm/dd/yyyy'}
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowStartDatePicker(true)}>
                    <MaterialCommunityIcons name="calendar" size={20} color={primaryColor} style={styles.calendarIcon} />
                  </TouchableOpacity>
                </View>
                {errors.startDate && <ThemedText style={styles.errorText}>{errors.startDate}</ThemedText>}
                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleStartDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Lease End Date</ThemedText>
                <View style={styles.dateInputRow}>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      styles.inputFlex,
                      {
                        backgroundColor: inputBgColor,
                        borderColor: errors.endDate ? '#ff3b30' : borderColor,
                      },
                    ]}
                    onPress={() => setShowEndDatePicker(true)}>
                    <ThemedText style={[styles.dateText, { color: formData.endDate ? textPrimaryColor : textSecondaryColor }]}>
                      {formData.endDate || 'mm/dd/yyyy'}
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(true)}>
                    <MaterialCommunityIcons name="calendar" size={20} color={primaryColor} style={styles.calendarIcon} />
                  </TouchableOpacity>
                </View>
                {errors.endDate && <ThemedText style={styles.errorText}>{errors.endDate}</ThemedText>}
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndDateChange}
                    minimumDate={startDate}
                  />
                )}
              </View>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Allow Pets</ThemedText>
                <ThemedText style={[styles.toggleDescription, { color: textSecondaryColor }]}>
                  Allow tenants to have pets in the rental unit
                </ThemedText>
              </View>
              <Switch
                value={formData.allowPets}
                onValueChange={(value) => setFormData({ ...formData, allowPets: value })}
                trackColor={{ false: borderColor, true: primaryColor }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <ThemedText style={[styles.label, { color: textPrimaryColor }]}>Tenant Insurance Required</ThemedText>
                <ThemedText style={[styles.toggleDescription, { color: textSecondaryColor }]}>
                  Require tenants to maintain valid insurance
                </ThemedText>
              </View>
              <Switch
                value={formData.insuranceRequired}
                onValueChange={(value) => setFormData({ ...formData, insuranceRequired: value })}
                trackColor={{ false: borderColor, true: primaryColor }}
                thumbColor="#ffffff"
              />
            </View>

            <ThemedText style={[styles.note, { color: textSecondaryColor }]}>
              An official Ontario Standard Lease Agreement will be generated and sent to the tenant for their
              signature.
            </ThemedText>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.generateButton, { backgroundColor: primaryColor }]}
          onPress={handleGenerate}>
          <ThemedText style={styles.generateButtonText}>Generate Lease</ThemedText>
        </TouchableOpacity>
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
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
  },
  form: {
    gap: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formGroup: {
    gap: 8,
  },
  formGroupHalf: {
    flex: 1,
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
    minHeight: 44,
  },
  inputFlex: {
    flex: 1,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarIcon: {
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleContent: {
    flex: 1,
    marginRight: 16,
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: 'italic',
  },
  generateButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

