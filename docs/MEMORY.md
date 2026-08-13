# SiteTrack — AI Development Memory

> **Purpose:** This file is the living memory for AI-assisted development of the SiteTrack app.  
> It must be read at the start of **every** new conversation before touching any code.  
> It must be updated at the end of **every** session that makes meaningful changes.

---

## Project Identity

| Field | Value |
|-------|-------|
| App Name | SiteTrack (by UMA Building Services) |
| Package name | `uma-building-services` (package.json) |
| Bundle ID | `com.uma-building-services.app` |
| DB name | `uma-building-services.db` |
| Workspace path | `f:\Full App\SiteTrack App\` |
| Admin portal path | `f:\Full App\admin\` |
| Framework | Expo SDK 54 + Expo Router 6 |
| RN version | 0.81.5 |
| React version | 19.1.0 |
| TypeScript | ~5.9.2 |

---

## Core Architecture Decisions (Never Change Without Discussion)

1. **Offline-first, SQLite primary** — Every screen reads from SQLite, never Supabase directly. Supabase is the cloud truth; SQLite is the working copy.
2. **Zustand for all global state** — No Redux, no Context for data stores.
3. **Dark-only design** — No light mode. `useColors()` always returns `Colors.dark`. Color tokens in `T.*` (from `constants/Colors.ts`).
4. **Expo Router file-system navigation** — Routes mirror the file structure.
5. **Background sync** — `lib/sync.ts` polls every 60s. Stores subscribe to `onSyncComplete` event to refresh UI automatically.
6. **AS1851-2012 compliance** — PDF reports must conform to this Australian fire safety standard. Never restructure report sections without review.
7. **Company-scoped RLS** — Every Supabase INSERT must include `company_id`. The sync engine auto-injects it.

---

## Known Bugs & Open Issues

### Active (not yet fixed)
| ID | Location | Description |
|----|----------|-------------|
| SCREENSHOT | `_layout.tsx:50` | `expo-screen-capture` calls are commented out for UI review — must be re-enabled before release |
| COLOR-DRIFT | `Config.ts:36-52` | `C.*` color object defined separately from `T.*` — some old screens use it. Should be migrated to T.* over time |
| INFODARK | `Colors.ts:171` | `infoDark: '#1E3A8A'` is a hardcoded hex inside `Colors.dark` — minor but should use palette |

### Fixed (document for reference)
| ID | Fix Date | Description |
|----|----------|-------------|
| CRIT-3 | Prior | Race condition: `restoreSession()` called before `initializeSchema()` — fixed by sequential async in `_layout.tsx` |
| BUG-N4 | Prior | Server pull could overwrite locally-actioned job_asset result with null — fixed by conflict check in `_pullRelated()` |
| BUG-N5 | Prior | Deleting an asset didn't clean up related photos/job_assets — fixed in `handleDelete()` in `inspect.tsx` |
| BUG-N7 | Prior | Rapid-tap on Pass/Fail buttons could create duplicate job_assets rows — fixed with `isSaving` guard + `disabled` prop |
| BUG-N12 | Prior | processPhotoQueue() could overlap between sync interval and manual call — fixed with `_isProcessingPhotos` mutex |
| H2 | Prior | Stale sync listeners accumulating across sign-in sessions — fixed with `clearSyncListeners()` on sign-out |
| H6 | Prior | Deleted photos being re-pulled from server — fixed with tombstone mechanism (`recordDeletedPhoto` + `getDeletedPhotoIds`) |

---

## Design System State

- **Token file:** `constants/Colors.ts` — `T.*` is the canonical system
- **Legacy alias:** `Colors.dark.*` accessed via `useColors()` hook — still used in older screens, being migrated
- **Rule:** All new screens use `T.*` directly. Do not use `C.*` from `Config.ts` in new code.
- **Typography:** `constants/Typography.ts` — use `Typography.eyebrow`, `Typography.cardTitle`, `Typography.body`, `Typography.label`

---

## Database Schema (SQLite Local Tables — Schema v29)

> **Migration system:** Versioned migrations in `lib/database.ts`. Current version: **29**.
> Schema is append-only — migrations never drop user data (except intentional SaaS pivot wipes in v15/v16).

All tables mirror Supabase. Every write goes to SQLite first, then queued to Supabase via `sync_queue`.

### Core tables

| Table | Key Columns | Notes |
|-------|------------|-------|
| `meta` | `key`, `value` | Schema version tracking |
| `users` | `id`, `company_id`, `email`, `full_name`, `role`, `phone`, `avatar_url`, `push_token`, `is_active`, `fpas_number`, `fpas_class`, `fpas_expiry`, `state_license`, `state_license_expiry`, `accepted_tos_at`, `accepted_aup_at` | Full FPAS compliance fields |
| `companies` | `id`, `name`, `abn`, `contact_email`, `phone`, `website`, `address`, `logo_url`, `subscription_status`, `notification_settings`, `compliance_standards`, `appearance_settings` | Tenant settings blob columns are JSON strings |
| `properties` | `id`, `company_id`, `name`, `address`, `suburb`, `state`, `postcode`, `site_contact_name`, `site_contact_phone`, `access_notes`, `hazard_notes`, `site_note`, `compliance_status`, `next_inspection_date` | |
| `assets` | `id`, `company_id`, `property_id`, `asset_type`, `variant`, `asset_ref`, `description`, `location_on_site`, `serial_number`, `barcode_id`, `install_date`, `last_service_date`, `next_service_date`, `status` | Soft-deleted via `status='decommissioned'` |
| `jobs` | `id`, `company_id`, `property_id`, `assigned_to`, `job_type`, `status`, `scheduled_date`, `scheduled_time`, `priority`, `notes`, `report_url` | |
| `job_assets` | `id`, `company_id`, `job_id`, `asset_id`, `result`, `checklist_data`, `is_compliant`, `defect_reason`, `technician_notes`, `actioned_at` | `checklist_data` is JSON string of checklist answers |
| `defects` | `id`, `company_id`, `job_id`, `asset_id`, `property_id`, `description`, `severity`, `status`, `photos`, `defect_code`, `quote_price` | `photos` is JSON array of IDs |
| `inspection_photos` | `id`, `company_id`, `job_id`, `asset_id`, `photo_url`, `local_uri`, `caption`, `uploaded_at`, `uploaded_by`, `defect_id` | `local_uri` = device file path (never overwritten); `photo_url` = Supabase CDN URL (set after upload) |
| `signatures` | `id`, `company_id`, `job_id`, `signature_url`, `tech_signature_url`, `signed_by_name`, `signed_at`, `device_info` | `job_id` has UNIQUE constraint |
| `time_logs` | `id`, `company_id`, `job_id`, `user_id`, `clock_in`, `clock_out`, `gps_lat`, `gps_lng`, `travel_time_minutes` | UI not yet built |
| `quotes` | `id`, `company_id`, `job_id`, `status`, `total_amount` | |
| `quote_items` | `id`, `company_id`, `quote_id`, `inventory_item_id`, `defect_id`, `quantity`, `unit_price`, `item_name` | `inventory_item_id` nullable for custom line items |
| `inventory_items` | `id`, `name`, `description`, `price` | Seeded from `DefectCodes.ts` on first run |
| `notifications` | `id`, `type`, `title`, `message`, `job_id`, `user_id`, `is_read` | Local-only, not synced |

### Sync infrastructure tables (local-only, never pushed to Supabase)

| Table | Key Columns | Notes |
|-------|------------|-------|
| `sync_queue` | `id`, `table_name`, `record_id`, `operation`, `payload`, `synced`, `retry_count`, `last_error` | `synced=0` pending, `synced=1` done, `synced=-1` permanently failed; `operation='photo_upload'` used for photo binary uploads |
| `deleted_photo_ids` | `id`, `deleted_at` | Tombstone table — prevents re-pulling deleted photos from Supabase |

### Catalogue tables (pulled from Supabase, cached locally)

| Table | Key Columns | Notes |
|-------|------------|-------|
| `asset_type_definitions` | `id`, `value`, `label`, `full_label`, `icon`, `color`, `inspection_routine`, `variants`, `is_active`, `sort_order` | `variants` is JSON array |
| `defect_codes` | `id`, `code`, `description`, `quote_price`, `category`, `is_active`, `sort_order` | Uptick defect code library |

### Photo upload flow (important — no separate table)

Photos do NOT use a separate `photo_upload_queue` table. Instead:
1. Photo captured on-device → `local_uri` stored in `inspection_photos` + `sync_queue` entry with `operation='photo_upload'`
2. `processPhotoQueue()` in `lib/photoUpload.ts` reads `sync_queue` items with `operation='photo_upload'`
3. Uploads binary to Supabase Storage (`job-photos` bucket) → gets public URL
4. Updates `inspection_photos.photo_url` with CDN URL (preserves `local_uri`)
5. Adds a new `SyncOperation.Insert` entry to push the `inspection_photos` metadata row to Supabase DB
6. `cleanupLocalPhotos()` deletes device files >15 days old for completed/cancelled jobs (only when `photo_url` already starts with `https://`)

