# SiteTrack — Phase 1 Bootstrap: Completion Report

> **Project:** SiteTrack Field Service Management App (Android)
> **Phase:** 1 of 15 — Foundation Bootstrap
> **Completed:** 31 March 2026
> **Status:** ✅ All checks passing — Ready for Phase 2

---

## What Phase 1 Is

Phase 1 is the invisible foundation of SiteTrack. No screens, no UI. Everything built here is the concrete slab that all 14 remaining phases build on top of:

- The project framework and all dependencies
- The entire TypeScript type system
- The colour palette, enums, and configuration
- The local SQLite database (offline-first)
- The Supabase backend connection
- The background sync engine
- The full cloud database schema with security policies

---

## Step 1 — Project Bootstrap

### Framework
| Item | Value |
|------|-------|
| Framework | Expo SDK 54 |
| Language | TypeScript 5.9.2 (strict mode) |
| Navigation | Expo Router v6 (file-based) |
| React Native | 0.81.5 |
| React | 19.1.0 |
| Architecture | New Architecture enabled (Fabric + JSI) |
| Target | Android physical device (APK) |

### All Dependencies Installed (30+)

**Backend & Storage**
- `@supabase/supabase-js` ^2.101.0 — Supabase client for auth, database, storage
- `@react-native-async-storage/async-storage` 2.2.0 — Persists auth session across restarts
- `react-native-url-polyfill` ^3.0.0 — Required by Supabase (URL API polyfill for RN)

**Offline Database**
- `expo-sqlite` ~16.0.10 — Local SQLite on-device (chosen over WatermelonDB which has RN 0.76+ issues)

**State Management**
- `zustand` ^5.0.12 — Global state store (lightweight, no boilerplate)

**UI & Navigation**
- `react-native-paper` ^5.15.0 — Material Design 3 components
- `react-native-gesture-handler` ~2.28.0 — Native gesture support
- `react-native-reanimated` ~4.1.1 — 60fps UI-thread animations
- `@gorhom/bottom-sheet` ^5.2.8 — Bottom sheet modals
- `react-native-toast-message` ^2.3.3 — Toast notifications

**Device Hardware**
- `expo-camera` ~17.0.10 — Camera + barcode scanning (replaces deprecated expo-barcode-scanner)
- `expo-local-authentication` ~17.0.8 — Fingerprint / Face ID
- `expo-location` ~19.0.8 — GPS coordinates
- `expo-notifications` ~0.32.16 — Push notifications
- `expo-image-picker` ~17.0.10 — Photo library access
- `expo-file-system` ~19.0.21 — File read/write for PDFs
- `expo-media-library` ~18.2.1 — Saves photos to camera roll

**Field Features**
- `react-native-signature-canvas` ^5.0.2 — Client signature collection
- `react-native-maps` 1.20.1 — Job site navigation maps
- `react-native-html-to-pdf` ^1.3.0 — PDF compliance report generation
- `react-native-webview` 13.15.0 — Required by signature-canvas
- `@react-native-community/netinfo` 11.4.1 — Online/offline detection for sync

### Configuration Files

**`app.json`**
- App name: SiteTrack | Slug: sitetrack
- iOS bundle ID: `com.sitetrack.app`
- Android package: `com.sitetrack.app`
- 11 Android permissions declared (CAMERA, LOCATION, BIOMETRIC, STORAGE, etc.)
- Plugins: expo-router, expo-splash-screen, expo-camera, expo-location, expo-notifications
- Google Maps API key slot reserved in `android.config`
- ⚠️ Note: `react-native-maps` removed from plugins (it ships no `app.plugin.js`) — this was a bug that caused a PluginError on startup, now fixed

