# 📚 Aralink Project - Complete Code Structure Guide

## 🎯 Project Overview

**Aralink** is a comprehensive property management mobile application built with React Native (Expo) and TypeScript. It allows landlords, property managers, and tenants to manage properties, tenants, maintenance, leases, and accounting all in one unified platform.

### Tech Stack Summary:
- **Frontend**: React Native with Expo (~SDK 54), TypeScript
- **Navigation**: Expo Router (file-based routing like Next.js)
- **State Management**: Zustand (lightweight, modern alternative to Redux)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **UI Components**: React Native + Custom themed components
- **Real-time**: Supabase RealtimeChannel subscriptions
- **Authentication**: Email/Password + OAuth (Google, Apple, Facebook)

---

## 📁 Complete Project Structure

```
Aralink/
│
├── 📄 app.json                    # Expo configuration (app metadata, build settings)
├── 📄 package.json                # Dependencies (React Native, Expo, Supabase, Zustand)
├── 📄 tsconfig.json               # TypeScript configuration
├── 📄 eslint.config.js            # Linting rules
├── 📄 expo-env.d.ts               # TypeScript definitions for Expo
│
├── 📚 Documentation Files
│   ├── README.md                  # Project overview & features
│   ├── ARCHITECTURE.md            # System architecture & data flow
│   ├── QUICK_START_GUIDE.md       # Setup instructions
│   ├── QUICKSTART.md              # Quick setup (similar to above)
│   ├── ANDROID_OAUTH_SETUP.md     # Android OAuth configuration
│   └── docs/
│       ├── SUPABASE_SETUP.md      # Database setup instructions
│       ├── SUPABASE_MIGRATION.md  # Migration guide
│       ├── IMPLEMENTATION_SUMMARY.md # Feature implementation notes
│       ├── MESSAGING_SETUP.sql    # Chat database schema
│       └── CHAT_SETUP_GUIDE.md    # Chat feature documentation
│
├── 🎨 assets/                     # App assets
│   ├── animations/                # Lottie animations
│   └── images/                    # Icons, splash screen, app logo
│
├── 📱 app/                        # MAIN APP SCREENS (file-based routing)
│   ├── _layout.tsx                # Root layout (auth/tabs routing logic)
│   ├── splash.tsx                 # Splash screen (loading state)
│   ├── modal.tsx                  # Modal presentation wrapper
│   │
│   ├── 🔐 (auth)/                 # Authentication flow
│   │   ├── _layout.tsx            # Auth stack layout
│   │   ├── index.tsx              # Landing page (role selector)
│   │   ├── login.tsx              # Email/Password login + OAuth buttons
│   │   ├── register.tsx           # Sign up with email/password
│   │   ├── otp.tsx                # Email verification
│   │   ├── forgot-password.tsx    # Password reset
│   │   └── ...
│   │
│   ├── 📊 (tabs)/                 # Main tabbed navigation
│   │   ├── _layout.tsx            # Tab navigator (6 tabs)
│   │   ├── index.tsx              # 🏠 LANDLORD DASHBOARD
│   │   │   │                       # Shows 5 colored tiles
│   │   │   ├─ Properties
│   │   │   ├─ Tenants
│   │   │   ├─ Maintenance
│   │   │   ├─ Leases
│   │   │   └─ Accounting
│   │   │
│   │   ├── tenant-dashboard.tsx   # 👤 TENANT DASHBOARD
│   │   │   │                       # Shows tenant-specific info
│   │   │   ├─ My Lease
│   │   │   ├─ Maintenance Requests
│   │   │   ├─ Messages
│   │   │   └─ Profile
│   │   │
│   │   ├── properties.tsx         # 🏘️ PROPERTIES LIST TAB
│   │   │   └─ Shows all properties with address, units
│   │   │   └─ "+ Add Property" button
│   │   │
│   │   ├── tenants.tsx            # 👥 TENANTS LIST TAB
│   │   │   └─ Shows all tenants with contact info
│   │   │   └─ "+ Add Tenant" button
│   │   │
│   │   ├── leases.tsx             # 📝 LEASES LIST TAB
│   │   │   └─ Shows all active/inactive leases
│   │   │   └─ "+ Create Lease" button
│   │   │
│   │   ├── maintenance.tsx        # 🛠️ MAINTENANCE LIST TAB
│   │   │   └─ Maintenance tickets (open/in-progress/resolved)
│   │   │   └─ "+ New Request" button
│   │   │   └─ Status colors & priority badges
│   │   │
│   │   ├── accounting.tsx         # 💰 ACCOUNTING/INVOICES TAB
│   │   │   └─ Invoices & transactions
│   │   │   └─ Category filtering (Rent, Maintenance, Utilities, etc)
│   │   │   └─ "+ Add Transaction" button
│   │   │
│   │   ├── explore.tsx            # 🔍 EXPLORE TAB (placeholder)
│   │   │   └─ Future features
│   │   │
│   │   ├── messages.tsx           # 💬 MESSAGES TAB (NEW)
│   │   │   └─ Conversation list (real-time updates)
│   │   │   └─ "+ New Chat" button
│   │   │   └─ Unread message counts
│   │   │
│   │   └── tenant-dashboard/      # Tenant-specific sub-routes
│   │       ├─ _layout.tsx
│   │       ├─ lease-status.tsx
│   │       ├─ maintenance-request.tsx
│   │       └─ ...
│   │
│   ├── 🔗 Modal/Detail Screens (opened as modals)
│   │   ├── property-detail.tsx    # Add/Edit property form
│   │   ├── tenant-detail.tsx      # Add/Edit tenant form
│   │   ├── maintenance-detail.tsx # Create maintenance request
│   │   ├── applicant-detail.tsx   # Applicant review/approval
│   │   ├── invoice-detail.tsx     # Add/Edit invoice/transaction
│   │   │
│   │   ├── add-property.tsx       # Add property (alias)
│   │   ├── add-unit.tsx           # Add unit to property
│   │   ├── add-room.tsx           # Add room/subunit
│   │   ├── add-tenant.tsx         # Add tenant (alias)
│   │   ├── add-transaction.tsx    # Add transaction (alias)
│   │   │
│   │   └── start-chat.tsx         # 🆕 Start new conversation
│   │       └─ Select user to message
│   │       └─ Create/retrieve conversation
│   │
│   ├── 📖 List/Detail Screens
│   │   ├── properties.tsx         # All properties
│   │   ├── property-detail.tsx    # Single property view
│   │   │
│   │   ├── tenants.tsx            # All tenants
│   │   ├── tenant-detail.tsx      # Single tenant view
│   │   │
│   │   ├── leases.tsx             # All leases
│   │   ├── lease-preview.tsx      # Preview lease document
│   │   ├── lease-sent.tsx         # Lease signing status
│   │   ├── finalize-lease-terms.tsx # Final lease review
│   │   │
│   │   ├── maintenance.tsx        # All maintenance tickets
│   │   ├── maintenance-detail.tsx # Single ticket view
│   │   │
│   │   ├── applicants.tsx         # Applicant list
│   │   ├── applicant-detail.tsx   # Single applicant review
│   │   ├── landlord-applications.tsx # All applications
│   │   │
│   │   └── accounting.tsx         # All transactions
│   │       └── accounting/
│   │           └── RentChart.tsx  # Chart component
│   │
│   ├── 👤 Tenant-specific screens
│   │   ├── tenant-lease-start.tsx # Lease initiation
│   │   ├── tenant-lease-step1-6.tsx # Multi-step lease signing
│   │   ├── tenant-lease-review-sign.tsx # Final review before signing
│   │   ├── tenant-lease-status.tsx # Current lease status
│   │   ├── tenant-lease-submitted.tsx # Confirmation
│   │   │
│   │   ├── tenant-maintenance-request.tsx # Submit request
│   │   ├── tenant-maintenance-detail.tsx  # View request
│   │   ├── tenant-maintenance-status.tsx  # Track status
│   │   ├── tenant-maintenance-confirmation.tsx # Confirmation
│   │   │
│   │   ├── tenant-detail.tsx      # Tenant profile
│   │   ├── tenant-lease-review-sign.tsx # Sign lease
│   │   │
│   │   └── 🆕 tenant-chat/       # Tenant messaging
│   │       └── [id].tsx           # Chat with landlord
│   │
│   ├── 💬 Chat/Messaging
│   │   ├── chat/
│   │   │   └── [id].tsx           # Individual chat screen
│   │   ├── messages.tsx           # Messages tab/list
│   │   └── start-chat.tsx         # Start new conversation
│   │
│   ├── 🎯 Admin/Settings
│   │   ├── profile.tsx            # User profile page
│   │   ├── settings.tsx           # App settings
│   │   ├── explore.tsx            # Explore section
│   │   └── landlord-applications/ # Admin application reviews
│   │       └── ...
│   │
│   └── 🔗 Other Routes
│       ├── invite.tsx             # Invite link handling
│       ├── modal.tsx              # Modal wrapper
│       └── splash.tsx             # Loading screen
│
├── 🧩 components/                 # Reusable React components
│   ├── external-link.tsx          # Link component
│   ├── haptic-tab.tsx             # Tab with haptic feedback
│   ├── hello-wave.tsx             # Greeting animation
│   ├── parallax-scroll-view.tsx   # Parallax scrolling
│   ├── RentChart.tsx              # Chart for accounting
│   ├── splash-screen.tsx          # Splash screen component
│   ├── themed-text.tsx            # Text with theme support
│   ├── themed-view.tsx            # View with theme support
│   ├── user-type-selector.tsx     # Role selector (Landlord/Tenant)
│   ├── web-navbar.tsx             # Web navigation bar
│   │
│   ├── maintenance/               # Maintenance-specific components
│   │   ├── MaintenanceCard.tsx
│   │   └── StatusBadge.tsx
│   │
│   └── ui/                        # Generic UI components
│       └── (reusable buttons, inputs, etc.)
│
├── 🎨 constants/                  # App constants
│   └── theme.ts                   # Colors, spacing, typography
│
├── 🔗 context/                    # React Context (rarely used, Zustand preferred)
│   └── auth-context.ts            # Auth context provider
│
├── 📚 docs/                       # Detailed documentation
│   ├── SUPABASE_SETUP.md          # Database schema setup
│   ├── SUPABASE_MIGRATION.md      # Migration guide
│   ├── MESSAGING_SETUP.sql        # Chat feature SQL
│   ├── CHAT_SETUP_GUIDE.md        # Chat documentation
│   └── IMPLEMENTATION_SUMMARY.md  # Implementation notes
│
├── 🪝 hooks/                      # Custom React hooks
│   ├── use-app-theme.ts           # App theme hook
│   ├── use-auth.ts                # Auth state hook
│   ├── use-color-scheme.ts        # Platform-specific color scheme
│   ├── use-color-scheme.web.ts    # Web color scheme
│   ├── use-theme-color.ts         # Theme color hook
│   └── use-user-role.ts           # User role hook
│
├── 📡 lib/                        # Library/service setup
│   └── supabase.ts                # Supabase client + all CRUD operations
│       │                          # 150+ functions for:
│       │                          # - Auth (sign up, sign in, OAuth, etc.)
│       │                          # - Properties (create, read, update, delete)
│       │                          # - Tenants (create, read, update, delete)
│       │                          # - Leases (create, sign, retrieve)
│       │                          # - Maintenance (create, update, status)
│       │                          # - Accounting (transactions, invoices)
│       │                          # - Applications (applicant management)
│       │                          # - User profiles
│       │                          # - And more...
│       └─ Real-time subscriptions
│       └─ RLS policy enforcement
│
├── 🔐 services/                   # Business logic services
│   ├── oauth-service.ts           # Google/Apple/Facebook OAuth
│   ├── location-service.ts        # Google Maps Geocoding/Autocomplete
│   ├── lease-generation-service.ts # Lease document generation
│   └── messageService.ts          # 🆕 Chat/messaging service
│       └─ Conversation management
│       └─ Message CRUD
│       └─ Real-time subscriptions
│
├── 🏪 store/                      # Zustand state management stores
│   ├── authStore.ts               # User authentication state
│   │   ├─ User profile
│   │   ├─ Session management
│   │   ├─ Sign up/in/out
│   │   ├─ Password reset
│   │   ├─ OAuth login
│   │   └─ Role management
│   │
│   ├── propertyStore.ts           # Property management state
│   │   ├─ Properties (CRUD)
│   │   ├─ Units (CRUD)
│   │   ├─ Sub-units/Rooms (CRUD)
│   │   ├─ Photos & utilities
│   │   └─ Sync with Supabase
│   │
│   ├── tenantStore.ts             # Tenant management state
│   │   ├─ Tenants (CRUD)
│   │   ├─ Tenant-property relations
│   │   ├─ Payment tracking
│   │   └─ Sync with Supabase
│   │
│   ├── leaseStore.ts              # Lease management state
│   │   ├─ Lease creation/signing
│   │   ├─ Status tracking
│   │   ├─ Document storage
│   │   └─ Sync with Supabase
│   │
│   ├── maintenanceStore.ts        # Maintenance management state
│   │   ├─ Tickets (CRUD)
│   │   ├─ Status updates
│   │   ├─ Priority management
│   │   └─ Sync with Supabase
│   │
│   └── propertyStore.ts           # (Can also manage accounting/transactions)
│
├── 📜 scripts/                    # Utility scripts
│   └── reset-project.js           # Reset app data script
│
└── 🔧 Configuration files
    ├── .env.local                 # ⚠️ REQUIRED: Add your secrets here
    │   ├─ EXPO_PUBLIC_SUPABASE_URL
    │   ├─ EXPO_PUBLIC_SUPABASE_ANON_KEY
    │   ├─ EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
    │   ├─ EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID
    │   └─ (and other API keys)
    │
    ├── .gitignore                 # Files to exclude from git
    └── tsconfig.json              # TypeScript compiler options
```