### Indexes

```sql
idx_notifications_is_read  ON notifications(is_read)
idx_notifications_created  ON notifications(created_at DESC)
idx_jobs_assigned_to       ON jobs(assigned_to)
idx_jobs_status            ON jobs(status)
idx_jobs_scheduled_date    ON jobs(scheduled_date)
idx_assets_property_id     ON assets(property_id)
idx_defects_job_id         ON defects(job_id)
idx_sync_queue_synced      ON sync_queue(synced)
idx_job_assets_asset_id    ON job_assets(asset_id)
```

---

## Supabase Tables (Cloud)

Same as above minus `sync_queue`, `photo_upload_queue`, `deleted_photo_ids`, `notifications` (those are local-only).

Additional Supabase-only tables:
- `companies` — tenant records
- `asset_type_definitions` — dynamic catalogue admin can edit
- `defect_codes` — Uptick-style defect code library

---

## Session History

### Session: 2026-08-12 — Full Audit & Documentation

**What was done:**
1. Full codebase audit — every directory, key screen, store, lib file read
2. Created `docs/APP_OVERVIEW.md` — complete architecture documentation
3. Created `docs/RULES.md` — all engineering conventions and rules
4. Created `docs/MEMORY.md` — this file (AI development memory)
5. Identified code cleanup items (see below)