**`tsconfig.json`** — Strict TypeScript:
- `strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `noImplicitReturns`
- Path alias: `@/*` → `./`

**`.env`** *(gitignored — filled with real credentials)*
```
EXPO_PUBLIC_SUPABASE_URL=https://vnrmgcxmcspdgqcnmmdx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

**`.gitignore`** — Excludes `.env`, `node_modules/`, `.expo/`, `dist/`, `android/`, `ios/`

---

## Step 2 — Folder Structure & Constants

### Full Folder Structure Created
```
f:\SiteTrack App\
├── app\
│   ├── (auth)\
│   │   └── _layout.tsx       ← Stack navigator (login/register)
│   └── (app)\
│       └── _layout.tsx       ← Tab navigator (jobs/properties/profile)
├── components\               ← Empty, ready for Phase 2
├── constants\
│   ├── Colors.ts             ← Full colour palette
│   ├── Enums.ts              ← All app enumerations
│   └── Config.ts             ← Non-secret configuration
├── lib\
│   ├── supabase.ts           ← Supabase client
│   ├── database.ts           ← SQLite local DB
│   └── sync.ts               ← Background sync engine
├── store\                    ← Empty, Zustand stores go here
├── hooks\                    ← Empty, custom hooks go here
├── types\
│   └── index.ts              ← All TypeScript interfaces
├── utils\                    ← Empty, helpers go here
├── supabase\
│   └── schema.sql            ← Cloud DB schema ✅ ran
└── docs\
    ├── DATABASE.md           ← DB reference guide
    └── PHASE1_REPORT.md      ← This file
```

### `constants/Colors.ts`
Complete dual-theme colour system:

| Token | Light | Dark |
|-------|-------|------|
| Primary (Navy) | `#1B2D4F` | `#3B5EA6` |
| Accent (Orange) | `#F97316` | `#F97316` |
| Background | `#FFFFFF` | `#0D1117` |
| Surface | `#FFFFFF` | `#161B22` |
| Text | `#0F172A` | `#F0F6FC` |
| Success | `#22C55E` | `#3FB950` |
| Warning | `#EAB308` | `#D29922` |
| Error | `#EF4444` | `#F85149` |
| Info | `#3B82F6` | `#58A6FF` |

### `constants/Enums.ts`
10 enums covering every status/type value in the app:
- `JobStatus` — scheduled | in_progress | completed | cancelled
- `JobType` — routine_service | defect_repair | installation | emergency | quote
- `AssetStatus` — active | decommissioned
- `InspectionResult` — pass | fail | not_tested
- `DefectSeverity` — minor | major | critical
- `DefectStatus` — open | quoted | repaired | monitoring
- `ComplianceStatus` — compliant | non_compliant | overdue | pending
- `UserRole` — technician | subcontractor
- `SyncOperation` — insert | update | delete
- `Priority` — low | normal | high | urgent

### `constants/Config.ts`
| Constant | Value |
|----------|-------|
| SYNC_INTERVAL_MS | 60,000 (60 seconds) |
| MAX_PHOTOS_PER_DEFECT | 10 |
| APP_NAME | "SiteTrack" |
| BUNDLE_ID | "com.sitetrack.app" |
| OFFLINE_CACHE_DAYS | 30 |
| DB_NAME | "sitetrack.db" |

### `types/index.ts`
Full TypeScript interfaces for all domain models:

| Interface | Purpose |
|-----------|---------|
| `User` | Technician profile |
| `Property` | Site/building |
| `Asset` | Fire safety device |
| `Job` | Field service visit |
| `JobAsset` | Per-asset inspection record |
| `Defect` | Compliance failure |
| `InspectionPhoto` | Job photo |
| `Signature` | Client sign-off |
| `TimeLog` | Clock-in/out record |
| `SyncQueueItem` | Offline write queue entry |
| `ApiResponse<T>` | Generic API wrapper |
| `PaginatedResponse<T>` | Paginated list wrapper |
| `LoginForm` | Login screen state |
| `InspectionForm` | Inspection submission |
| `DefectForm` | Defect logging |
| `SyncStatus` | Sync health snapshot |

---

## Step 3 — Services

### `lib/supabase.ts` — Cloud Backend Client
- Supabase client with `AsyncStorage` session persistence
- Auto token refresh (stays logged in indefinitely)
- `getCurrentUser()` — null-safe auth user helper
- `signOut()` — clears session and AsyncStorage

### `lib/database.ts` — Local SQLite Database
- Opens `sitetrack.db` using a singleton connection
- WAL journal mode — allows reads during writes (critical for background sync)
- 10 tables created with `CREATE TABLE IF NOT EXISTS` (safe to run every launch):
  `users, properties, assets, jobs, job_assets, defects, inspection_photos, signatures, time_logs, sync_queue`
- Generic CRUD: `insertRecord`, `updateRecord`, `deleteRecord`, `getRecord`, `queryRecords`, `upsertRecord`
- Domain helpers:
  - `getJobsForTechnician(userId)` — jobs with property details, ordered by date + priority
  - `getAssetsForProperty(propertyId)` — active assets sorted by type
  - `getDefectsForJob(jobId)` — defects sorted critical → major → minor
- Sync queue: `addToSyncQueue`, `getPendingSyncItems`, `markSyncItemComplete`

### `lib/sync.ts` — Background Sync Engine
- `startSync()` — runs immediately + every 60 seconds via `setInterval`
- `stopSync()` — clears the interval (on sign-out)
- `runSync()` — full sync cycle:
  1. Check `_isSyncing` flag (prevents overlap)
  2. NetInfo connectivity check → skip if offline
  3. `getCurrentUser()` → skip if not authenticated
  4. **PULL** from Supabase → upsert to SQLite: jobs → properties → assets → job_assets → defects → photos → signatures → time_logs
  5. **PUSH** sync queue → Supabase (insert/update/delete per item) → mark complete
  6. Save `last_synced` timestamp to AsyncStorage
- `getSyncStatus()` → `{ lastSynced, pendingCount, isOnline }`
- Per-item error handling — failed pushes stay in queue for retry, don't block other items

---

## `supabase/schema.sql` — Cloud Database ✅ Ran Successfully

### Tables Created (9)
| Table | Key Features |
|-------|-------------|
| `users` | Links to `auth.users`, role constraint, RLS = own row only |
| `properties` | Compliance status, access/hazard notes, readable by all auth users |
| `assets` | Barcode ID, service dates, cascades from property |
| `jobs` | Central entity, assigned_to FK, 3 performance indexes |
| `job_assets` | Inspection record, pass/fail/not_tested constraint |
| `defects` | photos TEXT[], severity/status constraints, job-scoped |
| `inspection_photos` | nullable asset_id (site-level photos), uploaded_by FK |
| `signatures` | UNIQUE job_id — one signature per job enforced at DB level |
| `time_logs` | GPS decimal(10,7), nullable clock_out |

### Security (RLS on every table)
- `users` → own row only
- `properties`, `assets` → all authenticated users can SELECT
- `jobs` → only the assigned technician
- All child tables → access gated through `is_job_assigned_to_me(job_id)` function
- No technician can INSERT jobs, DELETE anything, or read other technicians' data

### Performance Indexes (6)
`idx_jobs_assigned_to`, `idx_jobs_status`, `idx_jobs_scheduled_date`, `idx_assets_property_id`, `idx_defects_job_id`, `idx_properties_compliance_status`

### Automation
- `set_updated_at()` trigger fires on every UPDATE to `jobs` and `properties`
- `ON DELETE CASCADE` on all child tables

---

## Verification Results ✅

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ **0 TypeScript errors** |
| `npx expo config --type introspect` | ✅ **All plugins resolve cleanly** |
| `npx expo start` | ✅ **Metro bundler starts at localhost:8081** |
| Supabase SQL schema | ✅ **Ran successfully in SQL Editor** |
| `.env` filled with real credentials | ✅ |
| `.env` gitignored | ✅ |
| All 30+ packages installed | ✅ No version conflicts |

---

## Before Starting Phase 2

### Must Do Now
1. **Create a test user in Supabase Auth:**
   - Supabase Dashboard → Authentication → Users → Add User
   - Enter email + password for a test technician

2. **Insert their profile row** in SQL Editor:
   ```sql
   INSERT INTO public.users (id, email, full_name, role)
   VALUES (
     'paste-the-uuid-from-auth-users-table',
     'tech@sitetrack.com.au',
     'Test Technician',
     'technician'
   );
   ```

3. **Add Google Maps API key** (when ready for native build):
   - In `app.json` → `android.config.googleMaps.apiKey`

### Phase 2 Preview — What Gets Built Next
- Login screen (email/password form + biometric toggle)
- Zustand auth store (`store/authStore.ts`)
- Root layout with auth gating (redirect to login if no session)
- Jobs list screen — reads from local SQLite, shows today's jobs
- Sync status indicator in the header

---

*Supabase Project: `vnrmgcxmcspdgqcnmmdx` | App ID: `com.sitetrack.app`*
