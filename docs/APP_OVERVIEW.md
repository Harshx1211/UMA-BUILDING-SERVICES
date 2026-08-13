# SiteTrack — App Overview

> **Client:** UMA Building Services  
> **Purpose:** Field service mobile app for fire safety compliance technicians  
> **Platform:** React Native (Expo) — iOS + Android  
> **Backend:** Supabase (PostgreSQL + Storage + Auth)  
> **Local DB:** SQLite via `expo-sqlite`  
> **State:** Zustand stores  
> **Navigation:** Expo Router (file-system based)

---

## What This App Does

SiteTrack is a **field-first, offline-capable** mobile application for fire safety technicians employed by UMA Building Services. Technicians use it to:

1. **View their job schedule** — Jobs assigned by office admins via the web portal
2. **Inspect fire safety assets** — Log Pass/Fail/Not-Tested per asset, with compliance checklists
3. **Record defects** — Photograph and categorise deficiencies found on-site
4. **Capture signatures** — Client + technician sign-off on completed work
5. **Generate PDF reports** — AS1851-2012 compliant inspection reports sent via email/share
6. **Create quotes** — Line-item quotes for defect remediation
7. **Work fully offline** — All writes queue to SQLite; background sync pushes to Supabase

---

## Architecture At a Glance

```
┌─────────────────────────────────────────────────────┐
│                 EXPO ROUTER (Navigation)             │
│  /(auth)/login  →  /(app)/(tabs) + detail routes    │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   Zustand Stores  SQLite DB     Supabase
   (UI state)      (offline)     (cloud truth)
        │              │              │
        └──────────────┼──────────────┘
                  Background Sync
                  (every 60 seconds)
```

---

## Directory Structure

