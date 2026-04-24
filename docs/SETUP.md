# SiteTrack — Setup Guide

> Everything you need to get SiteTrack running from scratch — local dev, Supabase, builds, and deployment.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Expo CLI | latest | `npm install -g expo-cli` |
| EAS CLI | latest | `npm install -g eas-cli` |
| Android Studio | latest | For Android builds & emulator |
| Xcode | 15+ | macOS only — for iOS builds |

---

## 1. Clone & Install

```bash
git clone https://github.com/Harshx1211/sitetrack-app.git
cd sitetrack-app
npm install
```

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

Find these in: **Supabase Dashboard → Project Settings → API**

---

## 3. Supabase Database Setup

> **Full database documentation:** See `docs/DATABASE.md`
>
> ✅ **Live project status (April 2026):** Supabase is fully up to date — all migrations applied.
> Only do this if you're setting up a **brand new** Supabase project.

### Step 1 — Core schema

Open **[Supabase SQL Editor](https://supabase.com/dashboard/project/vnrmgcxmcspdgqcnmmdx/sql)**, paste and run **`supabase/schema.sql`**.

This is the canonical schema derived from the actual live Supabase dump — it creates all 13 tables, RLS policies, indexes, triggers, and already includes every column ever added (`variant`, `asset_ref`, `checklist_data`, `push_token`, etc.). **No separate migration needed for a fresh project.**

### Step 2 — Storage bucket (manual — SQL can't do this)

1. **Dashboard → Storage → New Bucket**
2. Name: `job-photos` | Public: ✅ | Allowed MIME: `image/jpeg, image/png`

### Step 3 — Storage + future migrations

Run **`docs/supabase_migrations.sql`** — all idempotent, safe to re-run.
Contains storage RLS policies (§3) and is where all future migrations get appended.

---

## 4. Google Maps API Key

Required for the "Navigate" feature on Job Detail screens.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Maps SDK for Android**
3. Create an API Key under **APIs & Services → Credentials**
4. Add it to `app.json`:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_API_KEY_HERE"
    }
  }
}
```

> Without this key, navigation links fall back to opening Google Maps in the browser.

---

## 5. Run Locally

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (Android / iOS).

> The local SQLite database is created automatically on first launch via `lib/database.ts → initializeSchema()`. No manual DB setup needed for local dev.

---

## 6. EAS Builds

### Preview build (internal testing APK)

```bash
eas build --platform android --profile preview
```

### Production build (Play Store AAB)

```bash
eas build --platform android --profile production
```

### Submit to Play Store

```bash
eas submit --platform android --latest
```

---

## 7. Push Notifications

Push tokens are stored in `users.push_token`. Expo registers the token automatically on first app launch — no extra setup needed unless switching to a custom push server.

---

## 8. Adding Future DB Migrations

When you add a new column or table:

**SQLite (local device):**
1. Increment `CURRENT_SCHEMA_VERSION` in `lib/database.ts`
2. Add a new `if (currentVersion < N) { ... }` block
3. Update the version history table in `docs/DATABASE.md`

**Supabase (cloud):**
1. Append a new `§ N` section to `docs/supabase_migrations.sql`
2. Run it in the Supabase SQL Editor
3. Update `docs/DATABASE.md` → Supabase Migration History table

---

## Docs Overview

| File | Purpose |
|------|---------|
| `docs/DATABASE.md` | Full database reference — schema, columns, migration history, architecture |
| `docs/SETUP.md` | This file — getting started guide |
| `docs/supabase_migrations.sql` | All Supabase migrations, cumulative and idempotent |
| `docs/dummy-data.sql` | Optional seed data for local dev / testing |
| `docs/PLAY_STORE_LISTING.md` | App store listing copy |
| `docs/PRIVACY_POLICY.md` | Privacy policy for Play Store compliance |
