import type {
  CatalogProvider,
  DeeplinkProvider,
  ProviderId,
  ProviderReadiness,
} from '@/lib/providers/types'
import { AdmitadCatalogProvider } from './providers/admitad'
import { CuelinksDeeplinkProvider } from './providers/cuelinks'
import { FlipkartCatalogProvider } from './providers/flipkart'

/**
 * Which providers exist, and which can run right now.
 *
 * One place that knows the full set, so the CLI, the scheduled route and the
 * documentation cannot disagree about what is available. Providers are
 * constructed lazily — instantiating one reads the environment, and a status
 * listing should not fail because an unrelated provider is misconfigured.
 */

export interface CatalogProviderEntry {
  id: ProviderId
  /** What this provider is, in one line, for CLI output and the setup doc. */
  summary: string
  create: () => CatalogProvider
}

export interface DeeplinkProviderEntry {
  id: ProviderId
  summary: string
  create: () => DeeplinkProvider
}

/**
 * Providers that supply products.
 *
 * `seed` is deliberately absent: the synthetic catalogue is not a real provider
 * and runs through its own pipeline (services/ingestion/seed-runner.ts). Listing
 * it here would make it reachable from the scheduled ingestion route, which is
 * exactly the confusion between development data and production data that this
 * separation exists to prevent.
 */
export const CATALOG_PROVIDERS: CatalogProviderEntry[] = [
  {
    id: 'flipkart',
    summary: 'Flipkart Affiliate API product feed (single merchant, JSON over HTTPS).',
    create: () => new FlipkartCatalogProvider(),
  },
  {
    id: 'admitad',
    summary: 'Admitad advertiser product feeds (many merchants, CSV/XML feed documents).',
    create: () => new AdmitadCatalogProvider(),
  },
]

/** Providers that turn a destination URL into a tracked one. */
export const DEEPLINK_PROVIDERS: DeeplinkProviderEntry[] = [
  {
    id: 'cuelinks',
    summary: 'Cuelinks link monetisation (no product catalogue — deeplinks only).',
    create: () => new CuelinksDeeplinkProvider(),
  },
]

export function getCatalogProvider(id: string): CatalogProviderEntry | null {
  return CATALOG_PROVIDERS.find((entry) => entry.id === id) ?? null
}

export interface ProviderStatus {
  id: ProviderId
  kind: 'catalog' | 'deeplink'
  summary: string
  readiness: ProviderReadiness
}

/**
 * Readiness of every provider.
 *
 * A provider whose constructor throws is reported as not ready rather than
 * taking the listing down with it — the whole point of this call is to find out
 * what is wrong.
 */
export function providerStatuses(): ProviderStatus[] {
  const statuses: ProviderStatus[] = []

  const check = (
    id: ProviderId,
    kind: 'catalog' | 'deeplink',
    summary: string,
    create: () => { readiness(): ProviderReadiness },
  ) => {
    let readiness: ProviderReadiness
    try {
      readiness = create().readiness()
    } catch (error) {
      readiness = {
        ready: false,
        reason: error instanceof Error ? error.message : 'provider could not be constructed',
        missing: [],
      }
    }
    statuses.push({ id, kind, summary, readiness })
  }

  for (const entry of CATALOG_PROVIDERS) check(entry.id, 'catalog', entry.summary, entry.create)
  for (const entry of DEEPLINK_PROVIDERS) check(entry.id, 'deeplink', entry.summary, entry.create)

  return statuses
}
