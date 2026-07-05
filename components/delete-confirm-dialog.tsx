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

export type DeleteEntityType = 'property' | 'unit' | 'subunit' | 'tenant';

interface Props {
  visible: boolean;
  entityType: DeleteEntityType;
  entityName?: string;
  hasTenant: boolean;
  tenantName?: string | null;
  tenantCount?: number;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ENTITY_LABEL: Record<DeleteEntityType, string> = {
  property: 'property',
  unit: 'unit',
  subunit: 'room',
  tenant: 'tenant',
};

export function DeleteConfirmDialog({
  visible,
  entityType,
  entityName,
  hasTenant,
  tenantName,
  tenantCount = 0,
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

  const label = ENTITY_LABEL[entityType];

  const title = `Delete ${label.charAt(0).toUpperCase() + label.slice(1)}`;

  let message: string;
  if (entityType === 'tenant') {
    message = `Are you sure you want to delete ${entityName ? `"${entityName}"` : 'this tenant'}? This action cannot be undone.`;
  } else if (hasTenant) {
    const who =
      tenantCount === 1 && tenantName
        ? `"${tenantName}"`
        : `${tenantCount} active tenant${tenantCount !== 1 ? 's' : ''}`;
    message = `This ${label}${entityName ? ` "${entityName}"` : ''} has ${who} linked to it. Deleting it will permanently remove the tenant record as well. Are you sure you want to continue?`;
  } else {
    message = `Are you sure you want to delete ${entityName ? `"${entityName}"` : `this ${label}`}? This action cannot be undone.`;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.centeredWrapper} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: hasTenant ? '#fef3c720' : '#fee2e220' }]}>
            <MaterialCommunityIcons
              name={hasTenant ? 'alert-circle-outline' : 'trash-can-outline'}
              size={32}
              color={hasTenant ? '#f59e0b' : '#ef4444'}
            />
          </View>

          {/* Title */}
          <ThemedText style={[styles.title, { color: textColor }]}>{title}</ThemedText>

          {/* Message */}
          <ThemedText style={[styles.message, { color: secondaryText }]}>{message}</ThemedText>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: cancelBg }]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <ThemedText style={[styles.cancelText, { color: textColor }]}>Cancel</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.deleteButton, { opacity: isLoading ? 0.7 : 1 }]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.deleteText}>
                  {hasTenant && entityType !== 'tenant' ? 'Delete Anyway' : 'Delete'}
                </ThemedText>
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
    marginBottom: 24,
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
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
