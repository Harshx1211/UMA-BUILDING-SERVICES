# SiteTrack — Database Reference

This folder contains all database-related files for the SiteTrack project.

| File | Purpose |
|------|---------|
| `../supabase/schema.sql` | **Canonical schema** — run once in Supabase SQL Editor to set up all tables, RLS policies, indexes, and triggers |

## How to apply the schema

1. Open your [Supabase project](https://supabase.com/dashboard)
2. Go to **SQL Editor** → **New Query**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run** — it is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)

## Re-running safely

All statements use `IF NOT EXISTS` — it is safe to re-run the script at any time.
Existing data will **not** be affected.

## Local SQLite (on-device)

The `sync_queue` table is **SQLite-only** and is created automatically by `lib/database.ts → initializeSchema()` on first app launch. Do NOT add it to Supabase.
