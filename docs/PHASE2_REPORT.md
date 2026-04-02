# SiteTrack — Phase 2 Completion Report
## Auth System + App Shell + Home Dashboard

> **Project:** SiteTrack Field Service Management App (Android)
> **Phase:** 2 of 15 — Auth System, Navigation Shell & Home Dashboard
> **Steps Completed:** Step 4, Step 5, Step 6
> **Completed:** 31 March 2026
> **Status:** ✅ All checks passing — Ready for Phase 3

---

## What Phase 2 Is

Phase 1 gave us the invisible foundation — the database, sync engine, types, and configuration. Phase 2 builds the first things a technician actually sees and touches. By the end of this phase:

- A technician can launch the app, see a branded splash screen, and sign in with email/password or biometrics
- The app remembers their session across restarts (no sign-in every morning)
- If the device goes offline, a banner appears immediately across every screen
- A home dashboard greets them by name, shows today's job count, gives quick-action shortcuts, and displays a weekly progress bar
- Signing out is one tap from the Profile tab

---

## Architecture Overview

```
app/
├── _layout.tsx              ← ROOT: Paper Provider + Auth Guard + Sync Start
├── (auth)/
│   ├── _layout.tsx          ← Stack navigator (unauthenticated)
│   ├── index.tsx            ← Animated splash screen
│   ├── login.tsx            ← Full sign-in screen
│   └── forgot-password.tsx  ← Password reset screen
└── (app)/
    ├── _layout.tsx          ← 4-tab bottom navigator (authenticated)
    ├── index.tsx            ← Home Dashboard (main screen)
    ├── jobs.tsx             ← Placeholder → Phase 3
    ├── notifications.tsx    ← Placeholder → Phase 4
    └── profile.tsx          ← Placeholder + working Sign Out

store/
├── authStore.ts             ← Zustand: user session, signIn/signOut/restore
└── dashboardStore.ts        ← Zustand: today's jobs, stats from SQLite

hooks/
├── useAuth.ts               ← Clean wrapper over authStore
└── useNetworkStatus.ts      ← Reactive NetInfo wrapper

components/
├── OfflineBanner.tsx         ← Animated yellow offline indicator
└── SyncStatusBar.tsx         ← Live sync status + manual trigger
```

**Data flow:** All screen data is read from local SQLite → Supabase sync happens in the background → UI never blocks on network. This is the offline-first guarantee established in Phase 1 and honoured throughout Phase 2.

---

## Step 4 — Authentication System

### `store/authStore.ts` — Zustand Auth Store

The central nervous system for user sessions. Uses Zustand with no boilerplate — a single store manages everything authentication-related.

**State shape:**
```typescript
user: User | null           // Full profile from public.users table
session: Session | null     // Supabase session (contains access + refresh tokens)
isLoading: boolean          // True while restoring session on launch
isAuthenticated: boolean    // Derived — true when both user + session exist
error: string | null        // Last auth error (shown in login UI)
```

**`signIn(email, password, rememberMe?)`**
1. Calls `supabase.auth.signInWithPassword` — validates credentials against Supabase Auth
2. On success: makes a second query to `public.users` to fetch the full profile (name, role, phone, avatar)
3. If the profile row doesn't exist (admin forgot to insert it): returns a friendly "Contact your administrator" error rather than crashing
4. If `rememberMe` was checked: saves a flag to AsyncStorage so biometric unlock can be offered next time
5. Sets `isAuthenticated: true` — the root layout's `useEffect` picks this up immediately and navigates to `/(app)/`

**`restoreSession()`**
Called on every app launch (from the root layout's `useEffect`). Calls `supabase.auth.getSession()` which reads the persisted session from AsyncStorage (configured in Phase 1's Supabase client). If the token is expired but the refresh token is valid, Supabase automatically refreshes it. Fetches the user profile and restores the full state silently — the technician never re-enters their password after the first sign-in.

**`signOut()`**
1. Calls `stopSync()` — stops the background sync interval immediately
2. Calls `supabase.signOut()` — revokes the session on Supabase's server
3. Wipes AsyncStorage (session + remember-me key)
4. Resets all Zustand state to null — root layout's `useEffect` detects `isAuthenticated: false` and redirects to login

**`onAuthStateChange` subscription**
Runs outside the store creation — subscribes to Supabase's auth event broadcast. Handles two events:
- `SIGNED_OUT`: Clears all state (catches server-side sign-out, e.g., password changed from dashboard)
- `TOKEN_REFRESHED`: Updates the session in state with the new access token without touching the user object

### `hooks/useAuth.ts` — Auth Hook

