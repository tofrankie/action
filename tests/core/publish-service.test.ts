import { beforeEach, describe, expect, it, vi } from 'vitest'

import { publishRelease } from '@/core/publish-service.js'

const {
  mockIsMonorepoWorkspace,
  mockResolvePackageDir,
  mockResolveChangelogPath,
  mockReadChangelogEntry,
  mockEnsureRelease,
  mockHasNpmVersion,
  mockPublishNpmPackage,
  mockAssertTagRefConsistency,
} = vi.hoisted(() => ({
  mockIsMonorepoWorkspace: vi.fn(),
  mockResolvePackageDir: vi.fn(),
  mockResolveChangelogPath: vi.fn(),
  mockReadChangelogEntry: vi.fn(),
  mockEnsureRelease: vi.fn(),
  mockHasNpmVersion: vi.fn(),
  mockPublishNpmPackage: vi.fn(),
  mockAssertTagRefConsistency: vi.fn(),
}))

vi.mock('@/core/package-resolver.js', () => ({
  isMonorepoWorkspace: mockIsMonorepoWorkspace,
  resolvePackageDir: mockResolvePackageDir,
}))
vi.mock('@/core/changelog-path.js', () => ({
  resolveChangelogPath: mockResolveChangelogPath,
}))
vi.mock('@/core/changelog.js', () => ({
  readChangelogEntry: mockReadChangelogEntry,
}))
vi.mock('@/core/release.js', () => ({
  ensureRelease: mockEnsureRelease,
}))
vi.mock('@/core/npm.js', () => ({
  hasNpmVersion: mockHasNpmVersion,
  publishNpmPackage: mockPublishNpmPackage,
}))
vi.mock('@/core/ref-guard.js', () => ({
  assertTagRefConsistency: mockAssertTagRefConsistency,
}))

describe('publishRelease', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsMonorepoWorkspace.mockResolvedValue(false)
    mockResolvePackageDir.mockResolvedValue({
      isMonorepo: false,
      packageName: '@tofrankie/action',
      packageDir: '/tmp/repo',
    })
    mockResolveChangelogPath.mockResolvedValue({
      path: '/tmp/repo/CHANGELOG.md',
      source: 'root-default',
    })
    mockReadChangelogEntry.mockResolvedValue({
      title: '@tofrankie/action@1.0.0',
      body: '- test',
    })
    mockEnsureRelease.mockResolvedValue({
      releaseUrl: 'https://example.com/release',
      action: 'created',
    })
    mockHasNpmVersion.mockResolvedValue(false)
    mockPublishNpmPackage.mockResolvedValue(undefined)
    mockAssertTagRefConsistency.mockResolvedValue(undefined)
  })

  it('returns skipped when publishNpm=false', async () => {
    const got = await publishRelease(
      { tag: 'v1.0.0', publishNpm: false },
      {
        releaseClient: {
          getReleaseByTag: async () => null,
          createRelease: async () => ({ html_url: '' }),
          updateRelease: async () => ({ html_url: '' }),
        },
        logger: { info: vi.fn() },
      }
    )

    expect(got.npmStatus).toBe('skipped')
    expect(mockHasNpmVersion).not.toHaveBeenCalled()
  })

  it('returns already-exists when npm version already exists', async () => {
    mockHasNpmVersion.mockResolvedValue(true)
    const warn = vi.fn()
    const got = await publishRelease(
      { tag: 'v1.0.0', publishNpm: true, npmToken: 'npm_xxx' },
      {
        releaseClient: {
          getReleaseByTag: async () => null,
          createRelease: async () => ({ html_url: '' }),
          updateRelease: async () => ({ html_url: '' }),
        },
        logger: { info: vi.fn(), warn },
      }
    )

    expect(got.npmStatus).toBe('already-exists')
    expect(mockPublishNpmPackage).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('publishes npm when enabled and version not found', async () => {
    const got = await publishRelease(
      { tag: 'v1.0.0', publishNpm: true, npmToken: 'npm_xxx' },
      {
        releaseClient: {
          getReleaseByTag: async () => null,
          createRelease: async () => ({ html_url: '' }),
          updateRelease: async () => ({ html_url: '' }),
        },
        logger: { info: vi.fn() },
      }
    )

    expect(got.npmStatus).toBe('published')
    expect(mockPublishNpmPackage).toHaveBeenCalledOnce()
  })

  it('fails fast when tag/ref mismatch and does not create release', async () => {
    mockAssertTagRefConsistency.mockRejectedValue(new Error('TAG_REF_MISMATCH'))

    await expect(
      publishRelease(
        { tag: 'v1.0.0', ref: 'main', publishNpm: false },
        {
          releaseClient: {
            getReleaseByTag: async () => null,
            createRelease: async () => ({ html_url: '' }),
            updateRelease: async () => ({ html_url: '' }),
            getTagCommit: async () => 'sha-a',
            getRefCommit: async () => 'sha-b',
          },
          logger: { info: vi.fn(), warn: vi.fn() },
        }
      )
    ).rejects.toThrow('TAG_REF_MISMATCH')

    expect(mockEnsureRelease).not.toHaveBeenCalled()
    expect(mockHasNpmVersion).not.toHaveBeenCalled()
  })
})
