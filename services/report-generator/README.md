# report-generator

SiteTrack's AS1851 inspection PDF report service: one container with headless
Chromium inside, running on **Google Cloud Run** (scales to zero, so you pay
only while a report renders). The mobile app reaches it through
`EXPO_PUBLIC_REPORT_SERVICE_URL`.

Until October 2026 this ran on Render as two services (`sitetrack-gotenberg-private`
plus this one, deployed by the now-removed `render.yaml`). The HTTP API is
unchanged from that version (`GET /health`, `POST /generate-report`,
`GET /report-status`). Deploy commands below run from this folder.

## What changed vs the Render version

| Area | Before (Render) | Now |
|---|---|---|
| HTML → PDF | Separate Gotenberg service over HTTP | `puppeteer-core` drives Chromium in the same container (`src/render/chromium.ts`). Page settings copied 1:1 |
| Cold-start workarounds | `waitForGotenbergReady()` | Removed (no second service) |
| Background work after the 202 | In-process | On Cloud Run (`INTERNAL_RUN_SECRET` set): runs inside a held-open `POST /internal/run` request to the same service, so the CPU stays allocated for the whole render. Unset: in-process, same as before |
| Shutdown grace | 240s (Render) | 8s (Cloud Run gives 10s) |
| Retries / lock | 3 attempts, 20 min stale lock | 2 attempts, 10 min per pass, 45 min stale lock |
| Pipeline | `generateReport()` | Split: `generateReport()` fetches and uploads, `renderReportPdf()` renders (pure, testable) |

Everything else is untouched: auth, job ownership check, atomic lock, data
fetch, sharp thumbnails, two-pass index, page stamping, Ghostscript, upload.

## Local testing (no Docker, no Supabase needed)

```bash
npm install
npm run typecheck
npm run smoketest                # template structure checks
npm run render-test -- 1200      # synthetic 1200-asset site through the real renderer
```

On Windows `render-test` uses installed Chrome automatically. Output goes to
`test-output/report-<n>.pdf`. Ghostscript is skipped locally unless installed
(it fails open), so local PDFs are a bit larger than production ones.

Measured on the dev PC (synthetic data, ~1.25 photos per asset):

| Assets | Pages | Time | Peak memory |
|---|---|---|---|
| 50 | 21 | 3.9s | — |
| 300 | 87 | 5.2s | — |
| 1200 | 334 | 17.4s | Chrome ~900MB + Node ~400MB |

Expect Cloud Run (2 vCPU) to be roughly 2–3× slower than a desktop CPU.

## Running against real data locally

```bash
cp .env.example .env   # fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHROMIUM_PATH
npm run dev
curl -X POST http://localhost:8080/generate-report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <a real user access_token>" \
  -d '{"jobId":"<a real job id>"}'
```

This writes a real report to Supabase Storage (`job-reports/<jobId>.pdf`) and
overwrites that job's existing report.

## Deploying to Cloud Run

Live: `https://report-service-267881656439.australia-southeast1.run.app`
(project `project-52971943-566f-4099-9bb`, region `australia-southeast1`, next to
the Supabase project in Sydney).

**Routine redeploy after a code change.** This keeps every existing setting:

```bash
gcloud run deploy report-service --source . --region australia-southeast1
```

Rebuild about once a month even without code changes, so the image picks up
Debian's latest Chromium security fixes.

**Full settings**, for recreating the service from scratch. Run from Git Bash:
`gcloud.cmd` in PowerShell/cmd splits arguments at commas.

```bash
gcloud run deploy report-service \
  --source . \
  --region australia-southeast1 \
  --allow-unauthenticated \
  --cpu 2 --memory 4Gi \
  --concurrency 8 --max-instances 3 --min-instances 0 \
  --timeout 3600 \
  --set-env-vars "REPORT_BUCKET=job-reports,PHOTO_BUCKET=job-photos,CHUNK_RETRY_ATTEMPTS=2,SHUTDOWN_GRACE_MS=8000,RENDER_TIMEOUT_MS=300000,TZ=Australia/Sydney,SELF_URL=https://report-service-267881656439.australia-southeast1.run.app" \
  --set-secrets SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,INTERNAL_RUN_SECRET=internal-run-secret:latest
```

- `--allow-unauthenticated`: the service checks the Supabase user token itself.
  `/internal/*` returns 404 without the secret.
- `--max-instances 3` caps the bill even under abuse or a bug.
- `MAX_CONCURRENT_RENDERS` (default 2, no flag needed): `--concurrency 8` lets
  several renders land on one 4Gi instance; beyond 2 they queue inside the
  instance instead of risking an out-of-memory kill (which leaves the job
  stuck as generating until the stale lock expires).
- `--timeout 3600`: the held-open `/internal/run` request must outlast the longest render.
- `TZ=Australia/Sydney`: report dates and times use the server time zone. Without
  it they print in UTC, which is 10–11h behind NSW and can show the wrong date.
- `--cpu 2`: 4 vCPU measured no faster (1200 assets: 111s vs 109s). The slow
  steps run on a single core.

One-time project setup already done: APIs enabled (run, cloudbuild,
artifactregistry, secretmanager); the compute service account has
`roles/run.builder` and `secretAccessor` on the three secrets; the Artifact
Registry repo `cloud-run-source-deploy` keeps the latest 3 images and deletes
others after 7 days.

**Rotating the Supabase key:** add a new version to the
`supabase-service-role-key` secret, then redeploy (`:latest` is read when an
instance starts).

## Scale test on the real cloud (no data touched)

Deploy a no-traffic tagged revision with `ENABLE_DIAGNOSTICS=1`, then
`POST <tag-url>/internal/diag/start` with header `X-Internal-Secret` and body
`{"assets":1200}`. The result is logged as a `[diag]` line. Measured on
2026-10-09: 1200 assets, 334 pages, 3.3 MB, 111s, no memory issues. Remove the
tag and send traffic back to the latest revision afterwards:
`gcloud run services update-traffic report-service --region australia-southeast1 --to-latest` and
`gcloud run services update-traffic report-service --region australia-southeast1 --remove-tags <tag>`.
