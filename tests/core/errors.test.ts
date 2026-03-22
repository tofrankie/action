import { describe, expect, it } from 'vitest'
import { DomainError, toErrorMessage } from '@/core/errors.js'

describe('errors', () => {
  it('formats DomainError with hint', () => {
    const err = new DomainError('E_CODE', 'Something bad', { hint: 'do this' })
    expect(toErrorMessage(err)).toBe('[E_CODE] Something bad\n💡 Hint: do this')
  })

  it('formats generic Error', () => {
    expect(toErrorMessage(new Error('plain error'))).toContain('Error: plain error')
  })

  it('formats DomainError with context', () => {
    const err = new DomainError('E_CODE', 'Something bad', {
      context: { tag: 'v1.0.0', packageName: '@acme/pkg' },
    })
    const msg = toErrorMessage(err)
    expect(msg).toContain('[E_CODE] Something bad')
    expect(msg).toContain('📦 Context:')
    expect(msg).toContain('"tag": "v1.0.0"')
    expect(msg).toContain('"packageName": "@acme/pkg"')
  })

  it('formats unknown value', () => {
    expect(toErrorMessage({ a: 1 })).toContain('[object Object]')
  })
})
