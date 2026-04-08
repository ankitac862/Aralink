import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useMaintenanceStore } from '@/store/maintenanceStore';
import { StatusChip } from '@/components/maintenance/StatusChip';
import { FilePreview } from '@/components/maintenance/FilePreview';

export default function TenantMaintenanceRequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requests, submitFeedback } = useMaintenanceStore();

  const request = requests.find((req) => req.id === id) ?? requests[0];

  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleFeedbackSubmit = async () => {
    if (feedbackRating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }
    setSubmittingFeedback(true);
    const success = await submitFeedback(request.id, feedbackText, feedbackRating);
    setSubmittingFeedback(false);
    if (success) {
      setFeedbackVisible(false);
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
    } else {
      Alert.alert('Error', 'Could not submit feedback. Please try again.');
    }
  };

  if (!request) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#64748b' }}>Request not found.</Text>
        </View>
      </View>
    );
  }

  const alreadyFeedback = !!request.tenantFeedback;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Title + Status */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>{request.title}</Text>
            <StatusChip status={request.status} />
          </View>
          <Text style={styles.subtitle}>
            {request.property} • {request.unit}
          </Text>
          <Text style={styles.description}>{request.description}</Text>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <DetailRow icon="tag" label="Category" value={request.category} />
          <DetailRow icon="alert-circle" label="Urgency" value={request.urgency} />
          <DetailRow
            icon="calendar-clock"
            label="Availability"
            value={new Date(request.availability).toLocaleString()}
          />
          <DetailRow
            icon="account-check"
            label="Permission to Enter"
            value={request.permissionToEnter ? 'Yes' : 'No'}
          />
        </View>

        {/* Activity */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {request.activity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityIcon}>
                <MaterialCommunityIcons name="checkbox-blank-circle" size={8} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityMessage}>{item.message}</Text>
                <Text style={styles.activityMeta}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Attachments */}
        {request.attachments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Attachments</Text>
            <FilePreview files={request.attachments} />
          </View>
        )}

        {/* Resolution Notes */}
        {request.resolutionNotes ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Resolution Notes</Text>
            <Text style={styles.description}>{request.resolutionNotes}</Text>
          </View>
        ) : null}

        {/* Existing feedback display */}
        {alreadyFeedback && (
          <View style={[styles.card, { borderColor: '#bbf7d0', borderWidth: 1 }]}>
            <Text style={styles.sectionTitle}>Your Feedback</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <MaterialCommunityIcons
                  key={s}
                  name="star"
                  size={20}
                  color={s <= (request.tenantFeedbackRating ?? 0) ? '#f59e0b' : '#e2e8f0'}
                />
              ))}
            </View>
            {request.tenantFeedback ? (
              <Text style={styles.description}>{request.tenantFeedback}</Text>
            ) : null}
          </View>
        )}

        {/* Feedback button — only for resolved requests that have no feedback yet */}
        {request.status === 'resolved' && !alreadyFeedback && (
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => setFeedbackVisible(true)}>
            <MaterialCommunityIcons name="star-outline" size={18} color="#2563eb" />
            <Text style={styles.feedbackText}>Provide Feedback</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Feedback Modal */}
      <Modal visible={feedbackVisible} animationType="slide" transparent onRequestClose={() => setFeedbackVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate this repair</Text>
              <TouchableOpacity onPress={() => setFeedbackVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Star rating */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)}>
                  <MaterialCommunityIcons
                    name={star <= feedbackRating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= feedbackRating ? '#f59e0b' : '#cbd5e1'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.feedbackInput}
              placeholder="Leave a comment (optional)"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              value={feedbackText}
              onChangeText={setFeedbackText}
            />

            <TouchableOpacity
              style={[styles.submitFeedbackButton, submittingFeedback && { opacity: 0.6 }]}
              onPress={handleFeedbackSubmit}
              disabled={submittingFeedback}>
              <Text style={styles.submitFeedbackText}>
                {submittingFeedback ? 'Submitting…' : 'Submit Feedback'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <MaterialCommunityIcons name={icon as any} size={18} color="#2563eb" />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, marginRight: 12 },
  subtitle: { color: '#475569', fontWeight: '600' },
  description: { color: '#475569', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 14, color: '#475569' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  activityRow: { flexDirection: 'row', gap: 12 },
  activityIcon: { width: 16, alignItems: 'center', paddingTop: 4 },
  activityMessage: { fontSize: 14, color: '#111827' },
  activityMeta: { fontSize: 12, color: '#94a3b8' },
  starsRow: { flexDirection: 'row', gap: 4, justifyContent: 'center', marginVertical: 8 },
  feedbackButton: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2563eb',
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  feedbackText: { color: '#2563eb', fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#111827',
  },
  submitFeedbackButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitFeedbackText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
