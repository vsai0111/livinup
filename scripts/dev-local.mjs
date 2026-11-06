/**
 * `npm run dev:local` — the dev server on the embedded database, with local auth.
 *
 * Use this when `.env.local` points at a real Supabase project but you want to
 * work without touching it: nothing here reads or writes that database, and no
 * Supabase user is created when you sign up.
 *
 * Why a script rather than `LIVINUP_DB_DRIVER=pglite next dev`: Next.js loads
 * `.env.local` for every variable that is absent from the environment, so the
 * Supabase variables have to be present-but-empty to stay switched off. On
 * Windows a shell cannot set an empty environment variable (assigning "" deletes
 * it), but a child process environment can carry one.
 *
 * The embedded database lives in `.livinup/pgdata` (git-ignored) and migrates
 * itself on first start. Uploaded photos go to `.livinup/media`. Delete those
 * folders to start over.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')

const env = {
  ...process.env,
  LIVINUP_DB_DRIVER: 'pglite',
  PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR || '.livinup/pgdata',
  DATABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
}

const child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
