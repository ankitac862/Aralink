import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLeaseStore } from '@/store/leaseStore';

export default function LeasePreviewScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentLeaseDraft, landlordApplications } = useLeaseStore();

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#0B0B0C' : '#F2F2F4';
  const cardBgColor = isDark ? '#1A1B1E' : '#FFFFFF';
  const textPrimaryColor = isDark ? '#FFFFFF' : '#111315';
  const textSecondaryColor = isDark ? '#9BA1A6' : '#6E7377';
  const primaryColor = isDark ? '#FFFFFF' : '#111315';
  const onPrimaryColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const borderColor = isDark ? '#26282C' : '#E5E5E7';
  const highlightColor = isDark ? '#222428' : '#EDEDEF';

  const [confirmed, setConfirmed] = useState(false);

  if (!currentLeaseDraft) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <ThemedText style={{ color: textPrimaryColor }}>No lease draft available</ThemedText>
      </ThemedView>
    );
  }

  const application = landlordApplications.find((app) => app.id === currentLeaseDraft.applicationId);
  const tenantName = application?.tenantName || 'Tenant Name';

  const handleSend = () => {
    if (confirmed) {
      router.push('/lease-sent');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textPrimaryColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
          Lease Preview: {tenantName}
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.introText, { color: textSecondaryColor }]}>
          Highlighted fields have been auto-filled with the provided information. Please review all details for
          accuracy.
        </ThemedText>

        <View style={[styles.leaseDocument, { backgroundColor: cardBgColor, borderColor }]}>
          {/* Parties */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionNumber, { color: textPrimaryColor }]}>1. Parties</ThemedText>
            <ThemedText style={[styles.sectionText, { color: textPrimaryColor }]}>
              This agreement is between the Landlord,{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>Jane Smith</ThemedText>,
              and the Tenant,{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>{tenantName}</ThemedText>.
            </ThemedText>
          </View>

          {/* Rental Unit */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionNumber, { color: textPrimaryColor }]}>2. Rental Unit</ThemedText>
            <ThemedText style={[styles.sectionText, { color: textPrimaryColor }]}>
              The rental unit is located at{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>
                {application?.propertyAddress || '123 Main Street, Unit 4B, Toronto, ON, M5V 2N2'}
              </ThemedText>
              . The rental unit includes{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>1 parking space</ThemedText>{' '}
              and{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>1 storage locker</ThemedText>
              .
            </ThemedText>
          </View>

          {/* Rent */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionNumber, { color: textPrimaryColor }]}>3. Rent</ThemedText>
            <ThemedText style={[styles.sectionText, { color: textPrimaryColor }]}>
              The total rent is{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>
                ${currentLeaseDraft.rent.toLocaleString()}.00 per month
              </ThemedText>
              . Rent is due on the{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>1st of each month</ThemedText>
              . The first rent payment is due on{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>
                {currentLeaseDraft.startDate}
              </ThemedText>
              . Payment shall be made by{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>e-transfer</ThemedText>.
            </ThemedText>
          </View>

          {/* Term */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionNumber, { color: textPrimaryColor }]}>
              4. Term of Tenancy Agreement
            </ThemedText>
            <ThemedText style={[styles.sectionText, { color: textPrimaryColor }]}>
              This tenancy begins on{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>
                {currentLeaseDraft.startDate}
              </ThemedText>
              , ending on{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>
                {currentLeaseDraft.endDate}
              </ThemedText>
              .
            </ThemedText>
          </View>

          {/* Services */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionNumber, { color: textPrimaryColor }]}>5. Services and Utilities</ThemedText>
            <ThemedText style={[styles.sectionText, { color: textPrimaryColor }]}>
              Included in rent: <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>Water, Heat</ThemedText>. Tenant is responsible for:{' '}
              <ThemedText style={[styles.highlighted, { backgroundColor: highlightColor }]}>
                Electricity, Internet, Cable TV
              </ThemedText>
              .
            </ThemedText>
          </View>

          {/* Insurance */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionNumber, { color: textPrimaryColor }]}>6. Tenant's Insurance</ThemedText>
            <ThemedText style={[styles.sectionText, { color: textPrimaryColor }]}>
              {currentLeaseDraft.insuranceRequired
                ? 'The tenant must maintain a valid insurance policy for the duration of the tenancy. Proof of insurance must be provided to the landlord prior to the move-in date.'
                : 'Tenant insurance is recommended but not required.'}
            </ThemedText>
          </View>

          {/* Pets */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionNumber, { color: textPrimaryColor }]}>7. Smoking</ThemedText>
            <ThemedText style={[styles.sectionText, { color: textPrimaryColor }]}>
              Smoking is not permitted in the rental unit or on the property, as per the rules of the condominium
              corporation.
            </ThemedText>
          </View>

          {currentLeaseDraft.allowPets && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionNumber, { color: textPrimaryColor }]}>8. Pets</ThemedText>
              <ThemedText style={[styles.sectionText, { color: textPrimaryColor }]}>
                Pets are allowed in the rental unit subject to building rules and regulations.
              </ThemedText>
            </View>
          )}
        </View>

        <View style={[styles.confirmCard, { backgroundColor: cardBgColor, borderColor }]}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setConfirmed(!confirmed)}>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: confirmed ? primaryColor : 'transparent',
                  borderColor: confirmed ? primaryColor : borderColor,
                },
              ]}>
              {confirmed && <MaterialCommunityIcons name="check" size={16} color="#ffffff" />}
            </View>
            <ThemedText style={[styles.confirmText, { color: textPrimaryColor }]}>
              I have reviewed this document and confirm its accuracy.
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.editButton, { borderColor }]}
            onPress={() => router.back()}>
            <ThemedText style={[styles.editButtonText, { color: textPrimaryColor }]}>Edit Details</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: confirmed ? primaryColor : textSecondaryColor }]}
            onPress={handleSend}
            disabled={!confirmed}>
            <ThemedText style={styles.sendButtonText}>Send for Signature</ThemedText>
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
  introText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  leaseDocument: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionNumber: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  highlighted: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  confirmCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  confirmText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

