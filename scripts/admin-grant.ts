import { loadScriptEnv, describeTarget } from './_env'

loadScriptEnv()

/**
 * Grant or revoke the admin role.
 *
 *   npm run admin:grant -- --email=you@example.com
 *   npm run admin:grant -- --username=yourname --revoke
 *
 * There is deliberately no way to do this from inside the app: an admin can
 * only be made by someone who already holds database credentials.
 */
async function main(): Promise<void> {
  const arg = (name: string) =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  const email = arg('email')?.trim().toLowerCase()
  const username = arg('username')?.trim().toLowerCase()
  const revoke = process.argv.includes('--revoke')

  if (!email && !username) {
    console.error('Pass --email=<address> or --username=<name>.')
    process.exitCode = 1
    return
  }

  const { createDbHandle } = await import('../lib/db/connect')
  const db = await createDbHandle()
  try {
    let profileId: string | undefined
    if (username) {
      const rows = await db.query<{ id: string }>(
        'select id::text from profiles where username = $1',
        [username],
      )
      profileId = rows[0]?.id
    } else {
      // Supabase keeps addresses in auth.users; the local provider in local_auth_users.
      const hasAuthSchema = await db.query<{ ok: boolean }>(
        `select exists (select 1 from information_schema.tables
                         where table_schema = 'auth' and table_name = 'users') as ok`,
      )
      const rows = await db.query<{ id: string }>(
        hasAuthSchema[0]?.ok
          ? 'select id::text from auth.users where lower(email) = $1'
          : 'select id::text from local_auth_users where lower(email) = $1',
        [email],
      )
      profileId = rows[0]?.id
    }

    if (!profileId) {
      console.error(`No account found on ${describeTarget()}.`)
      process.exitCode = 1
      return
    }

    const updated = await db.query<{ username: string | null }>(
      'update profiles set role = $2 where id = $1 returning username',
      [profileId, revoke ? 'member' : 'admin'],
    )
    if (updated.length === 0) {
      console.error('The account exists but has no profile yet. Sign in once, then retry.')
      process.exitCode = 1
      return
    }
    console.log(
      `${revoke ? 'Revoked admin from' : 'Granted admin to'} @${updated[0]?.username ?? '(no username yet)'} on ${describeTarget()}.`,
    )
  } finally {
    await db.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