```
SiteTrack App/
├── app/
│   ├── _layout.tsx              # Root layout — providers, splash, DB init
│   ├── (auth)/                  # Auth flow (unauthenticated users)
│   │   ├── login.tsx            # Email/password + biometric login
│   │   └── forgot-password.tsx  # Password reset flow
│   └── (app)/                   # Protected app routes
│       ├── _layout.tsx          # Tab navigator + sync bootstrap
│       ├── index.tsx            # Home / Dashboard
│       ├── profile.tsx          # Technician profile + settings
│       ├── help.tsx             # Help & FAQ
│       ├── jobs/
│       │   ├── index.tsx        # Job schedule list
│       │   └── [id]/
│       │       ├── index.tsx    # Job detail hub
│       │       ├── inspect.tsx  # Asset inspection form
│       │       ├── defects.tsx  # Defect list for job
│       │       ├── defects/     # Sub-defect detail screens
│       │       ├── photos.tsx   # Photo gallery
│       │       ├── signature.tsx # Client + tech signature capture
│       │       ├── quote.tsx    # Quote builder
│       │       ├── report.tsx   # Final PDF report viewer
│       │       └── preview.tsx  # Draft report preview
│       ├── properties/
│       │   ├── [id].tsx         # Property detail + asset list
│       │   └── assets/
│       │       └── [id].tsx     # Individual asset detail
│       ├── assets/
│       │   └── [id].tsx         # Asset detail (standalone entry)
│       ├── defects/
│       │   └── index.tsx        # Company-wide defect list
│       └── notifications/
│           └── index.tsx        # Notification inbox
│
├── components/
│   ├── OfflineBanner.tsx        # Network status ribbon
│   ├── SyncStatusBar.tsx        # Pending sync item counter
│   ├── camera/                  # Custom camera view
│   ├── defects/                 # Defect-specific components
│   ├── inspections/
│   │   ├── AddAssetModal.tsx    # Add new asset on-site
│   │   ├── AssetInspectModal.tsx # Fail capture modal (defect + photos)
│   │   ├── ChecklistModal.tsx   # AS1851 compliance checklist modal
│   │   ├── EditAssetModal.tsx   # Edit asset metadata
│   │   └── index.ts
│   ├── jobs/                    # Job-specific components (e.g. CompletionBottomSheet)
│   └── ui/                      # Shared design system components
│       ├── Badge.tsx            # Status pill (scheduled/in_progress/completed)
│       ├── Button.tsx           # Primary/secondary/ghost buttons
│       ├── Card.tsx             # Surface container with variants
│       ├── EmptyState.tsx       # Empty-list placeholder
│       ├── FilterPills.tsx      # Horizontal filter tabs
│       ├── FormField.tsx        # Labeled input wrapper
│       ├── Input.tsx            # Styled text input
│       ├── ScreenHeader.tsx     # Back button + title + right action
│       ├── SectionHeader.tsx    # Section heading
│       ├── SectionTitle.tsx     # Section label variant
│       ├── SkeletonCard.tsx     # Loading skeleton placeholder
│       └── index.ts             # Barrel export
│
├── store/                       # Zustand state management
│   ├── authStore.ts             # Auth, session, company subscription
│   ├── catalogueStore.ts        # Asset type + defect code definitions
│   ├── dashboardStore.ts        # KPI counts for the home screen
│   ├── defectsStore.ts          # Defect CRUD + filtering
│   ├── inspectionStore.ts       # Per-job asset inspection state
│   ├── inventoryStore.ts        # Inventory items for quoting
│   ├── jobsStore.ts             # Job list + status updates
│   ├── notificationsStore.ts    # In-app notification management
│   ├── photosStore.ts           # Photo management
│   └── quotesStore.ts           # Quote + quote items
│
├── lib/
│   ├── database.ts              # SQLite schema + all read/write helpers
│   ├── sync.ts                  # Background sync engine (push + pull)
│   ├── photoUpload.ts           # Photo queue processor + local cleanup
│   ├── pdfGenerator.ts          # PDF assembly (pdf-lib)
│   ├── reportTemplate.ts        # HTML/PDF template for AS1851 report
│   ├── quoteTemplate.ts         # HTML template for quote documents
│   ├── supabase.ts              # Supabase client configuration
│   ├── notifications.ts         # Expo Notifications setup + handlers
│   └── pdfConstants.ts          # Shared PDF layout constants
│
├── types/
│   └── index.ts                 # All TypeScript interfaces (domain models, forms, API)
│
├── constants/
│   ├── Colors.ts                # Single design token source (T.* + Colors.dark.*)
│   ├── Config.ts                # App-wide configuration (sync interval, keys, etc.)
│   ├── Enums.ts                 # All enumerations (JobStatus, AssetStatus, etc.)
│   ├── Typography.ts            # Text style presets
│   ├── GlobalStyles.ts          # Shared StyleSheet patterns
│   ├── Checklists.ts            # AS1851 compliance checklist definitions per asset type
│   ├── AssetData.ts             # Static asset type metadata
│   ├── DefectCodes.ts           # Uptick defect code library (code → description + price)
│   ├── Company.ts               # Company-level constants (name, ABN)
│   ├── headerPad.ts             # Safe-area header padding helpers
│   └── theme.ts                 # react-native-paper theme tokens
│
├── hooks/
│   ├── useAuth.ts               # Convenience wrapper around authStore
│   ├── useColors.ts             # Returns Colors.dark (always dark-mode)
│   ├── useNetworkStatus.ts      # NetInfo listener + offline banner trigger
│   └── use-color-scheme.ts      # System color scheme (stub — always 'dark')
│
├── utils/
│   ├── assetHelpers.ts          # formatAssetType(), getAssetTypeIcon()
│   └── uuid.ts                  # generateUUID() wrapper
│
└── supabase/                    # Supabase project config + Edge Functions
```

---

## Data Flow

### App Launch

