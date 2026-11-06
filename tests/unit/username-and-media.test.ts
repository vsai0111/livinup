import { describe, expect, it } from 'vitest'
import { normalizeUsername, suggestUsername, usernameProblem } from '@/lib/profiles/username'
import { looksLikeHeic, sniffImageType } from '@/lib/media/process'
import { normalizeInviteCode } from '@/lib/moderation/invites'

describe('usernames', () => {
  it('normalises case and a leading @', () => {
    expect(normalizeUsername('  @Asha.Rao ')).toBe('asha.rao')
  })

  it('accepts ordinary handles', () => {
    for (const name of ['asha', 'asha.rao', 'rahul_92', 'k.v.s']) {
      expect(usernameProblem(name)).toBeNull()
    }
  })

  it('refuses malformed handles with a specific reason', () => {
    expect(usernameProblem('ab')).toMatch(/at least 3/)
    expect(usernameProblem('a'.repeat(31))).toMatch(/30 characters/)
    expect(usernameProblem('9lives')).toMatch(/Start with a letter/)
    expect(usernameProblem('asha rao')).toMatch(/only letters/)
    expect(usernameProblem('asha..rao')).toMatch(/two dots/)
    expect(usernameProblem('asha.')).toMatch(/End with/)
  })

  it('refuses names that collide with routes or roles', () => {
    for (const name of ['admin', 'settings', 'livinup', 'Wardrobe']) {
      expect(usernameProblem(name)).toMatch(/reserved/)
    }
  })

  it('suggests a valid handle from a display name', () => {
    expect(suggestUsername('Asha Rao')).toBe('asha.rao')
    expect(suggestUsername('Ánanya   Iyer!')).toBe('ananya.iyer')
    expect(suggestUsername('42')).toBe('')
    const suggestion = suggestUsername('Priya Venkataraman Subramanian')
    expect(usernameProblem(suggestion)).toBeNull()
  })
})

describe('image type sniffing', () => {
  const bytes = (...values: number[]) => Uint8Array.from(values)
  const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0))

  it('recognises JPEG, PNG and WebP by their leading bytes', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffImageType(ascii('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
  })

  it('ignores the claimed file type: an SVG or HTML file is refused', () => {
    expect(sniffImageType(ascii('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull()
    expect(sniffImageType(ascii('<html><script>'))).toBeNull()
    expect(sniffImageType(ascii('GIF89a'))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })

  it('spots iPhone HEIC files so they get a helpful message', () => {
    expect(looksLikeHeic(ascii('\0\0\0\x18ftypheic'))).toBe(true)
    expect(looksLikeHeic(ascii('\0\0\0\x18ftypmp42'))).toBe(false)
  })
})

describe('invite codes', () => {
  it('normalises what people type', () => {
    expect(normalizeInviteCode('  livin-ab12-cd34 ')).toBe('LIVIN-AB12-CD34')
    expect(normalizeInviteCode('livin-ab12 -cd34')).toBe('LIVIN-AB12-CD34')
  })
})
