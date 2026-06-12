// Icon + color mapping for the unified "Recent Activity" feed (notifications table).
// Shared between landlord/manager and tenant dashboards so new activity types
// only need to be mapped in one place.

export interface ActivityIconInfo {
  icon: string;
  bgLight: string;
  bgDark: string;
  colorLight: string;
  colorDark: string;
}

const DEFAULT_ICON: ActivityIconInfo = {
  icon: 'bell',
  bgLight: '#e5e7eb',
  bgDark: '#374151',
  colorLight: '#6b7280',
  colorDark: '#9ca3af',
};

const ACTIVITY_ICON_MAP: Record<string, ActivityIconInfo> = {
  property_added: { icon: 'home-plus', bgLight: '#dbeafe', bgDark: '#1e3a5f', colorLight: '#2563eb', colorDark: '#60a5fa' },
  payment: { icon: 'cash-multiple', bgLight: '#d1fae5', bgDark: '#065f46', colorLight: '#059669', colorDark: '#10b981' },
  expense: { icon: 'cash-minus', bgLight: '#fee2e2', bgDark: '#7f1d1d', colorLight: '#dc2626', colorDark: '#f87171' },
  maintenance_request: { icon: 'toolbox', bgLight: '#fef3c7', bgDark: '#78350f', colorLight: '#d97706', colorDark: '#f59e0b' },
  maintenance_status_update: { icon: 'wrench-clock', bgLight: '#fef3c7', bgDark: '#78350f', colorLight: '#d97706', colorDark: '#f59e0b' },
  application: { icon: 'file-document', bgLight: '#ede9fe', bgDark: '#4c1d95', colorLight: '#7c3aed', colorDark: '#a78bfa' },
  application_approved: { icon: 'file-check', bgLight: '#d1fae5', bgDark: '#065f46', colorLight: '#059669', colorDark: '#10b981' },
  application_rejected: { icon: 'file-remove', bgLight: '#fee2e2', bgDark: '#7f1d1d', colorLight: '#dc2626', colorDark: '#f87171' },
  lease: { icon: 'gavel', bgLight: '#e0e7ff', bgDark: '#312e81', colorLight: '#4f46e5', colorDark: '#818cf8' },
  lease_received: { icon: 'file-sign', bgLight: '#e0e7ff', bgDark: '#312e81', colorLight: '#4f46e5', colorDark: '#818cf8' },
  lease_rejected: { icon: 'file-cancel', bgLight: '#fee2e2', bgDark: '#7f1d1d', colorLight: '#dc2626', colorDark: '#f87171' },
  chat_message: { icon: 'message-text', bgLight: '#dbeafe', bgDark: '#1e3a5f', colorLight: '#2563eb', colorDark: '#60a5fa' },
  arrival_date_change_request: { icon: 'calendar-clock', bgLight: '#fef3c7', bgDark: '#78350f', colorLight: '#d97706', colorDark: '#f59e0b' },
  invite: { icon: 'email-plus', bgLight: '#dbeafe', bgDark: '#1e3a5f', colorLight: '#2563eb', colorDark: '#60a5fa' },
};

export function getActivityIconInfo(type: string): ActivityIconInfo {
  return ACTIVITY_ICON_MAP[type] || DEFAULT_ICON;
}
