# Aaralink — App Overview, Feature Map & Audit

> Generated 2026-07-05 from a full scan of the codebase.
> Stack: **Expo (React Native) + expo-router + Zustand + Supabase**. App scheme: `aralink`. Web build shares the same codebase (`WebNavbar` replaces the tab bar on web).

---

## 1. Architecture at a Glance

```
app/                    ← expo-router file-based routes (each file = a screen)
├── (auth)/             ← login / register / OTP / forgot-password / activation
├── (tabs)/             ← the 4 main tabs (dashboard, messages, alerts, settings)
├── ara-partner/        ← separate stack for the "AaraPartner" referral role
├── lease-wizard/       ← landlord Ontario lease generation wizard (steps 1–6b)
├── chat/[id].tsx       ← dynamic chat room route
└── *.tsx               ← all other feature screens (root-level stack screens)

store/                  ← Zustand stores (state + Supabase sync)
lib/supabase.ts         ← 5,382-line data layer: ~120 exported functions, Supabase client
services/               ← messageService, vendorService, lease-generation, oauth, location
hooks/                  ← use-auth, use-color-scheme, usePushNotifications, use-user-role
components/             ← shared UI (themed-text/view, maintenance/*, charts, web-navbar)
```

**Data flow pattern:** Screen → Zustand store action → `lib/supabase.ts` function → Supabase (Postgres + Auth + Storage). Stores cache results (`lastLoadedUserId` guard); screens force-refresh with `useFocusEffect` + `AppState` listeners (added recently to properties, alerts, messages, leases).

**Auth guard:** `app/_layout.tsx` watches `useAuthStore` + route segments and redirects:
- no user → `/(auth)`
- `role === 'tenant'` → `/(tabs)/tenant-dashboard`
- `role === 'landlord' | 'manager'` → `/(tabs)/landlord-dashboard`
- `role === 'ara_partner'` → `/ara-partner/dashboard` (never allowed in tabs)
- pending Google OAuth session → `/(auth)/social-role-select`
- Supabase email-link callbacks (invite / recovery tokens in URL) → `/invite-auth`

---

## 2. Features (each described separately)

### 2.1 Authentication — `app/(auth)/`
| Screen | Purpose |
|---|---|
| `index.tsx` | Toggles between Login and Register components |
| `login.tsx` / `register.tsx` | Email+password auth, Google OAuth entry |
| `social-role-select.tsx` | After Google sign-in, user picks role (landlord/tenant/…) |
| `otp.tsx`, `verify-email.tsx` | Email verification flows |
| `forgot-password.tsx` | Sends Supabase recovery email |
| `activate-tenant.tsx` | Tenant account activation from an invite link |

**Connections:** `authStore.initialize()` restores the Supabase session on launch. `oauth-redirect.tsx` + `invite-auth.tsx` (aliased as `set-password.tsx`, the canonical Supabase `redirect_to` target) consume email-link tokens. Invite deep links persist a `pendingInviteToken` in AsyncStorage; the root layout redirects to `/invite?token=…` after login.

### 2.2 Dashboards — `app/(tabs)/`
- **`landlord-dashboard.tsx`** — portfolio metrics, rent collection summary (`getDashboardMetrics`, `getRentCollectionSummary`), quick links to Properties / Tenants / Leases / Accounting / Maintenance queue / Marketplace / Applications. Bell icon → `/notifications` (legacy screen — see §5).
- **`tenant-dashboard.tsx`** — current lease/property info, rent status card ("Pay Now" → legacy `/dashboard`, see §5), start-application button, maintenance shortcuts.

### 2.3 Properties — landlord
| Screen | Purpose | Links to |
|---|---|---|
| `properties.tsx` | List + filter tabs of all properties (`propertyStore.loadFromSupabase`) | `property-detail`, `add-property` |
| `property-detail.tsx` (modal) | Tabs: overview, units/rooms, rental setup, tenants | `add-unit`, `add-room`, `add-tenant`, `lease-wizard`, `tenant-detail` |
| `add-property.tsx` (modal) | Create property (address autocomplete) | back to properties |
| `add-unit.tsx` / `add-room.tsx` (modals) | Create unit / sub-unit (room) | back to property-detail |

**Data:** `propertyStore` — `addProperty/updateProperty/deleteProperty`, `addUnit/updateUnit/deleteUnit`, `addSubUnit/…`, backed by `createProperty`, `createUnit`, `createSubUnit`, etc. in `lib/supabase.ts`.

