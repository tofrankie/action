const PREFIX = '🐳'

export function formatMessage(message: string): string {
  return message
    .split(/\r?\n/)
    .map(line => `${PREFIX} ${line}`)
    .join('\n')
}
