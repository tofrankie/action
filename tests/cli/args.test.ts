import { describe, expect, it } from 'vitest'
import { parseArgs } from '@/cli.js'

describe('cli parseArgs', () => {
  it('parses full options', () => {
    const got = parseArgs([
      '--token',
      'ghs_xxx',
      '--npm-token',
      'npm_xxx',
      '--tag',
      'v1.2.3',
      '--ref',
      'refs/heads/main',
      '--publish-npm',
      '--yes',
    ])

    expect(got).toEqual({
      token: 'ghs_xxx',
      npmToken: 'npm_xxx',
      tag: 'v1.2.3',
      ref: 'refs/heads/main',
      publishNpm: true,
      yes: true,
    })
  })

  it('supports short yes flag', () => {
    const got = parseArgs(['-y'])
    expect(got.yes).toBe(true)
    expect(got.publishNpm).toBe(false)
  })

  it('keeps defaults when no args', () => {
    const got = parseArgs([])
    expect(got).toEqual({
      token: undefined,
      npmToken: undefined,
      tag: undefined,
      ref: undefined,
      publishNpm: false,
      yes: false,
    })
  })
})
