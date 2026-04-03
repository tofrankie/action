export class DomainError extends Error {
  public readonly code: string
  public readonly hint?: string
  public readonly context?: Record<string, unknown>

  constructor(code: string, message: string, options?: { hint?: string; context?: Record<string, unknown> }) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.hint = options?.hint
    this.context = options?.context
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof DomainError) {
    const lines = [`[${error.code}] ${error.message}`]
    if (error.hint) {
      lines.push(`💡 Hint: ${error.hint}`)
    }
    if (error.context && Object.keys(error.context).length > 0) {
      lines.push(`📦 Context: ${JSON.stringify(error.context, null, 2)}`)
    }
    return lines.join('\n')
  }
  if (error instanceof Error) {
    return error.stack ?? error.message
  }
  return String(error)
}
