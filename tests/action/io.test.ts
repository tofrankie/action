import { afterEach, describe, expect, it, vi } from 'vitest'

import { actionLogger, readActionInputs, readTriggerContext, setOutputs } from '@/action/io.js'

const { mockGetInput, mockSetOutput, mockInfo, mockWarning, mockError } = vi.hoisted(() => ({
  mockGetInput: vi.fn(),
  mockSetOutput: vi.fn(),
  mockInfo: vi.fn(),
  mockWarning: vi.fn(),
  mockError: vi.fn(),
}))

vi.mock('@actions/core', () => ({
  getInput: mockGetInput,
  setOutput: mockSetOutput,
  info: mockInfo,
  warning: mockWarning,
  error: mockError,
}))

describe('action/io', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.GITHUB_EVENT_NAME
    delete process.env.GITHUB_REF
    delete process.env.GITHUB_SHA
  })

  it('reads action inputs and parses booleans', () => {
    mockGetInput.mockImplementation((name: string) => {
      const map: Record<string, string> = {
        'github-token': 'ghs_xxx',
        'publish-npm': 'TRUE',
        tag: 'v1.2.3',
        ref: 'refs/heads/main',
        'changelog-path': 'CHANGELOG.md',
        'npm-token': 'npm_xxx',
      }
      return map[name] ?? ''
    })

    const got = readActionInputs()
    expect(got).toEqual({
      githubToken: 'ghs_xxx',
      publishNpm: true,
      tag: 'v1.2.3',
      ref: 'refs/heads/main',
      changelogPathInput: 'CHANGELOG.md',
    })
  })

  it('uses default boolean false when publish-npm is empty', () => {
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'github-token') return 'ghs_xxx'
      return ''
    })

    const got = readActionInputs()
    expect(got.publishNpm).toBe(false)
  })

  it('reads trigger context from env', () => {
    process.env.GITHUB_EVENT_NAME = 'push'
    process.env.GITHUB_REF = 'refs/tags/v1.0.0'
    process.env.GITHUB_SHA = 'abc123'

    expect(readTriggerContext()).toEqual({
      eventName: 'push',
      githubRef: 'refs/tags/v1.0.0',
      sha: 'abc123',
    })
  })

  it('writes outputs with stable keys', () => {
    setOutputs({
      githubReleaseUrl: 'https://github.com/org/repo/releases/tag/v1.0.0',
      npmStatus: 'skipped',
      packageName: '@tofrankie/action',
      version: '1.0.0',
    })

    expect(mockSetOutput).toHaveBeenCalledWith('github-release-url', expect.any(String))
    expect(mockSetOutput).toHaveBeenCalledWith('npm-status', 'skipped')
    expect(mockSetOutput).toHaveBeenCalledWith('resolved-package-name', '@tofrankie/action')
    expect(mockSetOutput).toHaveBeenCalledWith('resolved-version', '1.0.0')
  })

  it('delegates logger methods to actions core', () => {
    const logger = actionLogger()
    logger.info('i')
    logger.warn('w')
    logger.error('e')

    expect(mockInfo).toHaveBeenCalledWith('i')
    expect(mockWarning).toHaveBeenCalledWith('w')
    expect(mockError).toHaveBeenCalledWith('e')
  })
})
