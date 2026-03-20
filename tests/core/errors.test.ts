import { describe, expect, it } from 'vitest'
import { DomainError, toErrorMessage } from '@/core/errors.js'

describe('errors', () => {
  it('formats DomainError with hint', () => {
    const err = new DomainError('E_CODE', 'Something bad', { hint: 'do this' })
    expect(toErrorMessage(err)).toContain('E_CODE: Something bad (do this)')
  })

  it('formats generic Error', () => {
    expect(toErrorMessage(new Error('plain error'))).toBe('plain error')
  })

  it('formats unknown value', () => {
    expect(toErrorMessage({ a: 1 })).toContain('[object Object]')
  })
})