A thin wrapper over `useAuthStore` with two additions:
1. **Friendly error mapping:** Supabase returns technical strings like `"Invalid login credentials"` — the hook rewrites these to `"Incorrect email or password."` before the UI sees them
2. **`firstName` convenience property:** Splits `user.full_name` on the space character and returns the first word. Used in the dashboard greeting: *"Good morning, Harsh 👋"*

### `hooks/useNetworkStatus.ts` — Network Status Hook

Wraps `@react-native-community/netinfo` in a clean React effect:
- Immediately fetches the current network state on mount
- Subscribes to changes — if the user's phone drops WiFi, all subscribed components re-render within milliseconds
- Unsubscribes cleanly on unmount (no memory leaks)
- Returns: `{ isOnline: boolean, connectionType: string | null, isInternetReachable: boolean | null }`

---

### `app/(auth)/index.tsx` — Splash Screen

The first thing a technician sees every time they launch SiteTrack.

**Visuals:**
- Full-screen Navy (`#1B2D4F`) background
- Orange circle (`#F97316`) with "ST" monogram inside (100×100px, elevation shadow)
- "SiteTrack" wordmark in white, Expo-default bold — 36px
- Tagline: *"Field Service, Simplified"* in 70% white

**Behaviour:**
- The entire content area fades in using `react-native-reanimated`'s `FadeIn.duration(600)` entering animation
- While `isLoading` (session restore in progress): a subtle loading indicator animates in at the bottom
- Once `isLoading` becomes `false`: waits 500ms (so the animation is visible for at least a beat), then:
  - If `isAuthenticated: true` → navigates to `/(app)/` (home dashboard)
  - If `isAuthenticated: false` → navigates to `/(auth)/login`
- **The user never sees a blank white screen** — the splash renders first and transitions while the session check happens in the background

---

### `app/(auth)/login.tsx` — Login Screen

A full production sign-in screen. Every element is functional.

**Layout (scrollable, keyboard-aware):**
1. **Logo** — smaller version of the ST monogram + "SiteTrack" wordmark
2. **Heading block** — "Welcome back" (28px bold) + "Sign in to continue" subtext
3. **Global error banner** — appears above the form if Supabase returns an error; uses the `colors.errorLight` background with `colors.errorDark` text. Shows the friendly-mapped error from `useAuth`
4. **Email field** — React Native Paper `TextInput` (outlined) with email icon, `keyboardType="email-address"`, `autoCapitalize="none"`. Inline red error beneath the field if validation fails
5. **Password field** — `secureTextEntry` with show/hide toggle (eye icon on the right). Inline error beneath the field
6. **Remember Me row** — Paper `Checkbox` on the left, "Forgot Password?" link right-aligned
7. **Sign In button** — Full-width, 52px tall (glove-friendly), Navy background, Orange label text. Shows `ActivityIndicator` while signing in. Disabled during loading to prevent double-submit
8. **Biometric button** — Only appears if: (a) the device has biometric hardware, (b) biometrics are enrolled in device settings, AND (c) the user previously checked "Remember me". Shows either "Use Face ID" or "Use Fingerprint" depending on what the device supports

**Validation (client-side, runs before Supabase call):**
- Email: must be non-empty + match `/\S+@\S+\.\S+/`
- Password: must be non-empty + at least 6 characters
- Each field shows its own inline error below it — technicians know exactly which field is wrong

**Biometric flow:**
```
User taps biometric button
→ expo-local-authentication.authenticateAsync() shows OS prompt
→ On success: router.replace to /(app)/  (session is already in AsyncStorage)
→ On failure/cancel: nothing happens, password form remains
```

---

### `app/(auth)/forgot-password.tsx` — Forgot Password Screen

- Email input with the same validation as the login screen
- "Send Reset Email" button calls `supabase.auth.resetPasswordForEmail(email)`
- Two possible banner states:
  - **Success (green):** "Check your inbox — a password reset link has been sent."
  - **Error (red):** The Supabase error message (e.g., "User not found")
- Back to Login link at the top navigates `router.back()`

---

## Step 5 — App Shell & Navigation

### `app/_layout.tsx` — Root Layout (Replaced)

This file is the single entry point for the entire app. Everything is mounted here.

**Wrapping order (outer to inner):**
1. `GestureHandlerRootView` — required by `@gorhom/bottom-sheet` (used in later phases). Without this wrapper, bottom sheets will crash on Android
2. `PaperProvider` with custom SiteTrack theme — injects the Material Design 3 component system with our Navy primary and Orange secondary colours. Every `Button`, `TextInput`, `Checkbox`, and `Text` component in the app inherits this theme
3. `Stack` navigator with `(auth)`, `(app)`, and `modal` screens
4. `StatusBar` — adjusts light/dark style to match system colour scheme
5. `Toast` — the react-native-toast-message overlay. Mounted at root so toasts appear above every screen

