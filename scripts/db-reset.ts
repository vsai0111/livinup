import { loadScriptEnv, describeTarget } from './_env'

loadScriptEnv()

/**
 * Drop everything LivinUp owns and rebuild from migrations.
 *
 *   npm run db:reset
 *
 * Destructive. Refuses to run against anything but the embedded local
 * database, so a stray invocation cannot wipe a shared environment. Use
 * `npm run db:fixtures` afterwards for demo content.
 */
async function main(): Promise<void> {
  const driver =
    process.env.LIVINUP_DB_DRIVER && process.env.LIVINUP_DB_DRIVER !== 'auto'
      ? process.env.LIVINUP_DB_DRIVER
      : process.env.DATABASE_URL
        ? 'postgres'
        : 'pglite'

  if (driver !== 'pglite') {
    console.error(
      `Refusing to reset ${describeTarget()}.\n` +
        'db:reset only runs against the embedded local database. It would drop every table.',
    )
    process.exitCode = 1
    return
  }

  const { createDbHandle } = await import('../lib/db/connect')
  const { migrate } = await import('../lib/db/migrate')

  console.log(`Resetting ${describeTarget()}`)
  const db = await createDbHandle()
  try {
    await db.exec('drop schema public cascade; create schema public;')
    const { applied } = await migrate(db)
    console.log(`Reset complete: ${applied.length} migration(s) applied.`)
  } finally {
    await db.close()
  }
}

main().catch((error: unknown) => {
  console.error('\nReset failed:')
  console.error(error instanceof Error ? (error.stack ?? error.message) : error)
  process.exitCode = 1
})
