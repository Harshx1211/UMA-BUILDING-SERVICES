# SiteTrack — Engineering Rules & Conventions

> These rules are **non-negotiable**. Every PR/commit must comply with all rules in this document.
> When in doubt, ask — don't guess and diverge.

---

## 1. Design System Rules

### 1.1 Colors — Single Source of Truth
- **ALWAYS** use `T.*` tokens from `constants/Colors.ts` in new screens
- **NEVER** hardcode hex values in component files (e.g., `'#FF0000'`, `'#0A1525'`)
- Exception: the palette definition itself inside `Colors.ts`
- `Colors.dark.*` alias is the legacy form — older screens still use `C.* = useColors()`; both are correct
- The app is **dark-only**. No light mode. `useColors()` always returns `Colors.dark`

```typescript
// ✅ CORRECT
import { T } from '@/constants/Colors';
backgroundColor: T.background

// ✅ CORRECT (legacy screens using useColors())
const C = useColors();
backgroundColor: C.background

// ❌ WRONG
backgroundColor: '#0F1E3C'
```

### 1.2 Color Semantics
| Token | Allowed Usage |
|-------|--------------|
| `T.primary` / `C.accent` | CTA buttons, active tab indicator, focused input ring ONLY |
| `T.success` | Completed/passed states ONLY |
| `T.warning` | Pending/attention states ONLY |
| `T.danger` | Failed inspections, hazards, destructive actions ONLY |
| `T.info` | Navigation links, info banners ONLY |
| `T.textPrimary` | Headings, KPI numbers — NOT semantic colors |
| `T.textSecondary` | Body copy |
| `T.textMuted` | Labels, timestamps, placeholders |

### 1.3 Typography
- Use `Typography.*` presets from `constants/Typography.ts` for text styles
- Font sizes: 10/11/12/13/14/16/18/20/22/24/26 — no arbitrary values
- Labels are uppercase with letterSpacing (use `Typography.eyebrow`)

### 1.4 Spacing
- Use `T.space4`, `T.space8`, `T.space12`, `T.space16`, `T.space24`, `T.space32`
- No magic numbers for spacing (e.g., `marginTop: 7`)

### 1.5 Border Radius
- Cards: `T.radiusCard` (16px)
- Buttons/inputs: `T.radiusButton` (10px)
- Pills/chips: `T.radiusPill` (999px)

---

## 2. UI Copy Rules

- **No emoji in UI strings** — ever. Use `MaterialCommunityIcons` instead
  - Exception: existing strings with emoji in Toast messages may be cleaned up opportunistically
