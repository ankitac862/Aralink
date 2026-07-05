import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from './themed-text';

export type LeaseManageAction = 'delete' | 'replace';

interface Props {
  visible: boolean;
  action: LeaseManageAction;
  leaseStatus: string;
  /** Property address or other identifier shown in the message */
  entityName?: string;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const FULLY_SIGNED = ['signed_pending_move_in', 'active'];
const TENANT_SIGNED = 'signed'; // tenant only, landlord not yet

function buildMessage(action: LeaseManageAction, status: string, entityName?: string): string {
  const entity = entityName ? `"${entityName}"` : 'this lease';
  const fullySigned = FULLY_SIGNED.includes(status);
  const tenantSigned = status === TENANT_SIGNED;

  if (action === 'delete') {
    if (fullySigned) {
      return `Are you sure you want to delete ${entity}? This is a fully executed lease. This action cannot be undone.`;
    }
    if (tenantSigned) {
      return (
        `The tenant has already signed ${entity}, but you have not yet countersigned it. ` +
        `Deleting now will permanently remove the lease and the tenant's signature. This action cannot be undone.`
      );
    }
    return `Are you sure you want to permanently delete ${entity}? This action cannot be undone.`;
  }

  // replace
  if (fullySigned) {
    return `${entity} is a fully executed lease. Uploading a new document will replace the current one. The active tenant relationship will not be affected.`;
  }
  if (tenantSigned) {
    return `The tenant has already signed ${entity}. Uploading a new document will invalidate their signature and reset the lease to "Uploaded" status — you will need to resend it for signing.`;
  }
  return `Upload a new document to replace the current one on ${entity}? The lease will be reset to "Uploaded" status.`;
}

export function LeaseManageDialog({
  visible,
  action,
  leaseStatus,
  entityName,
  isLoading,
  onCancel,
  onConfirm,
}: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const textColor = isDark ? '#f3f4f6' : '#111827';
  const secondaryText = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const cancelBg = isDark ? '#374151' : '#f3f4f6';

  const fullySigned = FULLY_SIGNED.includes(leaseStatus);
  const tenantSigned = leaseStatus === TENANT_SIGNED;
  const isHighRisk = fullySigned || tenantSigned;

  const iconName = fullySigned
    ? 'shield-alert-outline'
    : tenantSigned
    ? 'alert-circle-outline'
    : action === 'delete'
    ? 'trash-can-outline'
    : 'file-replace-outline';

  const iconColor = fullySigned ? '#ef4444' : tenantSigned ? '#f59e0b' : '#ef4444';
  const iconBg = fullySigned
    ? '#fee2e220'
    : tenantSigned
    ? '#fef3c720'
    : '#fee2e220';

  const title = action === 'delete' ? 'Delete Lease' : 'Replace Document';

  const confirmLabel =
    action === 'delete'
      ? tenantSigned
        ? 'Delete Anyway'
        : 'Delete'
      : tenantSigned
      ? 'Replace Anyway'
      : 'Replace';

  const confirmColor = isHighRisk ? '#ef4444' : '#137fec';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.centeredWrapper} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <MaterialCommunityIcons name={iconName as any} size={32} color={iconColor} />
          </View>

          <ThemedText style={[styles.title, { color: textColor }]}>{title}</ThemedText>

          <ThemedText style={[styles.message, { color: secondaryText }]}>
            {buildMessage(action, leaseStatus, entityName)}
          </ThemedText>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: cancelBg }]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <ThemedText style={[styles.cancelText, { color: textColor }]}>Cancel</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton, { backgroundColor: confirmColor, opacity: isLoading ? 0.7 : 1 }]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.confirmText}>{confirmLabel}</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centeredWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  archiveNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    width: '100%',
  },
  archiveNoteText: {
    fontSize: 12,
    color: '#ef4444',
    flex: 1,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {},
  confirmButton: {},
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
