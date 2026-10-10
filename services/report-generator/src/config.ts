function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  // Chromium binary puppeteer-core drives. The Docker image installs Debian's
  // chromium package here; for local runs on Windows/macOS point this at an
  // installed Chrome (see .env.example).
  chromiumPath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  reportBucket: process.env.REPORT_BUCKET ?? 'job-reports',
  photoBucket: process.env.PHOTO_BUCKET ?? 'job-photos',

  // Tunables — see plan doc "Reliability & operations": start conservative,
  // measure against real scale tests, adjust via env without a code change.
  maxAssetsPerChunk: intEnv('MAX_ASSETS_PER_CHUNK', 200),
  // Per render pass (the pipeline runs two). A synthetic 1200-asset site
  // renders in under 20s locally, so 5 min is a wide margin even on 2 vCPU.
  renderTimeoutMs: intEnv('RENDER_TIMEOUT_MS', 300_000),
  chunkRetryAttempts: intEnv('CHUNK_RETRY_ATTEMPTS', 2),

  port: intEnv('PORT', 8080),

  // Cloud Run self-invocation — see index.ts's POST /internal/run. When set,
  // generation runs inside a separate, held-open request to this same
  // service instead of as in-process background work after the 202, so
  // Cloud Run keeps the CPU allocated for the whole render. Unset (local
  // dev, or any always-on host) = run in-process like before.
  internalRunSecret: process.env.INTERNAL_RUN_SECRET ?? '',
  // Optional override of this service's own public URL; normally derived
  // from the incoming request's Host header.
  selfUrl: process.env.SELF_URL ?? '',
} as const;