- **Sentence case** for all UI labels, section headers, button text
  - Correct: `"Start job"`, `"Open inspection form"`
  - Wrong: `"Start Job"`, `"Open Inspection Form"` (unless it's a proper noun)
- **Eyebrow labels** are ALL CAPS (handled by `Typography.eyebrow` + `textTransform: 'uppercase'`)
- No raw "UMA BUILDING SERVICES" user-visible strings — use `APP_NAME` from `constants/Config.ts`

---

## 3. Navigation Rules

- **Always** use `expo-router` for navigation: `router.push()`, `router.replace()`, `router.back()`
- **Never** use React Navigation directly (it's a transitive dep, not the primary navigator)
- Route paths are file-system derived. Reference as string literals with `as never` for type safety:
  ```typescript
  router.push(`/jobs/${id}/inspect` as never)
  ```
- Tab bar is auto-hidden on all non-main-tab routes (handled in `(app)/_layout.tsx` via `hideTabBar`)
- **Never** put navigation logic in `_layout.tsx` files — only in screen components

---

## 4. Data Access Rules

### 4.1 All reads from SQLite, not Supabase
- **Never** query Supabase directly from a screen component
- All screen data comes from SQLite via `lib/database.ts` helpers
- Supabase is only queried in `lib/sync.ts` (pull) and `lib/sync.ts` / direct API calls in stores (push)

### 4.2 All writes go to SQLite first, then sync queue
```typescript
// ✅ CORRECT pattern for any write operation
upsertRecord('table_name', payload);          // 1. Write to local SQLite
addToSyncQueue('table_name', id,              // 2. Queue for Supabase push
  SyncOperation.Insert, payload);
```

### 4.3 Company ID in sync payloads
- Every INSERT payload pushed to Supabase must include `company_id`
- The sync engine auto-injects it for INSERT and UPDATE ops, but explicitly set it when creating records on-device:
  ```typescript
  const companyId = useAuthStore.getState().user?.company_id ?? null;
  ```

### 4.4 Deleted records
- Assets are **soft-deleted** (status → `decommissioned`), never hard-deleted
- Photos have a tombstone mechanism: `recordDeletedPhoto(id)` prevents re-pulls from overwriting the deletion

---

## 5. Store Rules

- **Zustand only** — no React Context for global state
- Each store has a `subscribeToSync` / `unsubscribeFromSync` pattern to auto-reload after each sync cycle
- Stores read from SQLite in their load actions — never from Supabase directly
- `inspectionStore` is ephemeral — scoped to one active job, reset on navigate away
- Always call `store.reset()` in the screen's `useEffect` cleanup for inspection state

---

## 6. Sync Engine Rules

- The sync engine (`lib/sync.ts`) is the **only** place allowed to call `supabase.from(...)` for data fetching
- `runSync()` is idempotent — safe to call multiple times (mutex prevents overlap)
- `processPhotoQueue()` has its own mutex (`_isProcessingPhotos`) — do not call it from screens
- Access revocation (user deactivated / company suspended) is checked at the top of every `runSync()` call
- Conflict resolution priority: **local > server** when local is ahead and not stale (>6h)
- Max sync retries: **5** (`MAX_SYNC_RETRIES`). After that, item is marked `synced = -1` (permanently failed)
- Permanently failed items are reset for retry after **24 hours** (`resetStaleFailedSyncItems`)

---

## 7. TypeScript Rules

- **No `any` types** — use proper interfaces from `types/index.ts`
  - Allowed exception: `C: any` in prop types for the legacy `useColors()` return (fix incrementally)
  - `@ts-ignore` is banned except in known Supabase response shape issues (document the reason)
- All domain model interfaces live in `types/index.ts` — never define types inline in screens
- Enums live in `constants/Enums.ts` — never use raw string literals for status values

```typescript
// ✅ CORRECT
status: JobStatus.InProgress

// ❌ WRONG
status: 'in_progress'
```

---

## 8. Component Rules

- **`React.memo`** on list item components (e.g., `AssetCard`, `JobCard`) — they render in FlatList
- **`useCallback`** on functions passed to memoized child components
- **`useMemo`** on derived/computed values that depend on large arrays
- **`FlatList`** for any list with >10 potential items — never `ScrollView` + `map()` for dynamic data
- FlatList performance settings for large lists:
  ```typescript
  initialNumToRender={6}
  maxToRenderPerBatch={6}
  windowSize={8}
  removeClippedSubviews
  ```
- Set `displayName` on `React.memo` components for React DevTools debugging

---

## 9. Error Handling Rules

- **Never** silently swallow errors. Minimum: `console.error('[ComponentName] action:', err)`
- Use `Toast.show({ type: 'error', text1: '...' })` for user-facing errors
- Use `Alert.alert()` for destructive action confirmations
- Async functions in stores always have `try/catch` — never naked `await`
- The root `ErrorBoundary` catches render crashes — don't rely on it for network errors

---

## 10. Security Rules

- **Never** commit `.env` file — use `.env.example` as the template
- **Never** expose the service role key in the app — only the anon key
- Screenshot protection must remain active:
  - Android: `FLAG_SECURE` in `MainActivity.kt` (blocks at OS level)
  - iOS: `AppState` overlay in `_layout.tsx` (hides content in app switcher)
  - The `expo-screen-capture` calls are temporarily disabled for UI review — re-enable before release
- All Supabase writes require `company_id` to satisfy Row Level Security policies

---

## 11. File Organization Rules

- **One screen = one file** in the `app/` directory
- Helper functions used only within a single screen live at the top of that file (not extracted unless reused)
- Shared utilities belong in `utils/` with a clear, single-purpose name
- SQL patch files (`.sql`) belong in the root or `supabase/` — not inside `lib/` or `app/`
- Scratch/test scripts (`scratch_test.js`, `test_promise.js`, `find_stray_text.js`) are dev tools — delete before release

---

## 12. Code Hygiene Rules

- Remove all commented-out code blocks before merging (except documented `// TODO:` markers)
- Remove `console.log` in production paths — use `if (__DEV__) console.log(...)` for debug logs
- `console.error` and `console.warn` are **always** acceptable in error paths
- Remove unused imports — run `expo lint` before committing
- No dead state variables — if a `useState` is never set or never read, delete it

---

## 13. PDF / Report Rules

- Reports are **AS1851-2012 compliant** — do not change section structure without regulatory review
- All asset results, defects, and signatures must come from local SQLite at report generation time
- Never generate a report with 0 inspected assets — the job detail screen guards this
- Photo URLs in reports: prefer `https://` Supabase Storage URLs; fall back to `local_uri` if available; use placeholder only as last resort
- Report filename format: `SiteTrack_Report_{PropertyName}_{Date}.pdf`

---

## 14. Git & Release Rules

- Branch naming: `feat/`, `fix/`, `chore/`, `docs/`
- Commit messages: `[Screen/Area] Action — brief description`
  - Example: `[inspect.tsx] Fix — prevent duplicate tap on result buttons`
- Never commit `node_modules/`, `dist/`, `.expo/`, or `android/` build artifacts
- Before any EAS build: run `expo lint` → zero warnings → then build
