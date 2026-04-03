import { describe, expect, it } from 'vitest'
import { resolveContext } from '@/core/context.js'

describe('resolveContext', () => {
  it('prefers tag input over trigger ref', () => {
    const got = resolveContext(
      {
        tag: 'manual-v1',
        publishNpm: false,
        githubToken: 'ghs_xxx',
      },
      { eventName: 'push', githubRef: 'refs/tags/v1.0.0' }
    )
    expect(got.tag).toBe('manual-v1')
  })

  it('extracts tag from githubRef if not provided in inputs', () => {
    const got = resolveContext(
      {
        publishNpm: false,
        githubToken: 'ghs_xxx',
      },
      { eventName: 'push', githubRef: 'refs/tags/v2.0.0' }
    )
    expect(got.tag).toBe('v2.0.0')
  })

  it('throws when no tag can be resolved', () => {
    expect(() =>
      resolveContext({ publishNpm: false, githubToken: 'ghs_xxx' }, { eventName: 'workflow_dispatch' })
    ).toThrow('Unable to resolve tag from inputs or GitHub ref.')
  })
})