---

## 🔐 Authentication & Authorization Flow

```
User Opens App
    ↓
Splash Screen (Loading)
    ↓
authStore.initialize() checks Supabase session
    ↓
    ├─ Session found → Go to Dashboard (based on user role)
    └─ No session → Redirect to Auth Flow
           ↓
        Landing Page (Choose: Login or Register)
           ↓
           ├─ Email/Password Auth
           │   ├─ Login → Enter email & password
           │   └─ Register → Create account with role (Landlord/Tenant/Manager)
           │
           └─ OAuth Auth (Google/Apple/Facebook)
               └─ Confirm/Select role after login
               └─ Create user profile automatically
           ↓
        Email Verification (if new user)
        → OTP verification screen
           ↓
        Success → Redirected to Dashboard
```

### User Roles:
- **Landlord**: Full property/tenant/accounting management
- **Tenant**: View leases, submit maintenance, manage profile
- **Manager**: Property manager with delegated permissions

---

## 🏛️ State Management Architecture (Zustand)

### Why Zustand?
- Lightweight (small bundle size)
- Simple API (like useState but global)
- No boilerplate (unlike Redux)
- Built-in DevTools support
- Perfect for React Native

### Store Pattern:

```typescript
// 1. Define interface with state + actions
interface Store {
  // State
  items: Item[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadItems: () => Promise<void>;
  addItem: (item: Item) => Promise<void>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

// 2. Create store with Zustand
export const useStore = create<Store>((set, get) => ({
  // Initial state
  items: [],
  isLoading: false,
  error: null,
  
  // Actions
  loadItems: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await supabase.from('items').select();
      set({ items: data });
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },
  // ... more actions
}));

// 3. Use in components
export function MyComponent() {
  const { items, isLoading, loadItems } = useStore();
  
  useEffect(() => {
    loadItems();
  }, []);
  
  return <FlatList data={items} />;
}
```

