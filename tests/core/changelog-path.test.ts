import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveChangelogPath } from '@/core/changelog-path.js'

const tempDirs: string[] = []

async function mkDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'changelog-path-test-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

describe('resolveChangelogPath', () => {
  it('uses explicit input path first', async () => {
    const root = await mkDir()
    const custom = 'docs/CHANGELOG.md'
    await fs.mkdir(path.join(root, 'docs'), { recursive: true })
    await fs.writeFile(path.join(root, custom), '# Changelog', 'utf8')

    const got = await resolveChangelogPath({
      rootDir: root,
      packageDir: root,
      isMonorepo: false,
      changelogPathInput: custom,
    })
    expect(got.source).toBe('input')
  })

  it('uses package changelog for monorepo by default', async () => {
    const root = await mkDir()
    const pkgDir = path.join(root, 'packages/a')
    await fs.mkdir(pkgDir, { recursive: true })
    await fs.writeFile(path.join(pkgDir, 'CHANGELOG.md'), '# package', 'utf8')

    const got = await resolveChangelogPath({
      rootDir: root,
      packageDir: pkgDir,
      isMonorepo: true,
    })
    expect(got.source).toBe('package-default')
  })

  it('falls back to root changelog', async () => {
    const root = await mkDir()
    await fs.writeFile(path.join(root, 'CHANGELOG.md'), '# root', 'utf8')

    const got = await resolveChangelogPath({
      rootDir: root,
      packageDir: path.join(root, 'packages/a'),
      isMonorepo: true,
    })
    expect(got.source).toBe('root-default')
  })

  it('throws when no changelog can be resolved', async () => {
    const root = await mkDir()
    await expect(
      resolveChangelogPath({
        rootDir: root,
        packageDir: path.join(root, 'packages/a'),
        isMonorepo: true,
      })
    ).rejects.toThrow('No changelog file found')
  })
})
