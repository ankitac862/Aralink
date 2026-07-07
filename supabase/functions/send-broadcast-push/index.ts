/**
 * Supabase Edge Function: Send Broadcast (Promotional) Push
 *
 * Sends a push notification to EVERY registered device, or to a filtered
 * audience (landlords / tenants / managers). Optionally also writes an
 * in-app notification row for each user so the promo shows in the app's
 * notifications screen.
 *
 * Protected by a shared secret so only you can call it:
 *   set BROADCAST_SECRET in the function's env (Supabase dashboard → Edge
 *   Functions → send-broadcast-push → Secrets, or `supabase secrets set`).
 *
 * Payload:
 *   {
 *     "secret": "<BROADCAST_SECRET>",
 *     "title": "🎉 New feature!",
 *     "body": "You can now archive leases.",
 *     "audience": "all" | "landlord" | "tenant" | "manager",   // default "all"
 *     "data": { "type": "announcement" },                       // optional
 *     "createInAppNotification": true                           // optional, default false
 *   }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BroadcastRequest {
  secret: string;
  title: string;
  body: string;
  audience?: 'all' | 'landlord' | 'tenant' | 'manager';
  data?: Record<string, unknown>;
  createInAppNotification?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const {
      secret,
      title,
      body,
      audience = 'all',
      data = { type: 'announcement' },
      createInAppNotification = false,
    }: BroadcastRequest = await req.json();

    const expected = Deno.env.get('BROADCAST_SECRET');
    if (!expected || secret !== expected) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!title || !body) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing title or body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Collect target tokens (optionally filtered by user role)
    let tokens: { token: string; user_id: string }[] = [];
    if (audience === 'all') {
      const { data: rows, error } = await supabase
        .from('push_tokens')
        .select('token, user_id');
      if (error) throw error;
      tokens = rows ?? [];
    } else {
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_type', audience);
      if (usersError) throw usersError;
      const ids = (users ?? []).map((u) => u.id);
      if (ids.length > 0) {
        const { data: rows, error } = await supabase
          .from('push_tokens')
          .select('token, user_id')
          .in('user_id', ids);
        if (error) throw error;
        tokens = rows ?? [];
      }
    }

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: 'No registered devices for audience' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional: mirror the promo into the in-app notifications feed (one row per user)
    if (createInAppNotification) {
      const uniqueUserIds = [...new Set(tokens.map((t) => t.user_id))];
      const now = new Date().toISOString();
      const rows = uniqueUserIds.map((user_id) => ({
        user_id,
        type: 'announcement',
        title,
        message: body,
        data,
        is_read: false,
        created_at: now,
      }));
      // chunk inserts to stay under payload limits
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('notifications').insert(rows.slice(i, i + 500));
        if (error) console.error('In-app notification insert error:', error);
      }
    }

    // Send via Expo Push API in batches of 100
    const messages = tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
    }));

    let sent = 0;
    const errors: string[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      const result = (await response.json()) as { data?: { status: string; message?: string }[] };
      const tickets = result?.data ?? [];
      sent += tickets.filter((t) => t.status === 'ok').length;
      tickets
        .filter((t) => t.status !== 'ok')
        .forEach((t) => errors.push(t.message ?? 'unknown push error'));
    }

    return new Response(
      JSON.stringify({
        success: true,
        audience,
        devices: tokens.length,
        sent,
        failed: tokens.length - sent,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Broadcast error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