### Stores Available:
1. **authStore** - Authentication & user profile
2. **propertyStore** - Properties, units, rooms
3. **tenantStore** - Tenant information
4. **leaseStore** - Lease documents & status
5. **maintenanceStore** - Maintenance tickets

---

## 🔗 Database Architecture (Supabase PostgreSQL)

### Main Tables:
```sql
-- Authentication (managed by Supabase Auth)
users (id, email, password_hash, created_at)

-- User Profiles
user_profiles (
  id, user_id, role, full_name, phone, avatar_url, created_at
)

-- Properties Management
properties (
  id, user_id, address, city, state, zip_code, 
  property_type, units_count, created_at
)

units (
  id, property_id, name, bedrooms, bathrooms, 
  rent_price, tenant_id, created_at
)

sub_units (
  id, unit_id, name, type (bedroom|bathroom|kitchen|etc), 
  rent_price, created_at
)

-- Tenant Management
tenants (
  id, user_id, property_id, unit_id, first_name, last_name,
  email, phone, start_date, end_date, status, created_at
)

-- Lease Management
leases (
  id, property_id, tenant_id, start_date, end_date,
  rent_amount, document_url, status, signed_at, created_at
)

-- Maintenance
maintenance_tickets (
  id, property_id, tenant_id, title, description,
  priority, status, created_at, resolved_at
)

-- Accounting
transactions (
  id, property_id, type (income|expense), category,
  amount, description, date, created_at
)

-- Lease Applications
applicants (
  id, property_id, first_name, last_name, email,
  status, created_at, reviewed_at
)

-- 🆕 Messaging/Chat
conversations (
  id, property_id, participant_ids, last_message,
  unread_count_user1, unread_count_user2, created_at
)

messages (
  id, conversation_id, sender_id, content, 
  read_at, created_at
)
```

