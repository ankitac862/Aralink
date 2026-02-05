import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import messageService, { Message } from '@/services/messageService';
import { supabase } from '@/lib/supabase';

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { user } = useAuthStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationName, setConversationName] = useState('');
  const [subscription, setSubscription] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const userId = user?.id;

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const borderColor = isDark ? '#394a57' : '#E5E7EB';
  const primaryColor = '#4A90E2';
  const inputBgColor = isDark ? '#1a2a33' : '#ffffff';

  useEffect(() => {
    if (conversationId) {
      loadConversationAndMessages();
    }
  }, [conversationId, userId]);

  const loadConversationAndMessages = async () => {
    try {
      setLoading(true);

      const messageData = await messageService.getMessages(
        conversationId as string
      );
      setMessages(messageData);

      const { data: convData } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convData) {
        const displayName =
          convData.tenant_name === 'You'
            ? convData.landlord_name
            : convData.tenant_name;
        setConversationName(displayName);

        await messageService.markAllAsRead(conversationId as string);
      }

      const sub = messageService.subscribeToMessages(
        conversationId as string,
        (newMessage) => {
          setMessages((prev) => [...prev, newMessage]);
          flatListRef.current?.scrollToEnd({ animated: true });

          if (newMessage.sender_id !== userId && !newMessage.is_read) {
            messageService.markMessageAsRead(newMessage.id);
          }
        }
      );

      setSubscription(sub);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (subscription) {
        messageService.unsubscribe(subscription);
      }
    };
  }, [subscription]);

  const handleSendMessage = async () => {
    if (!text.trim() || !conversationId) return;

    try {
      setSending(true);
      const trimmedText = text.trim();
      setText('');

      // OPTIMIZATION: Add message to UI immediately (optimistic update)
      // Don't wait for database confirmation
      const optimisticMessage: Message = {
        id: Date.now().toString(), // Temporary ID
        conversation_id: conversationId as string,
        sender_id: userId || '',
        text: trimmedText,
        is_read: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add to messages immediately
      setMessages((prev) => [...prev, optimisticMessage]);
      flatListRef.current?.scrollToEnd({ animated: true });

      // Send to database in background
      const sentMessage = await messageService.sendMessage(
        conversationId as string,
        trimmedText
      );

      // Replace temporary message with actual message from database
      if (sentMessage) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticMessage.id ? sentMessage : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setText(text);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.sender_id === userId;
    const messageTime = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View
        style={[
          styles.messageContainer,
          isOwn ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}>
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isOwn ? primaryColor : cardBgColor,
            },
          ]}>
          <ThemedText
            style={[
              styles.messageText,
              {
                color: isOwn ? '#ffffff' : textPrimaryColor,
              },
            ]}>
            {item.text}
          </ThemedText>
        </View>
        <ThemedText style={[styles.timestamp, { color: textSecondaryColor }]}>
          {messageTime}
        </ThemedText>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: cardBgColor,
              borderBottomColor: borderColor,
              paddingTop: insets.top + 12,
            },
          ]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={textPrimaryColor}
            />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
            Loading...
          </ThemedText>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: cardBgColor,
              borderBottomColor: borderColor,
              paddingTop: insets.top + 12,
            },
          ]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={textPrimaryColor}
            />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: textPrimaryColor }]}>
            {conversationName}
          </ThemedText>
          <View style={styles.headerRight} />
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <MaterialCommunityIcons
                name="message-outline"
                size={48}
                color={textSecondaryColor}
              />
              <ThemedText style={[styles.emptyText, { color: textSecondaryColor }]}>
                No messages yet. Start the conversation!
              </ThemedText>
            </View>
          }
        />

        {/* Input Area */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: inputBgColor,
              borderTopColor: borderColor,
              paddingBottom: insets.bottom + 8,
            },
          ]}>
          <TextInput
            style={[
              styles.input,
              {
                color: textPrimaryColor,
                borderColor: borderColor,
                backgroundColor: isDark ? '#0f1620' : '#f5f5f5',
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={textSecondaryColor}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!text.trim() || sending}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  text.trim() && !sending ? primaryColor : borderColor,
              },
            ]}>
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <MaterialCommunityIcons name="send" size={20} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  messageContainer: {
    marginVertical: 6,
    flexDirection: 'column',
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 15,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    marginHorizontal: 12,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