```
1. _layout.tsx mounts
2. SQLite schema initialized (initializeSchema)
3. Old sync queue items cleaned up
4. restoreSession() → checks AsyncStorage cache → Supabase.auth.getSession()
5. If authenticated → app/(app)/_layout.tsx
   ├── Heartbeat access check (is_active + subscription_status)
   ├── Subscribe stores to sync events
   ├── Load from local SQLite immediately (no wait)
   └── Start background sync loop (60s interval)
6. If not authenticated → app/(auth)/login.tsx
```

### Job Inspection Flow

```
Jobs List → Job Detail [id]/index.tsx
  │
  ├── Start Job → status: in_progress (local SQLite + sync queue)
  │
  ├── Open Inspection → [id]/inspect.tsx
  │   ├── Load assets for property (SQLite JOIN job_assets)
  │   ├── For each asset: Pass / Fail / N/T
  │   │   ├── Pass → updateAssetResult() → save to job_assets in SQLite
  │   │   ├── Fail → AssetInspectModal → defect reason + photos + severity
  │   │   │         → creates defect row + inspection_photos rows in SQLite
  │   │   └── N/T  → updateAssetResult() with not_tested
  │   └── Complete → [id]/report.tsx (PDF generation)
  │
  ├── Photos → [id]/photos.tsx
  │   └── Camera capture → local file → photo_upload_queue → processPhotoQueue()
  │
  ├── Defects → [id]/defects.tsx → [id]/defects/[defectId].tsx
  │
  ├── Signature → [id]/signature.tsx
  │   └── Client signs → tech signs → base64 PNG → SQLite + sync queue
  │
  ├── Quote → [id]/quote.tsx
  │   └── Add inventory items → line items → quote total
  │
  ├── Preview → [id]/preview.tsx → draft PDF render
  │
  └── Complete Job → CompletionBottomSheet
      ├── Validates: signature present + at least 1 asset inspected
      └── → status: completed → [id]/report.tsx → final PDF
```

### Offline Sync Engine

```
runSync() [every 60s + manual pull-to-refresh]:
  1. Network check (NetInfo) — skip if offline
  2. Access revocation check (is_active + subscription_status)
  3. PUSH: processPhotoQueue() — upload local photo files to Supabase Storage
  4. PUSH: _pushQueue() — push pending sync_queue items (INSERT/UPDATE/DELETE)
  5. PULL: _pullJobs() — fetch all non-cancelled jobs for this technician
     └── Also pulls: properties, assets, job_assets, defects, inspection_photos,
                     signatures, time_logs, quotes, quote_items, inventory_items,
                     asset_type_definitions, defect_codes
  6. Write LAST_SYNCED timestamp to AsyncStorage
  7. Reset stale permanently-failed items (>24h old → get fresh retry budget)
  8. cleanupLocalPhotos() — delete local photo files >15 days old
  9. Emit syncComplete event → all subscribed stores reload from SQLite
```

### Conflict Resolution

| Scenario | Resolution |
|----------|-----------|
| Local job status is `in_progress`, server has `scheduled` | **Preserve local** (local is ahead; server is stale) |
| Local job status is stale (>6 hours) | **Accept server** value |
| Local `job_asset.result` is set, server has `null` | **Preserve local** (offline inspection not yet pushed) |
| Server `actioned_at` is newer than local | **Accept server** (admin corrected remotely) |
| Deleted photo re-pulled from server | **Skip** (tombstone in `deleted_photo_ids` table) |

---

## Authentication & Security

- **Login:** Supabase email/password → JWT session stored in AsyncStorage
- **Session restore:** AsyncStorage cache first → then Supabase.auth.getSession() (5s timeout)
- **Company lockout:** `subscription_status !== 'active'` → force logout
- **User deactivation:** `is_active === false` → graceful sync + force logout
- **Data loss prevention:** If pending queue items exist at deactivation, abort logout until data is pushed
- **Screenshot protection:** Android `FLAG_SECURE` (native, MainActivity.kt); iOS `AppState` overlay
- **Multi-tenant RLS:** `company_id` injected into every sync push payload to satisfy Supabase Row Level Security

