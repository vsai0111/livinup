/**
 * The result shape every Server Action returns.
 *
 * Failures come back as data rather than thrown errors, so a client component
 * can show a short message inline instead of hitting an error boundary.
 * `reference` ties a generic failure to a server log line without leaking
 * details to the browser.
 */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; reference?: string }

export function ok(): ActionResult
export function ok<T>(data: T): ActionResult<T>
export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data } as ActionResult<T>
}

export function fail(
  error: string,
  reference?: string,
): { ok: false; error: string; reference?: string } {
  return reference ? { ok: false, error, reference } : { ok: false, error }
}

/**
 * An expected, user-facing refusal: a limit reached, a forbidden action, bad
 * input that passed schema validation. Thrown inside an action body and turned
 * into `{ ok: false, error: message }` by `runAction`, with no error report.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}
