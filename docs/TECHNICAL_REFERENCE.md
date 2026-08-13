# SiteTrack App — Comprehensive Technical Reference

This document serves as the exhaustive technical manual for the SiteTrack application. It details the architecture, directory structure, module purposes, technical logic, and core systems (Offline Sync, PDF Generation, State Management, and Local Database) so that any developer can understand the codebase without needing to read every file individually.

---

## 1. Executive Summary & Tech Stack

**SiteTrack** is an offline-first field service application built for technicians. It allows them to view assigned jobs, inspect assets, log defects, capture signatures, and generate professional AS1851-compliant PDF reports entirely offline, syncing with the cloud when a connection is restored.

**Core Technologies:**
- **Framework:** Expo / React Native
- **Language:** TypeScript
- **Local Database:** `expo-sqlite/legacy` (Offline-first approach)
- **Backend / Cloud:** Supabase (PostgreSQL, Auth, Storage)
- **State Management:** Zustand
- **PDF Generation:** `expo-print` (HTML to PDF via WKWebView), `pdf-lib` (Document stamping/merging)
- **Navigation:** Expo Router (File-based routing)
- **UI & Animations:** React Native Paper, React Native Reanimated

---

## 2. Global Folder Structure

The project root is organized by feature and technical concern:

```text
+-- app/            # Expo Router file-based navigation (Screens)
+-- components/     # Reusable React UI components
+-- constants/      # App-wide configuration, enums, colors, and static data
+-- docs/           # Project documentation and audit logs
+-- hooks/          # Custom React hooks (Theming, Auth, Network)
+-- lib/            # Core business logic (DB, Sync, PDF, Supabase)
+-- store/          # Zustand global state managers
+-- supabase/       # SQL migrations and backend schema definitions
+-- types/          # Global TypeScript interfaces
+-- utils/          # Pure helper functions (formatting, sanitization)
```

---

## 3. Core Systems Deep Dive

### 3.1. Offline-First Sync Engine (`lib/sync.ts` & `lib/database.ts`)
SiteTrack is built around an "Offline-First" paradigm. The app reads and writes exclusively to the local SQLite database to ensure zero-latency UI and 100% offline capability.

**How it works:**
1. **Local Writes:** When a user modifies data (e.g., marks an asset as "pass", logs a defect), `database.ts` writes the change to the local SQLite tables (`job_assets`, `defects`) and instantly queues a synchronization task in the `sync_queue` table.
2. **Background Loop:** `sync.ts` runs a `setInterval` loop every 60 seconds (or immediately on network restore via `NetInfo`). 
3. **Queue Processing:** It fetches all pending tasks from `sync_queue`, processes them in order, and pushes the payload via Supabase RPC or REST calls.
4. **Photo Uploads:** Photos are managed specially by `lib/photoUpload.ts`. They are saved locally (`file://`), compressed, and pushed to Supabase Storage via a PUT request. If successful, the local DB row is updated with the public URL, and the photo row is synced to the backend. Local files are aggressively cached and cleaned up after 15 days for completed jobs.
5. **Conflict Resolution:** For job statuses, `STATUS_PRIORITY` ensures a local "completed" state cannot be overwritten by a stale cloud "scheduled" state.

### 3.2. PDF Generation Pipeline (`lib/pdfGenerator.ts`, `lib/reportTemplate.ts`, `preview.tsx`)
The PDF generation engine produces industry-compliant (AS1851) inspection reports on-device.

**Flow (`app/(app)/jobs/[id]/preview.tsx`):**
1. **Data Fetching:** Gathers all job details, assets, defects, time logs, and signatures (`fetchReportData`).
2. **Photo Encoding (`processPhotos`):** Because `expo-print` uses an isolated WKWebView that cannot access local device paths (`file://`), all referenced photos (thumbnails, defect proof, signatures) are compressed and converted into Base64 `data:` URIs using `expo-image-manipulator`.
3. **HTML Construction (`reportTemplate.ts`):** 
   - A massive HTML string is constructed injecting the data.
   - User inputs (site notes, addresses, asset locations) are vigorously sanitized against XSS using `utils/sanitize.ts` (`sanitizeForHtml`).
   - Generates the styling (left-accented defect boxes, pill badges).
4. **Rendering & Caching:** `expo-print` renders the HTML to a PDF. The HTML string is hashed; if the hash hasn't changed since the last generation and there are no pending sync items, the generation is skipped (Cache Hit) for speed.
5. **Stamping:** `pdf-lib` is used to stamp footers (Page X of Y) onto the generated PDF.
6. **Upload:** The finalized PDF is uploaded to Supabase Storage, and the job's `report_url` is updated.

### 3.3. State Management (`store/`)
Zustand is used for reactive global state that binds the UI to the SQLite database.
- `authStore.ts`: Manages session tokens, current user details, and active company context.
- `jobsStore.ts`: Caches the list of jobs for the dashboard and handles job status transitions.
- `inspectionStore.ts`: Specifically tracks the active job being inspected, ensuring fast updates to asset pills (Pass/Fail) without re-rendering the whole app.
- `photosStore.ts`: Manages the ephemeral state of the camera and photo selection before they are committed to SQLite.

---

## 4. File-by-File Breakdown

### `app/` (Routing & Screens)
Expo router handles deep linking and navigation.
- **`(auth)/`**: Handles unauthenticated states.
  - `login.tsx`: Supabase email/password auth.
