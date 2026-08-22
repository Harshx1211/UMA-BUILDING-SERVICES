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

  gotenbergUrl: process.env.GOTENBERG_URL ?? 'http://gotenberg:3000',
  reportBucket: process.env.REPORT_BUCKET ?? 'job-reports',
  photoBucket: process.env.PHOTO_BUCKET ?? 'job-photos',

  // Tunables — see plan doc "Reliability & operations": start conservative,
  // measure against real scale tests, adjust via env without a code change.
  maxAssetsPerChunk: intEnv('MAX_ASSETS_PER_CHUNK', 200),
  gotenbergConcurrency: intEnv('GOTENBERG_CONCURRENCY', 2),
  gotenbergTimeoutMs: intEnv('GOTENBERG_TIMEOUT_MS', 60_000),
  chunkRetryAttempts: intEnv('CHUNK_RETRY_ATTEMPTS', 2),
  photoSignedUrlTtlSeconds: intEnv('PHOTO_SIGNED_URL_TTL_SECONDS', 1800),

  port: intEnv('PORT', 8080),
} as const;
