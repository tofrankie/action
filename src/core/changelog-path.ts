import fs from 'node:fs/promises'
import path from 'node:path'
import { DomainError } from '@/core/errors.js'

export type ChangelogPathSource = 'input' | 'package-default' | 'root-default'

export interface ChangelogPathResult {
  path: string
  source: ChangelogPathSource
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export async function resolveChangelogPath(params: {
  rootDir: string
  packageDir: string
  isMonorepo: boolean
  changelogPathInput?: string
}): Promise<ChangelogPathResult> {
  const { rootDir, packageDir, isMonorepo, changelogPathInput } = params

  if (changelogPathInput) {
    const resolved = path.resolve(rootDir, changelogPathInput)
    if (!(await exists(resolved))) {
      throw new DomainError('CHANGELOG_NOT_FOUND', `Changelog not found: ${resolved}`)
    }
    return { path: resolved, source: 'input' }
  }

  if (isMonorepo) {
    const packageChangelog = path.join(packageDir, 'CHANGELOG.md')
    if (await exists(packageChangelog)) {
      return { path: packageChangelog, source: 'package-default' }
    }
  }

  const rootChangelog = path.join(rootDir, 'CHANGELOG.md')
  if (await exists(rootChangelog)) {
    return { path: rootChangelog, source: 'root-default' }
  }

  throw new DomainError('CHANGELOG_NOT_FOUND', 'No changelog file found.', {
    hint: 'Create CHANGELOG.md or pass changelog-path input.',
  })
}