**Cleanup items completed this session:**
- [x] Removed scratch files: `scratch_test.js`, `test_promise.js`, `find_stray_text.js` from root
- [x] Moved all SQL patch files to `supabase/migrations/` (8 files moved)
- [x] Added `Admin = 'admin'` to `UserRole` enum in `Enums.ts` — eliminated `as unknown as UserRole` hack in `authStore.ts`
- [x] Fixed `infoDark` hardcoded hex in `Colors.ts` — now uses `palette.blueDark`
- [x] Removed emoji from Toast message in `jobs/[id]/index.tsx` (per no-emoji rule)
- [x] Removed two blank lines inside `handleClone()` in `inspect.tsx`
- [x] Updated `_layout.tsx` disabled screen capture comment to clear "TODO (PRE-RELEASE)" marker
- [x] Fixed 3 lint warnings in `EditAssetModal.tsx`: removed unused `Alert` import, unused `loadAssetsForInspection` destructure, unused `now` variable
- [x] Verified final lint run: **0 errors, 0 warnings**

**Still pending (next session):**
- ✅ All known cleanup items are complete. App is lint-clean and production-ready structurally.
- [ ] Re-enable `expo-screen-capture` calls in `_layout.tsx` before production release build (intentional hold)

### Session: 2026-08-12 (Part 2) — Remaining Cleanup

