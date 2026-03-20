import { describe, expect, it } from 'vitest'
import { resolveContext } from '@/core/context.js'

describe('resolveContext', () => {
  it('resolves tag from input first', () => {
    const got = resolveContext(
      {
        tag: 'v1.0.0',
        publishNpm: false,
        githubToken: 'ghs_xxx',
      },
      { eventName: 'workflow_dispatch', githubRef: 'refs/tags/v0.0.1' }
    )
    expect(got.tag).toBe('v1.0.0')
  })

  it('falls back to tag from github ref', () => {
    const got = resolveContext(
      {
        publishNpm: false,
        githubToken: 'ghs_xxx',
      },
      { eventName: 'push', githubRef: 'refs/tags/v1.2.3' }
    )
    expect(got.tag).toBe('v1.2.3')
  })

  it('throws when publish-npm=true but no npm token', () => {
    expect(() =>
      resolveContext(
        {
          publishNpm: true,
          githubToken: 'ghs_xxx',
        },
        { eventName: 'workflow_dispatch', githubRef: 'refs/tags/v1.2.3' }
      )
    ).toThrow('npm-token')
  })
})
