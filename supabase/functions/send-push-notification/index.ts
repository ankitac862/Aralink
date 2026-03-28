/**
 * Supabase Edge Function: Send Push Notification (Generic / Reusable)
 *
 * Called by other edge functions AND by the client app to deliver
 * a push notification to every registered device of a given user.
 *
 * Payload:
 *   { userId, title, body, data?, channelId? }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendPushRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
}

interface ExpoMessage {
  to: string;
  sound: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority: string;
  channelId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, title, body, data = {}, channelId = 'default' }: SendPushRequest =
      await req.json();

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: userId, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📬 Sending push to user: ${userId} | title: "${title}"`);

    // Look up all push tokens for this user
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId);

    if (tokensError) {
      console.error('Error fetching push tokens:', tokensError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch push tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No push tokens found for user:', userId);
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: 'No registered devices' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 Found ${tokens.length} device(s) for user`);

    // Build Expo push messages
    const messages: ExpoMessage[] = tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId,
    }));

    // Send to Expo Push API (batched — max 100 per request)
    const batches: ExpoMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
      batches.push(messages.slice(i, i + 100));
    }

    const results = await Promise.allSettled(
      batches.map(async (batch) => {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });
        const json = await response.json();
        console.log('✅ Expo push response:', JSON.stringify(json));

        // Clean up invalid tokens
        if (json.data) {
          for (let i = 0; i < json.data.length; i++) {
            const item = json.data[i];
            if (
              item.status === 'error' &&
              (item.details?.error === 'DeviceNotRegistered' ||
                item.details?.error === 'InvalidCredentials')
            ) {
              const badToken = batch[i]?.to;
              if (badToken) {
                console.log('🗑️ Removing invalid token:', badToken.substring(0, 20) + '...');
                await supabase
                  .from('push_tokens')
                  .delete()
                  .eq('token', badToken)
                  .eq('user_id', userId);
              }
            }
          }
        }

        return json;
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({ success: true, sent, failed, batchCount: batches.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Unexpected error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
