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
import { fmtDateTime } from '@/lib/dateUtils';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function TenantMaintenanceRequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requests, submitFeedback } = useMaintenanceStore();
  const t = useAppTheme();

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
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={t.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: t.text }]}>Request Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.textSecondary }}>Request not found.</Text>
        </View>
      </View>
    );
  }

  const alreadyFeedback = !!request.tenantFeedback;

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]}>Request Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Title + Status */}
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <View style={styles.row}>
            <Text style={[styles.title, { color: t.text }]}>{request.title}</Text>
            <StatusChip status={request.status} />
          </View>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>
            {request.property} • {request.unit}
          </Text>
          <Text style={[styles.description, { color: t.textSecondary }]}>{request.description}</Text>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <DetailRow icon="tag" label="Category" value={request.category} />
          <DetailRow icon="alert-circle" label="Urgency" value={request.urgency} />
          <DetailRow
            icon="calendar-clock"
            label="Availability"
            value={fmtDateTime(request.availability)}
          />
          <DetailRow
            icon="account-check"
            label="Permission to Enter"
            value={request.permissionToEnter ? 'Yes' : 'No'}
          />
        </View>

        {/* Activity */}
        <View style={[styles.card, { backgroundColor: t.card }]}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Activity</Text>
          {request.activity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityIcon}>
                <MaterialCommunityIcons name="checkbox-blank-circle" size={8} color={t.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityMessage, { color: t.text }]}>{item.message}</Text>
                <Text style={[styles.activityMeta, { color: t.textSecondary }]}>
                  {fmtDateTime(item.timestamp)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Attachments */}
        {request.attachments.length > 0 && (
          <View style={[styles.card, { backgroundColor: t.card }]}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Attachments</Text>
            <FilePreview files={request.attachments} />
          </View>
        )}

        {/* Resolution Notes */}
        {request.resolutionNotes ? (
          <View style={[styles.card, { backgroundColor: t.card }]}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Resolution Notes</Text>
            <Text style={[styles.description, { color: t.textSecondary }]}>{request.resolutionNotes}</Text>
          </View>
        ) : null}

        {/* Existing feedback display */}
        {alreadyFeedback && (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.successBg, borderWidth: 1 }]}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Your Feedback</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <MaterialCommunityIcons
                  key={s}
                  name="star"
                  size={20}
                  color={s <= (request.tenantFeedbackRating ?? 0) ? '#f59e0b' : t.border}
                />
              ))}
            </View>
            {request.tenantFeedback ? (
              <Text style={[styles.description, { color: t.textSecondary }]}>{request.tenantFeedback}</Text>
            ) : null}
          </View>
        )}

        {/* Feedback button — only for resolved requests that have no feedback yet */}
        {request.status === 'resolved' && !alreadyFeedback && (
          <TouchableOpacity
            style={[styles.feedbackButton, { backgroundColor: t.accent }]}
            onPress={() => setFeedbackVisible(true)}>
            <MaterialCommunityIcons name="star-outline" size={18} color={t.onAccent} />
            <Text style={[styles.feedbackText, { color: t.onAccent }]}>Provide Feedback</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Feedback Modal */}
      <Modal visible={feedbackVisible} animationType="slide" transparent onRequestClose={() => setFeedbackVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: t.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.text }]}>Rate this repair</Text>
              <TouchableOpacity onPress={() => setFeedbackVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Star rating */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)}>
                  <MaterialCommunityIcons
                    name={star <= feedbackRating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= feedbackRating ? '#f59e0b' : t.border}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.feedbackInput, { borderColor: t.border, color: t.text, backgroundColor: t.subtle }]}
              placeholder="Leave a comment (optional)"
              placeholderTextColor={t.textSecondary}
              multiline
              numberOfLines={4}
              value={feedbackText}
              onChangeText={setFeedbackText}
            />

            <TouchableOpacity
              style={[styles.submitFeedbackButton, { backgroundColor: t.accent }, submittingFeedback && { opacity: 0.6 }]}
              onPress={handleFeedbackSubmit}
              disabled={submittingFeedback}>
              <Text style={[styles.submitFeedbackText, { color: t.onAccent }]}>
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
  const t = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <MaterialCommunityIcons name={icon as any} size={18} color={t.textSecondary} />
        <Text style={[styles.detailLabel, { color: t.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: t.text }]}>{value}</Text>
    </View>
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
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  subtitle: { fontWeight: '600' },
  description: { fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  activityRow: { flexDirection: 'row', gap: 12 },
  activityIcon: { width: 16, alignItems: 'center', paddingTop: 4 },
  activityMessage: { fontSize: 14 },
  activityMeta: { fontSize: 12 },
  starsRow: { flexDirection: 'row', gap: 4, justifyContent: 'center', marginVertical: 8 },
  feedbackButton: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  feedbackText: { fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
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
  modalTitle: { fontSize: 18, fontWeight: '700' },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  submitFeedbackButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitFeedbackText: { fontWeight: '700', fontSize: 15 },
});
