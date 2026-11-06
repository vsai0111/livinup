import { DEFAULT_LOCALE } from '@/config/app'

/**
 * Display formatting, kept in one place so a date or a count reads the same
 * on every screen.
 */

/** Relative time in plain words: "3 days ago". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const seconds = Math.round((now.getTime() - then) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ]

  const formatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' })

  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(seconds) >= secondsPerUnit) {
      return formatter.format(-Math.round(seconds / secondsPerUnit), unit)
    }
  }
  return 'just now'
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: 'medium' }).format(date)
}

/** Compact counts: 999, 1.2K, 3.4L would confuse, so K/M like most apps. */
export function formatCount(value: number): string {
  if (value < 1000) return String(value)
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

/** Sentence-case a vocabulary term for display: "date-night" -> "Date night". */
export function humanize(value: string): string {
  const spaced = value.replace(/[-_]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** "1 piece", "3 pieces". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
