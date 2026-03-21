import { describe, expect, it } from 'vitest'
import { formatMessage } from '@/cli/ux.js'

describe('cli ux', () => {
  it('prefixes arbitrary messages', () => {
    expect(formatMessage('GitHub Release preview')).toContain('GitHub Release preview')
    expect(formatMessage('GitHub Release completed')).toContain('GitHub Release completed')
    expect(formatMessage('x')).toContain('🐳')
  })

  it('prefixes every line of multiline messages', () => {
    expect(formatMessage('a\nb')).toBe('🐳 a\n🐳 b')
    expect(formatMessage('  - head:\n  line2')).toBe('🐳   - head:\n🐳   line2')
  })
})
