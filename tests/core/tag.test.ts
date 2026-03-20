import { describe, expect, it } from 'vitest'
import { parseTag } from '@/core/tag.js'

describe('parseTag', () => {
  it('parses scoped package tag', () => {
    const got = parseTag('@tofrankie/action@1.2.3', true)
    expect(got.packageName).toBe('@tofrankie/action')
    expect(got.normalizedVersion).toBe('1.2.3')
    expect(got.unscopedName).toBe('action')
  })

  it('parses plain version in single package mode', () => {
    const got = parseTag('v1.0.0', true)
    expect(got.normalizedVersion).toBe('1.0.0')
    expect(got.packageName).toBeUndefined()
  })

  it('rejects version-only tag in monorepo mode', () => {
    expect(() => parseTag('1.0.0', false)).toThrow('Tag must include package name')
  })
})
