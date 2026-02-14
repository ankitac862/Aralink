import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { messageId, conversationId, senderId, text } = await req.json();

    console.log('📨 Processing notification for message:', messageId);

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        tenant_id,
        tenant_record_id,
        landlord_id,
        tenant_name,
        landlord_name
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('Conversation not found:', convError);
      throw new Error('Conversation not found');
    }

    // Determine recipient (the person who DIDN'T send the message)
    let recipientId: string | null = null;
    let senderName = 'Someone';

    // Check if sender is tenant
    if (senderId === conversation.tenant_id) {
      recipientId = conversation.landlord_id;
      senderName = conversation.tenant_name || 'Tenant';
    } 
    // Check if sender is landlord
    else if (senderId === conversation.landlord_id) {
      // For tenant recipient, try to get their user_id
      if (conversation.tenant_id) {
        recipientId = conversation.tenant_id;
      } else if (conversation.tenant_record_id) {
        // Tenant hasn't signed up yet, look up their user_id from tenants table
        const { data: tenantRecord } = await supabase
          .from('tenants')
          .select('user_id')
          .eq('id', conversation.tenant_record_id)
          .single();
        
        recipientId = tenantRecord?.user_id || null;
      }
      senderName = conversation.landlord_name || 'Landlord';
    }

    if (!recipientId) {
      console.log('⚠️ No recipient found or tenant not signed up yet');
      return new Response(
        JSON.stringify({ success: false, reason: 'No recipient' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Sending notification to:', recipientId);

    // Get recipient's push tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', recipientId);

    if (tokensError || !tokens || tokens.length === 0) {
      console.log('⚠️ No push tokens found for recipient');
      return new Response(
        JSON.stringify({ success: false, reason: 'No tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📱 Found', tokens.length, 'push tokens');

    // Send push notifications to all recipient's devices
    const notifications = tokens.map(async ({ token }) => {
      const message = {
        to: token,
        sound: 'default',
        title: senderName,
        body: text.substring(0, 100), // Truncate long messages
        data: {
          type: 'chat_message',
          conversationId,
          messageId,
          senderId,
        },
        priority: 'high',
        channelId: 'default',
      };

      console.log('📤 Sending push notification:', message);

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('✅ Push notification sent:', result);
      return result;
    });

    const results = await Promise.all(notifications);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