**Custom Paper theme:**
```
Primary colour:   #1B2D4F  (Navy)
Secondary colour: #F97316  (Orange)
Background:       #FFFFFF / #0D1117 (light/dark)
Error:            #EF4444 / #F85149 (light/dark)
```

**Auth guard logic (inside the root layout):**
```
On mount → initializeSchema() → creates local SQLite tables if first launch
On mount → restoreSession() → checks AsyncStorage for persisted session
When isLoading changes to false:
    isAuthenticated === true  → startSync() → router.replace('/(app)/')
    isAuthenticated === false → router.replace('/(auth)/')
```
This means the app always starts at the splash screen and the auth state determines where it goes. No flicker, no blank screens.

---

### `app/(app)/_layout.tsx` — Main Tab Navigator

4-tab bottom navigator using `expo-router`'s `Tabs` component.

**Tab bar styling:**
| Property | Value |
|----------|-------|
| Background | `#1B2D4F` (Navy) |
| Active tint | `#F97316` (Orange) |
| Inactive tint | `rgba(255,255,255,0.55)` |
| Height | 60px (glove-friendly) |
| Shadow | 8px elevation, subtle drop shadow |
| Label size | 11px, semibold, 0.2 letter-spacing |

| Tab | Icon | Route | Status |
|-----|------|-------|--------|
| Home | `home` | `/` | ✅ Full dashboard |
| Jobs | `briefcase-outline` | `/jobs` | Placeholder → Phase 3 |
| Alerts | `bell-outline` | `/notifications` | Placeholder → Phase 4 |
| Profile | `account-outline` | `/profile` | Working sign-out |

**`app/(app)/profile.tsx`** — While a placeholder for full profile editing (Phase 5), it contains a working **Sign Out** button that calls `useAuth().signOut()`, which properly stops sync, clears storage, and redirects to login.

---

### `components/OfflineBanner.tsx` — Offline Mode Banner

A persistent banner that appears whenever the device has no internet connection.

**How it works:**
- Uses `useNetworkStatus()` hook — subscribes to NetInfo changes
- When `isOnline` becomes `false`: `Animated.timing` slides it down from `-36px` to `0` (takes 300ms)
- When `isOnline` becomes `true`: slides back up off-screen
- Uses `position: 'absolute'` at `top: 0` with `zIndex: 999` — sits above all content on every screen, always visible
- Yellow (`#EAB308`) background with dark bold text: *"⚠️  Offline Mode — Changes will sync when connected"*
- Does NOT block interaction — users can still use the app fully while the banner is visible

---

### `components/SyncStatusBar.tsx` — Sync Status Indicator

A small, tappable component placed in the header of the dashboard.

**States:**
| Dot Colour | Label | Meaning |
|------------|-------|---------|
| 🟢 Green | "Just synced" / "2 min ago" | Sync is up to date |
| 🟠 Orange | "3 min ago · 4 pending" | Items in sync queue not yet pushed |
| ⚫ Grey | "Offline" | Device has no internet |
| (any) | "Syncing..." | Manual sync in progress |

**Behaviour:**
- Calls `getSyncStatus()` from `lib/sync.ts` on mount, then every 30 seconds via `setInterval`
- `getSyncStatus()` reads `AsyncStorage` for the last-synced timestamp and counts the SQLite `sync_queue` table
- Tapping the component calls `runSync()` if online — executes a full pull + push cycle immediately
- Shows "Syncing..." label while the sync is running (prevents overlapping taps)
- `clearInterval` on unmount — no memory leaks

---

## Step 6 — Home Dashboard

### `store/dashboardStore.ts` — Dashboard Store

All dashboard data comes from **local SQLite only** — this is the offline-first principle in action. No network call is made when loading the dashboard.

**`loadDashboard(userId)`** runs 3 SQLite queries synchronously:

**Query 1 — Today's jobs with property info (JOIN)**
```sql
SELECT j.*, p.name AS property_name, p.address AS property_address,
       p.suburb AS property_suburb, p.state AS property_state
FROM jobs j
LEFT JOIN properties p ON j.property_id = p.id
WHERE j.assigned_to = ?
  AND j.scheduled_date = ?        -- Today's date (YYYY-MM-DD)
  AND j.status != 'cancelled'
ORDER BY j.scheduled_time ASC, j.priority DESC
```
The result powers both the stats cards and the job cards list.

