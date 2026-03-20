export class DomainError extends Error {
  public readonly code: string
  public readonly hint?: string
  public readonly context?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    options?: { hint?: string; context?: Record<string, unknown> }
  ) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.hint = options?.hint
    this.context = options?.context
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return `${error.code}: ${error.message}${error.hint ? ` (${error.hint})` : ''}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
