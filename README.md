# 🏠 Aralink - Property Management Platform

A comprehensive cross-platform mobile application built with React Native (Expo) for managing residential rental properties. Designed for landlords, property managers, and tenants to streamline property operations, tenant management, maintenance tracking, lease applications, and accounting—all in one unified platform.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
  - [Frontend Architecture](#frontend-architecture)
  - [Backend Architecture](#backend-architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Database Schema](#database-schema)
- [API Integration](#api-integration)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)

---

## 🎯 Project Overview

**Aralink** is a modern property management solution that enables:

- **Landlords & Property Managers**: Complete control over properties, units, tenants, maintenance, lease applications, and financial tracking
- **Tenants**: Easy access to lease information, maintenance request submission, and rental application workflow
- **Unified Platform**: All stakeholders can interact seamlessly through role-based access control

### Core Problem Solved

Traditionally, property management involves multiple disconnected tools—spreadsheets for tracking, email for communication, paper documents for leases. Aralink consolidates everything into a single, intuitive mobile application with real-time synchronization, secure data storage, and a modern user experience.

---

## ✨ Key Features

### 🏘️ Property Management
- Add/edit/view properties with detailed information (address, type, utilities, photos)
- Support for single-unit, multi-unit, commercial, and parking properties
- Organize properties into units and sub-units (rooms)
- Track property-specific utilities and their payment responsibility
- Image gallery for property photos

### 👥 Tenant Management
- Complete tenant profiles with photo, contact information, and lease details
- Link tenants to specific properties and units
- Payment tracking and ledger history
- Tenant status management (active/inactive)

### 🛠️ Maintenance Management
- Submit maintenance requests with photos/videos
- Track ticket status (open → in-progress → resolved)
- Priority levels (low/medium/high)
- Vendor assignment and resolution notes
- Real-time status updates for tenants and landlords

### 📝 Lease Application Workflow
- Multi-step lease application process for tenants
- Landlord review and approval/rejection workflow
- Digital lease document generation and signing
- Application status tracking

### 💰 Accounting & Financials
- Income/Expense transaction tracking
- Property and unit-level financial reporting
- Monthly summaries with visual charts
- Category-based filtering (rent, garage, parking, utilities, maintenance, etc.)
- Transaction history with payment status

### 🔐 Authentication & Security
- Email/password authentication
- Social login (Google, Apple, Facebook)
- Email verification workflow
- Password reset functionality
- Role-based access control (Landlord, Tenant, Manager)
- Secure session management

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React Native (Expo SDK ~54)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand (lightweight state management)
- **UI Components**: React Native core components + custom themed components
- **Styling**: React Native StyleSheet with theme support (light/dark mode)
- **Image Handling**: Expo Image Picker, Expo File System
- **Icons**: Material Community Icons, Expo Vector Icons

### Backend & Services
- **Backend as a Service**: Supabase
  - **Database**: PostgreSQL (with Row Level Security)
  - **Authentication**: Supabase Auth (email/password, OAuth providers)
  - **Storage**: Supabase Storage (for images and documents)
  - **Real-time**: Supabase Realtime (ready for real-time features)
  - **API**: Auto-generated REST APIs via PostgREST

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Version Control**: Git

---

## 🏗️ Architecture

### Frontend Architecture

#### State Management Pattern (Zustand)

The application uses **Zustand** for global state management, organized into domain-specific stores:

```typescript
store/
├── authStore.ts        # Authentication state & user session
├── propertyStore.ts    # Properties, units, and sub-units
├── tenantStore.ts      # Tenant profiles and data
├── maintenanceStore.ts # Maintenance tickets
└── leaseStore.ts       # Lease applications and documents
```

**Why Zustand?**
- Minimal boilerplate compared to Redux
- Simple API, easy to learn
- Excellent TypeScript support
- Small bundle size
- Works seamlessly with React hooks

**Store Structure Example** (`propertyStore.ts`):
```typescript
interface PropertyStore {
  // State
  properties: Property[];
  isLoading: boolean;
  isSynced: boolean;
  
  // Actions
  loadFromSupabase: (userId: string) => Promise<void>;
  addProperty: (data: PropertyData, userId: string) => Promise<string>;
  updateProperty: (id: string, updates: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  // ... more actions
}
```

#### Routing Architecture (Expo Router)

Uses **file-based routing** (similar to Next.js):

```
app/
├── _layout.tsx                    # Root layout with auth guard
├── splash.tsx                     # Initial splash screen
├── (auth)/                        # Auth group (public routes)
│   ├── _layout.tsx
│   ├── index.tsx                  # Auth landing
│   ├── login.tsx
│   ├── register.tsx
│   ├── verify-email.tsx
│   └── forgot-password.tsx
├── (tabs)/                        # Tab navigation (protected)
│   ├── _layout.tsx
│   ├── landlord-dashboard.tsx
│   ├── tenant-dashboard.tsx
│   └── settings.tsx
└── [modal screens]                # Stack screens
    ├── property-detail.tsx
    ├── add-property.tsx
    ├── tenant-detail.tsx
    └── ...
```

**Navigation Flow**:
1. App starts at `splash.tsx`
2. Checks authentication state via `authStore`
3. Routes to `(auth)` group if not authenticated
4. Routes to `(tabs)` group if authenticated (role-based dashboard)
5. Modal screens overlay on top for detailed views/forms

#### Component Architecture

**Themed Components**:
- `ThemedText`: Text component that adapts to light/dark theme
- `ThemedView`: View component with theme-aware background colors
- All components respect system color scheme preference

**Custom Hooks**:
- `useAuth()`: Access authentication state and actions
- `useUserRole()`: Get current user role and role-checking helpers
- `useColorScheme()`: Get current theme (light/dark)

**State Flow Example** (Adding a Property):

```
User fills form in add-property.tsx
    ↓
Calls propertyStore.addProperty(data, userId)
    ↓
Store calls lib/supabase.ts → createPropertyInDb()
    ↓
Supabase API saves to PostgreSQL
    ↓
Store updates local state with returned data
    ↓
UI automatically re-renders (Zustand reactivity)
    ↓
Navigation to property-detail.tsx (fetches from store)
```

#### Data Flow Pattern

1. **Initial Load**: On screen mount, fetch from Supabase → update store → render
2. **User Actions**: Update store → sync to Supabase → update store with response
3. **Optimistic Updates**: Store updates immediately, syncs in background
4. **Error Handling**: Rollback store changes if Supabase call fails

---

### Backend Architecture

#### Supabase Overview

**Supabase** is a Firebase alternative built on PostgreSQL. It provides:

1. **PostgreSQL Database**: Full-featured relational database
2. **Supabase Auth**: Built-in authentication (email/password, OAuth)
3. **Supabase Storage**: File storage (images, documents)
4. **Row Level Security (RLS)**: Database-level access control
5. **Auto-generated APIs**: REST APIs automatically generated from database schema
6. **Realtime**: WebSocket-based real-time subscriptions

#### Database Schema

**Core Tables**:

1. **`profiles`** (User profiles)
   - Extends Supabase `auth.users`
   - Stores: name, email, user_type (role), phone, avatar_url, social login info
   - RLS: Users can only read/update their own profile

2. **`properties`**
   - Stores property information: address, type, utilities, photos, landlord info
   - Foreign key: `user_id` (landlord/manager who owns it)
   - RLS: Users can only access properties they own

3. **`units`**
   - Belongs to a property
   - Stores: name, description, bedrooms, bathrooms, area, rent, lease dates, amenities, photos
   - RLS: Inherits from parent property

4. **`sub_units`** (Rooms)
   - Belongs to a unit
   - Stores: name, type, rent_price, area, availability, photos, amenities
   - RLS: Inherits from parent unit/property

5. **`tenants`**
   - Links to a property and optionally a unit
   - Stores: name, email, phone, photo, lease dates, rent amount, status
   - RLS: Landlords can access tenants for their properties

6. **`transactions`**
   - Financial records (income/expense)
   - Stores: amount, type, date, property_id, category, description
   - RLS: Users can only access transactions for their properties

**Database Relationships**:
```
users (auth.users)
  ↓
profiles (1:1)
  ↓
properties (1:many) → owned by user
  ↓
units (1:many) → belongs to property
  ↓
sub_units (1:many) → belongs to unit
  ↓
tenants (many:1) → linked to property/unit
```

#### Row Level Security (RLS)

**Security Model**:
- All tables have RLS enabled
- Policies defined using PostgreSQL functions (`auth.uid()`)
- Example policy:
  ```sql
  CREATE POLICY "Users can view own properties"
    ON properties FOR SELECT
    USING (user_id = auth.uid());
  ```

**Benefits**:
- Database-level security (can't be bypassed by client code)
- Fine-grained access control
- Automatic enforcement for all API calls

#### Supabase Storage

**Buckets**:
- `property-photos`: Property and unit images
- `tenant-photos`: Tenant profile pictures
- `maintenance-attachments`: Maintenance request photos/videos
- `lease-documents`: Lease PDFs and documents

**Storage Policies**:
- Users can upload to their own property/tenant folders
- Public read access for images (optional)
- Signed URLs for private documents

#### API Layer (`lib/supabase.ts`)

**Client Initialization**:
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: getStorageAdapter(), // Cross-platform storage (AsyncStorage/localStorage)
      flowType: 'pkce',
    },
  }
);
```

**Helper Functions**:
- `fetchProperties(userId)`: Get all properties for a user
- `createPropertyInDb(data)`: Create new property
- `updatePropertyInDb(id, data)`: Update existing property
- `uploadImage(file, bucket, path)`: Upload image to Supabase Storage
- `uploadMultipleImages(files, bucket, path)`: Batch image upload

**Error Handling**:
- Network errors caught and logged
- User-friendly error messages
- Retry logic for failed uploads
- Session error recovery (auto-clear corrupted sessions)

---

## 📁 Project Structure

```
Aralink/
├── app/                          # Expo Router pages (file-based routing)
│   ├── _layout.tsx              # Root layout with auth guard
│   ├── splash.tsx               # Splash screen
│   ├── (auth)/                  # Authentication group
│   │   ├── _layout.tsx
│   │   ├── index.tsx            # Auth landing
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── verify-email.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/                  # Tab navigation group
│   │   ├── _layout.tsx
│   │   ├── landlord-dashboard.tsx
│   │   ├── tenant-dashboard.tsx
│   │   └── settings.tsx
│   ├── properties.tsx           # Properties list
│   ├── property-detail.tsx      # Property detail/edit screen
│   ├── add-property.tsx         # Add property form
│   ├── add-unit.tsx             # Add unit form
│   ├── add-room.tsx             # Add room/sub-unit form
│   ├── tenants.tsx              # Tenants list
│   ├── tenant-detail.tsx        # Tenant detail screen
│   ├── add-tenant.tsx           # Add tenant form
│   ├── accounting.tsx           # Accounting/transactions list
│   ├── add-transaction.tsx      # Add transaction form
│   └── [other screens...]
│
├── components/                   # Reusable UI components
│   ├── themed-text.tsx          # Themed text component
│   ├── themed-view.tsx          # Themed view component
│   ├── maintenance/             # Maintenance-specific components
│   └── ui/                      # UI primitives
│
├── store/                       # Zustand state stores
│   ├── authStore.ts            # Authentication state
│   ├── propertyStore.ts        # Properties state
│   ├── tenantStore.ts          # Tenants state
│   ├── maintenanceStore.ts     # Maintenance state
│   └── leaseStore.ts           # Lease state
│
├── lib/                         # Core libraries and utilities
│   └── supabase.ts             # Supabase client & API helpers
│
├── hooks/                       # Custom React hooks
│   ├── use-auth.ts             # Auth hook
│   ├── use-user-role.ts        # Role checking hooks
│   └── use-color-scheme.ts     # Theme hook
│
├── types/                       # TypeScript type definitions
│   └── index.ts                # All data model types
│
├── constants/                   # App constants
│   └── theme.ts                # Color themes
│
├── docs/                        # Documentation
│   ├── SUPABASE_SETUP.md       # Supabase setup guide
│   ├── SUPABASE_MIGRATION.md   # Migration guide
│   └── IMPLEMENTATION_SUMMARY.md
│
├── assets/                      # Static assets
│   ├── images/
│   └── animations/
│
├── .env.local                   # Environment variables (gitignored)
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
└── README.md                    # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v16 or higher
- **npm** or **yarn**: Package manager
- **Expo CLI**: Installed globally (`npm install -g expo-cli`)
- **Supabase Account**: Free account at [supabase.com](https://supabase.com)

### Installation

1. **Clone the repository**:
   ```bash
   cd /Users/ankitac862/Documents/ANKITA\ /FProject/Aaralink/Aralink
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the project root:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

4. **Set up Supabase database**:
   - Follow the instructions in `docs/SUPABASE_SETUP.md`
   - Run the SQL scripts to create tables, RLS policies, and triggers
   - Create storage buckets and policies

5. **Start the development server**:
   ```bash
   npm start
   ```

6. **Run on device/simulator**:
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Press `w` for Web Browser
   - Scan QR code with **Expo Go** app on physical device

---

## ⚙️ Configuration

### Environment Variables

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# OAuth Configuration (optional)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your_ios_client_id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your_android_client_id
EXPO_PUBLIC_APPLE_CLIENT_ID=your_apple_client_id
EXPO_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id

# App Configuration
EXPO_PUBLIC_SCHEME=aralink://
```

### Supabase Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Get API keys** from Project Settings → API
3. **Run database migrations** from `docs/SUPABASE_SETUP.md`
4. **Create storage buckets**:
   - `property-photos` (public)
   - `tenant-photos` (public)
   - `maintenance-attachments` (private)
   - `lease-documents` (private)
5. **Configure authentication**:
   - Enable email/password auth
   - Enable OAuth providers (Google, Apple, Facebook)
   - Configure redirect URLs

---

## 🗄️ Database Schema

### Core Tables

**`profiles`**
```sql
id UUID PRIMARY KEY (references auth.users)
email TEXT NOT NULL
full_name TEXT NOT NULL
user_type TEXT NOT NULL (landlord|tenant|manager)
phone TEXT
avatar_url TEXT
is_social_login BOOLEAN
social_provider TEXT (google|apple|facebook)
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**`properties`**
```sql
id UUID PRIMARY KEY
user_id UUID (references profiles.id)
name TEXT
address1 TEXT NOT NULL
address2 TEXT
city TEXT NOT NULL
state TEXT NOT NULL
zip_code TEXT NOT NULL
country TEXT
property_type TEXT (single_unit|multi_unit|commercial|parking)
landlord_name TEXT
rent_complete_property BOOLEAN
description TEXT
photos TEXT[] (array of storage URLs)
parking_included BOOLEAN
rent_amount DECIMAL
utilities JSONB (electricity, heatGas, water, wifi, rentalEquipments → landlord|tenant)
status TEXT (active|inactive)
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**`units`**
```sql
id UUID PRIMARY KEY
property_id UUID (references properties.id)
name TEXT NOT NULL
description TEXT
bedrooms INTEGER
bathrooms INTEGER
area DECIMAL
rent_entire_unit BOOLEAN
default_rent_price DECIMAL
availability_date DATE
lease_start_date DATE
lease_end_date DATE
photos TEXT[] (array of storage URLs)
amenities JSONB (in_unit_laundry, balcony, dishwasher, parking_included)
is_occupied BOOLEAN
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**`sub_units`** (Rooms)
```sql
id UUID PRIMARY KEY
unit_id UUID (references units.id)
name TEXT NOT NULL
type TEXT (bedroom|bathroom|kitchen|living|other)
rent_price DECIMAL
area DECIMAL
availability_date DATE
photos TEXT[] (array of storage URLs)
amenities JSONB
shared_spaces JSONB
tenant_id UUID (references tenants.id, nullable)
tenant_name TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**`tenants`**
```sql
id UUID PRIMARY KEY
user_id UUID (references profiles.id, nullable)
property_id UUID (references properties.id)
unit_id UUID (references units.id, nullable)
unit_name TEXT
first_name TEXT NOT NULL
last_name TEXT NOT NULL
email TEXT NOT NULL
phone TEXT
photo TEXT (storage URL)
lease_start_date DATE
lease_end_date DATE
rent_amount DECIMAL
status TEXT (active|inactive)
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

**`transactions`**
```sql
id UUID PRIMARY KEY
user_id UUID (references profiles.id)
property_id UUID (references properties.id)
unit_id UUID (references units.id, nullable)
type TEXT (income|expense)
amount DECIMAL NOT NULL
date DATE NOT NULL
category TEXT (rent|garage|parking|utility|maintenance|other)
service_type TEXT
description TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

## 🔌 API Integration

### Supabase Client Setup

Located in `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Authentication API

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      full_name: 'John Doe',
      role: 'landlord',
    },
  },
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
});

// Sign out
await supabase.auth.signOut();

// Social login
await supabase.auth.signInWithOAuth({
  provider: 'google',
});
```

### Database API

```typescript
// Fetch properties
const { data, error } = await supabase
  .from('properties')
  .select('*')
  .eq('user_id', userId);

// Create property
const { data, error } = await supabase
  .from('properties')
  .insert([propertyData])
  .select()
  .single();

// Update property
const { data, error } = await supabase
  .from('properties')
  .update(updates)
  .eq('id', propertyId)
  .select()
  .single();

// Delete property
await supabase
  .from('properties')
  .delete()
  .eq('id', propertyId);
```

### Storage API

```typescript
// Upload image
const { data, error } = await supabase.storage
  .from('property-photos')
  .upload(`${propertyId}/${fileName}`, file);

// Get public URL
const { data } = supabase.storage
  .from('property-photos')
  .getPublicUrl(filePath);

// Delete image
await supabase.storage
  .from('property-photos')
  .remove([filePath]);
```

### Store Integration

Stores use these APIs internally. Example from `propertyStore.ts`:

```typescript
addProperty: async (propertyData, userId) => {
  // Prepare data
  const dbData = localToDbProperty(propertyData, userId);
  
  // Save to Supabase
  const savedProperty = await createPropertyInDb(dbData);
  
  // Update local state
  set((state) => ({
    properties: [...state.properties, dbToLocalProperty(savedProperty)],
  }));
  
  return savedProperty.id;
}
```

---

## 🔄 Development Workflow

### Adding a New Feature

1. **Define Types** (`types/index.ts`):
   ```typescript
   export interface NewFeature {
     id: string;
     name: string;
     // ... fields
   }
   ```

2. **Create Store** (`store/newFeatureStore.ts`):
   ```typescript
   export const useNewFeatureStore = create<NewFeatureStore>((set) => ({
     items: [],
     loadFromSupabase: async (userId) => { /* ... */ },
     addItem: async (data) => { /* ... */ },
     // ... actions
   }));
   ```

3. **Create Supabase Helpers** (`lib/supabase.ts`):
   ```typescript
   export async function fetchNewFeatures(userId: string) {
     const { data, error } = await supabase
       .from('new_features')
       .select('*')
       .eq('user_id', userId);
     // ... error handling
   }
   ```

4. **Create UI Screens** (`app/new-feature.tsx`, `app/add-new-feature.tsx`)

5. **Update Database Schema** (run SQL in Supabase)

6. **Update Navigation** (`app/_layout.tsx`)

### State Management Best Practices

- **Keep stores focused**: One store per domain (properties, tenants, etc.)
- **Always sync to Supabase**: Local state changes should persist
- **Handle errors gracefully**: Show user-friendly error messages
- **Optimistic updates**: Update UI immediately, sync in background
- **Loading states**: Show loading indicators during async operations

### Code Style

- **TypeScript**: Always use types, avoid `any`
- **Naming**: Use descriptive names (camelCase for variables, PascalCase for components)
- **Components**: Keep components small and focused
- **Hooks**: Use custom hooks for reusable logic
- **Comments**: Add comments for complex logic

---

## 🚢 Deployment

### Building for Production

1. **iOS**:
   ```bash
   expo build:ios
   # or
   eas build --platform ios
   ```

2. **Android**:
   ```bash
   expo build:android
   # or
   eas build --platform android
   ```

3. **Web**:
   ```bash
   npx expo export:web
   ```

### Environment Variables for Production

Update environment variables in:
- Expo EAS Build configuration
- Supabase project settings
- App store/Play Store listings

### Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Supabase database schema deployed
- [ ] Storage buckets created and policies set
- [ ] Authentication providers configured
- [ ] Error tracking set up (optional: Sentry)
- [ ] Analytics configured (optional: Mixpanel, Amplitude)
- [ ] App icons and splash screens updated
- [ ] App store listings prepared

---

## 📚 Additional Resources

### Documentation

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router Documentation](https://docs.expo.dev/routing/introduction/)
- [Supabase Documentation](https://supabase.com/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

### Project-Specific Docs

- `docs/SUPABASE_SETUP.md` - Detailed Supabase setup guide
- `docs/SUPABASE_MIGRATION.md` - Database migration guide
- `QUICK_START_GUIDE.md` - Quick start checklist

### Support

For issues, questions, or contributions, contact the development team.

---

## 📄 License

Proprietary - Aralink Property Management Platform © 2024

---

**Built with ❤️ using React Native, Expo, and Supabase**