### 2.4 Tenants — landlord
| Screen | Purpose | Links to |
|---|---|---|
| `tenants.tsx` | Tenant list (`tenantStore`) | `tenant-detail`, `add-tenant` |
| `tenant-detail.tsx` (modal) | Tenant profile, lease, transactions, removal (`initiateTenantRemoval`, `hardDeleteTenant`) | `lease-wizard`, `chat` |
| `add-tenant.tsx` (modal) | Invite/create a tenant (`inviteTenantToProperty`, `createTenantInvitation`, `sendTenantInvitationEmail`) | back |

### 2.5 Applications & Leases
Two distinct flows that meet in the middle:

**Tenant application flow** (root screens):
`tenant-lease-start` → `tenant-lease-step1…step6` (personal info, co-applicants via `leaseStore`, income, references, documents) → `tenant-lease-submitted` → `tenant-lease-status`. Tenant lease management: `tenant-leases` → `tenant-lease-detail` (sign via `handleLeaseSigning` / `handleInviteBasedLeaseSigning`).

**Landlord review flow:**
`landlord-applications` (list, `fetchLandlordApplications`) → `landlord-application-review` (approve/reject, loads `co_applicants`) → on approval: **`lease-wizard/`** (Ontario standard lease, `ontarioLeaseStore`, steps: Parties → Rental Unit → Term/Rent → Services → Signatures; generates the lease via `services/lease-generation-service.ts`) → `lease-preview` → `lease-sent`. Landlord lease management: `leases.tsx` → `lease-detail.tsx`.

**Invites:** `invite.tsx` (accept/decline via `acceptInvite`/`declineInvite`), `invite-auth.tsx` (token exchange + password set), `add-applicant.tsx` (invite applicant to a property).

### 2.6 Maintenance
| Screen | Role | Purpose |
|---|---|---|
| `tenant-maintenance-request.tsx` | tenant | Create request (photos via `uploadMultipleImages`) |
| `tenant-maintenance-confirmation.tsx` | tenant | Success screen |
| `tenant-maintenance-status.tsx` | tenant | List own requests |
| `tenant-maintenance-detail.tsx` | tenant | Detail + star-rating feedback (`submitFeedback`) |
| `landlord-maintenance-overview.tsx` | landlord | Queue; filters Open / In Progress / Resolved (default **Open**); unseen-badge via AsyncStorage `maintenance_viewed_ids` |
| `landlord-maintenance-create.tsx` | landlord | Create request on behalf of tenant |
| `landlord-maintenance-detail.tsx` | landlord | Status updates, vendor assignment, resolution notes, comments |
| `marketplace.tsx` | landlord | Browse vendors by city/category (`services/vendorService`) |
| `vendor-select.tsx` | landlord | Pick vendor for a request (`assignVendor`, `setMarketplaceVendor`) |

**Data:** `maintenanceStore` (`fetchRequests(userId, role)`, `addRequest`, `updateRequestStatus`, `assignVendor`, `addComment`, `submitFeedback`). Role permissions in `lib/maintenancePermissions.ts`.

### 2.7 Messaging
- `(tabs)/messages.tsx` — conversation list (`services/messageService`), reloads on focus + app-resume.
- `chat/[id].tsx` — real-time chat room (Supabase realtime subscription).
- `start-chat.tsx` (landlord) / `tenant-start-chat.tsx` (tenant) — pick a counterparty to start a conversation. Messages tab routes by role.

### 2.8 Notifications
- `(tabs)/alerts.tsx` — **the current notifications screen**: grouped (Today/Yesterday/This Week/Earlier), typed icons/accents, mark-read, mark-all-read, **clear-all (trash button)** and **swipe-to-delete per notification** (`ReanimatedSwipeable`). Deep-links each notification to the right screen (maintenance detail, lease detail, invite flow, etc.).
- `notifications.tsx` — **legacy duplicate** still opened by both dashboards' bell icons and the push-tap fallback (see §5).
- Push: `hooks/usePushNotifications.ts` registers the device and routes notification taps (`/chat/:id`, lease detail, maintenance detail, `/notifications` fallback). Sending: `lib/sendPushNotification.ts`.
- Data: `fetchTenantNotifications` / `fetchLandlordNotifications`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `clearAllNotifications`, `deleteNotification`.

