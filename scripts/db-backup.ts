import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadScriptEnv, describeTarget } from './_env'

loadScriptEnv()

/**
 * Dump every table in the public schema to JSON files.
 *
 *   npm run db:backup
 *   npm run db:backup -- --out=D:\backups
 *
 * A logical safety copy taken before a migration. It is not a substitute for
 * Supabase's own backups. The output contains personal data, so it is written
 * outside the repository (default: ~/livinup-backups/<timestamp>) and must
 * never be committed.
 */
async function main(): Promise<void> {
  const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.join(outArg ?? path.join(os.homedir(), 'livinup-backups'), stamp)

  const repo = path.resolve(process.cwd())
  if (path.resolve(dir).startsWith(repo + path.sep)) {
    console.error('Refusing to write a backup inside the repository.')
    process.exitCode = 1
    return
  }

  const { createDbHandle } = await import('../lib/db/connect')
  const db = await createDbHandle()
  try {
    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name`,
    )
    await mkdir(dir, { recursive: true })
    console.log(`Backing up ${describeTarget()} to ${dir}`)
    for (const { table_name } of tables) {
      // Names come from the catalogue, not user input; quoted regardless.
      const rows = await db.query(`select * from "${table_name.replace(/"/g, '""')}"`)
      await writeFile(path.join(dir, `${table_name}.json`), JSON.stringify(rows, null, 2))
      console.log(`  ${table_name.padEnd(28)} ${rows.length}`)
    }
  } finally {
    await db.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