### Row Level Security (RLS):
- Each user can only see their own data
- Tenants can only view their properties
- Landlords can only manage their properties
- Real-time subscriptions use RLS policies

---

## 🔄 Data Flow & Real-time Updates

```
Component Mounts
    ↓
useEffect calls: store.loadFromSupabase()
    ↓
Store action queries Supabase
    ↓
Supabase retrieves data with RLS filters
    ↓
Store updates state: set({ items: data, isLoading: false })
    ↓
Component re-renders with new data
    ↓
(Optional) Subscribe to real-time changes
    ↓
When data changes → Supabase notifies subscribers
    ↓
Store updates automatically
    ↓
Component re-renders instantly
```

### Real-time Subscriptions:
```typescript
// messageService.ts example
export function subscribeToMessages(conversationId: string, callback: () => void) {
  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      callback
    )
    .subscribe();
  
  return () => channel.unsubscribe();
}
```

---

## 🛠️ Key Services

### 1. **oauth-service.ts**
- Google/Apple/Facebook login
- Handles OAuth flow & token management
- Creates user profile automatically

### 2. **location-service.ts**
- Google Maps Geocoding API
- Address autocomplete for property entry
- Reverse geocoding ("Use my location")
- Structured address parsing

### 3. **lease-generation-service.ts**
- Generate PDF lease documents
- Template-based with variable substitution
- Sign and store documents

