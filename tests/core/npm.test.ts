import { beforeEach, describe, expect, it, vi } from 'vitest'

import { hasNpmVersion, publishNpmPackage } from '@/core/npm.js'

const { mockExeca } = vi.hoisted(() => ({
  mockExeca: vi.fn(),
}))

vi.mock('execa', () => ({
  execa: mockExeca,
}))

describe('npm core', () => {
  beforeEach(() => {
    mockExeca.mockReset()
  })

  it('returns true when npm view has output', async () => {
    mockExeca.mockResolvedValue({ stdout: '"1.0.0"' })
    await expect(hasNpmVersion('@tofrankie/action', '1.0.0')).resolves.toBe(true)
  })

  it('returns false when npm view fails', async () => {
    mockExeca.mockRejectedValue(new Error('not found'))
    await expect(hasNpmVersion('@tofrankie/action', '9.9.9')).resolves.toBe(false)
  })

  it('publishes scoped prerelease with access and next tag', async () => {
    mockExeca.mockResolvedValue({ stdout: '' })
    await publishNpmPackage({
      packageDir: '/tmp/pkg',
      packageName: '@tofrankie/action',
      isPrerelease: true,
      npmToken: 'npm_xxx',
    })

    expect(mockExeca).toHaveBeenNthCalledWith(
      1,
      'npm',
      ['pack', '--dry-run'],
      expect.objectContaining({ cwd: '/tmp/pkg' })
    )
    expect(mockExeca).toHaveBeenNthCalledWith(
      2,
      'npm',
      ['publish', '--access', 'public', '--tag', 'next'],
      expect.objectContaining({ cwd: '/tmp/pkg' })
    )
  })
})
