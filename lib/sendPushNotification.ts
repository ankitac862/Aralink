/**
 * lib/sendPushNotification.ts
 *
 * Client-side helper that calls the `send-push-notification` Edge Function.
 * Use this anywhere in the app after inserting an in-app notification row,
 * so the recipient also gets a device push.
 *
 * Usage:
 *   await triggerPushNotification({
 *     userId: landlordId,
 *     title: 'New Application Received',
 *     body: `${applicantName} applied for ${address}`,
 *     data: { type: 'application', applicationId: data.id },
 *   });
 */

import { supabase } from '@/lib/supabase';

export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
}

/**
 * Trigger a push notification for a user.
 * Fires-and-forgets: errors are logged but never thrown,
 * so they cannot break the calling flow.
 */
export async function triggerPushNotification(payload: PushPayload): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: payload,
    });

    if (error) {
      console.error('⚠️ Push notification error:', error.message);
      return;
    }

    console.log('✅ Push notification sent:', data);
  } catch (err) {
    console.error('⚠️ Push notification exception:', err);
  }
}
