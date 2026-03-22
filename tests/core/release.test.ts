import { describe, expect, it, vi } from 'vitest'
import { ensureRelease } from '@/core/release.js'

describe('ensureRelease', () => {
  it('creates release when tag does not exist', async () => {
    const createRelease = vi.fn().mockResolvedValue({ html_url: 'https://example.com/new' })
    const got = await ensureRelease({
      client: {
        getReleaseByTag: async () => null,
        createRelease,
        updateRelease: vi.fn(),
      },
      tag: 'v1.0.0',
      title: 'v1.0.0',
      body: 'notes',
      isPrerelease: false,
    })

    expect(got).toEqual({ githubReleaseUrl: 'https://example.com/new', action: 'created' })
    expect(createRelease).toHaveBeenCalledOnce()
  })

  it('updates release when tag already exists', async () => {
    const updateRelease = vi.fn().mockResolvedValue({ html_url: 'https://example.com/update' })
    const got = await ensureRelease({
      client: {
        getReleaseByTag: async () => ({ id: 1 }),
        createRelease: vi.fn(),
        updateRelease,
      },
      tag: 'v1.0.0',
      title: 'v1.0.0',
      body: 'notes',
      isPrerelease: true,
    })

    expect(got).toEqual({ githubReleaseUrl: 'https://example.com/update', action: 'updated' })
    expect(updateRelease).toHaveBeenCalledOnce()
  })
})
