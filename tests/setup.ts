// Vitest global setup. Keeps tests hermetic: they never touch a remote database
// and never emit analytics to a third party.
process.env.LIVINUP_DB_DRIVER = 'pglite'
// File-backed, not memory://: a full seeded catalogue does not fit in PGlite's
// in-memory WASM heap. See tests/helpers/db.ts.
process.env.PGLITE_DATA_DIR = '.livinup/test-default'
process.env.LIVINUP_AUTH_SECRET ||= 'test-secret-not-used-in-production-0000000000'
process.env.LIVINUP_LOG_LEVEL ||= 'error'
delete process.env.DATABASE_URL
delete process.env.NEXT_PUBLIC_SUPABASE_URL
delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// Also strip the pre-rename name: it still drives the migration guard in
// config/env.server.ts, and a developer's stale .env would otherwise leak in.
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
delete process.env.NEXT_PUBLIC_POSTHOG_KEY