**Query 2 — This week's job statuses**
Calculates Monday–Sunday of the current week. Counts total and completed jobs for the weekly summary card.

**Query 3 — Open defect count**
```sql
SELECT COUNT(*) as count FROM defects
WHERE job_id IN (SELECT id FROM jobs WHERE assigned_to = ?)
  AND status = 'open'
```
Drives the "Open Defects" quick action counter.

---

### `app/(app)/index.tsx` — Home Dashboard Screen

The main screen a technician looks at every morning. Built in 5 distinct sections, all with `FadeInDown` enter animations (staggered 50ms delays).

**Section 1 — Branded Header Bar**

A Navy (`#1B2D4F`) header that extends to the top of the screen with rounded bottom corners (24px radius). Contains:
- **Greeting:** Time-aware — "Good morning / Good afternoon / Good evening, [First Name] 👋" (22px, bold, white)
- **Date:** Full date in Australian format — "Tuesday, 31 March 2026" (12px, 65% white)
- **SyncStatusBar** — top-right corner, tappable sync indicator

**Section 2 — Today's Stats Row**

Four equal-width cards in a horizontal row, each with:
- An emoji icon (📋 📈 🔧 ⏳)
- A large bold number in the card's accent colour
- A small label below

| Card | Accent | Source |
|------|--------|--------|
| Total | Info Blue | `todayStats.total` |
| Done | Success Green | `todayStats.completed` |
| Active | Accent Orange | `todayStats.inProgress` |
| Pending | Grey | `todayStats.pending` |

Cards have 2px elevation shadow. Each animates in with `FadeInDown` at 50ms intervals (Total first, Pending last).

**Section 3 — Quick Actions Grid**

A 2×2 grid of large touchable cards. Each card has:
- A coloured icon circle (24px icon in a 44×44 semi-transparent circle)
- A label below

| Card | Icon | Colour | On Tap |
|------|------|--------|--------|
| Start Next Job | 🚀 | Orange | Navigate to `/jobs` tab |
| Scan Asset QR | 📷 | Info Blue | Toast: "Coming in Phase 3" |
| This Week | 📆 | Success Green | Toast: "X/Y jobs complete, Z%" |
| Open Defects | ⚠️ | Error Red | Toast: count + guidance |

The "This Week" and "Open Defects" toasts show live data from the dashboard store — so if there are 3 open defects, the toast says "3 Open Defects — Tap Jobs to view details". If none: "All defects resolved ✓".

**Section 4 — Today's Jobs List**

- Section header: "Today's Jobs (X)" where X is the live count
- **Empty state** (no jobs today): A dashed-border card with a 🎉 emoji, "No jobs scheduled for today", and "Enjoy your day or check back after sync"
- **Job cards** (when jobs exist): One card per job, stacked vertically

Each **JobCard** contains:
- **Priority colour strip** — a 5px vertical bar on the left edge:
  - Urgent → Error Red
  - High → Warning Yellow
  - Normal → Info Blue
  - Low → Grey
- **Property name** — bold, 15px, truncated to 1 line
- **Status badge** — right-aligned pill with background/text colour:
  - Scheduled → Blue
  - In Progress → Orange
  - Completed → Green
- **Address line** — 📍 street address + suburb, grey, 12px
- **Type badge** — pill showing "Routine Service", "Emergency", etc.
- **Scheduled time** — 🕐 HH:MM format if set
- Tapping any card navigates to the Jobs tab (Phase 3 will navigate to the specific job detail)

**Section 5 — Weekly Summary Card**

A full-width Navy card with:
- "This Week" title (white, bold) + percentage on the right (Orange, 22px bold)
- "X of Y jobs completed" subtitle (70% white)
- **Progress bar:** Full-width track (20% white fill), Orange fill bar that animates to the correct percentage
- Example: If 6 of 10 jobs are done → 60% → bar is 60% filled in Orange on Navy

**Three screen states handled:**
1. **Loading:** Skeleton placeholder blocks replace all sections while SQLite query runs
2. **Error:** Red error message centred on screen with a "Retry" button
3. **Loaded:** Full dashboard as described above

**Pull to refresh:** `RefreshControl` with Orange spinner — triggers `loadDashboard()` again.

---

## Bug Fixed During Phase 2

### Stale Typed Route Definitions

**Scenario:** TypeScript reported 9 errors like "Argument of type `'/(app)/'` is not assignable to parameter" in every file using `router.replace` or `router.push`.

**Root cause:** The `.expo/types/router.d.ts` file had been generated by an old `expo start` run that only knew about the scaffold's `(tabs)/` routes. When `typedRoutes: true` is set in `app.json`, Expo Router generates a strict union type of all known routes — and this stale file didn't include any of our new `(auth)` or `(app)` routes.