### 4. **messageService.ts** (NEW ✨)
- Real-time messaging between landlords & tenants
- Conversation management
- Message history
- Unread count tracking
- Real-time subscriptions

---

## 📱 Key Screens & Their Purpose

### Landlord/Manager Views:
| Screen | Purpose | Key Actions |
|--------|---------|-------------|
| Dashboard | Home hub with 5 tiles | Navigate to modules |
| Properties | List all properties | Add, edit, delete properties |
| Tenants | Manage all tenants | Add, edit tenant info |
| Leases | Track lease agreements | Create, sign, renew leases |
| Maintenance | Track repair requests | Create tickets, assign, resolve |
| Accounting | Financial tracking | Add transactions, view reports |
| Messages | Tenant communication | Start chat, send messages |

### Tenant Views:
| Screen | Purpose | Key Actions |
|--------|---------|-------------|
| Lease Status | View current lease | Sign lease, download docs |
| Maintenance | Submit repair requests | Create request, track status |
| Messages | Communicate with landlord | Send messages, ask questions |
| Profile | Manage account | Update info, change password |

---

## 🚀 How to Add a New Feature

### Example: Add a new "Inspection" module

1. **Create database table** (in Supabase):
```sql
CREATE TABLE inspections (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  scheduled_date DATE,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMP
);

-- Add RLS policy
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own inspections"
  ON inspections FOR SELECT
  USING (property_id IN (SELECT id FROM properties WHERE user_id = auth.uid()));
```

2. **Add CRUD functions** in `lib/supabase.ts`:
```typescript
export async function getInspections(propertyId: string) {
  return supabase.from('inspections').select('*').eq('property_id', propertyId);
}

export async function createInspection(inspection: Inspection) {
  return supabase.from('inspections').insert([inspection]);
}
// ... more CRUD
```