### 2.9 Accounting — landlord
- `accounting.tsx` — transactions list, aggregates (`getTransactionAggregates`), time-series charts (`TimeSeriesChart`, `getTimeSeriesTransactionData`), category summary.
- `add-transaction.tsx` (modal) — create income/expense (`createTransaction`).
- `transaction-detail.tsx` — view/edit/delete a transaction.

### 2.10 Settings & Profile
- `(tabs)/settings.tsx` — settings tab (theme, account actions, sign-out).
- `profile.tsx` — edit profile (`getUserProfile` / `upsertUserProfile`).

### 2.11 AaraPartner (referral partners) — `app/ara-partner/`
Own stack, own store (`araPartnerStore`): `dashboard` (earnings summary) → `referrals` (list), `submit-referral` (modal form), `payouts`, `profile`. Users with `role === 'ara_partner'` are hard-locked into this stack by the root layout.

---

## 3. Route Map (who links to whom)

```
(auth)/index ─→ login ⇄ register ─→ otp / verify-email
   └─ social-role-select (Google OAuth)          forgot-password
invite-auth (= set-password) ─→ tabs        activate-tenant ─→ tabs

TABS (mobile bottom bar / web navbar)
├─ landlord-dashboard ─→ properties, tenants, leases, accounting,
│     landlord-applications, landlord-maintenance-overview, marketplace,
│     notifications(legacy), transaction-detail (push-tap)
├─ tenant-dashboard ─→ tenant-lease-start, tenant-maintenance-request/-status,
│     tenant-leases, notifications(legacy), dashboard(legacy "Pay Now")
├─ messages ─→ chat/[id], start-chat | tenant-start-chat
├─ alerts ─→ (deep-links: landlord/tenant-maintenance-detail, lease-detail,
│     tenant-lease-detail, tenant-lease-start, invite, leases…)
└─ settings ─→ profile

properties ─→ property-detail ─→ add-unit / add-room / add-tenant / lease-wizard
tenants ─→ tenant-detail ─→ lease-wizard / chat
leases ─→ lease-detail
accounting ─→ add-transaction / transaction-detail
landlord-applications ─→ landlord-application-review ─→ lease-wizard
lease-wizard/index ─→ step1…step6, 6a, 6b ─→ (lease-preview ─→ lease-sent)
tenant-lease-start ─→ step1→2→3→4→5→6 ─→ tenant-lease-submitted ─→ tenant-lease-status
tenant-leases ─→ tenant-lease-detail
landlord-maintenance-overview ─→ landlord-maintenance-detail ─→ vendor-select / marketplace
tenant-maintenance-request ─→ tenant-maintenance-confirmation ─→ tenant-maintenance-status ─→ tenant-maintenance-detail
ara-partner/dashboard ─→ referrals / submit-referral / payouts / profile
```

External/deep links: invite emails → `/invite?token=…`; Supabase auth emails → `/set-password` (or site-root with hash tokens, intercepted by `_layout` → `/invite-auth`); push notification taps → chat/lease/maintenance detail routes.

---

## 4. Design System (current canonical tokens)

Dark mode standard (as recently applied to dashboard, properties, alerts, maintenance):
```
background:  isDark ? '#101c22' : '#F2F2F7'
card:        isDark ? '#1A2831' : '#ffffff'
border:      isDark ? '#2a3a45' : '#e2e8f0'
primary:     '#4A90E2' (alerts/dashboard)  /  '#2563eb' (maintenance)  /  '#2A64F5' (legacy screens)
```

---

## 5. Problems Found (audit results)

