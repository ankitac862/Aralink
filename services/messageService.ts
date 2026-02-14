import { supabase } from '@/lib/supabase';

export interface Conversation {
  id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  manager_id?: string;
  tenant_name: string;
  landlord_name: string;
  manager_name?: string;
  last_message?: string;
  last_message_at?: string;
  last_message_by?: string;
  tenant_unread_count: number;
  landlord_unread_count: number;
  manager_unread_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  attachment_url?: string;
  attachment_type?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

class MessageService {
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  async getOrCreateConversation(
    propertyId: string,
    tenantRecordId: string, // Tenant record ID from the tenants table
    landlordId: string,
    tenantName: string,
    landlordName: string,
    managerId?: string,
    managerName?: string
  ): Promise<Conversation> {
    try {
      console.log('🔍 getOrCreateConversation - Looking for conversation:', {
        propertyId,
        tenantRecordId,
        landlordId,
      });

      // Try to find existing conversation by tenant record
      const { data: existing, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('property_id', propertyId)
        .eq('tenant_record_id', tenantRecordId)
        .eq('landlord_id', landlordId);
      
      console.log('🔍 Query result:', { existing, error: fetchError });

      if (existing && !fetchError && Array.isArray(existing) && existing.length > 0) {
        return existing[0]; // Return first matching conversation
      }

      // Get tenant's user_id if they have an account
      let tenantUserId: string | null = null;
      const { data: tenantRecord } = await supabase
        .from('tenants')
        .select('user_id')
        .eq('id', tenantRecordId)
        .single();
      
      if (tenantRecord?.user_id) {
        tenantUserId = tenantRecord.user_id;
      }

      // Create new conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          property_id: propertyId,
          tenant_record_id: tenantRecordId,
          tenant_id: tenantUserId, // Will be null if tenant hasn't signed up
          landlord_id: landlordId,
          manager_id: managerId,
          tenant_name: tenantName,
          landlord_name: landlordName,
          manager_name: managerName,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting/creating conversation:', error);
      throw error;
    }
  }

  async getConversations() {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(
          `tenant_id.eq.${user.id},landlord_id.eq.${user.id},manager_id.eq.${user.id}`
        )
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).reverse();
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async sendMessage(
    conversationId: string,
    text: string,
    attachmentUrl?: string,
    attachmentType?: string
  ) {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
        })
        .select()
        .single();

      if (error) throw error;

      // Send push notification asynchronously (don't wait for it)
      if (data) {
        this.sendPushNotification(data.id, conversationId, user.id, text).catch(err => {
          console.error('Error sending push notification:', err);
          // Don't throw - message was sent successfully even if notification failed
        });
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendPushNotification(
    messageId: string,
    conversationId: string,
    senderId: string,
    text: string
  ) {
    try {
      const { data, error } = await supabase.functions.invoke('send-message-notification', {
        body: {
          messageId,
          conversationId,
          senderId,
          text,
        },
      });

      if (error) {
        console.error('Error calling notification function:', error);
      } else {
        console.log('✅ Push notification sent:', data);
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  async markMessageAsRead(messageId: string) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  async markAllAsRead(conversationId: string) {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  subscribeToMessages(conversationId: string, callback: (message: Message) => void) {
    return supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .subscribe();
  }

  subscribeToConversations(callback: (conversation: Conversation) => void) {
    return supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as Conversation);
          }
        }
      )
      .subscribe();
  }

  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }

  async archiveConversation(conversationId: string) {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ is_archived: true })
        .eq('id', conversationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error archiving conversation:', error);
      throw error;
    }
  }
}

export default new MessageService();
