# report-generator

Standalone service that replaces the old `supabase/functions/generate-report`
Edge Function. Renders SiteTrack's AS1851 inspection PDF as real HTML/CSS and
converts it via a self-hosted [Gotenberg](https://gotenberg.dev) instance
(Chromium under the hood), instead of hand-building a PDF document tree with
pdfmake inside a memory-constrained Edge Function. See the project plan doc
for the full rationale.

## Why this exists

Supabase Edge Functions can't run a headless browser, which is why the old
implementation used pdfmake — and why it kept breaking at scale (base64
photo embedding blowing a ~150MB memory ceiling, forcing a 600KB per-photo
cap with photos silently dropped and no placeholder shown). This service:

- Renders real HTML/CSS (matches the reference report far more precisely).
- Photos are resized server-side (`sharp`, bounded concurrency — see
  `src/photos/prepareInlinePhotos.ts`) and embedded as small inline JPEG data
  URIs, rather than signing the original's Storage URL and letting Chromium
  fetch it directly. That was the first design here, and real end-to-end
  testing showed it was the actual bottleneck: Chromium was downloading a
  full multi-MB phone-camera original for every photo, over a heavily
  CPU/bandwidth-throttled free-tier container, on every single generation.
  Resizing down first (a few tens of KB instead of several MB, one photo at a
  time, discarded immediately after) turned out both faster and no less safe
  memory-wise than the old approach.
- Splits large asset logs into bounded chunks (`MAX_ASSETS_PER_CHUNK`),
  renders each independently, and merges them — so a 1000-asset site doesn't
  become one giant, fragile render.
- Verifies the caller's token and job ownership itself (a real gap in the old
  function — it only checked "is this a valid JWT", not "does this user's
  company own this job"). Verification goes through Supabase's own
  `auth.getUser(token)` rather than a hand-rolled signature check against a
  fixed secret, so it keeps working across a JWT signing key rotation like
  this project already went through once (legacy shared secret -> asymmetric
  signing keys).
- Never publishes a partial report — a chunk that fails all its retries
  aborts the whole generation with a clear error, rather than silently
  shipping a PDF with missing sections.

## Local development

Requires Docker Desktop.

```bash
cp .env.example .env   # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
docker compose up --build
```

This starts both containers — `report-generator` on `localhost:8080` and a
`gotenberg` sibling only reachable from inside the compose network (matching
the production topology, where Gotenberg is never exposed publicly).

Test it against a real job in your dev database:

```bash
curl -X POST http://localhost:8080/generate-report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <a real user access_token>" \
  -d '{"jobId":"<a real job id>"}'
```

## Deploying

**Render** (what's actually deployed — see `render.yaml` at the repo root):
one Blueprint creates `sitetrack-gotenberg` (the public `gotenberg/gotenberg:8`
image, free web service) and `sitetrack-report-generator` (built from this
directory's `Dockerfile`). Free-tier web services can make outbound private-
network calls but can't receive them, so `sitetrack-gotenberg` ends up with an
unlisted public URL rather than a truly private one — acceptable to start
with since Gotenberg holds no secrets or customer data. Set
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` and, once `sitetrack-gotenberg` has
deployed and been assigned its URL, `GOTENBERG_URL` on
`sitetrack-report-generator`'s Environment tab.

**Fly.io** (alternative — `fly.toml` here is set up for this too, if you'd
rather have proper private networking from day one): deploy Gotenberg as its
own tiny Fly app using the public image directly — no Dockerfile needed:
`fly launch --image gotenberg/gotenberg:8 --name sitetrack-gotenberg --no-deploy`,
then `fly deploy` (with `internal_port = 3000` in its own `fly.toml`, and no
`[http_service]` public route since it should never be exposed). Then deploy
this service: `fly launch --no-deploy` (uses this directory's
`fly.toml`/`Dockerfile`), `fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`,
then `fly deploy`. Fly apps in the same org can reach each other over Fly's
private 6PN network at `<app-name>.internal:<port>` — that's what
`GOTENBERG_URL` in `fly.toml` already points at.

Either way: **before committing to a free tier long-term**, run the
1000-asset scale test (see the plan doc's Verification plan) against the
actual deployment and confirm it has enough CPU/RAM headroom for concurrent
Chromium renders — the architecture is host-agnostic, so upgrading later is a
config change, not a rewrite.

## Configuration

See `.env.example` for every tunable (chunk size, Gotenberg concurrency,
timeouts, retry attempts) with inline explanations.

## After deploying — wiring it up

1. Set the deployed URL as `EXPO_PUBLIC_REPORT_SERVICE_URL` in the mobile
   app's `.env` (see repo root `.env.example`).
2. Apply the two new migrations in `supabase/migrations/` (report-generation
   idempotency lock table, and the `job-reports` bucket/policy — the bucket
   previously existed only as out-of-band dashboard configuration with no
   migration on record).
3. Once you've confirmed a real report generates correctly end-to-end, the
   old `supabase/functions/generate-report/` Edge Function and the dead
   on-device `lib/reportTemplate.ts` template can be deleted (see the plan
   doc's "Files touched" section) — left in place for now as a fallback
   during cutover.