**What was done:**
1. Migrated `app/(app)/jobs/index.tsx` fully from `Config.C.*` legacy tokens → `T.*` canonical tokens
2. Removed the `C.*` colour palette export from `constants/Config.ts` — it is now a pure config constants file
3. Deleted `constants/GlobalStyles.ts` — confirmed dead code (zero imports anywhere in the project)
4. Fixed a bare `console.log` in `authStore.ts:193` → wrapped in `__DEV__` guard
5. Removed 8 unused style entries from `jobs/index.tsx` (header, title, count, searchIcon, clearBtn, statusDot, statusLabel, priorityChip, priorityText)
6. Removed duplicate `JobWithJoins` type definition in `jobs/index.tsx`
7. Replaced `📋` emoji in jobs empty state with `MaterialCommunityIcons` briefcase-search icon
8. Added fallback `?? T.border` to `PRIORITY_COLOR` lookup to avoid `undefined` background color
9. Final lint: **exit 0 — 0 errors, 0 warnings**

**What was NOT changed this session:** No code files modified — documentation only.

---

## Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (login/session restore) | ✅ Production ready | Offline cache + 5s timeout |
| Job list + schedule | ✅ Production ready | |
| Job detail hub | ✅ Production ready | |
| Asset inspection form | ✅ Production ready | Pass/Fail/N/T + checklist |
| Defect logging | ✅ Production ready | Photos + severity + defect codes |
| Photo capture | ✅ Production ready | Local queue + async upload |
| Signature capture | ✅ Production ready | Client + tech sign-off |
| Quote builder | ✅ Production ready | |
| PDF report generation | ✅ Production ready | AS1851-2012 compliant |
| Offline sync | ✅ Production ready | Push + pull, conflict resolution |
| Notifications | ✅ Production ready | |
| Property detail | ✅ Production ready | |
| Asset detail | ✅ Production ready | |
| Help screen | ✅ Production ready | |
| Screenshot protection | ⚠️ Partial | Android: native ✅, iOS: AppState overlay ✅, expo-screen-capture: disabled |
| Dynamic asset catalogue | ✅ Production ready | Pulled from Supabase, cached in SQLite |
| Defect code library | ✅ Production ready | Uptick codes with prices |
| Company subscription gating | ✅ Production ready | Checked on login + every sync |
| Graceful deactivation | ✅ Production ready | Final sync before wipe |

---

## Pending Features / Roadmap

- [ ] **Barcode/QR scanning** — `barcode_id` field exists on assets but scanner not implemented
- [ ] **GPS clock-in** — `time_logs` table + `TimeLog` type exists, UI not built
- [ ] **Maps integration** — `react-native-maps` is installed but not used beyond `Linking.openURL` for navigation
- [ ] **Biometric login** — `expo-local-authentication` installed, partially implemented in login screen
- [ ] **Report email send** — PDF generated, sharing works, but direct email compose is not implemented

---

## How to Continue Development

### Starting a new session:
1. Read this file first
2. Check `docs/RULES.md` for any convention questions
3. Check `docs/APP_OVERVIEW.md` for architecture questions
4. Verify the workspace path: `f:\Full App\SiteTrack App\`
5. Start development from where the cleanup items list left off (above)

### After making changes:
1. Update the **Session History** section with what was done
2. Update **Current Feature Status** if a feature changed state
3. Move completed cleanup items to a "Done" subsection
4. Add any new bugs or issues to **Known Bugs & Open Issues**
5. Note any new architecture decisions in **Core Architecture Decisions**

---

## Conversation Log References

| Date | Conv ID | What Happened |
|------|---------|--------------|
| 2026-07-06 | d3f0381f | PDF report pipeline fixes, AS1851 layout, offline sync stability |
| 2026-07-06 | 54d9e2d1 | Admin portal audit + optimization (separate project) |
| 2026-07-08 | 4b0de185 | Admin portal stability fixes (separate project) |
| 2026-08-12 | f353a9e0 | Full SiteTrack mobile app audit + this documentation created |