- **`(app)/`**: Main authenticated application shell.
  - `_layout.tsx`: Initializes the `startSync()` engine and network listeners. Checks auth.
  - `index.tsx`: The main Dashboard. Shows assigned jobs mapped via `jobsStore`.
  - **`jobs/[id]/`**: The core job workspace.
    - `index.tsx`: Job overview, client details, address.
    - `inspect.tsx`: The primary working screen. Lists all assets. Tapping an asset opens the inspection modal (Pass/Fail/NT).
    - `defects.tsx`: List of logged defects for the job.
    - `photos.tsx`: Gallery view of all photos taken for the job.
    - `report.tsx`: The "Report Summary". Shows compliance breakdown, completion gates (is everything inspected? is there a signature?), and the "Open PDF" / "Refresh" buttons.
    - `signature.tsx`: Canvas screen for capturing client and technician signatures.
    - `preview.tsx`: The PDF loading screen. Orchestrates the generation progress stages and displays the HTML preview inside a `<WebView>`.
  - **`properties/`**: Screens for viewing historical data for a property across multiple past jobs.

### `components/` (UI & Layout)
- **`ui/`**: Pure, stateless visual components (`Button.tsx`, `Card.tsx`, `ScreenHeader.tsx`, `Badge.tsx`).
- **`jobs/`**:
  - `JobCard.tsx`: Display card for jobs on the dashboard.
  - `StatusBadge.tsx`: Color-coded pill for job statuses.
  - `CompletionBottomSheet.tsx`: The swipe-up menu to mark a job complete, validating that all assets are inspected and signed.
- **`inspections/`**:
  - `AssetInspectModal.tsx`: The pop-up where technicians mark Pass/Fail, add notes, or link a defect.
- **`defects/`**:
  - `AddDefectSheet.tsx`: Form to log a new defect, pick a severity (Minor, Major, Critical), and attach photos.
  - `DefectCard.tsx`: Visual display of a defect in the list.

### `lib/` (Core Logic)
- **`database.ts`**: The largest file in the app. Handles SQLite initialization, schema creation, raw SQL queries (`getAssetsWithJobResults`), and CRUD operations.
- **`sync.ts`**: The background queue processor. Pulls `sync_queue` rows, pushes to Supabase, handles retries, and broadcasts events.
- **`supabase.ts`**: Initializes the Supabase JS client and handles auth session persistence.
- **`pdfGenerator.ts`**: Orchestrates the multi-step PDF creation (fetch data → encode photos → build HTML → render PDF → upload).
- **`reportTemplate.ts`**: Contains the raw HTML/CSS strings and logic (`buildAssetRow`, `buildDefectBox`, `buildSig`) to layout the inspection data beautifully.
- **`quoteTemplate.ts`**: Similar to the report template, but generates PDF quotes based on defects.
- **`photoUpload.ts`**: Handles Expo FileSystem PUT requests to Supabase Storage, local file cleanup, and queueing photo metadata inserts.
- **`pdfConstants.ts`**: Holds shared constants like `FALLBACK_IMG` (the placeholder for broken/missing photos).

### `utils/` (Helpers)
- **`sanitize.ts`**: Critical security file. Contains `sanitizeForHtml()` which strips `<script>` tags, event handlers, and truncates strings to `MAX_LENGTHS` to prevent XSS and layout breaking in the PDF WebView.
- **`assetHelpers.ts`**: Formats asset type strings (e.g., `fire_extinguisher` → "Fire Extinguisher") and maps them to Material icons.
- **`fileHelpers.ts`**: Normalizes local URI paths, ensuring `file://` prefixes are correct across iOS and Android.
- **`uuid.ts`**: Generates robust V4 UUIDs for offline ID creation before syncing to the cloud.

### `constants/` (Config)
- **`Colors.ts`**: Defines the light and dark mode color palettes (Primary, Surface, Background, Semantic Error/Success).
- **`Enums.ts`**: Typescript Enums for `JobStatus`, `DefectSeverity`, `SyncOperation`.
- **`Typography.ts`**: Font families and sizing scales.

---

## 5. Typical Data Flow (Example: Inspecting an Asset)
To understand the architecture in motion, here is exactly what happens when a technician marks an asset as "FAIL":

1. User taps "FAIL" on `AssetInspectModal.tsx`.
2. UI calls the SQLite helper: `updateRecord('job_assets', assetId, { result: 'fail' })`.
3. `database.ts` executes the `UPDATE` SQL statement immediately.
4. `database.ts` automatically calls `addToSyncQueue('job_assets', assetId, 'update', payload)`.
5. The local SQLite data updates. `inspectionStore.ts` or `report.tsx` re-queries the DB and updates the UI instantly. (Latency: ~5ms, Network required: None).
6. In the background, `sync.ts` interval fires. It reads the `sync_queue` table.
7. `sync.ts` sees the `update` operation for `job_assets`. It sends an RPC or REST call to Supabase.
8. If the network drops, Supabase throws an error. `sync.ts` increments the `retry_count` in SQLite and goes to sleep.
9. When the network restores, `sync.ts` tries again. It succeeds, deletes the row from `sync_queue`, and calls `_emitSyncComplete()`.

This architecture ensures the technician is never blocked by "Loading..." spinners during field execution.