---

## Database Schema (SQLite — v29)

> Versioned migration system in `lib/database.ts`. 29 migrations run sequentially at app launch.

| Table | Purpose |
|-------|---------|
| `meta` | Schema version tracking (`key='schema_version'`) |
| `users` | Technician profile — includes FPAS fields, licence, TOS timestamps |
| `companies` | Tenant record — settings, subscription status, appearance config |
| `properties` | Site/building records — contact, access notes, compliance status |
| `assets` | Fire safety assets — type, variant, location, serial, dates, barcode |
| `jobs` | Job records assigned to this technician |
| `job_assets` | Inspection results per asset per job — result, checklist_data (JSON), is_compliant, technician_notes |
| `defects` | Defects — severity, defect_code, quote_price, status, photos (JSON ID array) |
| `inspection_photos` | Photo rows — `local_uri` (device file, never overwritten) + `photo_url` (CDN URL after upload) |
| `signatures` | Client + tech signatures — `signature_url`, `tech_signature_url`, `device_info` |
| `time_logs` | GPS clock-in/out records (UI not yet built) |
| `quotes` | Quote headers |
| `quote_items` | Quote line items — supports inventory-linked and custom (item_name) lines |
| `inventory_items` | Parts/labour — seeded from DefectCodes on first run |
| `notifications` | In-app notifications (local-only, not synced to Supabase) |
| `sync_queue` | Offline write queue — `synced`: 0=pending, 1=done, -1=permanently failed |
| `deleted_photo_ids` | Tombstone table — prevents re-pulling server-deleted photos |
| `asset_type_definitions` | Asset type catalogue — pulled from Supabase, cached locally |
| `defect_codes` | Uptick defect code library — code, description, price, category |

**Important:** There is **no `photo_upload_queue` table**. Photos use the main `sync_queue` with `operation='photo_upload'`. `processPhotoQueue()` in `lib/photoUpload.ts` handles binary upload to Supabase Storage, then queues a separate `SyncOperation.Insert` to write the metadata row to Supabase DB.

| Store | Purpose |
|-------|---------|
| `authStore` | User, company, session, isAuthenticated |
| `jobsStore` | Job list, status updates |
| `inspectionStore` | Per-job asset list + result state during active inspection |
| `defectsStore` | Defect CRUD for the current job |
| `photosStore` | Photo management |
| `quotesStore` | Quote + line items |
| `catalogueStore` | Asset type definitions + defect codes from DB |
| `dashboardStore` | KPI counts for home screen |
| `notificationsStore` | In-app notification inbox |
| `inventoryStore` | Inventory items for quoting |

---

## PDF Report

The app generates **AS1851-2012 compliant** inspection reports using:
- `lib/reportTemplate.ts` — full HTML template with all sections
- `lib/pdfGenerator.ts` — orchestrates data fetch + HTML render + pdf-lib assembly
- `expo-print` — renders HTML to PDF on-device
- `expo-sharing` — shares the PDF file
- Report sections: Header, property info, technician details, asset inspection table, defect register, compliance summary, signatures

---

## Environment Variables

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> See `.env.example` for the full list. Never commit `.env`.

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-router ~6.0` | File-system routing |
| `expo-sqlite ~16.0` | Local SQLite database |
| `@supabase/supabase-js ^2` | Backend API + Auth |
| `zustand ^5` | Global state management |
| `react-native-paper ^5` | UI component library |
| `expo-print` | HTML → PDF rendering |
| `pdf-lib ^1.17` | PDF manipulation |
| `expo-camera` | On-site photo capture |
| `expo-haptics` | Haptic feedback |
| `react-native-reanimated ~4` | Animations |
| `react-native-signature-canvas` | Signature capture |
| `expo-notifications` | Push notifications |
| `@react-native-community/netinfo` | Network state |
| `@gorhom/bottom-sheet ^5` | Bottom sheet modals |