3. **Create Zustand store** `store/inspectionStore.ts`:
```typescript
export const useInspectionStore = create((set) => ({
  inspections: [],
  loadInspections: async (propertyId) => {
    const data = await getInspections(propertyId);
    set({ inspections: data });
  },
  // ... more actions
}));
```

4. **Create list screen** `app/inspections.tsx`:
```typescript
export default function InspectionsScreen() {
  const { inspections, loadInspections } = useInspectionStore();
  
  useEffect(() => {
    loadInspections(propertyId);
  }, []);
  
  return <FlatList data={inspections} renderItem={...} />;
}
```

5. **Create detail modal** `app/inspection-detail.tsx`:
```typescript
// Form to create/edit inspection
```

6. **Add route** to `app/_layout.tsx`:
```typescript
<Stack.Screen name="inspections" />
<Stack.Screen name="inspection-detail" options={{ presentation: 'modal' }} />
```

7. **Add navigation** to dashboard `app/(tabs)/index.tsx`:
- Add new tile for "Inspections"

---

## 🔐 Security Considerations

1. **API Keys**: Store in `.env.local` (never commit)
2. **Row Level Security**: Supabase RLS policies enforce data access
3. **Authentication**: Supabase handles session management
4. **Images**: Stored in Supabase Storage (not in database)
5. **Passwords**: Hashed by Supabase Auth
6. **Real-time**: Only subscribed channels receive updates

---

## ✅ Testing Workflow

1. **Local Testing**: `npm run web` or `expo start`
2. **iOS Simulator**: `expo run:ios`
3. **Android Emulator**: `expo run:android`
4. **Lint Check**: `npm run lint`

---

## 📦 Deployment

1. Build APK/IPA
2. Use EAS (Expo Application Services)
3. Configure `eas.json`
4. Run: `eas build --platform ios` or `eas build --platform android`

---

## 🎨 Theme System

```typescript
// constants/theme.ts
export const COLORS = {
  light: {
    background: '#F4F6F8',
    surface: '#FFFFFF',
    text: '#1D1D1F',
    textSecondary: '#8A8A8F',
    primary: '#4A90E2',
  },
  dark: {
    background: '#101922',
    surface: '#192734',
    text: '#F4F6F8',
    textSecondary: '#8A8A8F',
    primary: '#4A90E2',
  },
};

// Usage in components
const { colorScheme } = useColorScheme();
const isDark = colorScheme === 'dark';
const textColor = isDark ? COLORS.dark.text : COLORS.light.text;
```

---

## 📞 Common Tasks

### To add a property:
`app/properties.tsx` → "+ Add Property" → `app/add-property.tsx` → `propertyStore.addProperty()`

### To contact tenant:
`app/tenants.tsx` → Tap tenant → `app/tenant-detail.tsx` → Tap "Message" → `messageService.getOrCreateConversation()` → `app/chat/[id].tsx`

### To track a maintenance request:
`app/maintenance.tsx` → Tap request → `app/maintenance-detail.tsx` → View status/updates

### To view accounting:
`app/accounting.tsx` → Shows transactions → Category filter → Chart visualization

---

## 🐛 Debugging Tips

1. **Check Supabase**: Go to dashboard.supabase.com to verify data
2. **Console logs**: `console.log(data)` in stores before `set()`
3. **Redux DevTools**: Zustand has DevTools support
4. **Network tab**: Check API requests in browser dev tools
5. **RLS policies**: If data not showing, check Supabase RLS settings

---

## 📚 Key Files to Understand First

1. **`app/_layout.tsx`** - Navigation structure
2. **`store/authStore.ts`** - Authentication logic
3. **`lib/supabase.ts`** - Database operations
4. **`app/(tabs)/index.tsx`** - Dashboard/home screen
5. **`services/messageService.ts`** - Chat functionality
6. **`constants/theme.ts`** - App styling

---

## 🎉 You're All Set!

You now have a complete understanding of the Aralink project structure. Start by exploring these files:
- The auth flow in `authStore.ts`
- The database setup in `lib/supabase.ts`
- The messaging in `messageService.ts`
- Individual screens for specific features

Happy coding! 🚀