**Fix:**
1. Set `typedRoutes: false` in `app.json` (disables strict route checking — safe for active development)
2. Deleted `.expo/types/` directory to remove the stale type definitions
3. `npx tsc --noEmit` → 0 errors

`typedRoutes` can be re-enabled once all routes are stable and Expo regenerates the definitions.

---

## Verification Results ✅

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ **0 TypeScript errors** |
| `npx expo start` | ✅ **Metro starts at localhost:8081** |
| Plugin errors | ✅ **None (fixed in Phase 1)** |
| Supabase credentials populated | ✅ `.env` filled |
| Test user in database | ✅ Harsh / `harsh12112021@gmail.com` |

---

## Complete File Manifest — Phase 2

### New Files (12)
| File | Lines | Purpose |
|------|-------|---------|
| `store/authStore.ts` | ~155 | Zustand auth: signIn, signOut, restore, onAuthStateChange |
| `store/dashboardStore.ts` | ~110 | Zustand dashboard: SQLite queries for jobs + stats |
| `hooks/useAuth.ts` | ~40 | Auth hook wrapper with friendly errors |
| `hooks/useNetworkStatus.ts` | ~40 | NetInfo reactive wrapper |
| `components/OfflineBanner.tsx` | ~55 | Animated offline indicator |
| `components/SyncStatusBar.tsx` | ~90 | Live sync status + manual trigger |
| `app/(auth)/index.tsx` | ~95 | Animated navy splash screen |
| `app/(auth)/login.tsx` | ~255 | Full login form + biometrics + validation |
| `app/(auth)/forgot-password.tsx` | ~115 | Password reset with success/error banners |
| `app/(app)/jobs.tsx` | ~20 | Placeholder tab (Phase 3) |
| `app/(app)/notifications.tsx` | ~20 | Placeholder tab (Phase 4) |
| `app/(app)/profile.tsx` | ~30 | Profile shell with working sign-out |

### Modified Files (4)
| File | What Changed |
|------|-------------|
| `app/_layout.tsx` | Full replacement — Paper Provider + GestureHandler + auth guard + sync + Toast |
| `app/(auth)/_layout.tsx` | Real Stack navigator with auth redirect guard |
| `app/(app)/_layout.tsx` | 4-tab navigator with navy/orange styling |
| `app/(app)/index.tsx` | Full home dashboard — replaced scaffold placeholder |

### Config Changes
| File | Change |
|------|--------|
| `app.json` | `typedRoutes: false` (stale types cleanup) |
| `.expo/types/` | Deleted (stale route definitions regenerate on next start) |

---

## How to Run on Your Android Phone

### Option A — Expo Go (Fastest, for testing)
1. Install **Expo Go** from Google Play Store
2. Ensure phone and PC are on the **same WiFi network**
3. Run: `npx expo start`
4. Scan the QR code shown in the terminal with your camera
5. App loads in Expo Go

### Option B — Development Build APK (for full feature access)
> Required for: camera, biometrics, notifications, maps (native modules don't work in Expo Go)

```bash
# One-time setup — EAS CLI
npm install -g eas-cli
eas login

# Build
eas build --platform android --profile development
```
EAS builds in the cloud — no Android Studio or Java SDK needed. Download the APK link when done, install on device.

### What You'll See on First Launch
1. **Navy splash screen** fades in — "ST" orange circle, "SiteTrack" title, "Field Service, Simplified" tagline
2. Session check runs (300–500ms)
3. **Login screen** appears (first time — no saved session)
4. Enter: `harsh12112021@gmail.com` + your Supabase Auth password
5. Brief loading spinner on the Sign In button
6. **Home Dashboard** appears:
   - Greeting: "Good evening, Harsh 👋" + today's date
   - Stats: All zeros (no jobs in the DB yet — normal)
   - Quick action grid
   - Empty state: "No jobs scheduled for today 🎉"
   - Weekly summary: 0% progress bar
7. Bottom tab bar — navy with orange active tab
8. Pull down on the dashboard to trigger a manual refresh

---

## What's Next — Phase 3

**Step 7:** Jobs List Screen — full job management
- Live job list filtered by today / this week / all
- Job detail screen with asset checklist
- Job status updates (Scheduled → In Progress → Completed)
- Clock-in / Clock-out with GPS timestamp

**Step 8:** Property & Asset management screens

**Step 9:** QR Code scanner for asset identification

```
Supabase Project: vnrmgcxmcspdgqcnmmdx
Bundle ID: com.sitetrack.app
Test User: harsh12112021@gmail.com
```
