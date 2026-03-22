import { describe, expect, it, vi } from 'vitest'
import { createGitHubReleaseClient } from '@/core/github-client.js'

function createOctokitMock() {
  return {
    rest: {
      repos: {
        getReleaseByTag: vi.fn(),
        createRelease: vi.fn(),
        updateRelease: vi.fn(),
      },
      git: {
        getRef: vi.fn(),
        getTag: vi.fn(),
      },
    },
  }
}

describe('github client', () => {
  it('getReleaseByTag returns null on 404', async () => {
    const octokit = createOctokitMock()
    octokit.rest.repos.getReleaseByTag.mockRejectedValue({ status: 404 })
    const client = createGitHubReleaseClient(octokit as never, { owner: 'o', repo: 'r' })

    await expect(client.getReleaseByTag('v1.0.0')).resolves.toBeNull()
  })

  it('getReleaseByTag throws on non-404', async () => {
    const octokit = createOctokitMock()
    const error = { status: 500, message: 'boom' }
    octokit.rest.repos.getReleaseByTag.mockRejectedValue(error)
    const client = createGitHubReleaseClient(octokit as never, { owner: 'o', repo: 'r' })

    await expect(client.getReleaseByTag('v1.0.0')).rejects.toBe(error)
  })

  it('getTagCommit resolves annotated tag commit', async () => {
    const octokit = createOctokitMock()
    octokit.rest.git.getRef.mockResolvedValue({
      data: { object: { type: 'tag', sha: 'tag-sha' } },
    })
    octokit.rest.git.getTag.mockResolvedValue({
      data: { object: { sha: 'commit-sha' } },
    })
    const client = createGitHubReleaseClient(octokit as never, { owner: 'o', repo: 'r' })

    await expect(client.getTagCommit?.('v1.0.0')).resolves.toBe('commit-sha')
    expect(octokit.rest.git.getTag).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      tag_sha: 'tag-sha',
    })
  })

  it('getTagCommit returns null on 404 and throws on non-404', async () => {
    const octokit404 = createOctokitMock()
    octokit404.rest.git.getRef.mockRejectedValue({ status: 404 })
    const client404 = createGitHubReleaseClient(octokit404 as never, { owner: 'o', repo: 'r' })
    await expect(client404.getTagCommit?.('v1.0.0')).resolves.toBeNull()

    const octokit500 = createOctokitMock()
    const error = { status: 500 }
    octokit500.rest.git.getRef.mockRejectedValue(error)
    const client500 = createGitHubReleaseClient(octokit500 as never, { owner: 'o', repo: 'r' })
    await expect(client500.getTagCommit?.('v1.0.0')).rejects.toBe(error)
  })

  it('getRefCommit normalizes ref and only swallows 404', async () => {
    const octokit = createOctokitMock()
    octokit.rest.git.getRef.mockResolvedValue({
      data: { object: { type: 'commit', sha: 'abc123' } },
    })
    const client = createGitHubReleaseClient(octokit as never, { owner: 'o', repo: 'r' })

    await expect(client.getRefCommit?.('refs/heads/main')).resolves.toBe('abc123')
    expect(octokit.rest.git.getRef).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      ref: 'heads/main',
    })

    octokit.rest.git.getRef.mockRejectedValueOnce({ status: 404 })
    await expect(client.getRefCommit?.('refs/heads/main')).resolves.toBeNull()

    const error = { status: 500 }
    octokit.rest.git.getRef.mockRejectedValueOnce(error)
    await expect(client.getRefCommit?.('refs/heads/main')).rejects.toBe(error)
  })
})
