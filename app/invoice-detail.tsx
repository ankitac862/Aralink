import React, { useState } from 'react';
import { Platform, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fmtDateInput } from '@/lib/dateUtils';

export default function InvoiceDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [formData, setFormData] = useState({
    vendor: '',
    amount: '',
    category: 'maintenance',
    description: '',
    date: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDate = (d: Date) => fmtDateInput(d);

  const handleSave = () => {
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title">Add Invoice</ThemedText>

        <ThemedView style={styles.form}>
          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.label}>Vendor/Service Provider</ThemedText>
            <TextInput
              style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Vendor name"
              value={formData.vendor}
              onChangeText={(value) => setFormData({ ...formData, vendor: value })}
            />
          </ThemedView>

          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.label}>Amount</ThemedText>
            <TextInput
              style={[styles.input, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="0.00"
              value={formData.amount}
              onChangeText={(value) => setFormData({ ...formData, amount: value })}
              keyboardType="decimal-pad"
            />
          </ThemedView>

          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.label}>Category</ThemedText>
            <ThemedView style={styles.categoryContainer}>
              {['maintenance', 'utilities', 'tax', 'other'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryBtn,
                    formData.category === cat && { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                  ]}
                  onPress={() => setFormData({ ...formData, category: cat })}>
                  <ThemedText style={{ fontSize: 12 }}>{cat}</ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.label}>Description</ThemedText>
            <TextInput
              style={[styles.input, styles.multilineInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Invoice details..."
              value={formData.description}
              onChangeText={(value) => setFormData({ ...formData, description: value })}
              multiline
              numberOfLines={3}
            />
          </ThemedView>

          <ThemedView style={styles.formGroup}>
            <ThemedText style={styles.label}>Invoice Date</ThemedText>
            <TouchableOpacity
              style={[styles.input, styles.dateButton, { borderColor: '#ccc' }]}
              onPress={() => setShowDatePicker(true)}
            >
              <ThemedText style={{ color: formData.date ? Colors[colorScheme ?? 'light'].text : '#9ca3af' }}>
                {formData.date || 'MM/DD/YYYY'}
              </ThemedText>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.date ? new Date(formData.date) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_e, date) => {
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                  if (date) setFormData({ ...formData, date: formatDate(date) });
                }}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6, marginBottom: 4 }} onPress={() => setShowDatePicker(false)}>
                <ThemedText style={{ color: '#2563eb', fontWeight: '600' }}>Done</ThemedText>
              </TouchableOpacity>
            )}
          </ThemedView>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={handleSave}>
            <ThemedText style={styles.saveButtonText}>Save Invoice</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  form: { marginTop: 20, gap: 16 },
  formGroup: { gap: 8 },
  label: { fontWeight: 'bold', fontSize: 16 },
  input: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  dateButton: { justifyContent: 'center' },
  multilineInput: { height: 80, textAlignVertical: 'top' },
  categoryContainer: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  categoryBtn: { flex: 1, minWidth: '45%', padding: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, alignItems: 'center' },
  saveButton: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
});
