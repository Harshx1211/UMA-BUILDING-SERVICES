# SiteTrack — Field Service Mobile App

A professional-grade React Native / Expo mobile application for fire protection service technicians. Built for offline-first field operations, AS 1851-2012 compliance, and seamless cloud synchronisation via Supabase.

---

## Overview

SiteTrack is the technician-facing mobile companion to the SiteTrack platform. Technicians use it to:

- View and manage assigned jobs (scheduled, in-progress, completed)
- Conduct AS 1851-compliant fire asset inspections with checklist workflows
- Log defects with severity ratings, defect codes, photo evidence, and quote pricing
- Capture client and technician signatures for job completion
- Generate and share PDF compliance reports directly from the device
- Operate fully offline — all data syncs automatically when connectivity is restored

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 52 (file-based routing via Expo Router) |
| Language | TypeScript (strict mode) |
| State Management | Zustand |
| Local Database | SQLite (via `expo-sqlite`) |
| Cloud Backend | Supabase (PostgreSQL + Row-Level Security + Storage) |
| Styling | Custom design system — `constants/Colors.ts` (T tokens) + `constants/Typography.ts` |
| UI Icons | `@expo/vector-icons` — MaterialCommunityIcons exclusively |
| Maps | Expo MapView (Google Maps) |
| PDF Generation | `react-native-html-to-pdf` |
| Offline Detection | NetInfo + custom `OfflineBanner` + `SyncStatusBar` |

---

## Project Structure

```
app/
  (auth)/          Login, forgot password, splash screen
  (app)/           Authenticated screens (tab-based)
    index.tsx      Dashboard — KPI tiles, today's jobs, upcoming
    jobs/          Job list, job detail, inspection, signature, report, quote
    defects/       Defect log and detail
    assets/        Asset detail view
    profile.tsx    Technician profile and sync controls
    help.tsx       In-app help and FAQ
    notifications/ Push notification centre

components/
  ui/              Shared design system primitives (Button, Card, Badge, Input, etc.)
  jobs/            Job-specific components (JobCard, StatusBadge, RouteMapView)
  defects/         DefectCard, AddDefectSheet, DefectCodePicker
  inspections/     AssetInspectModal, AddAssetModal, ChecklistModal, EditAssetModal
  camera/          PhotoCaptureSheet, PhotoGrid

constants/
  Colors.ts        Single source of truth — T (static tokens) + dynamic useColors() hook
  Typography.ts    Type scale and font weight tokens
  Config.ts        App-wide config (APP_NAME, BUNDLE_ID, DB_NAME, API keys)
  Enums.ts         JobStatus, DefectSeverity, Priority, AssetStatus, etc.

store/             Zustand stores (authStore, jobsStore, defectsStore, photosStore, etc.)
lib/               Database (SQLite), Supabase client, sync engine, PDF generator
hooks/             useAuth, useColors, useOffline, useUnsavedChanges
utils/             dateHelpers, sanitize, uuid, assetHelpers, fileHelpers
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator, or a physical device with Expo Go

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root (never commit this file):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-key
```

> **Note:** `googleMaps.apiKey` in `app.json` is intentionally left empty. It is injected at build time via EAS Secrets for production builds.

### Running Locally

```bash
npx expo start
```

Then open in:
- iOS Simulator: press `i`
- Android Emulator: press `a`
- Physical device: scan the QR code with the Expo Go app

---

## Design System

All colours must come from the token system — **no hardcoded hex values are permitted** anywhere in the UI layer.

- **Static tokens:** `import { T } from '@/constants/Colors'` — use for `StyleSheet.create()` blocks
- **Dynamic tokens:** `const C = useColors()` — use for inline styles and computed values

```tsx
// Correct
const styles = StyleSheet.create({ text: { color: T.textPrimary } });
<Text style={{ color: C.error }}>Error</Text>

// Forbidden
<Text style={{ color: '#FF0000' }}>Error</Text>
```

### Emoji Policy

**Zero emoji in any UI string.** All status indicators, icons, and visual cues use `MaterialCommunityIcons`.

---

## Sync Architecture

SiteTrack uses a **write-ahead local queue** pattern:

1. All mutations (insert / update) write to SQLite immediately (offline-first)
2. The mutation is enqueued in the `sync_queue` table
3. A background sync engine (`lib/sync.ts`) processes the queue when online
4. Failed items are retried with exponential back-off; permanently failed items are reset on app restart

The `SyncStatusBar` component at the bottom of most screens shows real-time sync health.

---

## PDF Reports

Reports are generated entirely on-device using `lib/pdfGenerator.ts`:

- Pulls all relevant data from local SQLite (assets, defects, photos, signatures)
- Renders a styled HTML template
- Converts to PDF via `react-native-html-to-pdf`
- Shared via the native share sheet

Reports are AS 1851-2012 compliant and include tenant branding (company name, logo) injected at the job level.

---

## Building for Production

```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

EAS build profiles are defined in `eas.json`. Google Maps API key and other secrets are injected via EAS Secrets — do not add them to source code or `.env` files tracked by git.

---

## Key Notes for Beta Testers

- **First launch after a DB_NAME change** (`sitetrack.db`) will clear the local SQLite cache — all unsynced data will be lost. Ensure a full sync before updating.
- **Session key changes** will log out all existing sessions on device.
- The app targets **Australian timezones** (AEST/AEDT). Date calculations use `localDateString()` from `utils/dateHelpers.ts` — never `toISOString().slice(0,10)`.
