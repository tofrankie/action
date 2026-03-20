import fs from 'node:fs/promises'
import { DomainError } from '@/core/errors.js'

export interface ChangelogEntry {
  title: string
  body: string
}

function normalizeTitle(rawTitle: string): string {
  const title = rawTitle.trim()
  const bracket = title.match(
    /^\[([^\]]+)\](?:\s*-\s*(?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]))?$/
  )
  if (bracket) return bracket[1].trim()
  const plain = title.match(/^(.+?)(?:\s*-\s*\d{4}-\d{2}-\d{2})?$/)
  return plain ? plain[1].trim() : title
}

export async function readChangelogEntry(params: {
  changelogPath: string
  packageName: string
  version: string
}): Promise<ChangelogEntry> {
  const { changelogPath, packageName, version } = params
  const unscopedName = packageName.split('/').pop() ?? packageName
  const candidates = [
    `${packageName}@${version}`,
    `${unscopedName}@${version}`,
    `v${version}`,
    version,
  ]

  const content = await fs.readFile(changelogPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const headings: Array<{ index: number; raw: string; logical: string }> = []

  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^##\s+(.+)$/)
    if (!m) continue
    const raw = m[1].trim()
    headings.push({ index: i, raw, logical: normalizeTitle(raw) })
  }

  const found = headings.find(item => candidates.includes(item.logical))
  if (!found) {
    throw new DomainError(
      'CHANGELOG_ENTRY_NOT_FOUND',
      `Version entry not found in changelog for ${packageName}@${version}.`
    )
  }

  const next = headings.find(item => item.index > found.index)
  const end = next ? next.index : lines.length
  const body = lines
    .slice(found.index + 1, end)
    .join('\n')
    .trim()

  if (!body) {
    throw new DomainError('CHANGELOG_ENTRY_EMPTY', `Changelog entry is empty for ${found.logical}.`)
  }

  return { title: found.logical, body }
}
