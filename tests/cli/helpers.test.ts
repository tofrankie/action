import { afterEach, describe, expect, it } from 'vitest'
import { parseRepoFromOrigin, resolveToken } from '@/cli.js'

describe('cli helpers', () => {
  afterEach(() => {
    delete process.env.GITHUB_RELEASE_TOKEN
    delete process.env.GITHUB_TOKEN
  })

  it('resolveToken prefers argv token', () => {
    process.env.GITHUB_RELEASE_TOKEN = 'env_release'
    process.env.GITHUB_TOKEN = 'env_gh'
    expect(resolveToken('argv_token')).toBe('argv_token')
  })

  it('resolveToken falls back by env priority', () => {
    process.env.GITHUB_RELEASE_TOKEN = 'env_release'
    process.env.GITHUB_TOKEN = 'env_gh'
    expect(resolveToken()).toBe('env_release')
  })

  it('resolveToken throws when all missing', () => {
    expect(() => resolveToken()).toThrow('Missing GitHub token')
  })

  it('parseRepoFromOrigin supports ssh', () => {
    expect(parseRepoFromOrigin('git@github.com:tofrankie/action.git')).toEqual({
      owner: 'tofrankie',
      repo: 'action',
    })
  })

  it('parseRepoFromOrigin returns null for unsupported host', () => {
    expect(parseRepoFromOrigin('git@gitlab.com:foo/bar.git')).toBeNull()
  })
})
