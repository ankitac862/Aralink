# 💬 Chat Implementation - Setup Guide

Your Aralink app now has a complete chat system for messaging between landlords and tenants!

## Quick Setup (5 minutes)

### Step 1: Create Database Tables
1. Go to your Supabase Dashboard
2. Click **SQL Editor** → **New Query**
3. Copy all SQL from `docs/MESSAGING_SETUP.sql`
4. Click **Run**

This creates:
- `conversations` table (stores conversations between users)
- `messages` table (stores individual messages)
- RLS policies (security)
- Auto-update trigger (updates last message)

### Step 2: That's It! 
The app is ready to use. No code changes needed.

---

## How to Use the Chat

### For Landlords/Property Managers:
1. Open **Messages** tab → See all conversations
2. Tap a conversation → Start chatting
3. Or from **Tenants** list → Click tenant → (You can add a message button)

### For Tenants:
1. Open **Messages** tab → See all conversations  
2. Tap a conversation → Start chatting

---

## Features

✅ **Real-Time Messaging**
- Messages appear instantly
- Auto-read status tracking
- Last message preview

✅ **Conversation Management**
- View all conversations in one place
- Unread count badges
- Latest message first

✅ **User-Friendly**
- Dark/light mode support
- Clean, intuitive UI
- Auto-scroll to latest message

✅ **Secure**
- Only users in conversation can see messages
- Row-level security enabled
- Encrypted at rest and in transit

---

## Files Created

| File | Purpose |
|------|---------|
| `services/messageService.ts` | Message API & Supabase integration |
| `app/(tabs)/messages.tsx` | Conversations list screen |
| `app/chat/[id].tsx` | Chat detail screen |
| `docs/MESSAGING_SETUP.sql` | Database schema SQL |
| `docs/CHAT_SETUP_GUIDE.md` | This file |

---

## API Reference

### Get Conversations
```typescript
const conversations = await messageService.getConversations();
```

### Get or Create Conversation
```typescript
const conversation = await messageService.getOrCreateConversation(
  propertyId,
  tenantId,
  landlordId,
  tenantName,
  landlordName
);
```

### Send Message
```typescript
await messageService.sendMessage(conversationId, 'Hello!');
```

### Subscribe to Messages
```typescript
const sub = messageService.subscribeToMessages(
  conversationId,
  (newMessage) => {
    console.log('New message:', newMessage);
  }
);

// Cleanup
messageService.unsubscribe(sub);
```

---

## Integrating with Your Screens

### Add Message Button to Tenant Detail

To add a "Message" button when viewing a tenant:

```typescript
import messageService from '@/services/messageService';

const handleMessage = async () => {
  const conversation = await messageService.getOrCreateConversation(
    property.id,
    tenant.id,
    currentUser.id,
    tenant.name,
    currentUser.name
  );
  router.push(`/chat/${conversation.id}`);
};
```

### Navigate to Chat from Any Screen
```typescript
import { useRouter } from 'expo-router';

const router = useRouter();
router.push(`/chat/${conversationId}`);
```

---

## Troubleshooting

### Messages Not Showing
- Check Supabase tables exist (run SQL if not done)
- Verify RLS policies enabled
- Check network connection

### Can't Send Message
- Verify user is authenticated
- Check conversation ID is valid
- Check Supabase API keys in `.env.local`

### Real-Time Not Working
- Verify WebSocket connection
- Check browser console for errors
- Try refreshing the page

---

## Data Structure

### Conversation
```typescript
{
  id: string;                    // Unique ID
  property_id: string;           // Associated property
  tenant_id: string;             // Tenant's ID
  landlord_id: string;           // Landlord's ID
  manager_id?: string;           // Optional manager
  tenant_name: string;           // Tenant's name
  landlord_name: string;         // Landlord's name
  manager_name?: string;         // Manager's name
  last_message?: string;         // Last message text
  last_message_at?: string;      // When sent
  last_message_by?: string;      // Who sent it
  tenant_unread_count: number;   // Unread count
  landlord_unread_count: number;
  manager_unread_count: number;
  is_archived: boolean;          // Hidden?
  created_at: string;
  updated_at: string;
}
```

### Message
```typescript
{
  id: string;                 // Unique ID
  conversation_id: string;    // Which conversation
  sender_id: string;          // Who sent it
  text: string;               // Message content
  attachment_url?: string;    // Optional file URL
  attachment_type?: string;   // File type
  is_read: boolean;           // Has been read?
  read_at?: string;           // When read?
  created_at: string;
  updated_at: string;
}
```

---

## Next Steps

### Immediate
- [ ] Run SQL to create tables
- [ ] Test messaging between 2 accounts
- [ ] Add message button to tenant detail screen

### Future Enhancements
- [ ] File attachments (images)
- [ ] Typing indicators
- [ ] Message search
- [ ] Chat groups
- [ ] Push notifications

---

## Security

✅ **Row Level Security (RLS)**
- Users can only see their own conversations
- Users can only send messages to conversations they're in
- Automatically enforced by Supabase

✅ **Authentication**
- All operations require authenticated user
- User ID auto-populated from session

✅ **Encryption**
- Messages encrypted in transit (HTTPS)
- Stored encrypted at rest in Supabase

---

## Questions?

Check:
- `services/messageService.ts` - Method documentation
- `app/(tabs)/messages.tsx` - Conversation list implementation
- `app/chat/[id].tsx` - Chat screen implementation

Run SQL first, then everything else works automatically!
