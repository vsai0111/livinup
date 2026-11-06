import 'server-only'
import type { Db } from '@/lib/db/types'
import { logger } from '@/lib/logging/logger'
import type { EventType, UserEventInput } from '@/types/user'

/**
 * Server-side event recording.
 *
 * LivinUp's own database is the source of truth for the product funnel, not a
 * third-party analytics tool: the validation questions in docs/product-spec.md
 * section 13 are answered with SQL on `user_events`.
 *
 * PostHog, when configured, is a *mirror* for exploration — never the record.
 */

/** Events that may be recorded without an authenticated user. */
const ANONYMOUS_ALLOWED: ReadonlySet<EventType> = new Set([
  'landing_view',
  'signup_started',
  'signup_completed',
  'signin_completed',
  'profile_viewed',
  'brand_profile_viewed',
  'share_clicked',
  // Recorded after the account is gone, so it cannot name it.
  'account_deleted',
])

/** Cap on metadata size, so an event row cannot be used as arbitrary storage. */
const MAX_METADATA_BYTES = 4096

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {}

  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    // Only primitives and shallow string arrays; no nested objects, no PII by accident.
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      clean[key] = value
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      clean[key] = value.slice(0, 20)
    }
  }

  const serialized = JSON.stringify(clean)
  if (serialized.length > MAX_METADATA_BYTES) {
    return { truncated: true }
  }
  return clean
}

/**
 * Record one event.
 *
 * Never throws. Analytics failing must not break the user's action — a lost
 * data point is acceptable, a broken button is not.
 */
export async function recordEvent(db: Db, input: UserEventInput): Promise<void> {
  try {
    if (!input.userId && !ANONYMOUS_ALLOWED.has(input.eventType)) return

    await db.query(
      `insert into user_events (user_id, session_id, event_type, metadata)
       values ($1, $2, $3, $4::jsonb)`,
      [
        input.userId ?? null,
        input.sessionId ?? null,
        input.eventType,
        JSON.stringify(sanitizeMetadata(input.metadata)),
      ],
    )
  } catch (error) {
    logger.warn('failed to record event', { eventType: input.eventType, error })
  }
}
