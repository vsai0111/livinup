import { loadScriptEnv, describeTarget } from './_env'

loadScriptEnv()

/**
 * Run a real-provider ingestion.
 *
 *   npm run ingest -- --status
 *   npm run ingest -- --provider=flipkart --limit=200 --dry-run
 *   npm run ingest -- --provider=admitad
 *
 * Deliberately a separate command from `db:seed`. Seeding writes synthetic
 * development data; this writes real catalogue data. Sharing one entry point
 * between them is how a demo dataset ends up in production.
 *
 * `--dry-run` fetches, normalises and filters but writes nothing — the way to
 * see what a provider would contribute before letting it near the catalogue.
 */

interface Args {
  provider?: string
  limit?: number
  dryRun: boolean
  status: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, status: false }

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--status') args.status = true
    else if (arg.startsWith('--provider=')) args.provider = arg.slice('--provider='.length)
    else if (arg.startsWith('--limit=')) {
      const value = Number.parseInt(arg.slice('--limit='.length), 10)
      if (Number.isFinite(value) && value > 0) args.limit = value
    }
  }

  return args
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const { providerStatuses, getCatalogProvider } = await import('../services/ingestion/registry')

  // --- Status ---------------------------------------------------------------
  if (args.status || !args.provider) {
    console.log('\nProvider status\n')
    for (const status of providerStatuses()) {
      const state = status.readiness.ready ? 'READY' : 'not configured'
      console.log(`  ${status.id.padEnd(10)} ${status.kind.padEnd(9)} ${state}`)
      console.log(`  ${''.padEnd(10)} ${status.summary}`)
      if (!status.readiness.ready) {
        console.log(`  ${''.padEnd(10)} ${status.readiness.reason}`)
        if (status.readiness.missing.length > 0) {
          // Names only. A CLI must never echo a credential's value.
          console.log(`  ${''.padEnd(10)} set: ${status.readiness.missing.join(', ')}`)
        }
      }
      console.log()
    }

    if (!args.provider) {
      console.log('Run one with:  npm run ingest -- --provider=<id> [--limit=N] [--dry-run]\n')
      return
    }
  }

  // --- Run ------------------------------------------------------------------
  const entry = getCatalogProvider(args.provider)
  if (!entry) {
    console.error(`Unknown provider "${args.provider}".`)
    console.error('Run `npm run ingest -- --status` to list the providers that exist.')
    process.exitCode = 1
    return
  }

  const provider = entry.create()
  const readiness = provider.readiness()
  if (!readiness.ready) {
    console.error(`\nProvider "${entry.id}" is not configured.`)
    console.error(`  ${readiness.reason}`)
    if (readiness.missing.length > 0) {
      console.error(`  Required: ${readiness.missing.join(', ')}`)
    }
    console.error('\nSee docs/product-data.md for how to obtain credentials.\n')
    process.exitCode = 1
    return
  }

  const { createDbHandle } = await import('../lib/db/connect')
  const { migrate } = await import('../lib/db/migrate')
  const { runCatalogIngestion } = await import('../services/ingestion/catalog-run')

  console.log(`\nIngesting "${entry.id}" into ${describeTarget()}`)
  if (args.dryRun) console.log('DRY RUN — nothing will be written.\n')

  const db = await createDbHandle()
  try {
    await migrate(db)
    const summary = await runCatalogIngestion(db, provider, {
      limit: args.limit,
      dryRun: args.dryRun,
    })

    console.log('\nIngestion summary:')
    for (const key of [
      'status',
      'fetched',
      'accepted',
      'filtered',
      'rejected',
      'inserted',
      'updated',
      'unchanged',
      'duplicates',
      'priceObservations',
      'warnings',
    ] as const) {
      console.log(`  ${key.padEnd(20)} ${summary[key]}`)
    }

    const breakdown = Object.entries(summary.filterBreakdown)
    if (breakdown.length > 0) {
      console.log('\nFiltered out by rule:')
      for (const [reason, count] of breakdown.sort((a, b) => b[1]! - a[1]!)) {
        console.log(`  ${reason.padEnd(24)} ${count}`)
      }
    }

    if (summary.rejectionSamples.length > 0) {
      console.log('\nRejection samples:')
      for (const sample of summary.rejectionSamples.slice(0, 10)) {
        console.log(`  ${sample.externalId}: ${sample.errors.join('; ')}`)
      }
    }

    if (summary.error) console.log(`\nRun ended early: ${summary.error}`)
    if (summary.status === 'failed') process.exitCode = 1
    console.log()
  } finally {
    await db.close()
  }
}

main().catch((error) => {
  console.error('Ingestion failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