### A. Bugs / functional problems
1. **Two notification screens in use.** The bell icons on both dashboards ([landlord-dashboard.tsx:448,721](app/(tabs)/landlord-dashboard.tsx#L448), [tenant-dashboard.tsx:418,587,823](app/(tabs)/tenant-dashboard.tsx#L418)) and the push-tap fallback ([usePushNotifications.ts:113](hooks/usePushNotifications.ts#L113)) open the **legacy** `notifications.tsx` — which has *no clear-all, no swipe-to-delete,* and older colors. The improved screen is the `alerts` tab. Fix: point all of these to `/(tabs)/alerts` and delete `notifications.tsx`.
2. **"Pay Now" goes to a broken legacy screen.** [tenant-dashboard.tsx:737](app/(tabs)/tenant-dashboard.tsx#L737) pushes `/dashboard` (old template dashboard). Its quick-access items push routes that don't exist: `/(tabs)/properties`, `/(tabs)/tenants`, `/(tabs)/maintenance`, `/(tabs)/dashboard` ([dashboard.tsx:23-34](app/dashboard.tsx#L23-L34)). Tapping them fails/no-ops.
3. **Wrong-request fallback in tenant maintenance detail.** [tenant-maintenance-detail.tsx:28](app/tenant-maintenance-detail.tsx#L28): `requests.find(…) ?? requests[0]` — if the id isn't in the store (e.g. cold start from a push tap), it silently shows the *first* request instead of loading the right one or showing an error.
4. **`package.json` name is still `my-app`** (template default), while `app.json` says `Aaralink`.

### B. UI problems
5. **No dark mode at all** (hardcoded light palette) in: [marketplace.tsx](app/marketplace.tsx), [vendor-select.tsx](app/vendor-select.tsx), [tenant-maintenance-detail.tsx](app/tenant-maintenance-detail.tsx), [landlord-maintenance-create.tsx](app/landlord-maintenance-create.tsx). These are the "different shade" screens in the maintenance/marketplace area.
6. **Color-token fragmentation.** At least 6 different dark background pairs are in active use across screens: `#101922/#F4F6F8` (most common, 34+ uses), `#101922/#f6f7f8`, `#192734` cards, `#1f2937` cards, `#1a202c` cards, and the newer `#101c22`/`#1A2831` standard. Three different primary blues coexist (`#4A90E2`, `#2563eb`, `#2A64F5`). The app never looks broken, but shades visibly differ between screens. Recommended: extract tokens into `constants/theme.ts` and migrate screen-by-screen.
7. **Duplicate settings screen.** Root [settings.tsx](app/settings.tsx) (409 lines) is orphaned — nothing links to it; the tab uses `(tabs)/settings.tsx` (240 lines). Any edits to the wrong one silently do nothing.

### C. Dead / orphaned code (safe to delete after confirming)
| File | Why |
|---|---|
| [app/explore.tsx](app/explore.tsx), [app/modal.tsx](app/modal.tsx) | Expo template leftovers, never linked |
| [app/dashboard.tsx](app/dashboard.tsx) | Legacy dashboard; only reachable via the broken "Pay Now" button |
| [app/notifications.tsx](app/notifications.tsx) | Superseded by alerts tab (after fixing links in §A1) |
| [app/settings.tsx](app/settings.tsx) | Superseded by `(tabs)/settings.tsx` |
| [app/maintenance.tsx](app/maintenance.tsx) + [app/maintenance-detail.tsx](app/maintenance-detail.tsx) | Old maintenance flow, zero inbound links |
| [app/applicants.tsx](app/applicants.tsx) + [app/applicant-detail.tsx](app/applicant-detail.tsx) | Orphaned; applicant-detail is a mock form whose Save just goes back (no persistence) |
| [app/invoice-detail.tsx](app/invoice-detail.tsx) | Orphaned mock form, no persistence |
| [app/tenant-view-lease.tsx](app/tenant-view-lease.tsx), [app/tenant-lease-review-sign.tsx](app/tenant-lease-review-sign.tsx) | Registered in the stack but nothing navigates to them |
| [app/finalize-lease-terms.tsx](app/finalize-lease-terms.tsx) (+ its children `lease-preview`, `lease-sent`) | No inbound navigation to the entry screen — the whole chain is unreachable; lease sending now happens through `lease-wizard` |
| [app/debug-properties.tsx](app/debug-properties.tsx) | Dev-only debug screen, unlinked (fine to keep, but exclude from prod) |

### D. Architectural notes (not urgent)
- `lib/supabase.ts` is a 5,382-line module with ~120 exports; splitting it by domain (properties, leases, maintenance, notifications, …) would make it maintainable.
- Notification deep-link routing logic is duplicated in three places (`alerts.tsx handlePress`, `notifications.tsx`, `usePushNotifications.ts`) — extract one `routeForNotification(data)` helper so taps behave identically everywhere.
- Legacy screens still mounted in `_layout.tsx`'s Stack (`maintenance`, `applicants`, `applicant-detail`, `invoice-detail`, `maintenance-detail`) can be removed together with the files.
