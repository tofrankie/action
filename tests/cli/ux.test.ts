import { describe, expect, it } from 'vitest'
import { formatMessage } from '@/cli/ux.js'

describe('cli ux', () => {
  it('prefixes arbitrary messages', () => {
    expect(formatMessage('Release preview')).toContain('Release preview')
    expect(formatMessage('Release completed')).toContain('Release completed')
    expect(formatMessage('x')).toContain('🐳')
  })
})
