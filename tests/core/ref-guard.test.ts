import { describe, expect, it, vi } from 'vitest'
import { assertTagRefConsistency } from '@/core/ref-guard.js'

describe('assertTagRefConsistency', () => {
  it('passes when commits match', async () => {
    await expect(
      assertTagRefConsistency({
        tag: 'v1.0.0',
        ref: 'refs/heads/main',
        client: {
          getTagCommit: async () => 'abc',
          getRefCommit: async () => 'abc',
        },
      })
    ).resolves.toBeUndefined()
  })

  it('throws when commits mismatch', async () => {
    await expect(
      assertTagRefConsistency({
        tag: 'v1.0.0',
        ref: 'refs/heads/main',
        client: {
          getTagCommit: async () => 'abc',
          getRefCommit: async () => 'def',
        },
      })
    ).rejects.toThrow('Tag and ref point to different commits')
  })

  it('warns and skips when commit cannot be resolved', async () => {
    const warn = vi.fn()
    await assertTagRefConsistency({
      tag: 'v1.0.0',
      ref: 'refs/heads/main',
      client: {
        getTagCommit: async () => null,
        getRefCommit: async () => 'abc',
      },
      warn,
    })
    expect(warn).toHaveBeenCalledOnce()
  })
})
