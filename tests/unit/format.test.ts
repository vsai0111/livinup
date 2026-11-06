import { describe, expect, it } from 'vitest'
import { formatCount, formatRelativeTime, humanize, plural } from '@/lib/utils/format'

describe('formatCount', () => {
  it('leaves small numbers alone and compacts large ones', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1200)).toBe('1.2K')
    expect(formatCount(3_400_000)).toBe('3.4M')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-01T12:00:00.000Z')

  it('says "just now" under a minute', () => {
    expect(formatRelativeTime('2026-06-01T11:59:30.000Z', now)).toBe('just now')
  })

  it('uses the largest whole unit', () => {
    expect(formatRelativeTime('2026-06-01T09:00:00.000Z', now)).toBe('3 hours ago')
    expect(formatRelativeTime('2026-05-29T12:00:00.000Z', now)).toBe('3 days ago')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatRelativeTime('not a date', now)).toBe('')
  })
})

describe('humanize', () => {
  it('makes a vocabulary term readable', () => {
    expect(humanize('date-night')).toBe('Date night')
    expect(humanize('intimate_image')).toBe('Intimate image')
    expect(humanize('olive')).toBe('Olive')
  })
})

describe('plural', () => {
  it('picks the right form', () => {
    expect(plural(1, 'piece')).toBe('1 piece')
    expect(plural(3, 'piece')).toBe('3 pieces')
    expect(plural(2, 'person', 'people')).toBe('2 people')
  })
})
